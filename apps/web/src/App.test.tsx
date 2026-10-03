import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';

function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RTL web foundation routes', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { status: 'ok', service: 'bazariya-api', database: 'connected' },
        }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the application shell and reports API readiness', async () => {
    renderRoute('/');

    expect(screen.getByRole('heading', { name: /فروش روزانه/ })).toBeInTheDocument();
    expect(await screen.findByText('اتصال API برقرار است')).toBeInTheDocument();
  });

  it('renders the non-functional login placeholder', () => {
    renderRoute('/login');

    expect(screen.getByRole('heading', { name: 'ورود به حساب' })).toBeInTheDocument();
    expect(screen.getByLabelText('نام کاربری')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ورود به‌زودی فعال می‌شود' })).toBeDisabled();
  });

  it('renders a Persian not-found page for unknown routes', () => {
    renderRoute('/missing-page');

    expect(screen.getByRole('heading', { name: 'این صفحه پیدا نشد' })).toBeInTheDocument();
  });
});
