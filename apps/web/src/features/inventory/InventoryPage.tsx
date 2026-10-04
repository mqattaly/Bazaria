import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { CreateStockMovementInput, InventoryItem, InventoryListQuery, InventoryStatus, StockMovementType } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Badge, Breadcrumb, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Pagination, Select, Table, type TableColumn } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { PRODUCT_UNIT_LABELS } from '../catalog/catalog.constants';
import { useDebouncedValue } from '../catalog/useDebouncedValue';
import { StockMovementDialog } from './StockMovementDialog';
import { createStockMovement, listInventory } from './api';
import { formatInventoryDate, inventoryNumber, inventoryStatusLabels, inventoryStatusVariants, movementTypeLabels } from './inventory.constants';

const pageSize = 20;
type StatusFilter = 'all' | InventoryStatus;
type MovementSelection = { item: InventoryItem; type: StockMovementType };
const movementTypes: readonly StockMovementType[] = ['IN', 'OUT', 'ADJUSTMENT'];

function InventoryStatusBadge({ status }: { status: InventoryStatus }) {
  return <Badge variant={inventoryStatusVariants[status]}>{inventoryStatusLabels[status]}</Badge>;
}

export function InventoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 250);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [movementSelection, setMovementSelection] = useState<MovementSelection>();

  const filters = useMemo<InventoryListQuery>(() => ({
    search,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    page,
    pageSize,
  }), [page, search, statusFilter]);
  const inventoryQuery = useQuery({
    queryKey: ['inventory', filters],
    queryFn: ({ signal }) => listInventory(filters, signal),
    placeholderData: keepPreviousData,
  });
  const movementMutation = useMutation({
    mutationFn: ({ productId, input }: { productId: string; input: CreateStockMovementInput }) => createStockMovement(productId, input),
  });

  function openMovement(item: InventoryItem, type: StockMovementType): void {
    if (!item.product.isActive) return;
    setMovementSelection({ item, type });
  }

  async function saveMovement(input: CreateStockMovementInput): Promise<void> {
    if (!movementSelection) return;
    const { item } = movementSelection;
    await movementMutation.mutateAsync({ productId: item.product.id, input });
    setMovementSelection(undefined);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inventory'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-item', item.product.id] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-movements', item.product.id] }),
    ]);
    toast.success('گردش موجودی ثبت شد.');
  }

  const columns = useMemo<readonly TableColumn<InventoryItem>[]>(() => [
    {
      id: 'product',
      header: 'محصول',
      cell: (item) => (
        <div className="min-w-32">
          <button
            className="text-start font-bold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => navigate(`/inventory/${item.product.id}`)}
            type="button"
          >
            {item.product.name}
          </button>
          <bdi className="mt-0.5 block font-mono text-xs text-muted" dir="ltr">{item.product.sku}</bdi>
        </div>
      ),
    },
    {
      id: 'quantity',
      header: 'موجودی',
      cell: (item) => (
        <span className={item.isLowStock ? 'font-bold text-warning' : 'font-semibold text-foreground'}>
          {inventoryNumber.format(item.quantity)} <span className="text-xs font-normal text-muted">{PRODUCT_UNIT_LABELS[item.product.unit]}</span>
        </span>
      ),
    },
    {
      id: 'minimum',
      header: 'حداقل',
      cell: (item) => <span>{inventoryNumber.format(item.minimumQuantity)} <span className="text-xs text-muted">{PRODUCT_UNIT_LABELS[item.product.unit]}</span></span>,
    },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (item) => <div className="grid justify-items-start gap-1"><InventoryStatusBadge status={item.status} />{!item.product.isActive ? <span className="text-[0.68rem] text-muted">محصول غیرفعال</span> : null}</div>,
    },
    { id: 'updated', header: 'آخرین تغییر', cell: (item) => <time className="text-xs text-muted" dateTime={item.updatedAt}>{formatInventoryDate(item.updatedAt)}</time> },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'center',
      cell: (item) => (
        <div className="flex min-w-[13rem] flex-wrap items-center justify-center gap-1.5">
          {movementTypes.map((type) => (
            <Button
              aria-label={`${movementTypeLabels[type]} ${item.product.name}`}
              disabled={!item.product.isActive || movementMutation.isPending}
              key={type}
              onClick={() => openMovement(item, type)}
              size="sm"
              variant={type === 'IN' ? 'outline' : 'ghost'}
            >
              {type === 'IN' ? <Icon name="plus" size={15} /> : null}
              {movementTypeLabels[type]}
            </Button>
          ))}
          <Button onClick={() => navigate(`/inventory/${item.product.id}`)} size="sm" variant="secondary">جزئیات</Button>
        </div>
      ),
    },
  ], [movementMutation.isPending, navigate]);

  const data = inventoryQuery.data;
  const hasFilters = Boolean(searchInput.trim() || statusFilter !== 'all');

  return (
    <div className="grid gap-6 sm:gap-7">
      <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'موجودی انبار' }]} />
      <PageHeader
        description="موجودی، حداقل قابل‌قبول و گردش هر محصول را مستقل از سفارش‌ها مدیریت کنید. موجودی صفر جداگانه نمایش داده می‌شود."
        title="مدیریت موجودی"
      />

      <Card as="section" aria-label="فیلتر موجودی" className="grid gap-3 sm:grid-cols-[minmax(15rem,1fr)_minmax(11rem,0.55fr)]" padded>
        <Input
          label="جستجوی موجودی"
          onChange={(event) => {
            setSearchInput(event.currentTarget.value);
            setPage(1);
          }}
          placeholder="نام محصول یا کد کالا"
          startIcon="search"
          type="search"
          value={searchInput}
        />
        <Select
          label="وضعیت موجودی"
          onChange={(event) => {
            setStatusFilter(event.currentTarget.value as StatusFilter);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'همهٔ وضعیت‌ها' },
            { value: 'in-stock', label: inventoryStatusLabels['in-stock'] },
            { value: 'low-stock', label: inventoryStatusLabels['low-stock'] },
            { value: 'out-of-stock', label: inventoryStatusLabels['out-of-stock'] },
          ]}
          value={statusFilter}
        />
      </Card>

      {inventoryQuery.isPending ? <LoadingState label="در حال دریافت موجودی محصولات…" /> : inventoryQuery.isError ? (
        <ErrorState description="دریافت فهرست موجودی با مشکل مواجه شد." onRetry={() => { void inventoryQuery.refetch(); }} />
      ) : data && data.items.length === 0 ? (
        <Card>
          <EmptyState
            action={hasFilters
              ? <Button onClick={() => {
                  setSearchInput('');
                  setStatusFilter('all');
                  setPage(1);
                }} variant="outline">پاک کردن فیلترها</Button>
              : undefined}
            description={hasFilters
              ? 'عبارت جستجو یا وضعیت را تغییر دهید تا محصولات بیشتری ببینید.'
              : 'برای محصولات ثبت‌شده، موجودی اولیه به‌صورت صفر در این فهرست نمایش داده می‌شود.'}
            icon="warehouse"
            title={hasFilters ? 'موردی با این فیلتر پیدا نشد' : 'محصولی برای نمایش وجود ندارد'}
          />
        </Card>
      ) : data ? (
        <>
          <div className="hidden md:block">
            <Table
              ariaLabel="فهرست موجودی محصولات"
              caption="موجودی فعلی و حداقل موجودی محصولات"
              columns={columns}
              getRowId={(item) => item.product.id}
              rows={data.items}
            />
          </div>
          <div aria-label="فهرست موجودی محصولات" className="grid gap-3 md:hidden" role="region">
            {data.items.map((item) => (
              <Card as="article" className="p-4" key={item.product.id} padded={false}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      className="text-start text-base font-bold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={() => navigate(`/inventory/${item.product.id}`)}
                      type="button"
                    >
                      {item.product.name}
                    </button>
                    <bdi className="mt-1 block font-mono text-xs text-muted" dir="ltr">{item.product.sku}</bdi>
                  </div>
                  <InventoryStatusBadge status={item.status} />
                </div>
                {!item.product.isActive ? <p className="mt-2 text-xs text-muted">محصول غیرفعال است؛ مشاهدهٔ سابقه مجاز، ثبت گردش غیرفعال است.</p> : null}
                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-surface-muted p-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted">موجودی فعلی</dt>
                    <dd className="mt-1 font-bold text-foreground">{inventoryNumber.format(item.quantity)} {PRODUCT_UNIT_LABELS[item.product.unit]}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">حداقل موجودی</dt>
                    <dd className="mt-1 font-semibold text-foreground">{inventoryNumber.format(item.minimumQuantity)} {PRODUCT_UNIT_LABELS[item.product.unit]}</dd>
                  </div>
                </dl>
                <time className="mt-3 block text-xs text-muted" dateTime={item.updatedAt}>آخرین تغییر: {formatInventoryDate(item.updatedAt)}</time>
                <div className="mt-4 flex flex-wrap gap-2">
                  {movementTypes.map((type) => (
                    <Button
                      aria-label={`${movementTypeLabels[type]} ${item.product.name}`}
                      className="min-w-0 flex-1"
                      disabled={!item.product.isActive || movementMutation.isPending}
                      key={type}
                      onClick={() => openMovement(item, type)}
                      size="sm"
                      variant={type === 'IN' ? 'outline' : 'ghost'}
                    >
                      {movementTypeLabels[type]}
                    </Button>
                  ))}
                  <Button className="w-full" onClick={() => navigate(`/inventory/${item.product.id}`)} size="sm" variant="secondary">مشاهدهٔ جزئیات و سابقه</Button>
                </div>
              </Card>
            ))}
          </div>
          {data.pagination.totalPages > 1 ? <Pagination onPageChange={setPage} page={page} totalPages={data.pagination.totalPages} /> : null}
        </>
      ) : null}

      {movementSelection ? (
        <StockMovementDialog
          item={movementSelection.item}
          key={`${movementSelection.item.product.id}-${movementSelection.type}`}
          onOpenChange={(open) => { if (!open) setMovementSelection(undefined); }}
          onSave={saveMovement}
          open
          saving={movementMutation.isPending}
          type={movementSelection.type}
        />
      ) : null}
    </div>
  );
}
