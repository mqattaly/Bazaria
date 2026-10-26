import { Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useSession } from '../session/SessionContext';
import { Badge, Button } from './ui';
import { currencyLabel, roleLabel } from '../lib/text';

export function Layout({ children }: { children: ReactNode }): JSX.Element {
  const { user, activeCompany, logout } = useSession();
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:right-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2"
      >
        پرش به محتوای اصلی
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/companies" className="text-lg font-bold text-brand-700">
              بازاریا
            </Link>
            {activeCompany ? (
              <Link
                to="/company"
                className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                <span className="font-medium text-slate-800">{activeCompany.name}</span>
                <Badge tone="brand">{roleLabel(activeCompany.role)}</Badge>
              </Link>
            ) : null}
          </div>

          <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="ناوبری اصلی">
            <Link to="/companies" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">
              انتخاب شرکت
            </Link>
            {activeCompany?.permissions.includes('store.view') ? (
              <Link
                to="/stores"
                className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
              >
                فروشگاه‌ها
              </Link>
            ) : null}
            <Link to="/account" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">
              حساب کاربری
            </Link>
            {user ? (
              <span className="hidden text-xs text-slate-500 sm:inline" dir="auto">
                {user.fullName}
              </span>
            ) : null}
            <Button variant="ghost" onClick={() => void handleLogout()}>
              خروج
            </Button>
          </nav>
        </div>
        {activeCompany ? (
          <div className="border-t border-slate-100 bg-slate-50/60">
            <div className="mx-auto max-w-5xl px-4 py-1.5 text-xs text-slate-500">
              شرکت فعال: {activeCompany.name} · واحد پول: {currencyLabel(activeCompany.currency)}
            </div>
          </div>
        ) : null}
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-slate-400">
        بازاریا — فاز ۲: چرخه اشتراک و مدیریت فروشگاه‌ها
      </footer>
    </div>
  );
}
