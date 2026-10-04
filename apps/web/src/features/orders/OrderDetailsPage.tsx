import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { OrderStatus } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Badge, Breadcrumb, Button, Card, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { formatToman, PRODUCT_UNIT_LABELS, persianNumber } from '../catalog/catalog.constants';
import { updateOrder, updateOrderStatus, getOrder } from './api';
import { OrderComposer } from './OrderComposer';
import { formatOrderDate, ORDER_STATUS_LABELS, ORDER_STATUS_VARIANTS } from './orders.constants';

function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge size="md" variant={ORDER_STATUS_VARIANTS[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 last:border-0 sm:grid-cols-[10rem_1fr] sm:items-center">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="min-w-0 break-words whitespace-pre-line text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

export function OrderDetailsPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [statusAction, setStatusAction] = useState<'confirmed' | 'cancelled' | null>(null);
  const orderQuery = useQuery({
    queryKey: ['order', id],
    queryFn: ({ signal }) => getOrder(id, signal),
    enabled: Boolean(id),
  });
  const updateMutation = useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: Parameters<typeof updateOrder>[1] }) => updateOrder(orderId, input),
    onSuccess: async () => {
      setEditing(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['order', id] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ]);
      toast.success('تغییرات پیش‌نویس ذخیره شد.');
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: 'confirmed' | 'cancelled' }) => updateOrderStatus(orderId, status),
    onSuccess: async (updated) => {
      setStatusAction(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['order', id] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ]);
      toast.success(updated.status === 'confirmed' ? 'سفارش تأیید شد.' : 'سفارش لغو شد.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تغییر وضعیت سفارش انجام نشد.'),
  });
  const order = orderQuery.data;

  if (orderQuery.isPending) return <LoadingState label="در حال دریافت جزئیات سفارش…" />;
  if (orderQuery.isError || !order) {
    return (
      <ErrorState
        description={orderQuery.error instanceof Error ? orderQuery.error.message : 'ممکن است سفارش حذف شده باشد یا ارتباط با سرور برقرار نباشد.'}
        onRetry={() => { void orderQuery.refetch(); }}
        title="جزئیات سفارش در دسترس نیست"
      />
    );
  }

  const canEdit = order.status === 'draft';
  const canConfirm = order.status === 'draft';
  const canCancel = order.status === 'draft' || order.status === 'confirmed';

  if (editing && canEdit) {
    return (
      <div className="grid gap-6 sm:gap-7">
        <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'سفارش‌ها', to: '/orders' }, { label: order.orderNumber, to: `/orders/${order.id}` }, { label: 'ویرایش پیش‌نویس' }]} />
        <PageHeader description="پیش‌نویس را ویرایش کنید؛ قیمت محصولات و مبالغ هنگام ذخیره در سرور دوباره بررسی می‌شوند." title={`ویرایش ${order.orderNumber}`} />
        <OrderComposer
          initialOrder={order}
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => { await updateMutation.mutateAsync({ orderId: order.id, input }); }}
          saving={updateMutation.isPending}
          submitLabel="ذخیرهٔ تغییرات"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:gap-7">
      <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'سفارش‌ها', to: '/orders' }, { label: order.orderNumber }]} />
      <PageHeader
        actions={
          <>
            <StatusBadge status={order.status} />
            {canEdit ? <Button onClick={() => setEditing(true)} variant="outline"><Icon name="settings" size={17} />ویرایش پیش‌نویس</Button> : null}
            {canConfirm ? <Button onClick={() => setStatusAction('confirmed')}><Icon name="check" size={17} />تأیید سفارش</Button> : null}
            {canCancel ? <Button onClick={() => setStatusAction('cancelled')} variant="danger">لغو سفارش</Button> : null}
          </>
        }
        description="جزئیات، اقلام و وضعیت این سفارش را مشاهده کنید."
        title={order.orderNumber}
      />

      <Card as="section" aria-labelledby="order-information-heading">
        <h2 className="mb-2 text-base font-bold text-foreground" id="order-information-heading">اطلاعات سفارش</h2>
        <dl className="divide-y divide-border">
          <DetailField label="وضعیت" value={<StatusBadge status={order.status} />} />
          <DetailField
            label="مشتری"
            value={order.customer
              ? <Link className="text-primary hover:underline" to={`/customers/${order.customer.id}`}>{order.customer.name}</Link>
              : 'مشتری انتخاب نشده یا حذف شده است'}
          />
          {order.customer?.phone ? <DetailField label="شماره تماس" value={<bdi className="font-mono" dir="ltr">{order.customer.phone}</bdi>} /> : null}
          <DetailField label="تاریخ ثبت" value={<time dateTime={order.createdAt}>{formatOrderDate(order.createdAt)}</time>} />
          <DetailField label="آخرین ویرایش" value={<time dateTime={order.updatedAt}>{formatOrderDate(order.updatedAt)}</time>} />
          {order.confirmedAt ? <DetailField label="تاریخ تأیید" value={<time dateTime={order.confirmedAt}>{formatOrderDate(order.confirmedAt)}</time>} /> : null}
          {order.cancelledAt ? <DetailField label="تاریخ لغو" value={<time dateTime={order.cancelledAt}>{formatOrderDate(order.cancelledAt)}</time>} /> : null}
          <DetailField label="یادداشت" value={order.note || 'یادداشتی ثبت نشده است.'} />
        </dl>
      </Card>

      <Card as="section" aria-labelledby="order-items-heading" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-foreground" id="order-items-heading">اقلام سفارش</h2>
          <Badge variant="neutral">{persianNumber.format(order.items.length)} قلم</Badge>
        </div>
        {order.items.length > 0 ? (
          <div className="grid gap-2">
            {order.items.map((item) => (
              <article className="grid gap-2 border-b border-border pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center" key={item.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{item.productName}</p>
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                    <bdi dir="ltr">{item.sku}</bdi>
                    <span aria-hidden="true">·</span>
                    <span>{formatToman(item.unitPrice)} × {persianNumber.format(item.quantity)} {PRODUCT_UNIT_LABELS[item.unit]}</span>
                  </p>
                </div>
                <span className="text-xs text-muted">تعداد: <bdi className="font-semibold text-foreground">{persianNumber.format(item.quantity)}</bdi></span>
                <bdi className="text-sm font-bold text-foreground">{formatToman(item.total)}</bdi>
              </article>
            ))}
          </div>
        ) : <p className="text-sm text-muted">قلمی برای این سفارش ثبت نشده است.</p>}
      </Card>

      <Card as="section" aria-labelledby="order-totals-heading" className="grid gap-3 sm:ms-auto sm:w-full sm:max-w-md">
        <h2 className="text-base font-bold text-foreground" id="order-totals-heading">خلاصهٔ مبلغ</h2>
        <div className="flex items-center justify-between gap-3 text-sm text-muted"><span>جمع اقلام</span><bdi className="font-semibold text-foreground">{formatToman(order.subtotal)}</bdi></div>
        <div className="flex items-center justify-between gap-3 text-sm text-muted"><span>تخفیف</span><bdi className="font-semibold text-foreground">{formatToman(order.discount)}</bdi></div>
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between gap-3 text-foreground"><span className="font-bold">مبلغ نهایی</span><bdi className="text-lg font-extrabold">{formatToman(order.total)}</bdi></div>
        </div>
      </Card>

      <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background" to="/orders">
        <Icon name="chevron-right" size={17} />بازگشت به فهرست سفارش‌ها
      </Link>

      <Modal
        description={statusAction === 'confirmed'
          ? 'پس از تأیید، اقلام و مبلغ سفارش دیگر قابل ویرایش نیستند.'
          : 'لغو، سفارش را برای همیشه از حالت قابل ویرایش خارج می‌کند. سابقهٔ آن برای پیگیری باقی می‌ماند.'}
        onOpenChange={(open) => { if (!open) setStatusAction(null); }}
        open={statusAction !== null}
        title={statusAction === 'confirmed' ? 'تأیید سفارش' : 'لغو سفارش'}
      >
        <div className="grid gap-5">
          <p className="text-sm leading-6 text-muted">
            {statusAction === 'confirmed'
              ? `آیا سفارش ${order.orderNumber} را تأیید می‌کنید؟ پس از این کار امکان ویرایش جزئیات وجود ندارد.`
              : `آیا از لغو سفارش ${order.orderNumber} مطمئن هستید؟ این سفارش حذف نمی‌شود و در سوابق باقی می‌ماند.`}
          </p>
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button disabled={statusMutation.isPending} onClick={() => setStatusAction(null)} variant="outline">بازگشت</Button>
            <Button
              loading={statusMutation.isPending}
              onClick={() => {
                if (statusAction) statusMutation.mutate({ orderId: order.id, status: statusAction });
              }}
              variant={statusAction === 'cancelled' ? 'danger' : 'primary'}
            >
              {statusAction === 'confirmed' ? 'بله، تأیید سفارش' : 'بله، لغو سفارش'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
