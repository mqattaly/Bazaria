import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import type { Supplier, SupplierListQuery } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Badge, Breadcrumb, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Pagination, Select, Table, type TableColumn } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useDebouncedValue } from '../catalog/useDebouncedValue';
import { createSupplier, deleteSupplier, listSuppliers, updateSupplier, updateSupplierStatus } from './api';
import { SupplierFormDialog } from './SupplierFormDialog';

const pageSize = 20;
type SupplierStatusFilter = '' | 'active' | 'inactive';

function SupplierStatus({ isActive }: { isActive: boolean }) {
  return <Badge variant={isActive ? 'success' : 'neutral'}>{isActive ? 'فعال' : 'غیرفعال'}</Badge>;
}

export function SuppliersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput);
  const [status, setStatus] = useState<SupplierStatusFilter>('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier>();
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier>();
  const filters = useMemo<SupplierListQuery>(() => ({
    search,
    status: status || undefined,
    page,
    pageSize,
  }), [page, search, status]);
  const suppliersQuery = useQuery({
    queryKey: ['suppliers', filters],
    queryFn: ({ signal }) => listSuppliers(filters, signal),
    placeholderData: keepPreviousData,
  });
  const createMutation = useMutation({ mutationFn: createSupplier });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateSupplier>[1] }) => updateSupplier(id, input),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateSupplierStatus(id, isActive),
    onSuccess: async (supplier) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
        queryClient.invalidateQueries({ queryKey: ['supplier', supplier.id] }),
      ]);
      toast.success(supplier.isActive ? 'تأمین‌کننده فعال شد.' : 'تأمین‌کننده غیرفعال شد.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تغییر وضعیت انجام نشد.'),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: async () => {
      setDeletingSupplier(undefined);
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('تأمین‌کننده حذف شد.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'حذف تأمین‌کننده انجام نشد.'),
  });

  async function saveSupplier(input: Parameters<typeof createSupplier>[0]): Promise<void> {
    if (editingSupplier) {
      const { name, phone, email, address, note } = input;
      await updateMutation.mutateAsync({ id: editingSupplier.id, input: { name, phone, email, address, note } });
    } else {
      await createMutation.mutateAsync(input);
    }
    setFormOpen(false);
    setEditingSupplier(undefined);
    setPage(1);
    await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    toast.success(editingSupplier ? 'اطلاعات تأمین‌کننده ذخیره شد.' : 'تأمین‌کننده ثبت شد.');
  }

  function openCreate(): void {
    setEditingSupplier(undefined);
    setFormOpen(true);
  }

  function openEdit(supplier: Supplier): void {
    setEditingSupplier(supplier);
    setFormOpen(true);
  }

  const columns = useMemo<readonly TableColumn<Supplier>[]>(() => [
    {
      id: 'supplier',
      header: 'تأمین‌کننده',
      cell: (supplier) => (
        <div className="min-w-36">
          <Link className="font-bold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" to={`/suppliers/${supplier.id}`}>
            {supplier.name}
          </Link>
          {supplier.address ? <p className="mt-0.5 max-w-56 truncate text-xs text-muted">{supplier.address}</p> : null}
        </div>
      ),
    },
    { id: 'phone', header: 'شماره تماس', cell: (supplier) => supplier.phone ? <bdi className="font-mono text-xs" dir="ltr">{supplier.phone}</bdi> : <span className="text-muted">—</span> },
    { id: 'email', header: 'ایمیل', cell: (supplier) => supplier.email ? <bdi className="text-xs" dir="ltr">{supplier.email}</bdi> : <span className="text-muted">—</span> },
    { id: 'status', header: 'وضعیت', cell: (supplier) => <SupplierStatus isActive={supplier.isActive} /> },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'center',
      cell: (supplier) => (
        <div className="flex flex-wrap justify-center gap-1">
          <Button aria-label={`مشاهدهٔ ${supplier.name}`} onClick={() => navigate(`/suppliers/${supplier.id}`)} size="sm" variant="ghost"><Icon name="receipt" size={16} />مشاهده</Button>
          <Button aria-label={`ویرایش ${supplier.name}`} onClick={() => openEdit(supplier)} size="sm" variant="ghost"><Icon name="settings" size={16} />ویرایش</Button>
          <Button
            aria-label={`${supplier.isActive ? 'غیرفعال کردن' : 'فعال کردن'} ${supplier.name}`}
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate({ id: supplier.id, isActive: !supplier.isActive })}
            size="sm"
            variant="ghost"
          >
            {supplier.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
          </Button>
          <Button aria-label={`حذف ${supplier.name}`} onClick={() => setDeletingSupplier(supplier)} size="sm" variant="ghost"><Icon name="close" size={16} />حذف</Button>
        </div>
      ),
    },
  ], [navigate, statusMutation]);

  const data = suppliersQuery.data;
  const hasFilters = Boolean(searchInput.trim() || status);

  return (
    <div className="grid gap-6 sm:gap-7">
      <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'تأمین‌کنندگان' }]} />
      <PageHeader
        actions={<Button onClick={openCreate}><Icon name="plus" size={18} />ثبت تأمین‌کننده</Button>}
        description="اطلاعات تماس تأمین‌کنندگان را مدیریت کنید؛ سوابق خرید حذف نمی‌شوند."
        title="تأمین‌کنندگان"
      />

      <Card as="section" aria-label="جستجو و فیلتر تأمین‌کنندگان" className="grid gap-3 sm:grid-cols-[minmax(15rem,1fr)_minmax(11rem,0.55fr)]" padded>
        <Input
          label="جستجوی تأمین‌کنندگان"
          onChange={(event) => { setSearchInput(event.currentTarget.value); setPage(1); }}
          placeholder="نام، شماره تماس یا ایمیل"
          startIcon="search"
          type="search"
          value={searchInput}
        />
        <Select
          label="وضعیت"
          onChange={(event) => { setStatus(event.currentTarget.value as SupplierStatusFilter); setPage(1); }}
          options={[
            { value: '', label: 'همهٔ وضعیت‌ها' },
            { value: 'active', label: 'فعال' },
            { value: 'inactive', label: 'غیرفعال' },
          ]}
          value={status}
        />
      </Card>

      {suppliersQuery.isPending ? <LoadingState label="در حال دریافت تأمین‌کنندگان…" /> : suppliersQuery.isError ? (
        <ErrorState description="دریافت فهرست تأمین‌کنندگان با مشکل مواجه شد." onRetry={() => { void suppliersQuery.refetch(); }} />
      ) : data && data.items.length === 0 ? (
        <Card>
          <EmptyState
            action={hasFilters
              ? <Button onClick={() => { setSearchInput(''); setStatus(''); setPage(1); }} variant="outline">پاک کردن فیلترها</Button>
              : <Button onClick={openCreate}><Icon name="plus" size={17} />ثبت تأمین‌کننده</Button>}
            description={hasFilters ? 'فیلترها را تغییر دهید یا آن‌ها را پاک کنید.' : 'برای شروع، اولین تأمین‌کننده را ثبت کنید.'}
            icon="users"
            title={hasFilters ? 'تأمین‌کننده‌ای پیدا نشد' : 'هنوز تأمین‌کننده‌ای ثبت نشده است'}
          />
        </Card>
      ) : data ? (
        <>
          <div className="hidden md:block">
            <Table ariaLabel="فهرست تأمین‌کنندگان" caption="تأمین‌کنندگان ثبت‌شده در بازاریا" columns={columns} getRowId={(supplier) => supplier.id} rows={data.items} />
          </div>
          <div aria-label="فهرست تأمین‌کنندگان" className="grid gap-3 md:hidden" role="region">
            {data.items.map((supplier) => (
              <Card as="article" className="p-4" key={supplier.id} padded={false}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="text-start text-base font-bold text-foreground hover:text-primary" to={`/suppliers/${supplier.id}`}>{supplier.name}</Link>
                    <div className="mt-2 grid gap-1 text-xs text-muted">
                      {supplier.phone ? <bdi dir="ltr">{supplier.phone}</bdi> : null}
                      {supplier.email ? <bdi dir="ltr">{supplier.email}</bdi> : null}
                      {!supplier.phone && !supplier.email ? <span>راه تماس ثبت نشده</span> : null}
                    </div>
                  </div>
                  <SupplierStatus isActive={supplier.isActive} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button onClick={() => openEdit(supplier)} size="sm" variant="outline">ویرایش</Button>
                  <Button disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: supplier.id, isActive: !supplier.isActive })} size="sm" variant="outline">
                    {supplier.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                  </Button>
                  <Button onClick={() => setDeletingSupplier(supplier)} size="sm" variant="ghost">حذف</Button>
                </div>
              </Card>
            ))}
          </div>
          {data.pagination.totalPages > 1 ? <Pagination onPageChange={setPage} page={page} totalPages={data.pagination.totalPages} /> : null}
        </>
      ) : null}

      <SupplierFormDialog
        key={`${formOpen}-${editingSupplier?.id ?? 'new'}`}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingSupplier(undefined); }}
        onSave={saveSupplier}
        open={formOpen}
        saving={createMutation.isPending || updateMutation.isPending}
        supplier={editingSupplier}
      />

      <Modal
        description="تأمین‌کننده‌ای که سابقهٔ خرید دارد قابل حذف نیست؛ در آن حالت وضعیتش را غیرفعال کنید."
        onOpenChange={(open) => { if (!open) setDeletingSupplier(undefined); }}
        open={Boolean(deletingSupplier)}
        title="حذف تأمین‌کننده"
      >
        <div className="grid gap-5">
          <p className="text-sm leading-6 text-muted">آیا از حذف {deletingSupplier?.name} مطمئن هستید؟</p>
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button disabled={deleteMutation.isPending} onClick={() => setDeletingSupplier(undefined)} variant="outline">بازگشت</Button>
            <Button loading={deleteMutation.isPending} onClick={() => { if (deletingSupplier) deleteMutation.mutate(deletingSupplier.id); }} variant="danger">حذف تأمین‌کننده</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
