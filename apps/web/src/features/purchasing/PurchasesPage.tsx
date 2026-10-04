import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import type { PurchaseListItem, PurchaseListQuery, PurchaseStatus, SupplierSummary } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Badge, Breadcrumb, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Pagination, Select, Table, type TableColumn } from '../../components/ui';
import { formatToman } from '../catalog/catalog.constants';
import { useDebouncedValue } from '../catalog/useDebouncedValue';
import { getSupplier, listPurchases, listSuppliers } from './api';
import { formatPurchaseDate, localPurchaseDateTimeToIso, PURCHASE_STATUS_LABELS, PURCHASE_STATUS_VARIANTS } from './purchasing.constants';

const pageSize = 20;
type PurchaseStatusFilter = '' | PurchaseStatus;

function StatusBadge({ status }: { status: PurchaseStatus }) {
  return <Badge variant={PURCHASE_STATUS_VARIANTS[status]}>{PURCHASE_STATUS_LABELS[status]}</Badge>;
}

export function PurchasesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierIdFromUrl = searchParams.get('supplierId') ?? undefined;
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput);
  const [supplierSearchInput, setSupplierSearchInput] = useState('');
  const supplierSearch = useDebouncedValue(supplierSearchInput, 250);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null);
  const [status, setStatus] = useState<PurchaseStatusFilter>('');
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [page, setPage] = useState(1);
  const supplierFromUrlQuery = useQuery({
    queryKey: ['supplier', supplierIdFromUrl],
    queryFn: ({ signal }) => getSupplier(supplierIdFromUrl!, signal),
    enabled: Boolean(supplierIdFromUrl),
  });
  const supplierSearchQuery = useQuery({
    queryKey: ['purchase-supplier-filter-search', supplierSearch],
    queryFn: ({ signal }) => listSuppliers({ search: supplierSearch, page: 1, pageSize: 8 }, signal),
    enabled: supplierSearch.trim().length > 0,
  });

  useEffect(() => {
    const supplier = supplierFromUrlQuery.data;
    if (supplier && selectedSupplier?.id !== supplier.id) {
      setSelectedSupplier({ id: supplier.id, name: supplier.name, phone: supplier.phone, email: supplier.email, isActive: supplier.isActive });
    }
  }, [selectedSupplier?.id, supplierFromUrlQuery.data]);

  const from = localPurchaseDateTimeToIso(fromInput);
  const to = localPurchaseDateTimeToIso(toInput);
  const dateRangeInvalid = Boolean(from && to && Date.parse(from) > Date.parse(to));
  const filters = useMemo<PurchaseListQuery>(() => ({
    search,
    supplierId: selectedSupplier?.id ?? supplierIdFromUrl,
    status: status || undefined,
    from,
    to,
    page,
    pageSize,
  }), [from, page, search, selectedSupplier?.id, status, supplierIdFromUrl, to]);
  const purchasesQuery = useQuery({
    queryKey: ['purchases', filters],
    queryFn: ({ signal }) => listPurchases(filters, signal),
    placeholderData: keepPreviousData,
    enabled: !dateRangeInvalid,
  });
  const data = purchasesQuery.data;
  const hasFilters = Boolean(searchInput.trim() || selectedSupplier?.id || supplierIdFromUrl || status || fromInput || toInput);

  function clearFilters(): void {
    setSearchInput('');
    setSupplierSearchInput('');
    setSelectedSupplier(null);
    setStatus('');
    setFromInput('');
    setToInput('');
    setPage(1);
    if (supplierIdFromUrl) {
      const next = new URLSearchParams(searchParams);
      next.delete('supplierId');
      setSearchParams(next, { replace: true });
    }
  }

  function chooseSupplier(supplier: SupplierSummary): void {
    setSelectedSupplier(supplier);
    setSupplierSearchInput('');
    setPage(1);
    const next = new URLSearchParams(searchParams);
    next.set('supplierId', supplier.id);
    setSearchParams(next, { replace: true });
  }

  function clearSupplier(): void {
    setSelectedSupplier(null);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    next.delete('supplierId');
    setSearchParams(next, { replace: true });
  }

  const columns = useMemo<readonly TableColumn<PurchaseListItem>[]>(() => [
    {
      id: 'purchase-number',
      header: 'شماره خرید',
      cell: (purchase) => (
        <Link className="font-bold text-primary hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" to={`/purchases/${purchase.id}`}>
          <bdi dir="ltr">{purchase.purchaseNumber}</bdi>
        </Link>
      ),
    },
    { id: 'supplier', header: 'تأمین‌کننده', cell: (purchase) => purchase.supplierName },
    { id: 'items', header: 'اقلام', align: 'center', cell: (purchase) => <bdi>{new Intl.NumberFormat('fa-IR').format(purchase.itemCount)}</bdi> },
    { id: 'date', header: 'تاریخ ثبت', cell: (purchase) => <time dateTime={purchase.createdAt}>{formatPurchaseDate(purchase.createdAt)}</time> },
    { id: 'status', header: 'وضعیت', cell: (purchase) => <StatusBadge status={purchase.status} /> },
    { id: 'total', header: 'مبلغ نهایی', align: 'end', cell: (purchase) => <bdi className="font-bold">{formatToman(purchase.total)}</bdi> },
  ], []);

  return (
    <div className="grid gap-6 sm:gap-7">
      <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'خریدها' }]} />
      <PageHeader
        actions={<Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" to="/purchases/new"><Icon name="plus" size={18} />ثبت خرید</Link>}
        description="خریدهای ثبت‌شده، پیش‌نویس‌ها و رسیدهای نهایی را پیگیری کنید."
        title="خریدها"
      />

      <Card as="section" aria-label="جستجو و فیلتر خریدها" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" padded>
        <Input
          label="جستجوی خریدها"
          onChange={(event) => { setSearchInput(event.currentTarget.value); setPage(1); }}
          placeholder="شماره خرید یا تأمین‌کننده"
          startIcon="search"
          type="search"
          value={searchInput}
          wrapperClassName="xl:col-span-2"
        />
        <Select
          label="وضعیت خرید"
          onChange={(event) => { setStatus(event.currentTarget.value as PurchaseStatusFilter); setPage(1); }}
          options={[
            { value: '', label: 'همهٔ وضعیت‌ها' },
            { value: 'draft', label: PURCHASE_STATUS_LABELS.draft },
            { value: 'confirmed', label: PURCHASE_STATUS_LABELS.confirmed },
            { value: 'cancelled', label: PURCHASE_STATUS_LABELS.cancelled },
          ]}
          value={status}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:col-span-4">
          <Input
            label="از تاریخ و ساعت"
            onChange={(event) => { setFromInput(event.currentTarget.value); setPage(1); }}
            type="datetime-local"
            value={fromInput}
          />
          <Input
            label="تا تاریخ و ساعت"
            onChange={(event) => { setToInput(event.currentTarget.value); setPage(1); }}
            type="datetime-local"
            value={toInput}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2 xl:col-span-4">
          {selectedSupplier || supplierFromUrlQuery.data ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-muted/50 px-3 py-2">
              <span className="text-sm text-foreground">تأمین‌کننده: <strong>{selectedSupplier?.name ?? supplierFromUrlQuery.data?.name}</strong></span>
              <Button onClick={clearSupplier} size="sm" variant="outline">حذف فیلتر تأمین‌کننده</Button>
            </div>
          ) : (
            <Input
              autoComplete="off"
              label="فیلتر تأمین‌کننده"
              onChange={(event) => setSupplierSearchInput(event.currentTarget.value)}
              placeholder="برای انتخاب، نام یا راه تماس را جستجو کنید"
              startIcon="users"
              type="search"
              value={supplierSearchInput}
            />
          )}
          {supplierSearch.trim() && supplierSearchQuery.isPending ? <LoadingState compact label="در حال جستجوی تأمین‌کنندگان…" /> : null}
          {supplierSearch.trim() && supplierSearchQuery.isError ? <ErrorState compact description="جستجوی تأمین‌کننده انجام نشد." onRetry={() => { void supplierSearchQuery.refetch(); }} /> : null}
          {supplierSearchQuery.data && supplierSearch.trim() ? (
            supplierSearchQuery.data.items.length > 0 ? (
              <ul aria-label="نتایج فیلتر تأمین‌کننده" className="grid gap-2 sm:grid-cols-2">
                {supplierSearchQuery.data.items.map((supplier) => (
                  <li key={supplier.id}>
                    <button
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 text-start text-sm hover:border-primary/40 hover:bg-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={() => chooseSupplier({ id: supplier.id, name: supplier.name, phone: supplier.phone, email: supplier.email, isActive: supplier.isActive })}
                      type="button"
                    >
                      <span>{supplier.name}</span><Badge variant={supplier.isActive ? 'success' : 'neutral'}>{supplier.isActive ? 'فعال' : 'غیرفعال'}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <EmptyState compact description="تأمین‌کنندهٔ دیگری را جستجو کنید." title="تأمین‌کننده‌ای پیدا نشد" />
          ) : null}
        </div>
        {dateRangeInvalid ? <p className="text-sm text-danger" role="alert">تاریخ آغاز باید پیش از تاریخ پایان باشد.</p> : null}
      </Card>

      {purchasesQuery.isPending ? <LoadingState label="در حال دریافت خریدها…" /> : purchasesQuery.isError ? (
        <ErrorState description="دریافت فهرست خریدها با مشکل مواجه شد." onRetry={() => { void purchasesQuery.refetch(); }} />
      ) : data && data.items.length === 0 ? (
        <Card>
          <EmptyState
            action={hasFilters
              ? <Button onClick={clearFilters} variant="outline">پاک کردن فیلترها</Button>
              : <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover" to="/purchases/new"><Icon name="plus" size={17} />ثبت خرید</Link>}
            description={hasFilters ? 'فیلترها را تغییر دهید یا پاک کنید.' : 'برای شروع، یک پیش‌نویس خرید ثبت کنید.'}
            icon="receipt"
            title={hasFilters ? 'خریدی با این مشخصات پیدا نشد' : 'هنوز خریدی ثبت نشده است'}
          />
        </Card>
      ) : data ? (
        <>
          <div className="hidden md:block">
            <Table ariaLabel="فهرست خریدها" caption="خریدهای ثبت‌شده در بازاریا" columns={columns} getRowId={(purchase) => purchase.id} rows={data.items} />
          </div>
          <div aria-label="فهرست خریدها" className="grid gap-3 md:hidden" role="region">
            {data.items.map((purchase) => (
              <Card as="article" className="p-4" key={purchase.id} padded={false}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="font-bold text-primary" to={`/purchases/${purchase.id}`}><bdi dir="ltr">{purchase.purchaseNumber}</bdi></Link>
                    <p className="mt-1 truncate text-sm text-foreground">{purchase.supplierName}</p>
                    <p className="mt-1 text-xs text-muted"><time dateTime={purchase.createdAt}>{formatPurchaseDate(purchase.createdAt)}</time> · {new Intl.NumberFormat('fa-IR').format(purchase.itemCount)} قلم</p>
                  </div>
                  <StatusBadge status={purchase.status} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                  <span className="text-muted">مبلغ نهایی</span><bdi className="font-bold text-foreground">{formatToman(purchase.total)}</bdi>
                </div>
              </Card>
            ))}
          </div>
          {data.pagination.totalPages > 1 ? <Pagination onPageChange={setPage} page={page} totalPages={data.pagination.totalPages} /> : null}
        </>
      ) : null}
    </div>
  );
}
