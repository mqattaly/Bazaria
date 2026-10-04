import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/icons/Icon';
import { Badge, Breadcrumb, Button, Card, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { deleteSupplier, getSupplier, updateSupplier, updateSupplierStatus } from './api';
import { SupplierFormDialog } from './SupplierFormDialog';

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 last:border-0 sm:grid-cols-[10rem_1fr] sm:items-center">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="min-w-0 break-words whitespace-pre-line text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return <Badge size="md" variant={isActive ? 'success' : 'neutral'}>{isActive ? 'فعال' : 'غیرفعال'}</Badge>;
}

export function SupplierDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const supplierQuery = useQuery({
    queryKey: ['supplier', id],
    queryFn: ({ signal }) => getSupplier(id, signal),
    enabled: Boolean(id),
  });
  const updateMutation = useMutation({ mutationFn: ({ supplierId, input }: { supplierId: string; input: Parameters<typeof updateSupplier>[1] }) => updateSupplier(supplierId, input) });
  const statusMutation = useMutation({
    mutationFn: ({ supplierId, isActive }: { supplierId: string; isActive: boolean }) => updateSupplierStatus(supplierId, isActive),
    onSuccess: async (supplier) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['supplier', id] }),
        queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
      ]);
      toast.success(supplier.isActive ? 'تأمین‌کننده فعال شد.' : 'تأمین‌کننده غیرفعال شد.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تغییر وضعیت انجام نشد.'),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('تأمین‌کننده حذف شد.');
      navigate('/suppliers', { replace: true });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'حذف تأمین‌کننده انجام نشد.'),
  });
  const supplier = supplierQuery.data;

  if (supplierQuery.isPending) return <LoadingState label="در حال دریافت جزئیات تأمین‌کننده…" />;
  if (supplierQuery.isError || !supplier) {
    return (
      <ErrorState
        description={supplierQuery.error instanceof Error ? supplierQuery.error.message : 'ممکن است تأمین‌کننده حذف شده باشد یا ارتباط با سرور برقرار نباشد.'}
        onRetry={() => { void supplierQuery.refetch(); }}
        title="جزئیات تأمین‌کننده در دسترس نیست"
      />
    );
  }

  if (editing) {
    return (
      <div className="grid gap-6 sm:gap-7">
        <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'تأمین‌کنندگان', to: '/suppliers' }, { label: supplier.name, to: `/suppliers/${supplier.id}` }, { label: 'ویرایش' }]} />
        <PageHeader description="اطلاعات تماس تأمین‌کننده را به‌روزرسانی کنید." title={`ویرایش ${supplier.name}`} />
        <SupplierFormDialog
          key={supplier.id}
          onOpenChange={(open) => { if (!open) setEditing(false); }}
          onSave={async (input) => {
            const { name, phone, email, address, note } = input;
            await updateMutation.mutateAsync({ supplierId: supplier.id, input: { name, phone, email, address, note } });
            setEditing(false);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['supplier', supplier.id] }),
              queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
            ]);
            toast.success('اطلاعات تأمین‌کننده ذخیره شد.');
          }}
          open
          saving={updateMutation.isPending}
          supplier={supplier}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:gap-7">
      <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'تأمین‌کنندگان', to: '/suppliers' }, { label: supplier.name }]} />
      <PageHeader
        actions={(
          <>
            <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" to={`/purchases?supplierId=${encodeURIComponent(supplier.id)}`}>
              <Icon name="receipt" size={17} />خریدهای این تأمین‌کننده
            </Link>
            <Button disabled={!supplier.isActive} onClick={() => navigate(`/purchases/new?supplierId=${encodeURIComponent(supplier.id)}`)} title={!supplier.isActive ? 'برای ثبت خرید ابتدا تأمین‌کننده را فعال کنید.' : undefined}><Icon name="plus" size={17} />ثبت خرید</Button>
          </>
        )}
        description="اطلاعات تماس و وضعیت همکاری را مشاهده یا ویرایش کنید."
        eyebrow={<StatusBadge isActive={supplier.isActive} />}
        title={supplier.name}
      />

      <Card as="section" aria-labelledby="supplier-info-title" padded>
        <h2 className="mb-2 text-base font-bold text-foreground" id="supplier-info-title">اطلاعات تأمین‌کننده</h2>
        <dl>
          <DetailField label="شماره تماس" value={supplier.phone ? <bdi dir="ltr">{supplier.phone}</bdi> : 'ثبت نشده'} />
          <DetailField label="ایمیل" value={supplier.email ? <bdi dir="ltr">{supplier.email}</bdi> : 'ثبت نشده'} />
          <DetailField label="آدرس" value={supplier.address || 'ثبت نشده'} />
          <DetailField label="یادداشت" value={supplier.note || 'یادداشتی ثبت نشده است.'} />
          <DetailField label="تاریخ ثبت" value={<time dateTime={supplier.createdAt}>{new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeZone: 'Asia/Tehran' }).format(new Date(supplier.createdAt))}</time>} />
        </dl>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setEditing(true)} variant="outline"><Icon name="settings" size={17} />ویرایش اطلاعات</Button>
        <Button
          disabled={statusMutation.isPending}
          onClick={() => statusMutation.mutate({ supplierId: supplier.id, isActive: !supplier.isActive })}
          variant="outline"
        >
          {supplier.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
        </Button>
        <Button onClick={() => setDeleteOpen(true)} variant="danger"><Icon name="close" size={17} />حذف</Button>
      </div>

      <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" to="/suppliers">
        <Icon name="chevron-right" size={17} />بازگشت به فهرست تأمین‌کنندگان
      </Link>

      <Modal
        description="اگر این تأمین‌کننده سابقهٔ خرید داشته باشد، حذف نمی‌شود؛ می‌توانید آن را غیرفعال کنید."
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title="حذف تأمین‌کننده"
      >
        <div className="grid gap-5">
          <p className="text-sm leading-6 text-muted">آیا از حذف «{supplier.name}» مطمئن هستید؟</p>
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button disabled={deleteMutation.isPending} onClick={() => setDeleteOpen(false)} variant="outline">بازگشت</Button>
            <Button loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(supplier.id)} variant="danger">حذف تأمین‌کننده</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
