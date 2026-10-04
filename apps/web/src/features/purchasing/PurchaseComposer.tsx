import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CreatePurchaseInput, ProductUnit, PurchaseDetails, SupplierSummary } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, Textarea } from '../../components/ui';
import { formatToman, PRODUCT_UNIT_LABELS } from '../catalog/catalog.constants';
import { listProducts } from '../catalog/api';
import { useDebouncedValue } from '../catalog/useDebouncedValue';
import { getSupplier, listSuppliers } from './api';
import { normalizePurchaseDigits, parsePurchaseInteger } from './purchasing.constants';

interface ProductChoice {
  id: string;
  name: string;
  sku: string;
  unit: ProductUnit;
  purchasePrice: number | null;
}

interface ComposerLine {
  product: ProductChoice;
  quantityText: string;
  quantity: number | null;
  unitPriceText: string;
  unitPrice: number | null;
}

interface PurchaseComposerProps {
  initialPurchase?: PurchaseDetails;
  initialSupplierId?: string;
  saving: boolean;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (input: CreatePurchaseInput) => Promise<void>;
}

const MAX_SAFE_AMOUNT = Number.MAX_SAFE_INTEGER;
const MAX_ITEMS = 100;

function lineFromPurchase(purchase: PurchaseDetails): ComposerLine[] {
  return purchase.items.map((item) => ({
    product: {
      id: item.productId,
      name: item.productNameSnapshot,
      sku: item.productSkuSnapshot,
      unit: item.unitSnapshot,
      purchasePrice: item.unitPrice,
    },
    quantityText: String(item.quantity),
    quantity: item.quantity,
    unitPriceText: String(item.unitPrice),
    unitPrice: item.unitPrice,
  }));
}

function supplierFromPurchase(purchase: PurchaseDetails): SupplierSummary {
  return purchase.supplier;
}

function initialLine(product: ProductChoice): ComposerLine {
  const unitPrice = product.purchasePrice ?? 0;
  return {
    product,
    quantityText: '1',
    quantity: 1,
    unitPriceText: String(unitPrice),
    unitPrice,
  };
}

function calculateLineTotal(line: ComposerLine): number | null {
  if (!Number.isSafeInteger(line.quantity) || (line.quantity ?? 0) <= 0) return null;
  if (!Number.isSafeInteger(line.unitPrice) || (line.unitPrice ?? -1) < 0) return null;
  const total = line.quantity! * line.unitPrice!;
  return Number.isSafeInteger(total) && total <= MAX_SAFE_AMOUNT ? total : null;
}

