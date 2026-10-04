import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { CreateStockMovementInput, StockMovement, StockMovementType, StockMovementListQuery } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Badge, Breadcrumb, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Pagination, Select, Table, type TableColumn } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { PRODUCT_UNIT_LABELS } from '../catalog/catalog.constants';
import { StockMovementDialog, parseStockQuantity } from './StockMovementDialog';
import { createStockMovement, getInventoryItem, listStockMovements, updateMinimumQuantity } from './api';
import { formatInventoryDate, inventoryNumber, inventoryStatusLabels, inventoryStatusVariants, movementTypeLabels } from './inventory.constants';

const historyPageSize = 10;
const movementTypes: readonly StockMovementType[] = ['IN', 'OUT', 'ADJUSTMENT'];
type MovementFilter = '' | StockMovementType;

function movementSign(movement: StockMovement): string {
  if (movement.type === 'IN') return '+';
  if (movement.type === 'OUT') return '−';
  if (movement.afterQuantity > movement.beforeQuantity) return '+';
  if (movement.afterQuantity < movement.beforeQuantity) return '−';
  return '';
}

function MovementTypeBadge({ type }: { type: StockMovementType }) {
  const variant = type === 'IN' ? 'success' : type === 'OUT' ? 'warning' : 'info';
  return <Badge variant={variant}>{movementTypeLabels[type]}</Badge>;
}

