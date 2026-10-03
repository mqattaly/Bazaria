import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { fetchHealth } from './services/health';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

function AppShell() {
  const health = useQuery({ queryKey: ['api-health'], queryFn: fetchHealth });

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      <header className="border-b border-stone-200/80 bg-white/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="بازاریا، صفحه اصلی" className="flex min-h-12 items-center gap-3">
            <span className="brand-mark" aria-hidden="true">
              ب
            </span>
            <span>
              <span className="block text-lg font-extrabold tracking-tight">بازاریا</span>
              <span className="block text-xs text-slate-500">همراه فروش میدانی</span>
            </span>
          </Link>
          <Link className="button-secondary" to="/login">
            ورود
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center gap-2 text-sm" role="status" aria-live="polite">
          <span
            className={`h-2.5 w-2.5 rounded-full ${health.isSuccess ? 'bg-emerald-500' : health.isPending ? 'bg-amber-400' : 'bg-rose-500'}`}
            aria-hidden="true"
          />
          <span className="text-slate-600">
            {health.isPending
              ? 'در حال بررسی اتصال سرویس…'
              : health.isSuccess
                ? 'اتصال API برقرار است'
                : 'فعلاً امکان اتصال به API وجود ندارد'}
          </span>
        </div>
        <Outlet />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-400 sm:px-6 lg:px-8">
        بازاریا · نسخه پایه
      </footer>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />} path="/">
        <Route element={<HomePage />} index />
      </Route>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<Navigate replace to="/" />} path="/app" />
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}