export function PurchaseComposer({
  initialPurchase,
  initialSupplierId,
  saving,
  submitLabel,
  onCancel,
  onSubmit,
}: PurchaseComposerProps) {
  const [supplierSearchInput, setSupplierSearchInput] = useState('');
  const supplierSearch = useDebouncedValue(supplierSearchInput, 250);
  const [productSearchInput, setProductSearchInput] = useState('');
  const productSearch = useDebouncedValue(productSearchInput, 250);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(() => initialPurchase ? supplierFromPurchase(initialPurchase) : null);
  const [lines, setLines] = useState<ComposerLine[]>(() => initialPurchase ? lineFromPurchase(initialPurchase) : []);
  const [discountText, setDiscountText] = useState(String(initialPurchase?.discount ?? 0));
  const [note, setNote] = useState(initialPurchase?.note ?? '');
  const [submitError, setSubmitError] = useState<string>();
  const preselectedSupplierQuery = useQuery({
    queryKey: ['supplier', initialSupplierId],
    queryFn: ({ signal }) => getSupplier(initialSupplierId!, signal),
    enabled: Boolean(initialSupplierId && !initialPurchase),
  });
  const supplierQuery = useQuery({
    queryKey: ['purchase-supplier-search', supplierSearch],
    queryFn: ({ signal }) => listSuppliers({ search: supplierSearch, status: 'active', page: 1, pageSize: 8 }, signal),
    enabled: supplierSearch.trim().length > 0,
  });
  const productQuery = useQuery({
    queryKey: ['purchase-product-search', productSearch],
    queryFn: ({ signal }) => listProducts({ search: productSearch, isActive: true, page: 1, pageSize: 8 }, signal),
    enabled: productSearch.trim().length > 0,
  });

  useEffect(() => {
    const supplier = preselectedSupplierQuery.data;
    if (supplier && !selectedSupplier) {
      setSelectedSupplier({
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        email: supplier.email,
        isActive: supplier.isActive,
      });
    }
  }, [preselectedSupplierQuery.data, selectedSupplier]);

  const lineTotals = useMemo(() => lines.map(calculateLineTotal), [lines]);
  let subtotal: number | null = 0;
  for (const lineTotal of lineTotals) {
    if (lineTotal === null || subtotal === null || lineTotal > MAX_SAFE_AMOUNT - subtotal) {
      subtotal = null;
      break;
    }
    subtotal += lineTotal;
  }
  const discount = discountText.trim() ? parsePurchaseInteger(discountText) : 0;
  const discountError = subtotal === null
    ? 'جمع اقلام از محدودهٔ امن مبلغ بیشتر است.'
    : discount === null || discount > subtotal
      ? 'تخفیف باید عدد صحیح نامنفی و حداکثر برابر با جمع اقلام باشد.'
      : undefined;
  const total = subtotal === null || discount === null || discountError ? null : subtotal - discount;

  function chooseSupplier(supplier: SupplierSummary): void {
    setSelectedSupplier(supplier);
    setSupplierSearchInput('');
    setSubmitError(undefined);
  }

  function addProduct(product: ProductChoice): void {
    const existing = lines.find((line) => line.product.id === product.id);
    if (existing) {
      const quantity = existing.quantity === null ? null : existing.quantity + 1;
      const updated = { ...existing, quantity, quantityText: quantity === null ? existing.quantityText : String(quantity) };
      if (calculateLineTotal(updated) === null) {
        setSubmitError('تعداد یا مبلغ این محصول از محدودهٔ مجاز بیشتر می‌شود.');
        return;
      }
      setLines((current) => current.map((line) => line.product.id === product.id ? updated : line));
    } else {
      if (lines.length >= MAX_ITEMS) {
        setSubmitError('هر خرید حداکثر می‌تواند ۱۰۰ محصول متفاوت داشته باشد.');
        return;
      }
      setLines((current) => [...current, initialLine(product)]);
    }
    setProductSearchInput('');
    setSubmitError(undefined);
  }

  function updateQuantity(productId: string, value: string): void {
    const normalized = normalizePurchaseDigits(value);
    const quantity = /^\d+$/.test(normalized) ? Number(normalized) : null;
    setLines((current) => current.map((line) => line.product.id === productId
      ? { ...line, quantityText: value, quantity: Number.isSafeInteger(quantity) ? quantity : null }
      : line));
    setSubmitError(undefined);
  }

  function updateUnitPrice(productId: string, value: string): void {
    const unitPrice = value.trim() ? parsePurchaseInteger(value) : null;
    setLines((current) => current.map((line) => line.product.id === productId
      ? { ...line, unitPriceText: value, unitPrice }
      : line));
    setSubmitError(undefined);
  }

  function removeLine(productId: string): void {
    setLines((current) => current.filter((line) => line.product.id !== productId));
    setSubmitError(undefined);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitError(undefined);
    if (!selectedSupplier) {
      setSubmitError('ابتدا یک تأمین‌کنندهٔ فعال انتخاب کنید.');
      return;
    }
    if (!selectedSupplier.isActive) {
      setSubmitError('تأمین‌کنندهٔ انتخاب‌شده غیرفعال است؛ ابتدا آن را دوباره فعال کنید.');
      return;
    }
    if (lines.length === 0) {
      setSubmitError('برای ثبت خرید دست‌کم یک محصول اضافه کنید.');
      return;
    }
    if (lineTotals.some((value) => value === null) || subtotal === null) {
      setSubmitError('تعداد یا مبلغ یکی از اقلام معتبر نیست یا از محدودهٔ امن بیشتر است.');
      return;
    }
    if (discountError || discount === null) {
      setSubmitError(discountError ?? 'تخفیف معتبر نیست.');
      return;
    }
    if (note.length > 2000) {
      setSubmitError('یادداشت نمی‌تواند بیشتر از ۲۰۰۰ نویسه باشد.');
      return;
    }

    try {
      await onSubmit({
        supplierId: selectedSupplier.id,
        items: lines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity!,
          unitPrice: line.unitPrice!,
        })),
        discount,
        note: note.trim() || null,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'ذخیرهٔ خرید انجام نشد. دوباره تلاش کنید.');
    }
  }

  return (
    <form className="grid gap-5" noValidate onSubmit={(event) => { void handleSubmit(event); }}>
      <Card as="section" aria-labelledby="purchase-supplier-heading" className="grid gap-4" padded>
        <div>
          <h2 className="text-base font-bold text-foreground" id="purchase-supplier-heading">تأمین‌کننده <span className="text-xs font-normal text-danger">*</span></h2>
          <p className="mt-1 text-xs leading-5 text-muted">فقط تأمین‌کنندگان فعال را می‌توان برای خرید جدید انتخاب کرد.</p>
        </div>
        {selectedSupplier ? (
          <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/50 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Icon name="users" size={18} /></span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{selectedSupplier.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {selectedSupplier.phone ? <bdi className="text-xs text-muted" dir="ltr">{selectedSupplier.phone}</bdi> : null}
                  <Badge variant={selectedSupplier.isActive ? 'success' : 'neutral'}>{selectedSupplier.isActive ? 'فعال' : 'غیرفعال'}</Badge>
                </div>
                {!selectedSupplier.isActive ? <p className="mt-1 text-xs text-danger">برای ثبت خرید، تأمین‌کننده باید فعال باشد.</p> : null}
              </div>
            </div>
            <Button disabled={saving} onClick={() => setSelectedSupplier(null)} size="sm" variant="outline">تغییر تأمین‌کننده</Button>
          </div>
        ) : (
          <>
            <Input
              autoComplete="off"
              label="جستجوی تأمین‌کننده"
              onChange={(event) => setSupplierSearchInput(event.currentTarget.value)}
              placeholder="نام، تلفن یا ایمیل"
              startIcon="search"
              type="search"
              value={supplierSearchInput}
            />
            {preselectedSupplierQuery.isError ? <ErrorState compact description="دریافت تأمین‌کنندهٔ انتخاب‌شده انجام نشد." onRetry={() => { void preselectedSupplierQuery.refetch(); }} /> : null}
            {supplierSearch.trim() && supplierQuery.isPending ? <LoadingState compact label="در حال جستجوی تأمین‌کنندگان…" /> : null}
            {supplierSearch.trim() && supplierQuery.isError ? <ErrorState compact description="جستجوی تأمین‌کننده انجام نشد." onRetry={() => { void supplierQuery.refetch(); }} /> : null}
            {supplierQuery.data && supplierSearch.trim() ? (
              supplierQuery.data.items.length > 0 ? (
                <ul aria-label="نتایج جستجوی تأمین‌کنندگان" className="grid gap-2 sm:grid-cols-2">
                  {supplierQuery.data.items.map((supplier) => (
                    <li key={supplier.id}>
                      <button
                        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 text-start transition-colors hover:border-primary/40 hover:bg-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-60"
                        disabled={saving}
                        onClick={() => chooseSupplier({ id: supplier.id, name: supplier.name, phone: supplier.phone, email: supplier.email, isActive: supplier.isActive })}
                        type="button"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">{supplier.name}</span>
                          {supplier.phone ? <bdi className="mt-0.5 block text-xs text-muted" dir="ltr">{supplier.phone}</bdi> : null}
                        </span>
                        <Icon className="shrink-0 text-primary" name="plus" size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState compact description="عبارت دیگری را جستجو کنید یا ابتدا تأمین‌کننده را ثبت کنید." icon="users" title="تأمین‌کننده‌ای پیدا نشد" />
            ) : null}
          </>
        )}
      </Card>

      <Card as="section" aria-labelledby="purchase-items-heading" className="grid gap-4" padded>
        <div>
          <h2 className="text-base font-bold text-foreground" id="purchase-items-heading">اقلام خرید</h2>
          <p className="mt-1 text-xs leading-5 text-muted">قیمت خرید به تومان است. جمع و مبلغ نهایی در سرور محاسبه و اعتبارسنجی می‌شوند.</p>
        </div>
        <Input
          autoComplete="off"
          label="جستجوی محصول فعال"
          onChange={(event) => setProductSearchInput(event.currentTarget.value)}
          placeholder="نام یا کد محصول"
          startIcon="search"
          type="search"
          value={productSearchInput}
        />
        {productSearch.trim() && productQuery.isPending ? <LoadingState compact label="در حال جستجوی محصولات…" /> : null}
        {productSearch.trim() && productQuery.isError ? <ErrorState compact description="جستجوی محصول انجام نشد." onRetry={() => { void productQuery.refetch(); }} /> : null}
        {productQuery.data && productSearch.trim() ? (
          productQuery.data.items.length > 0 ? (
            <ul aria-label="نتایج جستجوی محصولات" className="grid gap-2 sm:grid-cols-2">
              {productQuery.data.items.map((product) => (
                <li key={product.id}>
                  <button
                    className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-start transition-colors hover:border-primary/40 hover:bg-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-60"
                    disabled={saving}
                    onClick={() => addProduct({
                      id: product.id,
                      name: product.name,
                      sku: product.sku,
                      unit: product.unit,
                      purchasePrice: product.purchasePrice,
                    })}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{product.name}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                        <bdi dir="ltr">{product.sku}</bdi>
                        <span>{PRODUCT_UNIT_LABELS[product.unit]}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-end">
                      <span className="block text-xs text-muted">قیمت پیش‌فرض</span>
                      <bdi className="text-xs font-semibold text-foreground">{product.purchasePrice === null ? 'ثبت نشده' : formatToman(product.purchasePrice)}</bdi>
                    </span>
                    <Icon className="shrink-0 text-primary" name="plus" size={18} />
                  </button>
                </li>
              ))}
            </ul>
          ) : <EmptyState compact description="عبارت دیگری را امتحان کنید." icon="box" title="محصول فعالی پیدا نشد" />
        ) : null}

        {lines.length === 0 ? (
          <EmptyState compact description="برای شروع، یک محصول فعال را جستجو و اضافه کنید." icon="box" title="هنوز محصولی به خرید اضافه نشده است" />
        ) : (
          <div className="grid gap-3" aria-label="اقلام انتخاب‌شده">
            {lines.map((line, index) => {
              const lineTotal = lineTotals[index];
              const quantityInvalid = line.quantity === null || line.quantity <= 0;
              const priceInvalid = line.unitPrice === null;
              return (
                <article className="grid gap-3 rounded-xl border border-border bg-surface p-3 sm:grid-cols-[minmax(10rem,1.3fr)_minmax(7rem,0.7fr)_minmax(8rem,0.8fr)_minmax(8rem,0.8fr)_auto] sm:items-end" key={line.product.id}>
                  <div className="min-w-0 sm:pb-2">
                    <h3 className="truncate text-sm font-bold text-foreground">{line.product.name}</h3>
                    <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                      <bdi dir="ltr">{line.product.sku}</bdi>
                      <span>{PRODUCT_UNIT_LABELS[line.product.unit]}</span>
                    </p>
                  </div>
                  <Input
                    error={quantityInvalid ? 'تعداد باید عدد صحیح مثبت باشد.' : undefined}
                    inputMode="numeric"
                    label="تعداد"
                    min={1}
                    onChange={(event) => updateQuantity(line.product.id, event.currentTarget.value)}
                    value={line.quantityText}
                  />
                  <Input
                    dir="ltr"
                    error={priceInvalid ? 'قیمت باید عدد صحیح نامنفی باشد.' : undefined}
                    inputMode="numeric"
                    label="قیمت خرید (تومان)"
                    min={0}
                    onChange={(event) => updateUnitPrice(line.product.id, event.currentTarget.value)}
                    value={line.unitPriceText}
                  />
                  <div className="grid gap-1 sm:pb-2">
                    <span className="text-xs font-medium text-muted">جمع قلم</span>
                    <bdi className="text-sm font-bold text-foreground">{lineTotal === null ? '—' : formatToman(lineTotal)}</bdi>
                  </div>
                  <Button aria-label={`حذف ${line.product.name} از خرید`} className="justify-self-end sm:mb-0.5" onClick={() => removeLine(line.product.id)} size="sm" variant="ghost">
                    <Icon name="close" size={17} />حذف
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <Card as="section" aria-labelledby="purchase-total-heading" className="grid gap-4" padded>
        <h2 className="text-base font-bold text-foreground" id="purchase-total-heading">جمع‌بندی خرید</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            dir="ltr"
            error={discountError}
            inputMode="numeric"
            label="تخفیف (تومان)"
            onChange={(event) => setDiscountText(event.currentTarget.value)}
            value={discountText}
          />
          <div className="grid content-center gap-2 rounded-xl bg-surface-muted/60 p-3">
            <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted">جمع اقلام</span><bdi className="font-semibold text-foreground">{subtotal === null ? '—' : formatToman(subtotal)}</bdi></div>
            <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted">تخفیف</span><bdi className="font-semibold text-foreground">{discount === null ? '—' : formatToman(discount)}</bdi></div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-2 text-sm"><span className="font-bold text-foreground">مبلغ نهایی</span><bdi className="font-extrabold text-foreground">{total === null ? '—' : formatToman(total)}</bdi></div>
          </div>
        </div>
        <Textarea
          label="یادداشت خرید"
          maxLength={2000}
          onChange={(event) => setNote(event.currentTarget.value)}
          placeholder="یادداشت داخلی (اختیاری)"
          rows={3}
          value={note}
        />
        {submitError ? <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{submitError}</p> : null}
        <div className="flex flex-col-reverse justify-end gap-2 border-t border-border pt-4 sm:flex-row">
          {onCancel ? <Button disabled={saving} onClick={onCancel} variant="outline">بازگشت</Button> : null}
          <Button loading={saving} type="submit"><Icon name="check" size={17} />{submitLabel}</Button>
        </div>
      </Card>
    </form>
  );
}
