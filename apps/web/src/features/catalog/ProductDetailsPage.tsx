import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { CreateProductInput, UpdateProductInput } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Badge, Breadcrumb, Button, Card, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { listCategories, getProduct, updateProduct } from './api';
import { PRODUCT_UNIT_LABELS, formatToman } from './catalog.constants';
import { ProductFormDialog } from './ProductFormDialog';

const persianDateTime = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
});

function formatDate(value: string): string {
  return persianDateTime.format(new Date(value));
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 last:border-0 sm:grid-cols-[10rem_1fr] sm:items-center">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

export function ProductDetailsPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const productQuery = useQuery({
    queryKey: ['product', id],
    queryFn: ({ signal }) => getProduct(id, signal),
    enabled: Boolean(id),
  });
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => listCategories(signal),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id: productId, input }: { id: string; input: UpdateProductInput }) => updateProduct(productId, input),
  });
  const product = productQuery.data;
  const category = useMemo(
    () => categoriesQuery.data?.find((item) => item.id === product?.categoryId),
    [categoriesQuery.data, product?.categoryId],
  );

  async function saveProduct(input: CreateProductInput): Promise<void> {
    if (!product) return;
    await updateMutation.mutateAsync({ id: product.id, input });
    setFormOpen(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['product', id] }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
    ]);
    toast.success('تغییرات محصول ذخیره شد.');
  }

  if (productQuery.isPending) return <LoadingState label="در حال دریافت جزئیات محصول…" />;
  if (productQuery.isError || !product) {
    return (
      <ErrorState
        description="دریافت اطلاعات محصول با مشکل مواجه شد. ممکن است محصول حذف شده باشد."
        onRetry={() => { void productQuery.refetch(); }}
        title="جزئیات محصول در دسترس نیست"
      />
    );
  }

  return (
    <div className="grid gap-6 sm:gap-7">
      <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'محصولات', to: '/products' }, { label: product.name }]} />
      <PageHeader
        actions={
          <>
            <Badge size="md" variant={product.isActive ? 'success' : 'neutral'}>{product.isActive ? 'فعال' : 'غیرفعال'}</Badge>
            <Button onClick={() => setFormOpen(true)} variant="outline">ویرایش محصول</Button>
          </>
        }
        description={`کد کالا: ${product.sku}`}
        title={product.name}
      />

      <Card as="section" aria-labelledby="product-details-title">
        <h2 className="mb-2 text-base font-bold text-foreground" id="product-details-title">اطلاعات محصول</h2>
        <dl className="divide-y divide-border">
          <DetailField label="کد کالا" value={product.sku} />
          <DetailField label="دسته‌بندی" value={category?.name ?? 'دسته‌بندی در دسترس نیست'} />
          <DetailField label="واحد" value={PRODUCT_UNIT_LABELS[product.unit]} />
          <DetailField label="قیمت خرید" value={product.purchasePrice === null ? 'ثبت نشده' : formatToman(product.purchasePrice)} />
          <DetailField label="قیمت فروش" value={formatToman(product.salePrice)} />
          <DetailField label="وضعیت" value={product.isActive ? 'فعال' : 'غیرفعال'} />
          <DetailField label="توضیحات" value={product.description || 'توضیحاتی ثبت نشده است.'} />
          <DetailField label="تاریخ ایجاد" value={formatDate(product.createdAt)} />
          <DetailField label="آخرین ویرایش" value={formatDate(product.updatedAt)} />
        </dl>
        {categoriesQuery.isError ? <p className="mt-3 text-xs text-warning">نام دسته‌بندی در حال حاضر دریافت نشد.</p> : null}
      </Card>

      <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background" to="/products">
        <Icon name="chevron-right" size={17} />
        بازگشت به فهرست محصولات
      </Link>

      <ProductFormDialog
        categories={categoriesQuery.data ?? []}
        key={`${formOpen}-${product.id}`}
        onOpenChange={setFormOpen}
        onSave={saveProduct}
        open={formOpen}
        product={product}
        saving={updateMutation.isPending}
      />
    </div>
  );
}
