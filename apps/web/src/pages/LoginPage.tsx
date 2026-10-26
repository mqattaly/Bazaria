import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '../session/SessionContext';
import { ApiError } from '../lib/api';
import { Alert, Button, Card } from '../components/ui';

export function LoginPage(): JSX.Element {
  const { status, login } = useSession();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  if (status === 'ready') {
    return <Navigate to="/companies" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(mobile, password);
      navigate('/companies', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError({
              status: 0,
              code: 'NETWORK_ERROR',
              message: 'ورود انجام نشد. دوباره تلاش کنید.',
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
          <p className="mt-2 text-sm text-slate-500">ورود به سامانه مدیریت فروش و توزیع</p>
        </div>

        <Card>
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            {error ? (
              <Alert title="ورود ناموفق" requestId={error.requestId}>
                <p>{error.message}</p>
                {error.details.length > 0 ? (
                  <ul className="mt-2 list-inside list-disc text-xs">
                    {error.details.map((detail) => (
                      <li key={`${detail.code}-${detail.field ?? ''}`}>{detail.message}</li>
                    ))}
                  </ul>
                ) : null}
              </Alert>
            ) : null}

            <div>
              <label htmlFor="mobile">شماره موبایل</label>
              <input
                id="mobile"
                name="mobile"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                className="text-start"
                placeholder="09121234567"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="password">رمز عبور</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" loading={submitting}>
              ورود
            </Button>
          </form>

          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <p>
              رمز عبور ندارید؟ از مدیر شرکت بخواهید لینک فعال‌سازی حساب را برای شما صادر کند.
            </p>
            <p>
              اگر لینک فعال‌سازی دارید،{' '}
              <Link to="/set-password" className="font-medium text-brand-700 hover:underline">
                رمز عبور خود را تعیین کنید
              </Link>
              .
            </p>
          </div>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-400">
          ورود به معنای پذیرش سیاست‌های امنیتی سامانه است. تلاش‌های ناموفق ثبت و محدود می‌شوند.
        </p>
      </div>
    </div>
  );
}
