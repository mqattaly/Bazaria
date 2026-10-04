import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { PurchaseStatus } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Badge, Breadcrumb, Button, Card, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { formatToman, PRODUCT_UNIT_LABELS } from '../catalog/catalog.constants';
import { getPurchase, updatePurchase, updatePurchaseStatus } from './api';
import { PurchaseComposer } from './PurchaseComposer';
import { formatPurchaseDate, PURCHASE_STATUS_LABELS, PURCHASE_STATUS_VARIANTS } from './purchasing.constants';

function StatusBadge({ status }: { status: PurchaseStatus }) {
  return <Badge size="md" variant={PURCHASE_STATUS_VARIANTS[status]}>{PURCHASE_STATUS_LABELS[status]}</Badge>;
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 last:border-0 sm:grid-cols-[10rem_1fr] sm:items-center">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="min-w-0 break-words whitespace-pre-line text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

export function PurchaseDetailsPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [statusAction, setStatusAction] = useState<'confirmed' | 'cancelled' | null>(null);
  const purchaseQuery = useQuery({
    queryKey: ['purchase', id],
    queryFn: ({ signal }) => getPurchase(id, signal),
    enabled: Boolean(id),
  });
  const updateMutation = useMutation({
    mutationFn: ({ purchaseId, input }: { purchaseId: string; input: Parameters<typeof updatePurchase>[1] }) => updatePurchase(purchaseId, input),
    onSuccess: async () => {
      setEditing(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['purchase', id] }),
        queryClient.invalidateQueries({ queryKey: ['purchases'] }),
      ]);
      toast.success('تغییرات پیش‌نویس خرید ذخیره شد.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'ویرایش خرید انجام نشد.'),
  });
  const statusMutation = useMutation({
    mutationFn: ({ purchaseId, status }: { purchaseId: string; status: 'confirmed' | 'cancelled' }) => updatePurchaseStatus(purchaseId, status),
    onSuccess: async (updated) => {
      setStatusAction(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['purchase', id] }),
        queryClient.invalidateQueries({ queryKey: ['purchases'] }),
        ...(updated.status === 'confirmed' ? [queryClient.invalidateQueries({ queryKey: ['inventory'] })] : []),
      ]);
      toast.success(updated.status === 'confirmed' ? 'خرید نهایی شد و موجودی به‌روزرسانی شد.' : 'پیش‌نویس خرید لغو شد.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تغییر وضعیت خرید انجام نشد.'),
  });
  const purchase = purchaseQuery.data;

  if (purchaseQuery.isPending) return <LoadingState label="در حال دریافت جزئیات خرید…" />;
  if (purchaseQuery.isError || !purchase) {
    return (
      <ErrorState
        description={purchaseQuery.error instanceof Error ? purchaseQuery.error.message : 'ممکن است خرید پیدا نشده باشد یا ارتباط با سرور برقرار نباشد.'}
        onRetry={() => { void purchaseQuery.refetch(); }}
        title="جزئیات خرید در دسترس نیست"
      />
    );
  }

  if (editing && purchase.status === 'draft') {
    return (
      <div className="grid gap-6 sm:gap-7">
        <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'خریدها', to: '/purchases' }, { label: purchase.purchaseNumber, to: `/purchases/${purchase.id}` }, { label: 'ویرایش پیش‌نویس' }]} />
        <PageHeader description="پیش‌نویس را ویرایش کنید؛ مبالغ و وضعیت محصولات هنگام ذخیره در سرور دوباره بررسی می‌شوند." title={`ویرایش ${purchase.purchaseNumber}`} />
        <PurchaseComposer
          initialPurchase={purchase}
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => { await updateMutation.mutateAsync({ purchaseId: purchase.id, input }); }}
          saving={updateMutation.isPending}
          submitLabel="ذخیرهٔ پیش‌نویس"
        />
      </div>
    );
  }

  const canEdit = purchase.status === 'draft';

  return (
    <div className="grid gap-6 sm:gap-7">
      <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'خریدها', to: '/purchases' }, { label: purchase.purchaseNumber }]} />
      <PageHeader
        actions={canEdit ? (
          <>
            <Button onClick={() => setEditing(true)} variant="outline"><Icon name="settings" size={17} />ویرایش پیش‌نویس</Button>
            <Button onClick={() => setStatusAction('cancelled')} variant="outline">لغو پیش‌نویس</Button>
            <Button disabled={!purchase.supplier.isActive} onClick={() => setStatusAction('confirmed')} title={!purchase.supplier.isActive ? 'برای نهایی‌سازی، ابتدا تأمین‌کننده را فعال کنید.' : undefined}><Icon name="check" size={17} />نهایی‌سازی خرید</Button>
          </>
        ) : null}
        description="جزئیات خرید، اقلام ثبت‌شده و وضعیت موجودی را بررسی کنید."
        eyebrow={<StatusBadge status={purchase.status} />}
        title={purchase.purchaseNumber}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <Card as="section" aria-labelledby="purchase-details-heading" padded>
          <h2 className="mb-2 text-base font-bold text-foreground" id="purchase-details-heading">اطلاعات خرید</h2>
          <dl>
            <DetailField label="تأمین‌کننده" value={<Link className="text-primary hover:underline" to={`/suppliers/${purchase.supplier.id}`}>{purchase.supplier.name}</Link>} />
            <DetailField label="وضعیت" value={<StatusBadge status={purchase.status} />} />
            <DetailField label="تاریخ ثبت" value={<time dateTime={purchase.createdAt}>{formatPurchaseDate(purchase.createdAt)}</time>} />
            <DetailField label="آخرین ویرایش" value={<time dateTime={purchase.updatedAt}>{formatPurchaseDate(purchase.updatedAt)}</time>} />
            <DetailField label="یادداشت" value={purchase.note || 'یادداشتی ثبت نشده است.'} />
          </dl>
        </Card>

        <Card as="section" aria-labelledby="purchase-supplier-heading" className="grid content-start gap-3" padded>
          <h2 className="text-base font-bold text-foreground" id="purchase-supplier-heading">راه‌های تماس تأمین‌کننده</h2>
          <p className="font-semibold text-foreground">{purchase.supplier.name}</p>
          {purchase.supplier.phone ? <bdi className="text-sm text-muted" dir="ltr">{purchase.supplier.phone}</bdi> : <p className="text-sm text-muted">شماره تماس ثبت نشده</p>}
          {purchase.supplier.email ? <bdi className="text-sm text-muted" dir="ltr">{purchase.supplier.email}</bdi> : <p className="text-sm text-muted">ایمیل ثبت نشده</p>}
          {!purchase.supplier.isActive ? <Badge className="w-fit" variant="neutral">تأمین‌کننده غیرفعال</Badge> : null}
          <Link className="mt-1 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary hover:underline" to={`/suppliers/${purchase.supplier.id}`}>
            مشاهدهٔ مشخصات تأمین‌کننده<Icon name="chevron-left" size={16} />
          </Link>
        </Card>
      </div>

      <Card as="section" aria-labelledby="purchase-lines-heading" className="grid gap-4" padded>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground" id="purchase-lines-heading">اقلام خرید</h2>
            <p className="mt-1 text-xs text-muted">نام، کد و واحد محصول در زمان ثبت خرید ذخیره شده‌اند.</p>
          </div>
          <Badge variant="neutral">{new Intl.NumberFormat('fa-IR').format(purchase.items.length)} قلم</Badge>
        </div>
        <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <caption className="sr-only">اقلام خرید {purchase.purchaseNumber}</caption>
            <thead className="bg-surface-muted text-xs font-semibold text-muted">
              <tr>
                <th className="px-4 py-3 text-start" scope="col">محصول (نسخهٔ ثبت‌شده)</th>
                <th className="px-4 py-3 text-center" scope="col">تعداد</th>
                <th className="px-4 py-3 text-end" scope="col">قیمت واحد</th>
                <th className="px-4 py-3 text-end" scope="col">جمع قلم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {purchase.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-foreground">{item.productNameSnapshot}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted"><bdi dir="ltr">{item.productSkuSnapshot}</bdi><span>{PRODUCT_UNIT_LABELS[item.unitSnapshot]}</span></p>
                  </td>
                  <td className="px-4 py-3.5 text-center"><bdi>{new Intl.NumberFormat('fa-IR').format(item.quantity)}</bdi></td>
                  <td className="px-4 py-3.5 text-end"><bdi>{formatToman(item.unitPrice)}</bdi></td>
                  <td className="px-4 py-3.5 text-end font-semibold"><bdi>{formatToman(item.lineTotal)}</bdi></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div aria-label="اقلام خرید" className="grid gap-3 md:hidden" role="list">
          {purchase.items.map((item) => (
            <article className="rounded-xl border border-border p-3" key={item.id} role="listitem">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-foreground">{item.productNameSnapshot}</h3>
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted"><bdi dir="ltr">{item.productSkuSnapshot}</bdi><span>{PRODUCT_UNIT_LABELS[item.unitSnapshot]}</span></p>
                </div>
                <bdi className="shrink-0 text-sm font-semibold text-foreground">{formatToman(item.lineTotal)}</bdi>
              </div>
              <p className="mt-3 border-t border-border pt-2 text-xs text-muted">
                تعداد {new Intl.NumberFormat('fa-IR').format(item.quantity)} × قیمت واحد {formatToman(item.unitPrice)}
              </p>
            </article>
          ))}
        </div>
      </Card>

      <Card as="section" aria-labelledby="purchase-total-heading" className="ms-auto grid w-full gap-3 sm:max-w-md" padded>
        <h2 className="text-base font-bold text-foreground" id="purchase-total-heading">خلاصهٔ مبلغ</h2>
        <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted">جمع اقلام</span><bdi className="font-semibold text-foreground">{formatToman(purchase.subtotal)}</bdi></div>
        <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted">تخفیف</span><bdi className="font-semibold text-foreground">{formatToman(purchase.discount)}</bdi></div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm"><span className="font-bold text-foreground">مبلغ نهایی</span><bdi className="text-lg font-extrabold text-foreground">{formatToman(purchase.total)}</bdi></div>
      </Card>

      <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" to="/purchases">
        <Icon name="chevron-right" size={17} />بازگشت به فهرست خریدها
      </Link>

      <Modal
        description={statusAction === 'confirmed'
          ? 'با نهایی‌سازی، موجودی هر قلم به‌صورت اتمیک افزایش پیدا می‌کند. خرید نهایی‌شده در این فاز قابل ویرایش یا لغو نیست.'
          : 'لغو پیش‌نویس موجودی انبار را تغییر نمی‌دهد و سابقهٔ خرید باقی می‌ماند.'}
        onOpenChange={(open) => { if (!open) setStatusAction(null); }}
        open={statusAction !== null}
        title={statusAction === 'confirmed' ? 'نهایی‌سازی خرید' : 'لغو پیش‌نویس خرید'}
      >
        <div className="grid gap-5">
          <p className="text-sm leading-6 text-muted">
            {statusAction === 'confirmed'
              ? `آیا خرید ${purchase.purchaseNumber} را نهایی می‌کنید؟ برای هر قلم یک گردش ورود موجودی ثبت خواهد شد.`
              : `آیا از لغو پیش‌نویس ${purchase.purchaseNumber} مطمئن هستید؟ این خرید حذف نمی‌شود و موجودی تغییر نمی‌کند.`}
          </p>
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button disabled={statusMutation.isPending} onClick={() => setStatusAction(null)} variant="outline">بازگشت</Button>
            <Button
              loading={statusMutation.isPending}
              onClick={() => { if (statusAction) statusMutation.mutate({ purchaseId: purchase.id, status: statusAction }); }}
              variant={statusAction === 'cancelled' ? 'danger' : 'primary'}
            >
              {statusAction === 'confirmed' ? 'بله، نهایی‌سازی خرید' : 'بله، لغو پیش‌نویس'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
