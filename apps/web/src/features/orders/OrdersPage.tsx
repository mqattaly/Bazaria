import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { OrderListItem, OrderListQuery, OrderStatus } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Badge, Breadcrumb, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Pagination, Select, Table, type TableColumn } from '../../components/ui';
import { formatToman } from '../catalog/catalog.constants';
import { useDebouncedValue } from '../catalog/useDebouncedValue';
import { listOrders } from './api';
import { formatOrderDate, localDateTimeToIso, ORDER_STATUS_LABELS, ORDER_STATUS_VARIANTS } from './orders.constants';

const pageSize = 20;

type OrderStatusFilter = '' | OrderStatus;

function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_STATUS_VARIANTS[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

function OrderNumber({ order, onClick }: { order: OrderListItem; onClick: () => void }) {
  return (
    <button
      className="font-bold text-primary hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onClick={onClick}
      type="button"
    >
      <bdi dir="ltr">{order.orderNumber}</bdi>
    </button>
  );
}

export function OrdersPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput);
  const [status, setStatus] = useState<OrderStatusFilter>('');
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [page, setPage] = useState(1);
  const from = localDateTimeToIso(fromInput);
  const to = localDateTimeToIso(toInput);
  const dateRangeInvalid = Boolean(from && to && Date.parse(from) > Date.parse(to));
  const filters = useMemo<OrderListQuery>(() => ({
    search,
    status: status || undefined,
    from,
    to,
    page,
    pageSize,
  }), [from, page, search, status, to]);
  const ordersQuery = useQuery({
    queryKey: ['orders', filters],
    queryFn: ({ signal }) => listOrders(filters, signal),
    placeholderData: keepPreviousData,
    enabled: !dateRangeInvalid,
  });

  const columns = useMemo<readonly TableColumn<OrderListItem>[]>(() => [
    {
      id: 'order-number',
      header: 'شماره سفارش',
      cell: (order) => <OrderNumber onClick={() => navigate(`/orders/${order.id}`)} order={order} />,
    },
    {
      id: 'customer',
      header: 'مشتری',
      cell: (order) => order.customerName ?? <span className="text-muted">مشتری انتخاب نشده</span>,
    },
    { id: 'items', header: 'اقلام', align: 'center', cell: (order) => <bdi>{new Intl.NumberFormat('fa-IR').format(order.itemCount)}</bdi> },
    { id: 'date', header: 'تاریخ ثبت', cell: (order) => <time dateTime={order.createdAt}>{formatOrderDate(order.createdAt)}</time> },
    { id: 'status', header: 'وضعیت', cell: (order) => <StatusBadge status={order.status} /> },
    { id: 'total', header: 'مبلغ نهایی', align: 'end', cell: (order) => <bdi className="font-bold">{formatToman(order.total)}</bdi> },
  ], [navigate]);

  const data = ordersQuery.data;
  const hasFilters = Boolean(searchInput.trim() || status || fromInput || toInput);

  function clearFilters(): void {
    setSearchInput('');
    setStatus('');
    setFromInput('');
    setToInput('');
    setPage(1);
  }

  return (
    <div className="grid gap-6 sm:gap-7">
      <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'سفارش‌ها' }]} />
      <PageHeader
        actions={<Button onClick={() => navigate('/orders/new')}><Icon name="plus" size={18} />ثبت سفارش</Button>}
        description="سفارش‌های فروشگاه را ثبت، پیگیری و مدیریت کنید."
        title="مدیریت سفارش‌ها"
      />

      <Card as="section" aria-label="جستجو و فیلتر سفارش‌ها" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" padded>
        <Input
          label="جستجوی سفارش‌ها"
          onChange={(event) => { setSearchInput(event.currentTarget.value); setPage(1); }}
          placeholder="شماره سفارش، مشتری یا محصول"
          startIcon="search"
          type="search"
          value={searchInput}
          wrapperClassName="sm:col-span-2 xl:col-span-2"
        />
        <Select
          label="وضعیت سفارش"
          onChange={(event) => { setStatus(event.currentTarget.value as OrderStatusFilter); setPage(1); }}
          options={[
            { value: '', label: 'همهٔ وضعیت‌ها' },
            { value: 'draft', label: ORDER_STATUS_LABELS.draft },
            { value: 'confirmed', label: ORDER_STATUS_LABELS.confirmed },
            { value: 'cancelled', label: ORDER_STATUS_LABELS.cancelled },
          ]}
          value={status}
        />
        <Input
          label="از تاریخ و ساعت (به وقت تهران)"
          onChange={(event) => { setFromInput(event.currentTarget.value); setPage(1); }}
          type="datetime-local"
          value={fromInput}
        />
        <Input
          label="تا تاریخ و ساعت (به وقت تهران)"
          onChange={(event) => { setToInput(event.currentTarget.value); setPage(1); }}
          type="datetime-local"
          value={toInput}
        />
      </Card>

      {dateRangeInvalid ? (
        <p className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">زمان پایان باید برابر یا پس از زمان آغاز باشد.</p>
      ) : ordersQuery.isPending ? <LoadingState label="در حال دریافت سفارش‌ها…" /> : ordersQuery.isError ? (
        <ErrorState description={ordersQuery.error instanceof Error ? ordersQuery.error.message : 'دریافت فهرست سفارش‌ها با مشکل مواجه شد.'} onRetry={() => { void ordersQuery.refetch(); }} />
      ) : data && data.items.length === 0 ? (
        <Card>
          <EmptyState
            action={hasFilters
              ? <Button onClick={clearFilters} variant="outline">پاک کردن فیلترها</Button>
              : <Button onClick={() => navigate('/orders/new')}><Icon name="plus" size={17} />ثبت سفارش</Button>}
            description={hasFilters
              ? 'فیلترها را تغییر دهید یا برای دیدن همهٔ سفارش‌ها آن‌ها را پاک کنید.'
              : 'برای شروع، اولین سفارش فروشگاه را ثبت کنید.'}
            icon="sales"
            title={hasFilters ? 'سفارشی با این مشخصات پیدا نشد' : 'هنوز سفارشی ثبت نشده است'}
          />
        </Card>
      ) : data ? (
        <>
          <div className="hidden md:block">
            <Table
              ariaLabel="فهرست سفارش‌ها"
              caption="سفارش‌های ثبت‌شده در بازاریا"
              columns={columns}
              getRowId={(order) => order.id}
              rows={data.items}
            />
          </div>
          <div aria-label="فهرست سفارش‌ها" className="grid gap-3 md:hidden" role="region">
            {data.items.map((order) => (
              <Card as="article" className="p-4" key={order.id} padded={false}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <OrderNumber onClick={() => navigate(`/orders/${order.id}`)} order={order} />
                    <p className="mt-1 truncate text-sm text-muted">{order.customerName ?? 'مشتری انتخاب نشده'}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-3">
                  <div className="grid gap-1 text-xs text-muted">
                    <time dateTime={order.createdAt}>{formatOrderDate(order.createdAt)}</time>
                    <span><bdi>{new Intl.NumberFormat('fa-IR').format(order.itemCount)}</bdi> قلم</span>
                  </div>
                  <bdi className="text-sm font-bold text-foreground">{formatToman(order.total)}</bdi>
                </div>
              </Card>
            ))}
          </div>
          {data.pagination.totalPages > 1 ? (
            <Pagination onPageChange={setPage} page={page} totalPages={data.pagination.totalPages} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
