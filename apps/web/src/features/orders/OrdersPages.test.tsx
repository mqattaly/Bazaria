import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { Customer, OrderDetails, OrderListItem, Product } from '@bazariya/shared';
import { AppRoutes } from '../../App';
import { ThemeProvider } from '../../components/providers/ThemeProvider';
import { ToastProvider } from '../../components/ui/Toast';

const productId = '40000000-0000-4000-8000-000000000001';
const customerId = '30000000-0000-4000-8000-000000000001';
const orderId = '50000000-0000-4000-8000-000000000001';
const now = '2026-09-20T10:00:00.000Z';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: productId,
    name: 'چای ممتاز',
    sku: 'TEA-001',
    categoryId: '20000000-0000-4000-8000-000000000001',
    unit: 'pack',
    description: null,
    salePrice: 125_000,
    purchasePrice: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: customerId,
    name: 'سارا احمدی',
    phone: '09121234567',
    email: null,
    address: null,
    description: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<OrderDetails> = {}): OrderDetails {
  const product = makeProduct();
  const customer = makeCustomer();
  return {
    id: orderId,
    orderNumber: 'BAZ-000000001',
    customerId: customer.id,
    status: 'draft',
    note: null,
    subtotal: 250_000,
    discount: 0,
    total: 250_000,
    createdAt: now,
    updatedAt: now,
    confirmedAt: null,
    cancelledAt: null,
    customer: { id: customer.id, name: customer.name, phone: customer.phone },
    items: [{
      id: '60000000-0000-4000-8000-000000000001',
      orderId,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      unit: product.unit,
      quantity: 2,
      unitPrice: product.salePrice,
      total: 250_000,
    }],
    ...overrides,
  };
}

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface MockOptions {
  products?: Product[];
  customers?: Customer[];
  orders?: OrderDetails[];
  failProductSearch?: boolean;
}

