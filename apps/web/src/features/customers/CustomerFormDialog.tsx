import { useEffect, useMemo, useRef } from 'react';
import { Controller, useForm, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CreateCustomerInput, Customer } from '@bazariya/shared';
import { Icon } from '../../components/icons/Icon';
import { Button, Input, Modal, Switch, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { CustomerApiError } from './api';

const customerFormSchema = z.object({
  name: z.string().trim().min(2, 'نام مشتری باید دست‌کم ۲ نویسه باشد.').max(120, 'نام مشتری نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.'),
  phone: z.string().trim().max(32, 'شماره تماس نمی‌تواند بیشتر از ۳۲ نویسه باشد.'),
  email: z.string().trim().max(254, 'ایمیل نمی‌تواند بیشتر از ۲۵۴ نویسه باشد.'),
  address: z.string().trim().max(500, 'آدرس نمی‌تواند بیشتر از ۵۰۰ نویسه باشد.'),
  description: z.string().trim().max(1000, 'توضیحات نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد.'),
  isActive: z.boolean(),
}).superRefine((values, context) => {
  const normalizedPhone = normalizePhone(values.phone);
  if (normalizedPhone && !/^0\d{9,10}$/.test(normalizedPhone)) {
    context.addIssue({ code: 'custom', path: ['phone'], message: 'شماره را با قالبی مانند 09121234567 یا 02112345678 وارد کنید.' });
  }

  const email = values.email.trim().toLocaleLowerCase('en-US');
  if (email && !z.string().email().safeParse(email).success) {
    context.addIssue({ code: 'custom', path: ['email'], message: 'یک نشانی ایمیل معتبر وارد کنید.' });
  }
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

const customerFieldNames = ['name', 'phone', 'email', 'address', 'description', 'isActive'] as const;

function normalizePhone(value: string): string {
  const digits = value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
  const compact = digits.trim().replace(/[\s().-]/g, '');
  if (!compact) return '';
  if (compact.startsWith('+98')) return `0${compact.slice(3)}`;
  if (compact.startsWith('0098')) return `0${compact.slice(4)}`;
  return compact;
}

function normalizeOptional(value: string): string | null {
  return value.trim() || null;
}

interface CustomerFormDialogProps {
  open: boolean;
  customer?: Customer;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: CreateCustomerInput) => Promise<void>;
}

export function CustomerFormDialog({ open, customer, saving, onOpenChange, onSave }: CustomerFormDialogProps) {
  const toast = useToast();
  const nameRef = useRef<HTMLInputElement>(null);
  const defaultValues = useMemo<CustomerFormValues>(() => ({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    description: customer?.description ?? '',
    isActive: customer?.isActive ?? true,
  }), [customer]);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues,
  });
  const { ref: nameFieldRef, ...nameRegistration } = register('name');

  useEffect(() => {
    if (!open) return;
    reset(defaultValues);
    const frame = window.requestAnimationFrame(() => nameRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [defaultValues, open, reset]);

  async function submit(values: CustomerFormValues): Promise<void> {
    const phone = normalizePhone(values.phone);
    const email = values.email.trim().toLocaleLowerCase('en-US');
    try {
      await onSave({
        name: values.name.trim(),
        phone: phone || null,
        email: email || null,
        address: normalizeOptional(values.address),
        description: normalizeOptional(values.description),
        isActive: values.isActive,
      });
      reset(defaultValues);
    } catch (error) {
      if (error instanceof CustomerApiError && error.details?.length) {
        let shouldFocus = true;
        for (const detail of error.details) {
          if (!customerFieldNames.includes(detail.field as (typeof customerFieldNames)[number])) continue;
          setError(detail.field as Path<CustomerFormValues>, { type: 'server', message: detail.message }, { shouldFocus });
          shouldFocus = false;
        }
        if (!shouldFocus) return;
      }
      toast.error(error instanceof Error ? error.message : 'ذخیرهٔ مشتری انجام نشد.');
    }
  }

  return (
    <Modal
      description={customer ? 'اطلاعات پایهٔ مشتری را ویرایش کنید.' : 'مشخصات مشتری جدید را وارد کنید.'}
      onOpenChange={onOpenChange}
      open={open}
      title={customer ? 'ویرایش مشتری' : 'افزودن مشتری'}
    >
      <form className="grid gap-4" noValidate onSubmit={handleSubmit(submit)}>
        <Input
          autoComplete="name"
          error={errors.name?.message}
          label="نام مشتری *"
          maxLength={120}
          placeholder="مثلاً سارا احمدی"
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
            hint="موبایل یا تلفن ثابت ایران، مانند 09121234567"
            inputMode="tel"
            label="شماره تماس"
            maxLength={32}
            placeholder="0912 123 4567"
            {...register('phone')}
          />
          <Input
            autoComplete="email"
            dir="ltr"
            error={errors.email?.message}
            inputMode="email"
            label="ایمیل"
            maxLength={254}
            placeholder="name@example.com"
            type="email"
            {...register('email')}
          />
        </div>
        <Input
          autoComplete="street-address"
          error={errors.address?.message}
          label="آدرس"
          maxLength={500}
          placeholder="نشانی مشتری (اختیاری)"
          {...register('address')}
        />
        <Textarea
          error={errors.description?.message}
          label="توضیحات"
          maxLength={1000}
          placeholder="یادداشت کوتاه دربارهٔ مشتری"
          rows={3}
          {...register('description')}
        />
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch
              checked={field.value}
              description="مشتری غیرفعال در فهرست می‌ماند."
              label="مشتری فعال"
              onCheckedChange={field.onChange}
            />
          )}
        />
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button disabled={saving || isSubmitting} onClick={() => onOpenChange(false)} variant="outline">انصراف</Button>
          <Button loading={saving || isSubmitting} type="submit">
            <Icon name="check" size={17} />
            ذخیرهٔ مشتری
          </Button>
        </div>
      </form>
    </Modal>
  );
}
