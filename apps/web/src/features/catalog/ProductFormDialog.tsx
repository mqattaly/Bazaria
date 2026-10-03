import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { PRODUCT_UNITS, type CategoryListItem, type CreateProductInput, type Product } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Button, Input, Modal, Select, Switch, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { CatalogApiError } from './api';
import { PRODUCT_UNIT_LABELS, tomanNumber } from './catalog.constants';

const productFormSchema = z.object({
  name: z.string().trim().min(2, 'نام محصول باید دست‌کم ۲ نویسه باشد.').max(120, 'نام محصول نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.'),
  sku: z.string()
    .trim()
    .toUpperCase()
    .min(1, 'کد کالا الزامی است.')
    .max(64, 'کد کالا نمی‌تواند بیشتر از ۶۴ نویسه باشد.')
    .regex(/^[\p{L}\p{N}][\p{L}\p{N}._/-]*$/u, 'کد کالا فقط می‌تواند شامل حروف، عدد، نقطه، خط تیره و ممیز باشد.'),
  categoryId: z.string().uuid('یک دسته‌بندی معتبر انتخاب کنید.'),
  unit: z.enum(PRODUCT_UNITS, 'واحد محصول را انتخاب کنید.'),
  salePrice: z.number({ error: 'قیمت فروش را وارد کنید.' }).int('قیمت فروش باید عدد صحیح باشد.').min(0, 'قیمت فروش نمی‌تواند منفی باشد.').max(Number.MAX_SAFE_INTEGER, 'قیمت فروش بیش از حد بزرگ است.'),
  purchasePrice: z.number().int('قیمت خرید باید عدد صحیح باشد.').min(0, 'قیمت خرید نمی‌تواند منفی باشد.').max(Number.MAX_SAFE_INTEGER, 'قیمت خرید بیش از حد بزرگ است.').optional(),
  description: z.string().trim().max(1000, 'توضیحات نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد.'),
  isActive: z.boolean(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

const unitOptions = PRODUCT_UNITS.map((value) => ({ value, label: PRODUCT_UNIT_LABELS[value] }));
const productFieldNames = ['name', 'sku', 'categoryId', 'unit', 'salePrice', 'purchasePrice', 'description', 'isActive'] as const;

function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

function parsePrice(value: string): number | undefined {
  const normalized = normalizeDigits(value);
  if (!/^[0-9,٬\s]*$/.test(normalized)) return Number.NaN;
  const compact = normalized.replace(/[٬,\s]/g, '');
  if (!compact) return undefined;
  const amount = Number(compact);
  return Number.isSafeInteger(amount) ? amount : Number.NaN;
}

interface PriceInputProps {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  onBlur: () => void;
  inputRef: (element: HTMLInputElement | null) => void;
  error?: string;
  required?: boolean;
}

function PriceInput({ label, value, onChange, onBlur, inputRef, error, required = false }: PriceInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!focused) setDraft(value !== undefined && Number.isSafeInteger(value) ? String(value) : '');
  }, [focused, value]);

  const displayValue = focused
    ? draft
    : value !== undefined && Number.isSafeInteger(value)
      ? tomanNumber.format(value)
      : draft;

  return (
    <Input
      aria-required={required || undefined}
      error={error}
      endAdornment={<span className="text-xs">تومان</span>}
      inputMode="numeric"
      label={label}
      onBlur={() => {
        setFocused(false);
        onBlur();
      }}
      onChange={(event) => {
        const inputValue = event.currentTarget.value;
        setDraft(inputValue);
        onChange(parsePrice(inputValue));
      }}
      onFocus={() => {
        setFocused(true);
        setDraft(value !== undefined && Number.isSafeInteger(value) ? String(value) : '');
      }}
      placeholder="۰"
      ref={inputRef}
      type="text"
      value={displayValue}
    />
  );
}

interface ProductFormDialogProps {
  open: boolean;
  product?: Product;
  categories: readonly CategoryListItem[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: CreateProductInput) => Promise<void>;
}