function installOrdersFetch(options: MockOptions = {}) {
  const products = [...(options.products ?? [makeProduct()])];
  const customers = [...(options.customers ?? [makeCustomer()])];
  const orders = new Map((options.orders ?? []).map((order) => [order.id, order]));
  const requests: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];
  let orderSequence = orders.size;
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
    if (url.pathname === '/api/v1/products' && method === 'GET') {
      if (options.failProductSearch) return jsonResponse(500, { error: { code: 'INTERNAL_SERVER_ERROR', message: 'محصولات دریافت نشد.' } });
      const search = url.searchParams.get('search')?.toLocaleLowerCase('fa');
      const active = url.searchParams.get('isActive');
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
      const filtered = products
        .filter((product) => !search || product.name.toLocaleLowerCase('fa').includes(search) || product.sku.toLocaleLowerCase('fa').includes(search))
        .filter((product) => active === null || product.isActive === (active === 'true'));
      const total = filtered.length;
      return jsonResponse(200, { data: { items: filtered.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } });
    }
    if (url.pathname === '/api/v1/customers' && method === 'GET') {
      const search = url.searchParams.get('search')?.toLocaleLowerCase('fa');
      const active = url.searchParams.get('isActive');
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
      const filtered = customers
        .filter((customer) => !search || customer.name.toLocaleLowerCase('fa').includes(search) || customer.phone?.includes(search))
        .filter((customer) => active === null || customer.isActive === (active === 'true'));
      const total = filtered.length;
      return jsonResponse(200, { data: { items: filtered.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } });
    }
    if (url.pathname === '/api/v1/orders' && method === 'GET') {
      const search = url.searchParams.get('search')?.toLocaleLowerCase('fa');
      const status = url.searchParams.get('status');
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
      const filtered = [...orders.values()]
        .filter((order) => !status || order.status === status)
        .filter((order) => !from || Date.parse(order.createdAt) >= Date.parse(from))
        .filter((order) => !to || Date.parse(order.createdAt) <= Date.parse(to))
        .filter((order) => !search
          || order.orderNumber.toLocaleLowerCase('fa').includes(search)
          || order.customer?.name.toLocaleLowerCase('fa').includes(search)
          || order.items.some((item) => item.productName.toLocaleLowerCase('fa').includes(search)));
      const total = filtered.length;
      const items: OrderListItem[] = filtered.slice((page - 1) * pageSize, page * pageSize).map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        status: order.status,
        note: order.note,
        subtotal: order.subtotal,
        discount: order.discount,
        total: order.total,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        confirmedAt: order.confirmedAt,
        cancelledAt: order.cancelledAt,
        customerName: order.customer?.name ?? null,
        customerPhone: order.customer?.phone ?? null,
        itemCount: order.items.length,
      }));
      return jsonResponse(200, { data: { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } });
    }
    if (url.pathname === '/api/v1/orders' && method === 'POST' && body) {
      const customer = customers.find((item) => item.id === body.customerId);
      const inputItems = Array.isArray(body.items) ? body.items.filter(isRecord) : [];
      const orderItems = inputItems.map((item, index) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        const quantity = Number(item.quantity);
        return {
          id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          orderId,
          productId: product?.id ?? productId,
          productName: product?.name ?? 'چای ممتاز',
          sku: product?.sku ?? 'TEA-001',
          unit: product?.unit ?? 'pack',
          quantity,
          unitPrice: product?.salePrice ?? 125_000,
          total: (product?.salePrice ?? 125_000) * quantity,
        };
      });
      const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
      orderSequence += 1;
      const created: OrderDetails = {
        id: '50000000-0000-4000-8000-000000000002',
        orderNumber: `BAZ-${String(orderSequence).padStart(9, '0')}`,
        customerId: typeof body.customerId === 'string' ? body.customerId : null,
        status: 'draft',
        note: typeof body.note === 'string' ? body.note : null,
        subtotal,
        discount: Number(body.discount ?? 0),
        total: subtotal - Number(body.discount ?? 0),
        createdAt: now,
        updatedAt: now,
        confirmedAt: null,
        cancelledAt: null,
        customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
        items: orderItems,
      };
      orders.set(created.id, created);
      return jsonResponse(201, { data: created });
    }
    const statusMatch = url.pathname.match(/^\/api\/v1\/orders\/([^/]+)\/status$/);
    if (statusMatch && method === 'PATCH' && body) {
      const id = decodeURIComponent(statusMatch[1] ?? '');
      const order = orders.get(id);
      if (!order) return jsonResponse(404, { error: { code: 'ORDER_NOT_FOUND', message: 'سفارش پیدا نشد.' } });
      const status = body.status as OrderDetails['status'];
      const updated: OrderDetails = {
        ...order,
        status,
        updatedAt: new Date().toISOString(),
        confirmedAt: status === 'confirmed' ? now : order.confirmedAt,
        cancelledAt: status === 'cancelled' ? now : null,
      };
      orders.set(id, updated);
      return jsonResponse(200, { data: updated });
    }
    const orderMatch = url.pathname.match(/^\/api\/v1\/orders\/([^/]+)$/);
    if (orderMatch) {
      const id = decodeURIComponent(orderMatch[1] ?? '');
      const order = orders.get(id);
      if (!order) return jsonResponse(404, { error: { code: 'ORDER_NOT_FOUND', message: 'سفارش پیدا نشد.' } });
      if (method === 'GET') return jsonResponse(200, { data: order });
      if (method === 'PATCH' && body) {
        const updated = { ...order, note: typeof body.note === 'string' ? body.note : order.note, updatedAt: new Date().toISOString() };
        orders.set(id, updated);
        return jsonResponse(200, { data: updated });
      }
    }
    return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, requests, orders };
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

