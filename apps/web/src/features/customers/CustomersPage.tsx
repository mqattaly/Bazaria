import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Customer, CustomerListQuery } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Badge, Breadcrumb, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Pagination, Select, Table, type TableColumn } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { createCustomer, deleteCustomer, listCustomers, updateCustomer } from './api';
import { CustomerActionsMenu } from './CustomerActionsMenu';
import { CustomerFormDialog } from './CustomerFormDialog';
import { useDebouncedSearch } from './useDebouncedSearch';

const pageSize = 20;

type ActiveFilter = 'all' | 'active' | 'inactive';

function CustomerStatus({ isActive }: { isActive: boolean }) {
  return <Badge variant={isActive ? 'success' : 'neutral'}>{isActive ? 'فعال' : 'غیرفعال'}</Badge>;
}

export function CustomersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedSearch(searchInput);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer>();
  const [deletingCustomer, setDeletingCustomer] = useState<Customer>();

  const createFromQuickAction = searchParams.get('create') === '1';
  useEffect(() => {
    if (!createFromQuickAction) return;
    setEditingCustomer(undefined);
    setFormOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });
  }, [createFromQuickAction, searchParams, setSearchParams]);

  const activeValue = activeFilter === 'all' ? undefined : activeFilter === 'active';
  const filters = useMemo<CustomerListQuery>(() => ({ search, isActive: activeValue, page, pageSize }), [activeValue, page, search]);
  const customersQuery = useQuery({
    queryKey: ['customers', filters],
    queryFn: ({ signal }) => listCustomers(filters, signal),
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({ mutationFn: createCustomer });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateCustomer>[1] }) => updateCustomer(id, input),
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateCustomer(id, { isActive }),
    onSuccess: async (_, variables) => {
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(variables.isActive ? 'مشتری فعال شد.' : 'مشتری غیرفعال شد.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تغییر وضعیت مشتری انجام نشد.'),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: async () => {
      setDeletingCustomer(undefined);
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('مشتری حذف شد.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'حذف مشتری انجام نشد.'),
  });

  async function saveCustomer(input: Parameters<typeof createCustomer>[0]): Promise<void> {
    if (editingCustomer) await updateMutation.mutateAsync({ id: editingCustomer.id, input });
    else await createMutation.mutateAsync(input);
    setFormOpen(false);
    setEditingCustomer(undefined);
    setPage(1);
    await queryClient.invalidateQueries({ queryKey: ['customers'] });
    toast.success(editingCustomer ? 'تغییرات مشتری ذخیره شد.' : 'مشتری جدید ثبت شد.');
  }

  function openCreateForm(): void {
    setEditingCustomer(undefined);
    setFormOpen(true);
  }

  function openEditForm(customer: Customer): void {
    setEditingCustomer(customer);
    setFormOpen(true);
  }

  const columns = useMemo<readonly TableColumn<Customer>[]>(() => [
    {
      id: 'customer',
      header: 'مشتری',
      cell: (customer) => (
        <div className="min-w-32">
          <button
            className="text-start font-bold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => navigate(`/customers/${customer.id}`)}
            type="button"
          >
            {customer.name}
          </button>
          {customer.description ? <p className="mt-0.5 max-w-52 truncate text-xs text-muted">{customer.description}</p> : null}
        </div>
      ),
    },
    { id: 'phone', header: 'شماره تماس', cell: (customer) => customer.phone ? <bdi dir="ltr" className="font-mono text-xs">{customer.phone}</bdi> : <span className="text-muted">—</span> },
    { id: 'email', header: 'ایمیل', cell: (customer) => customer.email ? <bdi dir="ltr" className="text-xs">{customer.email}</bdi> : <span className="text-muted">—</span> },
    { id: 'status', header: 'وضعیت', cell: (customer) => <CustomerStatus isActive={customer.isActive} /> },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'center',
      cell: (customer) => (
        <CustomerActionsMenu
          busy={toggleMutation.isPending || deleteMutation.isPending}
          customerName={customer.name}
          isActive={customer.isActive}
          onDelete={() => setDeletingCustomer(customer)}
          onEdit={() => openEditForm(customer)}
          onToggleActive={() => toggleMutation.mutate({ id: customer.id, isActive: !customer.isActive })}
          onView={() => navigate(`/customers/${customer.id}`)}
        />
      ),
    },
  ], [deleteMutation.isPending, navigate, toggleMutation]);

  const data = customersQuery.data;
  const hasFilters = Boolean(searchInput.trim() || activeFilter !== 'all');

  return (
    <div className="grid gap-6 sm:gap-7">
      <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'مشتریان' }]} />
      <PageHeader
        actions={<Button onClick={openCreateForm}><Icon name="plus" size={18} />افزودن مشتری</Button>}
        description="اطلاعات پایه و راه‌های تماس مشتریان را مدیریت کنید."
        title="مدیریت مشتریان"
      />

      <Card as="section" aria-label="فیلتر مشتریان" className="grid gap-3 sm:grid-cols-[minmax(15rem,1fr)_minmax(11rem,0.55fr)]" padded>
        <Input
          label="جستجوی مشتریان"
          onChange={(event) => {
            setSearchInput(event.currentTarget.value);
            setPage(1);
          }}
          placeholder="نام، شماره تماس یا ایمیل"
          startIcon="search"
          type="search"
          value={searchInput}
        />
        <Select
          label="وضعیت"
          onChange={(event) => {
            setActiveFilter(event.currentTarget.value as ActiveFilter);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'همهٔ وضعیت‌ها' },
            { value: 'active', label: 'فقط فعال' },
            { value: 'inactive', label: 'فقط غیرفعال' },
          ]}
          value={activeFilter}
        />
      </Card>

      {customersQuery.isPending ? <LoadingState label="در حال دریافت مشتریان…" /> : customersQuery.error ? (
        <ErrorState description="دریافت فهرست مشتریان با مشکل مواجه شد." onRetry={() => { void customersQuery.refetch(); }} />
      ) : data && data.items.length === 0 ? (
        <Card>
          <EmptyState
            action={hasFilters
              ? <Button onClick={() => {
                  setSearchInput('');
                  setActiveFilter('all');
                  setPage(1);
                }} variant="outline">پاک کردن فیلترها</Button>
              : <Button onClick={openCreateForm}><Icon name="plus" size={17} />افزودن مشتری</Button>}
            description={hasFilters
              ? 'فیلترها را تغییر دهید یا برای دیدن همهٔ مشتریان آن‌ها را پاک کنید.'
              : 'برای شروع، اولین مشتری را ثبت کنید.'}
            icon="users"
            title={hasFilters ? 'مشتری‌ای با این مشخصات پیدا نشد' : 'هنوز مشتری‌ای ثبت نشده است'}
          />
        </Card>
      ) : data ? (
        <>
          <div className="hidden md:block">
            <Table
              ariaLabel="فهرست مشتریان"
              caption="مشتریان ثبت‌شده در بازاریا"
              columns={columns}
              getRowId={(customer) => customer.id}
              rows={data.items}
            />
          </div>
          <div aria-label="فهرست مشتریان" className="grid gap-3 md:hidden" role="region">
            {data.items.map((customer) => (
              <Card as="article" className="p-4" key={customer.id} padded={false}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      className="text-start text-base font-bold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      type="button"
                    >
                      {customer.name}
                    </button>
                    {customer.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{customer.description}</p> : null}
                  </div>
                  <CustomerActionsMenu
                    busy={toggleMutation.isPending || deleteMutation.isPending}
                    customerName={customer.name}
                    isActive={customer.isActive}
                    onDelete={() => setDeletingCustomer(customer)}
                    onEdit={() => openEditForm(customer)}
                    onToggleActive={() => toggleMutation.mutate({ id: customer.id, isActive: !customer.isActive })}
                    onView={() => navigate(`/customers/${customer.id}`)}
                  />
                </div>
                <div className="mt-4 grid gap-2 text-xs text-muted">
                  {customer.phone ? <bdi dir="ltr" className="w-fit font-mono">{customer.phone}</bdi> : null}
                  {customer.email ? <bdi dir="ltr" className="w-fit">{customer.email}</bdi> : null}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <CustomerStatus isActive={customer.isActive} />
                  {customer.address ? <span className="max-w-[60%] truncate text-xs text-muted">{customer.address}</span> : null}
                </div>
              </Card>
            ))}
          </div>
          {data.pagination.totalPages > 1 ? (
            <Pagination onPageChange={setPage} page={page} totalPages={data.pagination.totalPages} />
          ) : null}
        </>
      ) : null}

      <CustomerFormDialog
        key={`${formOpen}-${editingCustomer?.id ?? 'new'}`}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingCustomer(undefined);
        }}
        onSave={saveCustomer}
        open={formOpen}
        customer={editingCustomer}
        saving={createMutation.isPending || updateMutation.isPending}
      />

      <Modal
        description="این عملیات قابل بازگشت نیست."
        onOpenChange={(open) => {
          if (!open) setDeletingCustomer(undefined);
        }}
        open={Boolean(deletingCustomer)}
        title="حذف مشتری"
      >
        <div className="grid gap-5">
          <p className="text-sm leading-6 text-muted">
            آیا از حذف مشتری «{deletingCustomer?.name ?? ''}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.
          </p>
          <div className="flex justify-end gap-2">
            <Button disabled={deleteMutation.isPending} onClick={() => setDeletingCustomer(undefined)} variant="outline">انصراف</Button>
            <Button
              loading={deleteMutation.isPending}
              onClick={() => {
                if (deletingCustomer) deleteMutation.mutate(deletingCustomer.id);
              }}
              variant="danger"
            >
              حذف
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
