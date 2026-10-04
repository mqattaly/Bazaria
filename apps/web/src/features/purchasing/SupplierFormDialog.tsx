import { useEffect, useMemo, useRef } from 'react';
import { useForm, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CreateSupplierInput, Supplier } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Button, Input, Modal, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { PurchasingApiError } from './api';

const supplierFormSchema = z.object({
  name: z.string().trim().min(2, 'نام تأمین‌کننده باید دست‌کم ۲ نویسه باشد.').max(120, 'نام تأمین‌کننده نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.'),
  phone: z.string().trim().max(32, 'شماره تماس نمی‌تواند بیشتر از ۳۲ نویسه باشد.'),
  email: z.string().trim().max(254, 'ایمیل نمی‌تواند بیشتر از ۲۵۴ نویسه باشد.'),
  address: z.string().trim().max(500, 'آدرس نمی‌تواند بیشتر از ۵۰۰ نویسه باشد.'),
  note: z.string().trim().max(1000, 'یادداشت نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد.'),
}).superRefine((values, context) => {
  const email = values.email.trim().toLocaleLowerCase('en-US');
  if (email && !z.string().email().safeParse(email).success) {
    context.addIssue({ code: 'custom', path: ['email'], message: 'یک نشانی ایمیل معتبر وارد کنید.' });
  }
});

type SupplierFormValues = z.infer<typeof supplierFormSchema>;

const supplierFieldNames = ['name', 'phone', 'email', 'address', 'note'] as const;

interface SupplierFormDialogProps {
  open: boolean;
  supplier?: Supplier;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: CreateSupplierInput) => Promise<void>;
}

function optionalValue(value: string): string | null {
  return value.trim() || null;
}

export function SupplierFormDialog({ open, supplier, saving, onOpenChange, onSave }: SupplierFormDialogProps) {
  const toast = useToast();
  const nameRef = useRef<HTMLInputElement>(null);
  const defaultValues = useMemo<SupplierFormValues>(() => ({
    name: supplier?.name ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    note: supplier?.note ?? '',
  }), [supplier]);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<SupplierFormValues>({ resolver: zodResolver(supplierFormSchema), defaultValues });
  const { ref: nameFieldRef, ...nameRegistration } = register('name');

  useEffect(() => {
    if (!open) return;
    reset(defaultValues);
    const frame = window.requestAnimationFrame(() => nameRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [defaultValues, open, reset]);

  async function submit(values: SupplierFormValues): Promise<void> {
    try {
      await onSave({
        name: values.name.trim(),
        phone: optionalValue(values.phone),
        email: values.email.trim().toLocaleLowerCase('en-US') || null,
        address: optionalValue(values.address),
        note: optionalValue(values.note),
      });
      reset(defaultValues);
    } catch (error) {
      if (error instanceof PurchasingApiError && error.details?.length) {
        let shouldFocus = true;
        for (const detail of error.details) {
          if (!supplierFieldNames.includes(detail.field as (typeof supplierFieldNames)[number])) continue;
          setError(detail.field as Path<SupplierFormValues>, { type: 'server', message: detail.message }, { shouldFocus });
          shouldFocus = false;
        }
        if (!shouldFocus) return;
      }
      toast.error(error instanceof Error ? error.message : 'ذخیرهٔ تأمین‌کننده انجام نشد.');
    }
  }

  return (
    <Modal
      description={supplier ? 'اطلاعات تماس و مشخصات تأمین‌کننده را ویرایش کنید.' : 'نام الزامی است؛ راه‌های تماس و آدرس اختیاری هستند.'}
      onOpenChange={onOpenChange}
      open={open}
      title={supplier ? 'ویرایش تأمین‌کننده' : 'ثبت تأمین‌کننده'}
    >
      <form className="grid gap-4" noValidate onSubmit={handleSubmit(submit)}>
        <Input
          autoComplete="organization"
          error={errors.name?.message}
          label="نام تأمین‌کننده *"
          maxLength={120}
          placeholder="مثلاً پخش کالای خانه"
          {...nameRegistration}
          ref={(element) => {
            nameFieldRef(element);
            nameRef.current = element;
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            autoComplete="tel"
            dir="ltr"
            error={errors.phone?.message}
            inputMode="tel"
            label="شماره تماس"
            maxLength={32}
            placeholder="021 1234 5678"
            {...register('phone')}
          />
          <Input
            autoComplete="email"
            dir="ltr"
            error={errors.email?.message}
            inputMode="email"
            label="ایمیل"
            maxLength={254}
            placeholder="orders@example.com"
            type="email"
            {...register('email')}
          />
        </div>
        <Input
          autoComplete="street-address"
          error={errors.address?.message}
          label="آدرس"
          maxLength={500}
          placeholder="نشانی تأمین‌کننده (اختیاری)"
          {...register('address')}
        />
        <Textarea
          error={errors.note?.message}
          label="یادداشت"
          maxLength={1000}
          placeholder="اطلاعات تکمیلی برای استفادهٔ داخلی"
          rows={3}
          {...register('note')}
        />
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button disabled={saving || isSubmitting} onClick={() => onOpenChange(false)} variant="outline">انصراف</Button>
          <Button loading={saving || isSubmitting} type="submit">
            <Icon name="check" size={17} />ذخیرهٔ تأمین‌کننده
          </Button>
        </div>
      </form>
    </Modal>
  );
}
