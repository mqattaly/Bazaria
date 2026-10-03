import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <section className="surface-card overflow-hidden p-6 sm:p-10 lg:p-12">
      <div className="max-w-2xl">
        <span className="eyebrow">زیرساخت فروش میدانی</span>
        <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-5xl">
          فروش روزانه،
          <br className="hidden sm:block" />
          روشن و منظم.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
          بازاریا در حال آماده‌سازی است؛ فضایی ساده برای همراهی تیم فروش و ارتباط بهتر با فروشگاه‌ها.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="button-primary" to="/login">
            ورود به بازاریا
          </Link>
          <span className="inline-flex min-h-12 items-center rounded-xl border border-stone-200 bg-white px-4 text-sm text-slate-500">
            نسخه پایه · فاز صفر
          </span>
        </div>
      </div>
      <div className="mt-12 grid gap-3 border-t border-stone-200 pt-6 text-sm text-slate-600 sm:grid-cols-3">
        <p className="rounded-xl bg-stone-50 px-4 py-3">طراحی راست‌چین و فارسی</p>
        <p className="rounded-xl bg-stone-50 px-4 py-3">آماده برای موبایل</p>
        <p className="rounded-xl bg-stone-50 px-4 py-3">ساختار توسعه‌پذیر</p>
      </div>
    </section>
  );
}
