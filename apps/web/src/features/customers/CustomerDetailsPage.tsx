import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/icons/Icon';
import { Badge, Breadcrumb, Button, Card, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { deleteCustomer, getCustomer, updateCustomer } from './api';
import { CustomerFormDialog } from './CustomerFormDialog';

const persianDateTime = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
});

function formatDate(value: string): string {
  return persianDateTime.format(new Date(value));
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 last:border-0 sm:grid-cols-[10rem_1fr] sm:items-center">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="min-w-0 break-words whitespace-pre-line text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

export function CustomerDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const customerQuery = useQuery({
    queryKey: ['customer', id],
    queryFn: ({ signal }) => getCustomer(id, signal),
    enabled: Boolean(id),
  });
  const updateMutation = useMutation({
    mutationFn: ({ customerId, input }: { customerId: string; input: Parameters<typeof updateCustomer>[1] }) => updateCustomer(customerId, input),
  });
  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) => updateCustomer(id, { isActive }),
    onSuccess: async (_, isActive) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['customer', id] }),
        queryClient.invalidateQueries({ queryKey: ['customers'] }),
      ]);
      toast.success(isActive ? 'مشتری فعال شد.' : 'مشتری غیرفعال شد.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تغییر وضعیت مشتری انجام نشد.'),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: async () => {
      setDeleteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('مشتری حذف شد.');
      navigate('/customers');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'حذف مشتری انجام نشد.'),
  });
  const customer = customerQuery.data;

  async function saveCustomer(input: Parameters<typeof updateCustomer>[1]): Promise<void> {
    if (!customer) return;
    await updateMutation.mutateAsync({ customerId: customer.id, input });
    setFormOpen(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['customer', id] }),
      queryClient.invalidateQueries({ queryKey: ['customers'] }),
    ]);
    toast.success('تغییرات مشتری ذخیره شد.');
  }

  if (customerQuery.isPending) return <LoadingState label="در حال دریافت جزئیات مشتری…" />;
  if (customerQuery.isError || !customer) {
    return (
      <ErrorState
        description="دریافت اطلاعات مشتری با مشکل مواجه شد. ممکن است مشتری حذف شده باشد."
        onRetry={() => { void customerQuery.refetch(); }}
        title="جزئیات مشتری در دسترس نیست"
      />
    );
  }

  return (
    <div className="grid gap-6 sm:gap-7">
      <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'مشتریان', to: '/customers' }, { label: customer.name }]} />
      <PageHeader
        actions={
          <>
            <Badge size="md" variant={customer.isActive ? 'success' : 'neutral'}>{customer.isActive ? 'فعال' : 'غیرفعال'}</Badge>
            <Button disabled={toggleMutation.isPending} onClick={() => toggleMutation.mutate(!customer.isActive)} variant="outline">
              {customer.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
            </Button>
            <Button onClick={() => setFormOpen(true)} variant="outline">ویرایش مشتری</Button>
            <Button onClick={() => setDeleteOpen(true)} variant="danger">حذف مشتری</Button>
          </>
        }
        description="اطلاعات تماس و وضعیت مشتری را مشاهده و ویرایش کنید."
        title={customer.name}
      />

      <Card as="section" aria-labelledby="customer-details-title">
        <h2 className="mb-2 text-base font-bold text-foreground" id="customer-details-title">اطلاعات مشتری</h2>
        <dl className="divide-y divide-border">
          <DetailField label="نام مشتری" value={customer.name} />
          <DetailField label="شماره تماس" value={customer.phone ? <bdi dir="ltr" className="font-mono">{customer.phone}</bdi> : 'ثبت نشده'} />
          <DetailField label="ایمیل" value={customer.email ? <bdi dir="ltr">{customer.email}</bdi> : 'ثبت نشده'} />
          <DetailField label="آدرس" value={customer.address || 'ثبت نشده'} />
          <DetailField label="توضیحات" value={customer.description || 'توضیحاتی ثبت نشده است.'} />
          <DetailField label="وضعیت" value={customer.isActive ? 'فعال' : 'غیرفعال'} />
          <DetailField label="تاریخ ایجاد" value={formatDate(customer.createdAt)} />
          <DetailField label="آخرین ویرایش" value={formatDate(customer.updatedAt)} />
        </dl>
      </Card>

      <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background" to="/customers">
        <Icon name="chevron-right" size={17} />
        بازگشت به فهرست مشتریان
      </Link>

      <CustomerFormDialog
        key={`${formOpen}-${customer.id}`}
        onOpenChange={setFormOpen}
        onSave={saveCustomer}
        open={formOpen}
        customer={customer}
        saving={updateMutation.isPending}
      />

      <Modal
        description="این عملیات قابل بازگشت نیست."
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title="حذف مشتری"
      >
        <div className="grid gap-5">
          <p className="text-sm leading-6 text-muted">
            آیا از حذف مشتری «{customer.name}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.
          </p>
          <div className="flex justify-end gap-2">
            <Button disabled={deleteMutation.isPending} onClick={() => setDeleteOpen(false)} variant="outline">انصراف</Button>
            <Button loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(customer.id)} variant="danger">حذف</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
