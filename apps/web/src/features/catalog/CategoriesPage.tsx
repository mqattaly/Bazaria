import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CategoryListItem, Category } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Badge, Breadcrumb, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Table, type TableColumn } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { CategoryActionsMenu } from './CategoryActionsMenu';
import { createCategory, deleteCategory, listCategories, updateCategory } from './api';
import { CategoryFormDialog } from './CategoryFormDialog';

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => listCategories(signal),
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category>();
  const [deletingCategory, setDeletingCategory] = useState<CategoryListItem>();

  const createMutation = useMutation({ mutationFn: createCategory });
  const updateMutation = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateCategory>[1] }) => updateCategory(id, patch) });
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateCategory(id, { isActive }),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
      ]);
      toast.success(variables.isActive ? 'دسته‌بندی فعال شد.' : 'دسته‌بندی غیرفعال شد.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تغییر وضعیت دسته‌بندی انجام نشد.'),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: async () => {
      setDeletingCategory(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
      ]);
      toast.success('دسته‌بندی حذف شد.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'حذف دسته‌بندی انجام نشد.'),
  });

  const categoryItems = categoriesQuery.data ?? [];
  const columns: readonly TableColumn<CategoryListItem>[] = [
    {
      id: 'name',
      header: 'نام دسته‌بندی',
      cell: (category) => <span className="font-bold text-foreground">{category.name}</span>,
    },
    {
      id: 'description',
      header: 'توضیحات',
      cell: (category) => <span className="block max-w-xs truncate text-muted">{category.description || '—'}</span>,
    },
    { id: 'product-count', header: 'تعداد محصولات', align: 'center', cell: (category) => <bdi>{new Intl.NumberFormat('fa-IR').format(category.productCount)}</bdi> },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (category) => <Badge variant={category.isActive ? 'success' : 'neutral'}>{category.isActive ? 'فعال' : 'غیرفعال'}</Badge>,
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'center',
      cell: (category) => (
        <CategoryActionsMenu
          busy={toggleMutation.isPending || deleteMutation.isPending}
          categoryName={category.name}
          isActive={category.isActive}
          onDelete={() => setDeletingCategory(category)}
          onEdit={() => openEditCategory(category)}
          onToggleActive={() => toggleMutation.mutate({ id: category.id, isActive: !category.isActive })}
          productCount={category.productCount}
        />
      ),
    },
  ];

  async function saveCategory(input: Parameters<typeof createCategory>[0]): Promise<void> {
    if (editingCategory) await updateMutation.mutateAsync({ id: editingCategory.id, patch: input });
    else await createMutation.mutateAsync(input);
    setFormOpen(false);
    setEditingCategory(undefined);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
    ]);
    toast.success(editingCategory ? 'تغییرات دسته‌بندی ذخیره شد.' : 'دسته‌بندی جدید ثبت شد.');
  }

  function openCreateCategory(): void {
    setEditingCategory(undefined);
    setFormOpen(true);
  }

  function openEditCategory(category: Category): void {
    setEditingCategory(category);
    setFormOpen(true);
  }

  return (
    <div className="grid gap-6 sm:gap-7">
      <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'دسته‌بندی‌ها' }]} />
      <PageHeader
        actions={<Button onClick={openCreateCategory}><Icon name="plus" size={18} />افزودن دسته‌بندی</Button>}
        description="دسته‌بندی‌های ساده و تخت برای مرتب‌سازی محصولات بسازید."
        title="مدیریت دسته‌بندی‌ها"
      />

      {categoriesQuery.isPending ? <LoadingState label="در حال دریافت دسته‌بندی‌ها…" /> : categoriesQuery.isError ? (
        <ErrorState description="دریافت دسته‌بندی‌ها با مشکل مواجه شد." onRetry={() => { void categoriesQuery.refetch(); }} />
      ) : categoryItems.length === 0 ? (
        <Card>
          <EmptyState
            action={<Button onClick={openCreateCategory}><Icon name="plus" size={17} />افزودن دسته‌بندی</Button>}
            description="برای نظم بهتر محصولات، اولین دسته‌بندی را ایجاد کنید."
            icon="sparkles"
            title="هنوز دسته‌بندی‌ای ثبت نشده است"
          />
        </Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Table
              ariaLabel="فهرست دسته‌بندی‌ها"
              caption="دسته‌بندی‌های محصولات"
              columns={columns}
              getRowId={(category) => category.id}
              rows={categoryItems}
            />
          </div>
          <div aria-label="فهرست دسته‌بندی‌ها" className="grid gap-3 md:hidden" role="region">
            {categoryItems.map((category) => (
              <Card as="article" key={category.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold text-foreground">{category.name}</h2>
                    <p className="mt-1 text-xs text-muted">{category.description || 'بدون توضیحات'}</p>
                  </div>
                  <CategoryActionsMenu
                    busy={toggleMutation.isPending || deleteMutation.isPending}
                    categoryName={category.name}
                    isActive={category.isActive}
                    onDelete={() => setDeletingCategory(category)}
                    onEdit={() => openEditCategory(category)}
                    onToggleActive={() => toggleMutation.mutate({ id: category.id, isActive: !category.isActive })}
                    productCount={category.productCount}
                  />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <Badge variant={category.isActive ? 'success' : 'neutral'}>{category.isActive ? 'فعال' : 'غیرفعال'}</Badge>
                  <span className="text-xs text-muted"><bdi>{new Intl.NumberFormat('fa-IR').format(category.productCount)}</bdi> محصول</span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <CategoryFormDialog
        category={editingCategory}
        key={`${formOpen}-${editingCategory?.id ?? 'new'}`}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingCategory(undefined);
        }}
        onSave={saveCategory}
        open={formOpen}
        saving={createMutation.isPending || updateMutation.isPending}
      />

      <Modal
        description="این عملیات فقط زمانی مجاز است که محصولی به دسته‌بندی وابسته نباشد."
        onOpenChange={(open) => {
          if (!open) setDeletingCategory(undefined);
        }}
        open={Boolean(deletingCategory)}
        title="حذف دسته‌بندی"
      >
        <div className="grid gap-5">
          <p className="text-sm leading-6 text-muted">
            آیا از حذف دسته‌بندی «{deletingCategory?.name ?? ''}» مطمئن هستید؟
          </p>
          <div className="flex justify-end gap-2">
            <Button disabled={deleteMutation.isPending} onClick={() => setDeletingCategory(undefined)} variant="outline">انصراف</Button>
            <Button
              disabled={(deletingCategory?.productCount ?? 0) > 0}
              loading={deleteMutation.isPending}
              onClick={() => {
                if (deletingCategory && deletingCategory.productCount === 0) deleteMutation.mutate(deletingCategory.id);
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
