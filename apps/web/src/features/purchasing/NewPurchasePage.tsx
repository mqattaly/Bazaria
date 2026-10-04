import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Breadcrumb, PageHeader } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { createPurchase } from './api';
import { PurchaseComposer } from './PurchaseComposer';

export function NewPurchasePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const createMutation = useMutation({ mutationFn: createPurchase });

  async function savePurchase(input: Parameters<typeof createPurchase>[0]): Promise<void> {
    const purchase = await createMutation.mutateAsync(input);
    await queryClient.invalidateQueries({ queryKey: ['purchases'] });
    toast.success('پیش‌نویس خرید ثبت شد.');
    navigate(`/purchases/${purchase.id}`);
  }

  return (
    <div className="grid gap-6 sm:gap-7">
      <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'خریدها', to: '/purchases' }, { label: 'ثبت خرید' }]} />
      <PageHeader description="تأمین‌کننده، اقلام، قیمت خرید، تخفیف و یادداشت را وارد کنید." title="ثبت خرید جدید" />
      <PurchaseComposer
        initialSupplierId={searchParams.get('supplierId') ?? undefined}
        onSubmit={savePurchase}
        saving={createMutation.isPending}
        submitLabel="ذخیرهٔ پیش‌نویس خرید"
      />
    </div>
  );
}
