import { useEffect, useMemo, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Category, CreateCategoryInput } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Button, Input, Modal, Switch, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { CatalogApiError } from './api';

const categoryFormSchema = z.object({
  name: z.string().trim().min(2, 'نام دسته‌بندی باید دست‌کم ۲ نویسه باشد.').max(80, 'نام دسته‌بندی نمی‌تواند بیشتر از ۸۰ نویسه باشد.'),
  description: z.string().trim().max(1000, 'توضیحات نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد.'),
  isActive: z.boolean(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

interface CategoryFormDialogProps {
  open: boolean;
  category?: Category;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: CreateCategoryInput) => Promise<void>;
}

export function CategoryFormDialog({ open, category, saving, onOpenChange, onSave }: CategoryFormDialogProps) {
  const toast = useToast();
  const nameRef = useRef<HTMLInputElement>(null);
  const defaultValues = useMemo<CategoryFormValues>(() => ({
    name: category?.name ?? '',
    description: category?.description ?? '',
    isActive: category?.isActive ?? true,
  }), [category]);
  const { control, formState: { errors, isSubmitting }, handleSubmit, register, reset, setError } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues,
  });
  const { ref: nameFieldRef, ...nameRegistration } = register('name');

  useEffect(() => {
    if (!open) return;
    reset(defaultValues);
    const frame = window.requestAnimationFrame(() => nameRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [defaultValues, open, reset]);

  async function submit(values: CategoryFormValues): Promise<void> {
    try {
      await onSave({
        ...values,
        description: values.description.trim() || null,
      });
    } catch (error) {
      if (error instanceof CatalogApiError && error.details?.length) {
        const nameError = error.details.find((detail) => detail.field === 'name');
        if (nameError) {
          setError('name', { type: 'server', message: nameError.message }, { shouldFocus: true });
          return;
        }
      }
      toast.error(error instanceof Error ? error.message : 'ثبت دسته‌بندی انجام نشد.');
    }
  }

  return (
    <Modal
      description={category ? 'نام و وضعیت دسته‌بندی را ویرایش کنید.' : 'برای مرتب‌سازی محصولات یک دسته‌بندی بسازید.'}
      onOpenChange={onOpenChange}
      open={open}
      title={category ? 'ویرایش دسته‌بندی' : 'افزودن دسته‌بندی'}
    >
      <form className="grid gap-4" noValidate onSubmit={handleSubmit(submit)}>
        <Input
          autoComplete="off"
          error={errors.name?.message}
          label="نام دسته‌بندی *"
          maxLength={80}
          placeholder="مثلاً ظروف یکبار مصرف"
          {...nameRegistration}
          ref={(element) => {
            nameFieldRef(element);
            nameRef.current = element;
          }}
        />
        <Textarea error={errors.description?.message} label="توضیحات" maxLength={1000} rows={3} {...register('description')} />
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch
              checked={field.value}
              description="دسته‌بندی غیرفعال از فهرست حذف نمی‌شود."
              label="دسته‌بندی فعال"
              onCheckedChange={field.onChange}
            />
          )}
        />
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button onClick={() => onOpenChange(false)} variant="outline">انصراف</Button>
          <Button loading={saving || isSubmitting} type="submit">
            <Icon name="check" size={17} />
            ذخیرهٔ دسته‌بندی
          </Button>
        </div>
      </form>
    </Modal>
  );
}
