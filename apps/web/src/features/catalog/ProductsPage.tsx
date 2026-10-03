import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { CategoryListItem, Product, ProductListQuery } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Badge, Breadcrumb, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Pagination, Select, Table, type TableColumn } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { createProduct, deleteProduct, listCategories, listProducts, updateProduct } from './api';
import { PRODUCT_UNIT_LABELS, formatToman } from './catalog.constants';
import { ProductActionsMenu } from './ProductActionsMenu';
import { ProductFormDialog } from './ProductFormDialog';
import { useDebouncedValue } from './useDebouncedValue';
import { Modal } from '../../components/ui/Modal';

const pageSize = 20;

type ActiveFilter = 'all' | 'active' | 'inactive';

export function ProductsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput);
  const [categoryId, setCategoryId] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product>();
  const [deletingProduct, setDeletingProduct] = useState<Product>();

  const createFromQuickAction = searchParams.get('create') === '1';
  useEffect(() => {
    if (!createFromQuickAction) return;
    setEditingProduct(undefined);
    setFormOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });
  }, [createFromQuickAction, searchParams, setSearchParams]);

  const activeValue = activeFilter === 'all' ? undefined : activeFilter === 'active';
  const filters = useMemo<ProductListQuery>(() => ({
    search,
    categoryId: categoryId || undefined,
    isActive: activeValue,
    page,
    pageSize,
  }), [activeValue, categoryId, page, search]);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => listCategories(signal),
  });
  const productsQuery = useQuery({
    queryKey: ['products', filters],
    queryFn: ({ signal }) => listProducts(filters, signal),
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({ mutationFn: createProduct });
  const updateMutation = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateProduct>[1] }) => updateProduct(id, patch) });
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateProduct(id, { isActive }),
    onSuccess: async (_, variables) => {
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(variables.isActive ? 'محصول فعال شد.' : 'محصول غیرفعال شد.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تغییر وضعیت محصول انجام نشد.'),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      setDeletingProduct(undefined);
      setPage(1);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
      ]);
      toast.success('محصول حذف شد.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'حذف محصول انجام نشد.'),
  });

  const categoryItems = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const categoryNames = useMemo(
    () => new Map<string, CategoryListItem>(categoryItems.map((category) => [category.id, category])),
    [categoryItems],
  );

  async function saveProduct(input: Parameters<typeof createProduct>[0]): Promise<void> {
    if (editingProduct) await updateMutation.mutateAsync({ id: editingProduct.id, patch: input });
    else await createMutation.mutateAsync(input);
    setFormOpen(false);
    setEditingProduct(undefined);
    setPage(1);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
    ]);
    toast.success(editingProduct ? 'تغییرات محصول ذخیره شد.' : 'محصول جدید ثبت شد.');
  }

  function openCreateForm(): void {
    setEditingProduct(undefined);
    setFormOpen(true);
  }

  function openEditForm(product: Product): void {
    setEditingProduct(product);
    setFormOpen(true);
  }

  const columns = useMemo<readonly TableColumn<Product>[]>(() => [
    {
      id: 'product',
      header: 'محصول',
      cell: (product) => (
        <div className="min-w-32">
          <p className="font-bold text-foreground">{product.name}</p>
          {product.description ? <p className="mt-0.5 max-w-52 truncate text-xs text-muted">{product.description}</p> : null}
        </div>
      ),
    },
    { id: 'sku', header: 'کد کالا', cell: (product) => <bdi className="font-mono text-xs text-muted">{product.sku}</bdi> },
    {
      id: 'category',
      header: 'دسته‌بندی',
      cell: (product) => categoryNames.get(product.categoryId)?.name ?? 'دسته‌بندی حذف‌شده',
    },
    { id: 'unit', header: 'واحد', cell: (product) => PRODUCT_UNIT_LABELS[product.unit] },
    { id: 'sale-price', header: 'قیمت فروش', align: 'end', cell: (product) => <bdi className="font-semibold">{formatToman(product.salePrice)}</bdi> },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (product) => <Badge variant={product.isActive ? 'success' : 'neutral'}>{product.isActive ? 'فعال' : 'غیرفعال'}</Badge>,
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'center',
      cell: (product) => (
        <ProductActionsMenu
          busy={toggleMutation.isPending || deleteMutation.isPending}
          isActive={product.isActive}
          onDelete={() => setDeletingProduct(product)}
          onEdit={() => openEditForm(product)}
          onToggleActive={() => toggleMutation.mutate({ id: product.id, isActive: !product.isActive })}
          onView={() => navigate(`/products/${product.id}`)}
          productName={product.name}
        />
      ),
    },
  ], [categoryNames, deleteMutation.isPending, navigate, toggleMutation]);

  const data = productsQuery.data;
  const hasFilters = Boolean(searchInput.trim() || categoryId || activeFilter !== 'all');
  const loading = productsQuery.isPending || categoriesQuery.isPending;
  const error = productsQuery.error ?? categoriesQuery.error;

  return (
    <div className="grid gap-6 sm:gap-7">
      <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'محصولات' }]} />
      <PageHeader
        actions={<Button onClick={openCreateForm}><Icon name="plus" size={18} />افزودن محصول</Button>}
        description="فهرست محصولات و اطلاعات پایهٔ آن‌ها را مدیریت کنید."
        title="مدیریت محصولات"
      />

      <Card as="section" aria-label="فیلتر محصولات" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(15rem,1fr)_minmax(11rem,0.65fr)_minmax(10rem,0.55fr)]" padded>
        <Input
          label="جستجوی محصولات"
          onChange={(event) => {
            setSearchInput(event.currentTarget.value);
            setPage(1);
          }}
          placeholder="نام محصول یا کد کالا"
          startIcon="search"
          type="search"
          value={searchInput}
        />
        <Select
          label="دسته‌بندی"
          onChange={(event) => {
            setCategoryId(event.currentTarget.value);
            setPage(1);
          }}
          options={categoryItems.map((category) => ({ value: category.id, label: category.name }))}
          placeholder="همهٔ دسته‌بندی‌ها"
          value={categoryId}
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

      {loading ? <LoadingState label="در حال دریافت محصولات…" /> : error ? (
        <ErrorState description="دریافت فهرست محصولات با مشکل مواجه شد." onRetry={() => {
          void productsQuery.refetch();
          void categoriesQuery.refetch();
        }} />
      ) : data && data.items.length === 0 ? (
        <Card>
          <EmptyState
            action={hasFilters
              ? <Button onClick={() => {
                  setSearchInput('');
                  setCategoryId('');
                  setActiveFilter('all');
                  setPage(1);
                }} variant="outline">پاک کردن فیلترها</Button>
              : <Button onClick={openCreateForm}><Icon name="plus" size={17} />افزودن محصول</Button>}
            description={hasFilters
              ? 'فیلترها را تغییر دهید یا برای دیدن همهٔ محصولات آن‌ها را پاک کنید.'
              : 'برای شروع، اولین محصول فروشگاه را ثبت کنید.'}
            icon="box"
            title={hasFilters ? 'محصولی با این مشخصات پیدا نشد' : 'هنوز محصولی ثبت نشده است'}
          />
        </Card>
      ) : data ? (
        <>
          <div className="hidden md:block">
            <Table
              ariaLabel="فهرست محصولات"
              caption="محصولات ثبت‌شده در بازاریا"
              columns={columns}
              getRowId={(product) => product.id}
              rows={data.items}
            />
          </div>
          <div aria-label="فهرست محصولات" className="grid gap-3 md:hidden" role="region">
            {data.items.map((product) => (
              <Card as="article" className="p-4" key={product.id} padded={false}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button className="text-start text-base font-bold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => navigate(`/products/${product.id}`)} type="button">
                      {product.name}
                    </button>
                    <p className="mt-1 font-mono text-xs text-muted"><bdi>{product.sku}</bdi></p>
                  </div>
                  <ProductActionsMenu
                    busy={toggleMutation.isPending || deleteMutation.isPending}
                    isActive={product.isActive}
                    onDelete={() => setDeletingProduct(product)}
                    onEdit={() => openEditForm(product)}
                    onToggleActive={() => toggleMutation.mutate({ id: product.id, isActive: !product.isActive })}
                    onView={() => navigate(`/products/${product.id}`)}
                    productName={product.name}
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
                  <span>{categoryNames.get(product.categoryId)?.name ?? 'دسته‌بندی حذف‌شده'}</span>
                  <span aria-hidden="true" className="size-1 rounded-full bg-border" />
                  <span>{PRODUCT_UNIT_LABELS[product.unit]}</span>
                  <Badge variant={product.isActive ? 'success' : 'neutral'}>{product.isActive ? 'فعال' : 'غیرفعال'}</Badge>
                </div>
                <p className="mt-3 text-sm font-bold text-foreground"><bdi>{formatToman(product.salePrice)}</bdi></p>
              </Card>
            ))}
          </div>
          {data.pagination.totalPages > 1 ? (
            <Pagination onPageChange={setPage} page={page} totalPages={data.pagination.totalPages} />
          ) : null}
        </>
      ) : null}

      <ProductFormDialog
        categories={categoryItems}
        key={`${formOpen}-${editingProduct?.id ?? 'new'}`}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingProduct(undefined);
        }}
        onSave={saveProduct}
        open={formOpen}
        product={editingProduct}
        saving={createMutation.isPending || updateMutation.isPending}
      />

      <Modal
        description="این عملیات قابل بازگشت نیست."
        onOpenChange={(open) => {
          if (!open) setDeletingProduct(undefined);
        }}
        open={Boolean(deletingProduct)}
        title="حذف محصول"
      >
        <div className="grid gap-5">
          <p className="text-sm leading-6 text-muted">
            آیا از حذف محصول «{deletingProduct?.name ?? ''}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.
          </p>
          <div className="flex justify-end gap-2">
            <Button disabled={deleteMutation.isPending} onClick={() => setDeletingProduct(undefined)} variant="outline">انصراف</Button>
            <Button
              loading={deleteMutation.isPending}
              onClick={() => {
                if (deletingProduct) deleteMutation.mutate(deletingProduct.id);
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
