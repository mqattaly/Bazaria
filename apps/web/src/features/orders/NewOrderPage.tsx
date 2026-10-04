import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Breadcrumb, PageHeader } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { createOrder } from './api';
import { OrderComposer } from './OrderComposer';

export function NewOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const createMutation = useMutation({ mutationFn: createOrder });

  async function saveOrder(input: Parameters<typeof createOrder>[0]): Promise<void> {
    const order = await createMutation.mutateAsync(input);
    await queryClient.invalidateQueries({ queryKey: ['orders'] });
    toast.success('سفارش پیش‌نویس ثبت شد.');
    navigate(`/orders/${order.id}`);
  }

  return (
    <div className="grid gap-6 sm:gap-7">
      <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'سفارش‌ها', to: '/orders' }, { label: 'ثبت سفارش' }]} />
      <PageHeader description="مشتری، اقلام، تخفیف و یادداشت سفارش را وارد کنید." title="ثبت سفارش جدید" />
      <OrderComposer onSubmit={saveOrder} saving={createMutation.isPending} submitLabel="ذخیرهٔ پیش‌نویس" />
    </div>
  );
}
