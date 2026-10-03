import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Icon } from '../components/icons/Icon';
import { Button, Card, Input } from '../components/ui';

const loginPlaceholderSchema = z.object({
  username: z.string().min(1, 'نام کاربری را وارد کنید.'),
  password: z.string().min(1, 'گذرواژه را وارد کنید.'),
});

type LoginPlaceholderValues = z.infer<typeof loginPlaceholderSchema>;

export function LoginPage() {
  const { register, formState: { errors } } = useForm<LoginPlaceholderValues>({
    resolver: zodResolver(loginPlaceholderSchema),
    defaultValues: { username: '', password: '' },
  });

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10" dir="rtl">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <Link to="/dashboard" aria-label="بازگشت به داشبورد بازاریا" className="inline-flex min-h-12 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground">ب</span>
          <span className="text-xl font-extrabold text-foreground">بازاریا</span>
        </Link>
        <h1 className="mt-8 text-2xl font-bold text-foreground">ورود به حساب</h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          این صفحه فقط نمایشی است؛ احراز هویت در این فاز پیاده‌سازی نمی‌شود.
        </p>

        <form className="mt-7 grid gap-5" onSubmit={(event) => event.preventDefault()}>
          <Input
            autoComplete="username"
            error={errors.username?.message}
            label="نام کاربری"
            placeholder="نام کاربری خود را وارد کنید"
            {...register('username')}
          />
          <Input
            autoComplete="current-password"
            error={errors.password?.message}
            label="گذرواژه"
            placeholder="گذرواژه"
            type="password"
            {...register('password')}
          />
          <Button className="w-full" disabled type="submit">
            <Icon name="check" size={17} />
            ورود در فاز بعدی فعال می‌شود
          </Button>
        </form>
        <Link className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background" to="/dashboard">
          <Icon name="chevron-right" size={16} />
          بازگشت به داشبورد
        </Link>
      </Card>
    </main>
  );
}