export function InventoryDetailsPage() {
  const { productId = '' } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [movementType, setMovementType] = useState<StockMovementType>();
  const [minimumDraft, setMinimumDraft] = useState('');
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('');
  const [historyPage, setHistoryPage] = useState(1);

  const inventoryQuery = useQuery({
    queryKey: ['inventory-item', productId],
    queryFn: ({ signal }) => getInventoryItem(productId, signal),
    enabled: Boolean(productId),
  });
  const item = inventoryQuery.data;
  useEffect(() => {
    if (item) setMinimumDraft(String(item.minimumQuantity));
  }, [item]);

  const movementQuery = useMemo<StockMovementListQuery>(() => ({
    ...(movementFilter ? { type: movementFilter } : {}),
    page: historyPage,
    pageSize: historyPageSize,
  }), [historyPage, movementFilter]);
  const historyQuery = useQuery({
    queryKey: ['inventory-movements', productId, movementQuery],
    queryFn: ({ signal }) => listStockMovements(productId, movementQuery, signal),
    enabled: Boolean(productId && item),
    placeholderData: keepPreviousData,
  });

  const minimumMutation = useMutation({
    mutationFn: ({ id, minimumQuantity }: { id: string; minimumQuantity: number }) => updateMinimumQuantity(id, { minimumQuantity }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['inventory-item', productId], updated);
      setMinimumDraft(String(updated.minimumQuantity));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-item', productId] }),
      ]);
      toast.success('حداقل موجودی به‌روزرسانی شد.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'ویرایش حداقل موجودی انجام نشد.'),
  });
  const movementMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateStockMovementInput }) => createStockMovement(id, input),
    onSuccess: async (result) => {
      queryClient.setQueryData(['inventory-item', productId], result.inventory);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-item', productId] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-movements', productId] }),
      ]);
      toast.success('گردش موجودی ثبت شد.');
    },
  });

  const parsedMinimum = parseStockQuantity(minimumDraft);
  const minimumError = minimumDraft.trim() && parsedMinimum === null
    ? 'حداقل موجودی باید عدد صحیح صفر یا بیشتر باشد.'
    : undefined;

  async function saveMinimum(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!item || parsedMinimum === null || minimumError || parsedMinimum === item.minimumQuantity) return;
    await minimumMutation.mutateAsync({ id: item.product.id, minimumQuantity: parsedMinimum });
  }

  async function saveMovement(input: CreateStockMovementInput): Promise<void> {
    if (!item) return;
    await movementMutation.mutateAsync({ id: item.product.id, input });
    setMovementType(undefined);
  }

  const movementColumns = useMemo<readonly TableColumn<StockMovement>[]>(() => [
    {
      id: 'createdAt',
      header: 'زمان',
      cell: (movement) => <time className="text-xs text-muted" dateTime={movement.createdAt}>{formatInventoryDate(movement.createdAt)}</time>,
    },
    { id: 'type', header: 'نوع گردش', cell: (movement) => <MovementTypeBadge type={movement.type} /> },
    {
      id: 'quantity',
      header: 'تغییر',
      cell: (movement) => (
        <span className="font-bold text-foreground">
          {movementSign(movement)}{inventoryNumber.format(movement.quantity)} <span className="text-xs font-normal text-muted">{item ? PRODUCT_UNIT_LABELS[item.product.unit] : ''}</span>
        </span>
      ),
    },
    {
      id: 'snapshot',
      header: 'قبل ← بعد',
      cell: (movement) => (
        <span className="text-xs">
          {inventoryNumber.format(movement.beforeQuantity)} <span className="text-muted">←</span> <strong>{inventoryNumber.format(movement.afterQuantity)}</strong>
        </span>
      ),
    },
    { id: 'note', header: 'یادداشت', cell: (movement) => movement.note || <span className="text-muted">—</span> },
  ], [item]);

  if (inventoryQuery.isPending) return <LoadingState label="در حال دریافت اطلاعات موجودی…" />;
  if (inventoryQuery.isError || !item) {
    return (
      <ErrorState
        description="دریافت موجودی محصول با مشکل مواجه شد. ممکن است محصول حذف شده باشد."
        onRetry={() => { void inventoryQuery.refetch(); }}
        title="اطلاعات موجودی در دسترس نیست"
      />
    );
  }

  return (
    <div className="grid gap-6 sm:gap-7">
      <Breadcrumb items={[
        { label: 'خانه', to: '/dashboard' },
        { label: 'موجودی انبار', to: '/inventory' },
        { label: item.product.name },
      ]} />
      <PageHeader
        actions={
          <>
            <Badge size="md" variant={item.product.isActive ? 'success' : 'neutral'}>{item.product.isActive ? 'محصول فعال' : 'محصول غیرفعال'}</Badge>
            {movementTypes.map((type) => (
              <Button
                aria-label={`${movementTypeLabels[type]} ${item.product.name}`}
                disabled={!item.product.isActive || movementMutation.isPending}
                key={type}
                onClick={() => setMovementType(type)}
                size="sm"
                variant={type === 'IN' ? 'outline' : 'ghost'}
              >
                {type === 'IN' ? <Icon name="plus" size={16} /> : null}
                {movementTypeLabels[type]}
              </Button>
            ))}
          </>
        }
        description={`کد کالا: ${item.product.sku} · مدیریت مستقل موجودی و سابقهٔ گردش`}
        title={item.product.name}
      />
      {!item.product.isActive ? <p className="-mt-3 text-sm text-muted" role="status">محصول غیرفعال است؛ موجودی و سابقه قابل مشاهده‌اند، اما ثبت گردش جدید مجاز نیست.</p> : null}

      <section aria-label="خلاصهٔ موجودی" className="grid gap-3 sm:grid-cols-3">
        <Card as="article" className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted">موجودی فعلی</p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {inventoryNumber.format(item.quantity)} <span className="text-sm font-medium text-muted">{PRODUCT_UNIT_LABELS[item.product.unit]}</span>
            </p>
          </div>
          <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary-strong"><Icon name="warehouse" /></span>
        </Card>
        <Card as="article" className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted">حداقل موجودی</p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {inventoryNumber.format(item.minimumQuantity)} <span className="text-sm font-medium text-muted">{PRODUCT_UNIT_LABELS[item.product.unit]}</span>
            </p>
          </div>
          <Badge className="mt-1" variant={inventoryStatusVariants[item.status]}>{inventoryStatusLabels[item.status]}</Badge>
        </Card>
        <Card as="article">
          <p className="text-xs font-medium text-muted">آخرین تغییر موجودی</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{formatInventoryDate(item.updatedAt)}</p>
          <p className="mt-1 text-xs text-muted">{item.isLowStock ? 'موجودی به حداقل یا کمتر رسیده است.' : 'موجودی بالاتر از حداقل ثبت‌شده است.'}</p>
        </Card>
      </section>

      <Card as="section" aria-labelledby="minimum-title">
        <div className="mb-4">
          <h2 className="text-base font-bold text-foreground" id="minimum-title">تنظیم حداقل موجودی</h2>
          <p className="mt-1 text-xs leading-5 text-muted">وقتی موجودی به این عدد یا کمتر برسد، کالا کم‌موجودی محسوب می‌شود؛ مقدار صفر نیز در محاسبه لحاظ می‌شود.</p>
        </div>
        <form className="grid items-end gap-3 sm:grid-cols-[minmax(14rem,0.8fr)_1fr_auto]" onSubmit={(event) => { void saveMinimum(event); }}>
          <Input
            autoComplete="off"
            error={minimumError}
            id="minimum-quantity"
            inputMode="numeric"
            label={`حداقل قابل‌قبول (${PRODUCT_UNIT_LABELS[item.product.unit]})`}
            onChange={(event) => setMinimumDraft(event.currentTarget.value)}
            type="text"
            value={minimumDraft}
          />
          <p className="text-xs leading-5 text-muted">تغییر حداقل موجودی فقط آستانهٔ هشدار را به‌روزرسانی می‌کند و گردش جدیدی نمی‌سازد.</p>
          <Button
            disabled={parsedMinimum === null || Boolean(minimumError) || parsedMinimum === item.minimumQuantity || minimumMutation.isPending}
            loading={minimumMutation.isPending}
            type="submit"
          >
            ذخیرهٔ حداقل
          </Button>
        </form>
        {minimumMutation.isError ? <p className="mt-3 text-sm text-danger" role="alert">{minimumMutation.error instanceof Error ? minimumMutation.error.message : 'ویرایش حداقل موجودی انجام نشد.'}</p> : null}
      </Card>

      <Card as="section" aria-labelledby="movement-history-title" padded={false}>
        <div className="grid gap-3 border-b border-border px-4 py-4 sm:flex sm:items-end sm:justify-between sm:px-5">
          <div>
            <h2 className="text-base font-bold text-foreground" id="movement-history-title">سابقهٔ گردش موجودی</h2>
            <p className="mt-1 text-xs leading-5 text-muted">مقادیر قبل و بعد در زمان ثبت هر گردش نگهداری می‌شوند.</p>
          </div>
          <Select
            label="نوع گردش"
            onChange={(event) => {
              setMovementFilter(event.currentTarget.value as MovementFilter);
              setHistoryPage(1);
            }}
            options={[
              { value: '', label: 'همهٔ گردش‌ها' },
              ...movementTypes.map((type) => ({ value: type, label: movementTypeLabels[type] })),
            ]}
            value={movementFilter}
          />
        </div>

        {historyQuery.isPending ? <LoadingState compact label="در حال دریافت سابقهٔ موجودی…" /> : historyQuery.isError ? (
          <div className="p-4"><ErrorState compact description="دریافت سابقهٔ موجودی با مشکل مواجه شد." onRetry={() => { void historyQuery.refetch(); }} /></div>
        ) : historyQuery.data && historyQuery.data.items.length === 0 ? (
          <EmptyState
            compact
            description={movementFilter ? 'نوع گردش دیگری را انتخاب کنید.' : 'پس از اولین ورود، خروج یا اصلاح موجودی، سابقه در این بخش ثبت می‌شود.'}
            icon="receipt"
            title={movementFilter ? 'گردشی با این نوع پیدا نشد' : 'هنوز گردشی ثبت نشده است'}
          />
        ) : historyQuery.data ? (
          <>
            <div className="hidden md:block px-3 py-2 sm:px-4">
              <Table
                ariaLabel="سابقهٔ گردش موجودی"
                caption={`سابقهٔ گردش موجودی ${item.product.name}`}
                columns={movementColumns}
                getRowId={(movement) => movement.id}
                rows={historyQuery.data.items}
              />
            </div>
            <div aria-label="سابقهٔ گردش موجودی" className="grid gap-3 p-3 md:hidden" role="region">
              {historyQuery.data.items.map((movement) => (
                <article className="rounded-xl border border-border bg-surface p-3.5" key={movement.id}>
                  <div className="flex items-start justify-between gap-3">
                    <MovementTypeBadge type={movement.type} />
                    <time className="text-end text-[0.68rem] leading-5 text-muted" dateTime={movement.createdAt}>{formatInventoryDate(movement.createdAt)}</time>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-foreground">
                    {movementSign(movement)}{inventoryNumber.format(movement.quantity)} {PRODUCT_UNIT_LABELS[item.product.unit]}
                    <span className="ms-2 text-xs font-normal text-muted">
                      {inventoryNumber.format(movement.beforeQuantity)} ← {inventoryNumber.format(movement.afterQuantity)}
                    </span>
                  </p>
                  {movement.note ? <p className="mt-2 break-words text-xs leading-5 text-muted">{movement.note}</p> : null}
                </article>
              ))}
            </div>
            {historyQuery.data.pagination.totalPages > 1 ? (
              <div className="border-t border-border px-4 py-3 sm:px-5">
                <Pagination label="صفحه‌های سابقهٔ گردش" onPageChange={setHistoryPage} page={historyPage} totalPages={historyQuery.data.pagination.totalPages} />
              </div>
            ) : null}
          </>
        ) : null}
      </Card>

      <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background" to="/inventory">
        <Icon name="chevron-right" size={17} />
        بازگشت به فهرست موجودی
      </Link>

      {movementType ? (
        <StockMovementDialog
          item={item}
          key={`${item.product.id}-${movementType}`}
          onOpenChange={(open) => { if (!open) setMovementType(undefined); }}
          onSave={saveMovement}
          open
          saving={movementMutation.isPending}
          type={movementType}
        />
      ) : null}
    </div>
  );
}
