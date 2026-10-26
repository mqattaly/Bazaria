import { useState, type FormEvent } from 'react';
import { useSession } from '../session/SessionContext';
import { Layout } from '../components/Layout';
import { Alert, Button, Card, Value } from '../components/ui';
import { api, ApiError } from '../lib/api';

export function AccountPage(): JSX.Element {
  const { user, activeCompany, logout } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirm) {
      setError(
        new ApiError({
          status: 0,
          code: 'VALIDATION_ERROR',
          message: 'تکرار رمز عبور جدید با رمز واردشده یکسان نیست.',
        }),
      );
      return;
    }
    setSubmitting(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError({
              status: 0,
              code: 'NETWORK_ERROR',
              message: 'تغییر رمز عبور انجام نشد.',
            }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <h1 className="mb-6 text-xl font-bold text-slate-900">حساب کاربری</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="اطلاعات حساب">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">نام</dt>
              <Value>{user?.fullName ?? '—'}</Value>
            </div>
            <div>
              <dt className="text-xs text-slate-500">شماره موبایل</dt>
              <Value>
                <span dir="ltr">{user?.mobile ?? '—'}</span>
              </Value>
            </div>
            <div>
              <dt className="text-xs text-slate-500">شرکت فعال</dt>
              <Value>{activeCompany?.name ?? 'انتخاب نشده'}</Value>
            </div>
          </dl>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <Button variant="secondary" onClick={() => void logout()}>
              خروج از حساب
            </Button>
          </div>
        </Card>

        <Card
          title="تغییر رمز عبور"
          description="پس از تغییر رمز، نشست‌های دیگر این حساب باطل می‌شوند."
        >
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
            {error ? (
              <Alert requestId={error.requestId}>
                <p>{error.message}</p>
                {error.details.length > 0 ? (
                  <ul className="mt-1 list-inside list-disc text-xs">
                    {error.details.map((detail) => (
                      <li key={detail.code}>{detail.message}</li>
                    ))}
                  </ul>
                ) : null}
              </Alert>
            ) : null}
            {success ? (
              <Alert tone="success">
                رمز عبور با موفقیت تغییر کرد و سایر نشست‌ها باطل شدند.
              </Alert>
            ) : null}

            <div>
              <label htmlFor="current-password">رمز عبور فعلی</label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="new-password">رمز عبور جدید</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="confirm-password">تکرار رمز عبور جدید</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </div>

            <Button type="submit" loading={submitting}>
              تغییر رمز عبور
            </Button>
          </form>
        </Card>
      </div>
    </Layout>
  );
}
