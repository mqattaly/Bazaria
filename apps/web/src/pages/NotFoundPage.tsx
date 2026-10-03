import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-stone-50 px-4 py-12 text-center">
      <section className="max-w-md">
        <p className="text-sm font-bold tracking-wide text-emerald-800">خطای ۴۰۴</p>
        <h1 className="mt-4 text-3xl font-extrabold text-slate-950">این صفحه پیدا نشد</h1>
        <p className="mt-3 leading-7 text-slate-600">نشانی واردشده معتبر نیست یا این صفحه هنوز ساخته نشده است.</p>
        <Link className="button-primary mt-7" to="/">
          بازگشت به خانه
        </Link>
      </section>
    </main>
  );
}
