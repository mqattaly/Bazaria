import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { Customer } from '@bazariya/shared';
import { AppRoutes } from '../../App';
import { ThemeProvider } from '../../components/providers/ThemeProvider';
import { ToastProvider } from '../../components/ui/Toast';

const customerId = '30000000-0000-4000-8000-000000000001';
const secondCustomerId = '30000000-0000-4000-8000-000000000002';
const now = '2026-09-20T10:00:00.000Z';

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: customerId,
    name: 'سارا احمدی',
    phone: '09121234567',
    email: 'sara@example.com',
    address: 'تهران، خیابان نمونه',
    description: 'مشتری فروشگاه',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response;
}

interface MockOptions {
  customers?: Customer[];
  failCustomers?: boolean;
  loadingCustomers?: boolean;
  failCreate?: boolean;
}

function installCustomerFetch(options: MockOptions = {}) {
  const customers = [...(options.customers ?? [])];
  const requests: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input), 'http://bazariya.test');
    const method = init?.method ?? 'GET';
    let body: Record<string, unknown> | undefined;
    if (typeof init?.body === 'string') {
      const parsed: unknown = JSON.parse(init.body);
      if (isRecord(parsed)) body = parsed;
    }
    requests.push({ path: `${url.pathname}${url.search}`, method, ...(body ? { body } : {}) });

    if (url.pathname === '/api/v1/health') {
      return jsonResponse(200, { data: { status: 'ok', service: 'bazariya-api', database: 'connected' } });
    }
    if (url.pathname.startsWith('/api/v1/customers')) {
      if (options.loadingCustomers) return new Promise<Response>(() => undefined);
      if (options.failCustomers) {
        return jsonResponse(500, { error: { code: 'INTERNAL_SERVER_ERROR', message: 'request failed' } });
      }
    }

    if (url.pathname === '/api/v1/customers' && method === 'GET') {
      const search = url.searchParams.get('search')?.trim().toLocaleLowerCase('en-US');
      const active = url.searchParams.get('isActive');
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
      const filtered = customers
        .filter((customer) => !search
          || customer.name.toLocaleLowerCase('en-US').includes(search)
          || customer.phone?.includes(search)
          || customer.email?.toLocaleLowerCase('en-US').includes(search))
        .filter((customer) => active === null || customer.isActive === (active === 'true'))
        .sort((left, right) => left.name.localeCompare(right.name, 'fa'));
      const total = filtered.length;
      const offset = (page - 1) * pageSize;
      return jsonResponse(200, {
        data: {
          items: filtered.slice(offset, offset + pageSize),
          pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        },
      });
    }
    if (url.pathname === '/api/v1/customers' && method === 'POST' && body) {
      if (options.failCreate) {
        return jsonResponse(400, {
          error: {
            code: 'CUSTOMER_PHONE_INVALID',
            message: 'شماره تماس مشتری معتبر نیست.',
            details: [{ field: 'phone', message: 'شماره تماس دیگری وارد کنید.' }],
          },
        });
      }
      const created = makeCustomer({
        id: `30000000-0000-4000-8000-${String(customers.length + 1).padStart(12, '0')}`,
        name: String(body.name),
        phone: typeof body.phone === 'string' ? body.phone : null,
        email: typeof body.email === 'string' ? body.email : null,
        address: typeof body.address === 'string' ? body.address : null,
        description: typeof body.description === 'string' ? body.description : null,
        isActive: body.isActive !== false,
      });
      customers.push(created);
      return jsonResponse(201, { data: created });
    }

    const match = url.pathname.match(/^\/api\/v1\/customers\/([^/]+)$/);
    if (match) {
      const id = decodeURIComponent(match[1] ?? '');
      const customer = customers.find((item) => item.id === id);
      if (!customer) return jsonResponse(404, { error: { code: 'CUSTOMER_NOT_FOUND', message: 'مشتری پیدا نشد.' } });
      if (method === 'GET') return jsonResponse(200, { data: customer });
      if (method === 'PATCH' && body) {
        const updated: Customer = {
          ...customer,
          ...(typeof body.name === 'string' ? { name: body.name } : {}),
          ...(body.phone === null || typeof body.phone === 'string' ? { phone: body.phone } : {}),
          ...(body.email === null || typeof body.email === 'string' ? { email: body.email } : {}),
          ...(body.address === null || typeof body.address === 'string' ? { address: body.address } : {}),
          ...(body.description === null || typeof body.description === 'string' ? { description: body.description } : {}),
          ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
          updatedAt: new Date().toISOString(),
        };
        customers[customers.indexOf(customer)] = updated;
        return jsonResponse(200, { data: updated });
      }
      if (method === 'DELETE') {
        customers.splice(customers.indexOf(customer), 1);
        return jsonResponse(200, { data: { id } });
      }
    }

    return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, requests, customers };
}

