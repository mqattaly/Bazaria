import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Alert, Button, Card } from '../components/ui';

export function SetPasswordPage(): JSX.Element {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(
        new ApiError({
          status: 0,
          code: 'VALIDATION_ERROR',
          message: 'تکرار رمز عبور با رمز واردشده یکسان نیست.',
        }),
      );
      return;
    }
    setSubmitting(true);
    try {
      await api.setPassword(token.trim(), password);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError({
              status: 0,
              code: 'NETWORK_ERROR',
              message: 'تعیین رمز عبور انجام نشد.',
            }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-2xl font-bold text-brand-700">بازاریا</p>
          <p className="mt-2 text-sm text-slate-500">فعال‌سازی حساب و تعیین رمز عبور</p>
        </div>

        <Card>
          {done ? (
            <div className="space-y-4">
              <Alert tone="success" title="رمز عبور تعیین شد">
                اکنون می‌توانید با شماره موبایل و رمز جدید وارد شوید.
              </Alert>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                رفتن به صفحه ورود
              </Link>
            </div>
          ) : (
            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
              {error ? (
                <Alert title="تعیین رمز انجام نشد" requestId={error.requestId}>
                  <p>{error.message}</p>
                </Alert>
              ) : null}

              <div>
                <label htmlFor="token">کد فعال‌سازی</label>
                <input
                  id="token"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  dir="ltr"
                  className="text-start"
                  autoComplete="one-time-code"
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  کدی که مدیر شرکت برای شما صادر کرده است.
                </p>
              </div>

              <div>
                <label htmlFor="password">رمز عبور جدید</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={10}
                />
                <p className="mt-1 text-xs text-slate-500">
                  حداقل ۱۰ نویسه، شامل حرف و رقم و متفاوت با شماره موبایل.
                </p>
              </div>

              <div>
                <label htmlFor="confirm">تکرار رمز عبور</label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                  minLength={10}
                />
              </div>

              <Button type="submit" className="w-full" loading={submitting}>
                تعیین رمز عبور
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