export function ProductFormDialog({ open, product, categories, saving, onOpenChange, onSave }: ProductFormDialogProps) {
  const toast = useToast();
  const nameRef = useRef<HTMLInputElement>(null);
  const defaultValues = useMemo<ProductFormValues>(() => ({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    categoryId: product?.categoryId ?? '',
    unit: product?.unit ?? 'piece',
    salePrice: product?.salePrice ?? Number.NaN,
    purchasePrice: product?.purchasePrice ?? undefined,
    description: product?.description ?? '',
    isActive: product?.isActive ?? true,
  }), [product]);
  const { control, formState: { errors, isSubmitting }, handleSubmit, register, reset, setError, setValue } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  });
  const { ref: nameFieldRef, ...nameRegistration } = register('name');
  const skuRegistration = register('sku');

  useEffect(() => {
    if (!open) return;
    reset(defaultValues);
    const frame = window.requestAnimationFrame(() => nameRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [defaultValues, open, reset]);

  async function submit(values: ProductFormValues): Promise<void> {
    try {
      await onSave({
        ...values,
        purchasePrice: values.purchasePrice ?? null,
        description: values.description.trim() || null,
      });
    } catch (error) {
      if (error instanceof CatalogApiError && error.details?.length) {
        let shouldFocus = true;
        for (const detail of error.details) {
          if (!productFieldNames.includes(detail.field as (typeof productFieldNames)[number])) continue;
          setError(detail.field as Path<ProductFormValues>, { type: 'server', message: detail.message }, { shouldFocus });
          shouldFocus = false;
        }
        if (!shouldFocus) return;
      }
      toast.error(error instanceof Error ? error.message : 'ثبت محصول انجام نشد.');
    }
  }

  return (
    <Modal
      description={product ? 'اطلاعات پایهٔ محصول را ویرایش کنید.' : 'مشخصات محصول جدید را وارد کنید.'}
      onOpenChange={onOpenChange}
      open={open}
      title={product ? 'ویرایش محصول' : 'افزودن محصول'}
    >
      <form className="grid gap-4" noValidate onSubmit={handleSubmit(submit)}>
        <Input
          autoComplete="off"
          error={errors.name?.message}
          label="نام محصول *"
          maxLength={120}
          placeholder="مثلاً لیوان کاغذی"
          {...nameRegistration}
          ref={(element) => {
            nameFieldRef(element);
            nameRef.current = element;
          }}
        />
        <Input
          autoComplete="off"
          error={errors.sku?.message}
          label="کد کالا *"
          maxLength={64}
          placeholder="مثلاً CUP-001"
          {...skuRegistration}
          onBlur={(event) => {
            void skuRegistration.onBlur(event);
            setValue('sku', event.currentTarget.value.trim().toUpperCase(), { shouldValidate: true });
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            error={errors.categoryId?.message}
            label="دسته‌بندی *"
            options={categories.map((category) => ({
              value: category.id,
              label: `${category.name}${category.isActive ? '' : ' (غیرفعال)'}`,
            }))}
            placeholder={categories.length === 0 ? 'ابتدا دسته‌بندی بسازید' : 'انتخاب دسته‌بندی'}
            {...register('categoryId')}
          />
          <Select error={errors.unit?.message} label="واحد *" options={unitOptions} {...register('unit')} />
        </div>
        {categories.length === 0 ? (
          <p className="-mt-2 text-xs leading-5 text-warning">
            برای ثبت محصول ابتدا یک دسته‌بندی بسازید.{' '}
            <Link className="font-semibold underline underline-offset-2" to="/categories">مدیریت دسته‌بندی‌ها</Link>
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="salePrice"
            render={({ field }) => (
              <PriceInput
                error={errors.salePrice?.message}
                inputRef={field.ref}
                label="قیمت فروش *"
                onBlur={field.onBlur}
                onChange={field.onChange}
                required
                value={field.value}
              />
            )}
          />
          <Controller
            control={control}
            name="purchasePrice"
            render={({ field }) => (
              <PriceInput
                error={errors.purchasePrice?.message}
                inputRef={field.ref}
                label="قیمت خرید"
                onBlur={field.onBlur}
                onChange={field.onChange}
                value={field.value}
              />
            )}
          />
        </div>
        <Textarea error={errors.description?.message} label="توضیحات" maxLength={1000} rows={3} {...register('description')} />
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch
              checked={field.value}
              description="محصول غیرفعال در فهرست می‌ماند و حذف نمی‌شود."
              label="محصول فعال"
              onCheckedChange={field.onChange}
            />
          )}
        />
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button onClick={() => onOpenChange(false)} variant="outline">انصراف</Button>
          <Button disabled={categories.length === 0} loading={saving || isSubmitting} type="submit">
            <Icon name="check" size={17} />
            ذخیرهٔ محصول
          </Button>
        </div>
      </form>
    </Modal>
  );
}