function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  document.documentElement.dataset.theme = 'light';
});

describe('Customer UI', () => {
  it('opens the customer form from the dashboard quick action', async () => {
    installCustomerFetch();
    renderRoute('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: /افزودن مشتری/ }));

    expect(await screen.findByRole('heading', { name: 'مدیریت مشتریان' })).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'افزودن مشتری' })).toBeInTheDocument();
  });

  it('renders customers and searches by name, phone, email with active-status filtering', async () => {
    const active = makeCustomer();
    const inactive = makeCustomer({
      id: secondCustomerId,
      name: 'آرمان کریمی',
      phone: '02112345678',
      email: 'arman@example.com',
      isActive: false,
    });
    const { requests } = installCustomerFetch({ customers: [active, inactive] });
    renderRoute('/customers');

    expect(await screen.findByRole('heading', { name: 'مدیریت مشتریان' })).toBeInTheDocument();
    expect((await screen.findAllByText('سارا احمدی')).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('جستجوی مشتریان'), { target: { value: 'sara' } });
    await waitFor(() => expect(requests.some((item) => item.path.includes('search=sara'))).toBe(true));
    fireEvent.change(screen.getByLabelText('جستجوی مشتریان'), { target: { value: '0912123' } });
    await waitFor(() => expect(requests.some((item) => item.path.includes('search=0912123'))).toBe(true));
    fireEvent.change(screen.getByLabelText('جستجوی مشتریان'), { target: { value: 'arman@example.com' } });
    await waitFor(() => expect(requests.some((item) => item.path.includes('search=arman%40example.com'))).toBe(true));

    fireEvent.change(screen.getByLabelText('جستجوی مشتریان'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('وضعیت'), { target: { value: 'inactive' } });
    await waitFor(() => expect(requests.some((item) => item.path.includes('isActive=false'))).toBe(true));
    expect((await screen.findAllByText('آرمان کریمی')).length).toBeGreaterThan(0);
  });

  it('shows customer empty, loading, and error states', async () => {
    installCustomerFetch({ customers: [] });
    const empty = renderRoute('/customers');
    expect(await screen.findByText('هنوز مشتری‌ای ثبت نشده است')).toBeInTheDocument();
    empty.unmount();
    cleanup();

    installCustomerFetch({ loadingCustomers: true });
    renderRoute('/customers');
    expect(await screen.findByText('در حال دریافت مشتریان…')).toBeInTheDocument();
    cleanup();

    installCustomerFetch({ failCustomers: true });
    renderRoute('/customers');
    expect(await screen.findByText('دریافت فهرست مشتریان با مشکل مواجه شد.')).toBeInTheDocument();
  });

  it('validates and creates customers with normalized contacts and cleared optional values', async () => {
    const { requests, customers } = installCustomerFetch();
    renderRoute('/customers');
    await screen.findByRole('heading', { name: 'مدیریت مشتریان' });
    fireEvent.click(screen.getAllByRole('button', { name: /افزودن مشتری/ })[0]!);
    await screen.findByRole('dialog', { name: 'افزودن مشتری' });
    await waitFor(() => expect(screen.getByLabelText('نام مشتری *')).toHaveFocus());

    fireEvent.change(screen.getByLabelText('نام مشتری *'), { target: { value: '  ' } });
    fireEvent.change(screen.getByLabelText('شماره تماس'), { target: { value: '1234' } });
    fireEvent.change(screen.getByLabelText('ایمیل'), { target: { value: 'invalid-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ مشتری' }));
    expect(await screen.findByText('نام مشتری باید دست‌کم ۲ نویسه باشد.')).toBeInTheDocument();
    expect(screen.getByText('شماره را با قالبی مانند 09121234567 یا 02112345678 وارد کنید.')).toBeInTheDocument();
    expect(screen.getByText('یک نشانی ایمیل معتبر وارد کنید.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('نام مشتری *'), { target: { value: '  سارا رضایی  ' } });
    fireEvent.change(screen.getByLabelText('شماره تماس'), { target: { value: ' ۰۹۱۲ ۱۲۳ ۴۵۶۷ ' } });
    fireEvent.change(screen.getByLabelText('ایمیل'), { target: { value: ' SARA@Example.COM ' } });
    fireEvent.change(screen.getByLabelText('آدرس'), { target: { value: '  تهران  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ مشتری' }));

    await waitFor(() => expect(requests.some((item) => item.method === 'POST' && item.path === '/api/v1/customers')).toBe(true));
    const createRequest = requests.find((item) => item.method === 'POST' && item.path === '/api/v1/customers');
    expect(createRequest?.body).toMatchObject({
      name: 'سارا رضایی',
      phone: '09121234567',
      email: 'sara@example.com',
      address: 'تهران',
      description: null,
      isActive: true,
    });
    expect(customers).toHaveLength(1);
    expect(await screen.findByText('مشتری جدید ثبت شد.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'افزودن مشتری' })).not.toBeInTheDocument());
  });

  it('keeps customer form values and associates server validation errors with their fields', async () => {
    const { requests } = installCustomerFetch({ failCreate: true });
    renderRoute('/customers');
    await screen.findByRole('heading', { name: 'مدیریت مشتریان' });
    fireEvent.click(screen.getAllByRole('button', { name: /افزودن مشتری/ })[0]!);
    await screen.findByRole('dialog', { name: 'افزودن مشتری' });
    fireEvent.change(screen.getByLabelText('نام مشتری *'), { target: { value: 'مشتری آزمایشی' } });
    fireEvent.change(screen.getByLabelText('شماره تماس'), { target: { value: '09121234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ مشتری' }));

    expect(await screen.findByText('شماره تماس دیگری وارد کنید.')).toBeInTheDocument();
    expect(screen.getByLabelText('نام مشتری *')).toHaveValue('مشتری آزمایشی');
    expect(screen.getByLabelText('شماره تماس')).toHaveValue('09121234567');
    expect(requests.some((item) => item.method === 'POST' && item.path === '/api/v1/customers')).toBe(true);
  });

  it('shows only customer details, supports editing and active toggle, and confirms deletion', async () => {
    const customer = makeCustomer();
    const { requests, customers } = installCustomerFetch({ customers: [customer] });
    renderRoute(`/customers/${customer.id}`);

    expect(await screen.findByRole('heading', { name: customer.name })).toBeInTheDocument();
    expect(screen.getByText('تهران، خیابان نمونه')).toBeInTheDocument();
    expect(screen.getByText('sara@example.com')).toBeInTheDocument();
    expect(screen.queryByText('سفارش‌ها')).not.toBeInTheDocument();
    expect(screen.queryByText('بدهی')).not.toBeInTheDocument();
    expect(screen.queryByText('پرداخت')).not.toBeInTheDocument();
    expect(screen.queryByText('موجودی')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'غیرفعال کردن' }));
    await waitFor(() => expect(requests.some((item) => item.method === 'PATCH' && item.body?.isActive === false)).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'ویرایش مشتری' }));
    await screen.findByRole('dialog', { name: 'ویرایش مشتری' });
    fireEvent.change(screen.getByLabelText('نام مشتری *'), { target: { value: 'سارا رضایی' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ مشتری' }));
    expect(await screen.findByRole('heading', { name: 'سارا رضایی' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'حذف مشتری' }));
    expect(await screen.findByRole('dialog', { name: 'حذف مشتری' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'انصراف' }));
    expect(requests.some((item) => item.method === 'DELETE')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'حذف مشتری' }));
    fireEvent.click(await screen.findByRole('button', { name: 'حذف' }));
    await waitFor(() => expect(requests.some((item) => item.method === 'DELETE' && item.path.includes(customer.id))).toBe(true));
    await waitFor(() => expect(customers).toHaveLength(0));
    expect(await screen.findByRole('heading', { name: 'مدیریت مشتریان' })).toBeInTheDocument();
  });
});
