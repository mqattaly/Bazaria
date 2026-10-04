import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { ThemeProvider } from './components/providers/ThemeProvider';
import { ToastProvider } from './components/ui/Toast';

function renderRoute(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('Persian application shell', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { status: 'ok', service: 'bazariya-api', database: 'connected' } }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    document.documentElement.dataset.theme = 'light';
  });

  it('redirects the default route to the Persian RTL dashboard', async () => {
    renderRoute('/');

    expect(await screen.findByRole('heading', { name: 'داشبورد' })).toBeInTheDocument();
    expect(screen.getByRole('main').closest('[dir="rtl"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'رفتن به محتوای اصلی' })).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('link', { name: 'داشبورد' })).toHaveAttribute('aria-current', 'page');
  });

  it('renders explicitly marked mock KPI values and quick actions', async () => {
    renderRoute('/dashboard');

    expect(screen.getByText('اطلاعات نمایشی')).toBeInTheDocument();
    expect(screen.getByText('فروش امروز')).toBeInTheDocument();
    expect(screen.getByText('۱۲٬۸۵۰٬۰۰۰')).toBeInTheDocument();
    expect(screen.queryByText('موجودی کالا')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /مدیریت موجودی/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ثبت سفارش/ }));
    expect(await screen.findByRole('heading', { name: 'ثبت سفارش جدید' })).toBeInTheDocument();
  });

  it('opens mobile navigation with active sections linked and future sections still disabled', async () => {
    renderRoute('/dashboard');

    fireEvent.click(screen.getByRole('button', { name: 'باز کردن منوی اصلی' }));
    expect(await screen.findByRole('dialog', { name: 'منوی اصلی' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'سفارش‌ها' }).some((link) => link.getAttribute('href') === '/orders')).toBe(true);
    expect(screen.getAllByRole('link', { name: 'انبار' }).every((link) => link.getAttribute('href') === '/inventory')).toBe(true);
    expect(screen.getAllByRole('button', { name: /گزارش‌ها/ }).some((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it('persists the dark theme preference', async () => {
    renderRoute('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'فعال کردن پوستهٔ تیره' }));

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(window.localStorage.getItem('bazariya-theme')).toBe('dark');
  });

  it('keeps the login route as an explicitly non-functional placeholder', () => {
    renderRoute('/login');

    expect(screen.getByRole('heading', { name: 'ورود به حساب' })).toBeInTheDocument();
    expect(screen.getByLabelText('نام کاربری')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ورود در فاز بعدی/ })).toBeDisabled();
  });

  it('shows a shell-level not-found state for unknown routes', () => {
    renderRoute('/unknown-feature');

    expect(screen.getByRole('heading', { name: 'این صفحه پیدا نشد' })).toBeInTheDocument();
  });
});
