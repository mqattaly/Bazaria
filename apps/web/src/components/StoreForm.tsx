import { useState, type FormEvent } from 'react';
import { Alert, Button } from './ui';
import { ApiError, type StoreInput } from '../lib/api';

export interface StoreFormProps {
  initial?: Partial<StoreInput>;
  submitLabel: string;
  onSubmit: (values: StoreInput) => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
}

type FieldName = 'name' | 'contactName' | 'contactMobile' | 'address' | 'note';
type FieldErrors = Partial<Record<FieldName, string>>;

const LIMITS = {
  name: { min: 2, max: 160 },
  contactName: { min: 2, max: 120 },
  address: { max: 500 },
  note: { max: 1000 },
};

function normalizeMobile(raw: string): string | null {
  const digits = raw
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[\s\-()]/g, '');
  if (/^09\d{9}$/.test(digits)) return `+98${digits.slice(1)}`;
  if (/^9\d{9}$/.test(digits)) return `+98${digits}`;
  if (/^\+989\d{9}$/.test(digits)) return digits;
  if (/^00989\d{9}$/.test(digits)) return `+98${digits.slice(4)}`;
  if (/^989\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

function validate(values: StoreInput): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  if (name.length < LIMITS.name.min || name.length > LIMITS.name.max) {
    errors.name = 'نام فروشگاه باید بین ۲ تا ۱۶۰ نویسه باشد.';
  }

  const contactName = values.contactName?.trim() ?? '';
  if (
    contactName.length > 0 &&
    (contactName.length < LIMITS.contactName.min || contactName.length > LIMITS.contactName.max)
  ) {
    errors.contactName = 'نام مسئول باید بین ۲ تا ۱۲۰ نویسه باشد.';
  }

  const contactMobile = values.contactMobile?.trim() ?? '';
  if (contactMobile.length > 0 && !normalizeMobile(contactMobile)) {
    errors.contactMobile = 'شماره موبایل تماس معتبر نیست. نمونه: ۰۹۱۲۱۲۳۴۵۶۷';
  }

  if ((values.address?.trim().length ?? 0) > LIMITS.address.max) {
    errors.address = 'نشانی نباید بیش از ۵۰۰ نویسه باشد.';
  }
  if ((values.note?.trim().length ?? 0) > LIMITS.note.max) {
    errors.note = 'یادداشت نباید بیش از ۱۰۰۰ نویسه باشد.';
  }

  return errors;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/**
 * Compact create/edit form. Client validation mirrors the server contract, but
 * the server stays authoritative; server field errors are mapped back to inputs
 * and the typed values are preserved on any failure.
 */
export function StoreForm({
  initial,
  submitLabel,
  onSubmit,
  disabled = false,
  disabledReason,
}: StoreFormProps): JSX.Element {
  const [values, setValues] = useState<StoreInput>({
    name: initial?.name ?? '',
    contactName: initial?.contactName ?? '',
    contactMobile: initial?.contactMobile ?? '',
    address: initial?.address ?? '',
    note: initial?.note ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  const blocked = disabled || saving;

  function update(field: FieldName, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (blocked) return;

    const nextErrors = validate(values);
    setErrors(nextErrors);
    setServerError(null);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: StoreInput = {
      name: values.name.trim(),
      contactName: emptyToNull(values.contactName),
      contactMobile: emptyToNull(values.contactMobile),
      address: emptyToNull(values.address),
      note: emptyToNull(values.note),
    };

    setSaving(true);
    try {
      await onSubmit(payload);
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError({
              status: 0,
              code: 'NETWORK_ERROR',
              message: 'ذخیره فروشگاه انجام نشد. دوباره تلاش کنید.',
              retryable: true,
            });
      setServerError(apiError);
      const fieldErrors: FieldErrors = {};
      for (const detail of apiError.details) {
        if (
          detail.field === 'name' ||
          detail.field === 'contactName' ||
          detail.field === 'contactMobile' ||
          detail.field === 'address' ||
          detail.field === 'note'
        ) {
          fieldErrors[detail.field] = detail.message;
        }
      }
      if (Object.keys(fieldErrors).length > 0) {
        setErrors((current) => ({ ...current, ...fieldErrors }));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3" noValidate>
      {serverError ? (
        <Alert requestId={serverError.requestId}>
          <p>{serverError.message}</p>
          {serverError.code === 'COMPANY_SUBSCRIPTION_READ_ONLY' ? (
            <p className="mt-1 text-xs">
              پس از پایان مهلت ارفاقی، ثبت تغییرات تا تمدید اشتراک ممکن نیست.
            </p>
          ) : null}
        </Alert>
      ) : null}

      {disabled && disabledReason ? (
        <Alert tone="warning">{disabledReason}</Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="store-name">نام فروشگاه *</label>
          <input
            id="store-name"
            value={values.name}
            onChange={(event) => update('name', event.target.value)}
            minLength={LIMITS.name.min}
            maxLength={LIMITS.name.max}
            required
            disabled={blocked}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'store-name-error' : undefined}
            placeholder="مثال: فروشگاه مرکزی"
          />
          {errors.name ? (
            <p id="store-name-error" className="mt-1 text-xs text-rose-700">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="store-contact-name">نام مسئول</label>
          <input
            id="store-contact-name"
            value={values.contactName ?? ''}
            onChange={(event) => update('contactName', event.target.value)}
            maxLength={LIMITS.contactName.max}
            disabled={blocked}
            aria-invalid={errors.contactName ? true : undefined}
            aria-describedby={errors.contactName ? 'store-contact-name-error' : undefined}
          />
          {errors.contactName ? (
            <p id="store-contact-name-error" className="mt-1 text-xs text-rose-700">
              {errors.contactName}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="store-contact-mobile">موبایل تماس</label>
          <input
            id="store-contact-mobile"
            dir="ltr"
            className="text-start"
            value={values.contactMobile ?? ''}
            onChange={(event) => update('contactMobile', event.target.value)}
            disabled={blocked}
            inputMode="tel"
            placeholder="09121234567"
            aria-invalid={errors.contactMobile ? true : undefined}
            aria-describedby={errors.contactMobile ? 'store-contact-mobile-error' : undefined}
          />
          {errors.contactMobile ? (
            <p id="store-contact-mobile-error" className="mt-1 text-xs text-rose-700">
              {errors.contactMobile}
            </p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="store-address">نشانی</label>
          <textarea
            id="store-address"
            value={values.address ?? ''}
            onChange={(event) => update('address', event.target.value)}
            maxLength={LIMITS.address.max}
            rows={2}
            disabled={blocked}
            aria-invalid={errors.address ? true : undefined}
            aria-describedby={errors.address ? 'store-address-error' : undefined}
          />
          {errors.address ? (
            <p id="store-address-error" className="mt-1 text-xs text-rose-700">
              {errors.address}
            </p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="store-note">یادداشت</label>
          <textarea
            id="store-note"
            value={values.note ?? ''}
            onChange={(event) => update('note', event.target.value)}
            maxLength={LIMITS.note.max}
            rows={2}
            disabled={blocked}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={errors.note ? 'store-note-error' : undefined}
          />
          {errors.note ? (
            <p id="store-note-error" className="mt-1 text-xs text-rose-700">
              {errors.note}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" loading={saving} disabled={blocked}>
          {submitLabel}
        </Button>
        {disabled ? (
          <span className="text-xs text-slate-500">
            در حالت فقط‌خواندنی امکان ثبت وجود ندارد.
          </span>
        ) : null}
      </div>
    </form>
  );
}
