import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

const loginPlaceholderSchema = z.object({
  username: z.string().min(1, 'نام کاربری را وارد کنید.'),
  password: z.string().min(1, 'گذرواژه را وارد کنید.'),
});

type LoginPlaceholderValues = z.infer<typeof loginPlaceholderSchema>;

export function LoginPage() {
  const { register } = useForm<LoginPlaceholderValues>({
    resolver: zodResolver(loginPlaceholderSchema),
    defaultValues: { username: '', password: '' },
  });

  return (
    <main className="grid min-h-[calc(100vh-2rem)] place-items-center px-4 py-10">
      <section className="surface-card w-full max-w-md p-6 sm:p-8">
        <Link to="/" className="inline-flex min-h-12 items-center gap-3" aria-label="بازگشت به صفحه اصلی بازاریا">
          <span className="brand-mark" aria-hidden="true">
            ب
          </span>
          <span className="text-xl font-extrabold">بازاریا</span>
        </Link>
        <h1 className="mt-8 text-2xl font-extrabold">ورود به حساب</h1>
        <p className="mt-2 text-sm leading-7 text-slate-500">
          این صفحه در فاز صفر نمایشی است. ورود امن در فاز MVP پیاده‌سازی می‌شود.
        </p>

        <form className="mt-7 space-y-5" onSubmit={(event) => event.preventDefault()}>
          <label className="form-label" htmlFor="username">
            نام کاربری
            <input
              autoComplete="username"
              className="form-input"
              id="username"
              placeholder="نام کاربری خود را وارد کنید"
              {...register('username')}
            />
          </label>
          <label className="form-label" htmlFor="password">
            گذرواژه
            <input
              autoComplete="current-password"
              className="form-input"
              id="password"
              placeholder="گذرواژه"
              type="password"
              {...register('password')}
            />
          </label>
          <button className="button-primary w-full cursor-not-allowed opacity-50" disabled type="submit">
            ورود به‌زودی فعال می‌شود
          </button>
        </form>
        <Link className="mt-5 inline-flex min-h-12 items-center text-sm font-semibold text-emerald-800" to="/">
          بازگشت به صفحه اصلی
        </Link>
      </section>
    </main>
  );
}
