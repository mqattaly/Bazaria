import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CreateOrderInput, OrderDetails, ProductUnit } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, Textarea } from '../../components/ui';
import { formatToman, PRODUCT_UNIT_LABELS, persianNumber } from '../catalog/catalog.constants';
import { listProducts } from '../catalog/api';
import { listCustomers } from '../customers/api';
import { useDebouncedValue } from '../catalog/useDebouncedValue';

interface ProductChoice {
  id: string;
  name: string;
  sku: string;
  unit: ProductUnit;
  salePrice: number;
}

interface ComposerLine {
  product: ProductChoice;
  quantity: number;
}

interface CustomerChoice {
  id: string;
  name: string;
  phone: string | null;
}

interface OrderComposerProps {
  initialOrder?: OrderDetails;
  saving: boolean;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (input: CreateOrderInput) => Promise<void>;
}

const MAX_QUANTITY = 2_147_483_647;

function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[٬,\s]/g, '');
}

function parseAmount(value: string): number | null {
  if (!value.trim()) return 0;
  const normalized = normalizeDigits(value);
  if (!/^\d+$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function getLineTotal(product: ProductChoice, quantity: number): number | null {
  const total = product.salePrice * quantity;
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}

export function OrderComposer({ initialOrder, saving, submitLabel, onCancel, onSubmit }: OrderComposerProps) {
  const [productSearchInput, setProductSearchInput] = useState('');
  const productSearch = useDebouncedValue(productSearchInput, 250);
  const [customerSearchInput, setCustomerSearchInput] = useState('');
  const customerSearch = useDebouncedValue(customerSearchInput, 250);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerChoice | null>(initialOrder?.customer ?? null);
  const [lines, setLines] = useState<ComposerLine[]>(() => (initialOrder?.items ?? []).map((item) => ({
    product: {
      id: item.productId,
      name: item.productName,
      sku: item.sku,
      unit: item.unit,
      salePrice: item.unitPrice,
    },
    quantity: item.quantity,
  })));
  const [discountText, setDiscountText] = useState(String(initialOrder?.discount ?? 0));
  const [note, setNote] = useState(initialOrder?.note ?? '');
  const [submitError, setSubmitError] = useState<string>();

  const productQuery = useQuery({
    queryKey: ['order-product-search', productSearch],
    queryFn: ({ signal }) => listProducts({ search: productSearch, isActive: true, page: 1, pageSize: 8 }, signal),
    enabled: productSearch.trim().length > 0,
  });
  const customerQuery = useQuery({
    queryKey: ['order-customer-search', customerSearch],
    queryFn: ({ signal }) => listCustomers({ search: customerSearch, isActive: true, page: 1, pageSize: 8 }, signal),
    enabled: customerSearch.trim().length > 0,
  });

  const lineTotals = lines.map((line) => getLineTotal(line.product, line.quantity));
  const subtotal = lineTotals.every((total): total is number => total !== null)
    ? lineTotals.reduce((sum, total) => sum + total, 0)
    : Number.NaN;
  const safeSubtotal = Number.isSafeInteger(subtotal) && subtotal >= 0;
  const discount = parseAmount(discountText);
  const discountError = !safeSubtotal
    ? 'مبلغ سفارش از محدودهٔ مجاز بیشتر است.'
    : discount === null || discount > subtotal
      ? 'تخفیف باید عدد صحیح نامنفی و حداکثر برابر با جمع اقلام باشد.'
      : undefined;
  const discountInvalid = discountError !== undefined;
  const total = discount === null || discountInvalid ? null : subtotal - discount;

  function addProduct(product: ProductChoice): void {
    const existing = lines.find((line) => line.product.id === product.id);
    const quantity = (existing?.quantity ?? 0) + 1;
    if (quantity > MAX_QUANTITY || getLineTotal(product, quantity) === null) {
      setSubmitError('جمع مبلغ سفارش از محدودهٔ مجاز بیشتر می‌شود.');
      return;
    }
    setSubmitError(undefined);
    setLines((current) => {
      const match = current.find((line) => line.product.id === product.id);
      if (match) return current.map((line) => line.product.id === product.id ? { ...line, product, quantity } : line);
      return [...current, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, delta: -1 | 1): void {
    const current = lines.find((line) => line.product.id === productId);
    if (!current) return;
    const nextQuantity = current.quantity + delta;
    if (nextQuantity < 1 || nextQuantity > MAX_QUANTITY || getLineTotal(current.product, nextQuantity) === null) return;
    setSubmitError(undefined);
    setLines((items) => items.map((line) => line.product.id === productId ? { ...line, quantity: nextQuantity } : line));
  }

  function removeProduct(productId: string): void {
    setLines((items) => items.filter((line) => line.product.id !== productId));
    setSubmitError(undefined);
  }

  function chooseCustomer(customer: CustomerChoice): void {
    setSelectedCustomer(customer);
    setCustomerSearchInput('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitError(undefined);
    if (lines.length === 0) {
      setSubmitError('برای ثبت سفارش، دست‌کم یک محصول اضافه کنید.');
      return;
    }
    if (!safeSubtotal) {
      setSubmitError('مبلغ سفارش از محدودهٔ مجاز بیشتر است.');
      return;
    }
    if (discountInvalid || discount === null) {
      setSubmitError('تخفیف را به‌صورت عدد صحیح و حداکثر برابر با جمع اقلام وارد کنید.');
      return;
    }

    try {
      await onSubmit({
        customerId: selectedCustomer?.id ?? null,
        items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        discount,
        note: note.trim() || null,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'ذخیرهٔ سفارش انجام نشد. دوباره تلاش کنید.');
    }
  }

  return (
    <form className="grid gap-5" onSubmit={(event) => { void handleSubmit(event); }}>
      <Card as="section" aria-labelledby="order-customer-heading" className="grid gap-4" padded>
        <div>
          <h2 className="text-base font-bold text-foreground" id="order-customer-heading">مشتری <span className="text-xs font-normal text-muted">(اختیاری)</span></h2>
          <p className="mt-1 text-xs leading-5 text-muted">برای ثبت سفارش، انتخاب مشتری الزامی نیست.</p>
        </div>
        {selectedCustomer ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/50 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Icon name="users" size={18} /></span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{selectedCustomer.name}</p>
                {selectedCustomer.phone ? <bdi className="mt-0.5 block text-xs text-muted" dir="ltr">{selectedCustomer.phone}</bdi> : null}
              </div>
            </div>
            <Button disabled={saving} onClick={() => setSelectedCustomer(null)} size="sm" variant="outline">حذف مشتری</Button>
          </div>
        ) : (
          <>
            <Input
              autoComplete="off"
              label="جستجوی مشتری"
              onChange={(event) => setCustomerSearchInput(event.currentTarget.value)}
              placeholder="نام یا شماره تماس"
              startIcon="search"
              type="search"
              value={customerSearchInput}
            />
            {customerSearch.trim().length > 0 && customerQuery.isPending ? <LoadingState compact label="در حال جستجوی مشتری…" /> : null}
            {customerSearch.trim().length > 0 && customerQuery.isError ? (
              <ErrorState compact description="جستجوی مشتری انجام نشد." onRetry={() => { void customerQuery.refetch(); }} />
            ) : null}
            {customerQuery.data && customerSearch.trim().length > 0 ? (
              customerQuery.data.items.length > 0 ? (
                <ul aria-label="نتایج جستجوی مشتریان" className="grid gap-2 sm:grid-cols-2">
                  {customerQuery.data.items.map((customer) => (
                    <li key={customer.id}>
                      <button
                        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 text-start transition-colors hover:border-primary/40 hover:bg-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-60"
                        disabled={saving}
                        onClick={() => chooseCustomer({ id: customer.id, name: customer.name, phone: customer.phone })}
                        type="button"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">{customer.name}</span>
                          {customer.phone ? <bdi className="mt-0.5 block text-xs text-muted" dir="ltr">{customer.phone}</bdi> : null}
                        </span>
                        <Icon className="shrink-0 text-primary" name="plus" size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState compact description="عبارت دیگری را امتحان کنید." icon="users" title="مشتری‌ای پیدا نشد" />
            ) : null}
          </>
        )}
      </Card>

      <Card as="section" aria-labelledby="order-products-heading" className="grid gap-4" padded>
        <div>
          <h2 className="text-base font-bold text-foreground" id="order-products-heading">اقلام سفارش</h2>
          <p className="mt-1 text-xs leading-5 text-muted">قیمت‌های فعلی سرور هنگام ذخیرهٔ سفارش محاسبه می‌شوند.</p>
        </div>
        <Input
          autoComplete="off"
          label="جستجوی محصول"
          onChange={(event) => setProductSearchInput(event.currentTarget.value)}
          placeholder="نام محصول یا کد کالا"
          startIcon="search"
          type="search"
          value={productSearchInput}
        />
        {productSearch.trim().length > 0 && productQuery.isPending ? <LoadingState compact label="در حال جستجوی محصولات…" /> : null}
        {productSearch.trim().length > 0 && productQuery.isError ? (
          <ErrorState compact description="جستجوی محصولات انجام نشد." onRetry={() => { void productQuery.refetch(); }} />
        ) : null}
        {productSearch.trim().length > 0 && productQuery.data ? (
          productQuery.data.items.length > 0 ? (
            <ul aria-label="نتایج جستجوی محصولات" className="grid gap-2 sm:grid-cols-2">
              {productQuery.data.items.map((product) => (
                <li key={product.id}>
                  <div className="flex min-h-[4.5rem] items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <bdi dir="ltr">{product.sku}</bdi>
                        <span aria-hidden="true">·</span>
                        <span>{formatToman(product.salePrice)}</span>
                      </div>
                    </div>
                    <Button
                      aria-label={`افزودن ${product.name} به سفارش`}
                      disabled={saving}
                      onClick={() => addProduct({
                        id: product.id,
                        name: product.name,
                        sku: product.sku,
                        unit: product.unit,
                        salePrice: product.salePrice,
                      })}
                      size="sm"
                      variant="outline"
                    >
                      <Icon name="plus" size={16} />افزودن
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState compact description="نام یا کد کالای دیگری را جستجو کنید." title="محصول فعالی پیدا نشد" />
        ) : productSearch.trim().length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-3 text-xs leading-5 text-muted">برای افزودن اقلام، نام محصول یا کد کالا را جستجو کنید.</p>
        ) : null}

        {lines.length > 0 ? (
          <div className="grid gap-2" aria-label="اقلام انتخاب‌شدهٔ سفارش">
            <h3 className="text-sm font-semibold text-foreground">محصولات انتخاب‌شده</h3>
            {lines.map((line, index) => {
              const lineTotal = lineTotals[index];
              const maxByAmount = line.product.salePrice > 0
                ? Math.floor(Number.MAX_SAFE_INTEGER / line.product.salePrice)
                : MAX_QUANTITY;
              const maxQuantity = Math.min(MAX_QUANTITY, maxByAmount);
              return (
                <article className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center" key={line.product.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{line.product.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <bdi dir="ltr">{line.product.sku}</bdi>
                      <span aria-hidden="true">·</span>
                      <span>{PRODUCT_UNIT_LABELS[line.product.unit]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatToman(line.product.salePrice)} برای هر {PRODUCT_UNIT_LABELS[line.product.unit]}</span>
                    </p>
                  </div>
                  <div aria-label={`تعداد ${line.product.name}`} className="flex w-fit items-center gap-2 rounded-xl border border-border p-1" role="group">
                    <Button
                      aria-label={`کاهش تعداد ${line.product.name}`}
                      disabled={saving || line.quantity <= 1}
                      onClick={() => changeQuantity(line.product.id, -1)}
                      size="sm"
                      variant="ghost"
                    >−</Button>
                    <output className="min-w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                      {persianNumber.format(line.quantity)}
                    </output>
                    <Button
                      aria-label={`افزایش تعداد ${line.product.name}`}
                      disabled={saving || line.quantity >= maxQuantity}
                      onClick={() => changeQuantity(line.product.id, 1)}
                      size="sm"
                      variant="ghost"
                    >+</Button>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <bdi className="text-sm font-bold text-foreground">{lineTotal === null ? '—' : formatToman(lineTotal)}</bdi>
                    <button
                      aria-label={`حذف ${line.product.name} از سفارش`}
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      disabled={saving}
                      onClick={() => removeProduct(line.product.id)}
                      type="button"
                    ><Icon name="close" size={18} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState compact description="از جستجوی بالا یک محصول انتخاب کنید." icon="box" title="هنوز محصولی به سفارش اضافه نشده است" />
        )}
      </Card>

      <Card as="section" aria-labelledby="order-totals-heading" className="grid gap-4" padded>
        <h2 className="text-base font-bold text-foreground" id="order-totals-heading">جمع سفارش</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            dir="ltr"
            inputMode="numeric"
            error={discountText.trim().length > 0 && discountInvalid ? discountError : undefined}
            label="تخفیف (تومان)"
            onChange={(event) => {
              setDiscountText(event.currentTarget.value);
              setSubmitError(undefined);
            }}
            placeholder="۰"
            type="text"
            value={discountText}
          />
          <div aria-live="polite" className="grid gap-2 rounded-xl bg-surface-muted p-4 text-sm" role="status">
            <div className="flex items-center justify-between gap-3 text-muted"><span>جمع اقلام</span><bdi className="font-semibold text-foreground">{safeSubtotal ? formatToman(subtotal) : '—'}</bdi></div>
            <div className="flex items-center justify-between gap-3 text-muted"><span>تخفیف</span><bdi className="font-semibold text-foreground">{discount === null ? '—' : formatToman(discount)}</bdi></div>
            <div className="my-1 border-t border-border" />
            <div className="flex items-center justify-between gap-3 text-foreground"><span className="font-bold">مبلغ نهایی</span><bdi className="text-base font-extrabold">{total === null ? '—' : formatToman(total)}</bdi></div>
          </div>
        </div>
        <Textarea
          label="یادداشت سفارش"
          maxLength={2000}
          onChange={(event) => setNote(event.currentTarget.value)}
          placeholder="یادداشت اختیاری برای این سفارش…"
          rows={3}
          value={note}
        />
      </Card>

      {submitError ? <p className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{submitError}</p> : null}
      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
        {onCancel ? <Button disabled={saving} onClick={onCancel} variant="outline">انصراف از ویرایش</Button> : null}
        <Button disabled={saving || lines.length === 0 || !safeSubtotal || discountInvalid} loading={saving} type="submit">
          {submitLabel}
        </Button>
      </div>
      <p className="text-xs leading-5 text-muted">مبلغ و مشخصات محصول در سرور دوباره بررسی می‌شوند؛ مبالغ قابل ثبت به‌صورت عدد صحیح تومان هستند.</p>
    </form>
  );
}