describe('Orders UI', () => {
  it('searches customer and product, edits quantities, calculates totals, and submits only product ids and quantities', async () => {
    const product = makeProduct();
    const customer = makeCustomer();
    const { requests } = installOrdersFetch({ products: [product], customers: [customer] });
    renderRoute('/orders/new');

    expect(await screen.findByRole('heading', { name: 'ثبت سفارش جدید' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('جستجوی محصول'), { target: { value: 'چای' } });
    fireEvent.click(await screen.findByRole('button', { name: 'افزودن چای ممتاز به سفارش' }));
    fireEvent.click(screen.getByRole('button', { name: 'افزایش تعداد چای ممتاز' }));

    fireEvent.change(screen.getByLabelText('جستجوی مشتری'), { target: { value: 'سارا' } });
    fireEvent.click(await screen.findByRole('button', { name: /سارا احمدی/ }));
    fireEvent.change(screen.getByLabelText('تخفیف (تومان)'), { target: { value: '5000' } });
    fireEvent.change(screen.getByLabelText('یادداشت سفارش'), { target: { value: '  تلفنی  ' } });
    expect(screen.getByText('۲۴۵٬۰۰۰ تومان')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ پیش‌نویس' }));
    await screen.findByRole('heading', { name: 'BAZ-000000001' });
    const createRequest = requests.find((item) => item.method === 'POST' && item.path === '/api/v1/orders');
    expect(createRequest?.body).toMatchObject({
      customerId: customer.id,
      items: [{ productId: product.id, quantity: 2 }],
      discount: 5000,
      note: 'تلفنی',
    });
    expect(createRequest?.body?.items).not.toHaveProperty('unitPrice');
  });

  it('renders filtered order history and formats timestamps and totals in Persian', async () => {
    const order = makeOrder();
    const { requests } = installOrdersFetch({ orders: [order] });
    renderRoute('/orders');

    expect(await screen.findByRole('heading', { name: 'مدیریت سفارش‌ها' })).toBeInTheDocument();
    expect((await screen.findAllByText('BAZ-000000001')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('۲۵۰٬۰۰۰ تومان').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('وضعیت سفارش'), { target: { value: 'draft' } });
    fireEvent.change(screen.getByLabelText('از تاریخ و ساعت (به وقت تهران)'), { target: { value: '2026-09-01T00:00' } });
    await waitFor(() => expect(requests.some((item) => {
      const url = new URL(item.path, 'http://bazariya.test');
      return url.searchParams.get('status') === 'draft' && url.searchParams.get('from') === '2026-08-31T20:30:00.000Z';
    })).toBe(true));
  });

  it('shows draft status actions, confirmation dialog, and cancellation history', async () => {
    const order = makeOrder();
    const { requests } = installOrdersFetch({ orders: [order] });
    renderRoute(`/orders/${order.id}`);

    expect(await screen.findByRole('heading', { name: 'BAZ-000000001' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'تأیید سفارش' }));
    expect(await screen.findByRole('dialog', { name: 'تأیید سفارش' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'بله، تأیید سفارش' }));
    await waitFor(() => expect(requests.some((item) => item.method === 'PATCH' && item.path.endsWith('/status') && item.body?.status === 'confirmed')).toBe(true));
    expect((await screen.findAllByText('تأییدشده')).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'لغو سفارش' }));
    expect(await screen.findByRole('dialog', { name: 'لغو سفارش' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'بله، لغو سفارش' }));
    await waitFor(() => expect(requests.some((item) => item.method === 'PATCH' && item.path.endsWith('/status') && item.body?.status === 'cancelled')).toBe(true));
    expect((await screen.findAllByText('لغوشده')).length).toBeGreaterThan(0);
  });

  it('surfaces product-search errors without hiding the rest of the order form', async () => {
    installOrdersFetch({ failProductSearch: true });
    renderRoute('/orders/new');
    fireEvent.change(screen.getByLabelText('جستجوی محصول'), { target: { value: 'چای' } });
    expect(await screen.findByText('جستجوی محصولات انجام نشد.')).toBeInTheDocument();
    expect(screen.getByLabelText('یادداشت سفارش')).toBeInTheDocument();
  });
});
