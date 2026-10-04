import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { Product, PurchaseDetails, PurchaseListItem, Supplier } from '@bazariya/shared';
import { AppRoutes } from '../../App';
import { ThemeProvider } from '../../components/providers/ThemeProvider';
import { ToastProvider } from '../../components/ui/Toast';

const supplierId = '70000000-0000-4000-8000-000000000001';
const productId = '70000000-0000-4000-8000-000000000002';
const purchaseId = '70000000-0000-4000-8000-000000000003';
const now = '2026-10-04T09:00:00.000Z';

function makeSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: supplierId,
    name: 'پخش چای بهار',
    phone: '02112345678',
    email: 'orders@example.test',
    address: 'تهران، بازار بزرگ',
    note: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: productId,
    name: 'چای کیسه‌ای',
    sku: 'TEA-001',
    categoryId: '70000000-0000-4000-8000-000000000004',
    unit: 'pack',
    description: null,
    salePrice: 20_000,
    purchasePrice: 12_000,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makePurchase(overrides: Partial<PurchaseDetails> = {}): PurchaseDetails {
  const supplier = makeSupplier();
  const product = makeProduct();
  return {
    id: purchaseId,
    purchaseNumber: 'PUR-000001',
    supplierId: supplier.id,
    status: 'draft',
    subtotal: 24_000,
    discount: 0,
    total: 24_000,
    note: null,
    createdAt: now,
    updatedAt: now,
    supplier: { id: supplier.id, name: supplier.name, phone: supplier.phone, email: supplier.email, isActive: supplier.isActive },
    items: [{
      id: '70000000-0000-4000-8000-000000000005',
      purchaseId,
      productId: product.id,
      productNameSnapshot: product.name,
      productSkuSnapshot: product.sku,
      unitSnapshot: product.unit,
      unitPrice: 12_000,
      quantity: 2,
      lineTotal: 24_000,
    }],
    ...overrides,
  };
}

function jsonResponse(status: number, payload: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => payload } as unknown as Response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function installPurchasingFetch(options: { suppliers?: Supplier[]; products?: Product[]; purchases?: PurchaseDetails[] } = {}) {
  const suppliers = [...(options.suppliers ?? [makeSupplier()])];
  const products = [...(options.products ?? [makeProduct()])];
  const purchases = new Map((options.purchases ?? []).map((purchase) => [purchase.id, purchase]));
  const requests: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];
  let supplierSequence = suppliers.length;
  let purchaseSequence = purchases.size;
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

    if (url.pathname === '/api/v1/suppliers' && method === 'GET') {
      const search = url.searchParams.get('search')?.trim().toLocaleLowerCase('en-US');
      const status = url.searchParams.get('status');
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
      const filtered = suppliers
        .filter((supplier) => !search
          || supplier.name.toLocaleLowerCase('en-US').includes(search)
          || supplier.phone?.toLocaleLowerCase('en-US').includes(search)
          || supplier.email?.toLocaleLowerCase('en-US').includes(search))
        .filter((supplier) => !status || supplier.isActive === (status === 'active'));
      const total = filtered.length;
      return jsonResponse(200, { data: { items: filtered.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } });
    }
    if (url.pathname === '/api/v1/suppliers' && method === 'POST' && body) {
      supplierSequence += 1;
      const created = makeSupplier({
        id: `70000000-0000-4000-8000-${String(supplierSequence).padStart(12, '0')}`,
        name: String(body.name),
        phone: typeof body.phone === 'string' ? body.phone : null,
        email: typeof body.email === 'string' ? body.email : null,
        address: typeof body.address === 'string' ? body.address : null,
        note: typeof body.note === 'string' ? body.note : null,
      });
      suppliers.push(created);
      return jsonResponse(201, { data: created });
    }
    const supplierStatusMatch = url.pathname.match(/^\/api\/v1\/suppliers\/([^/]+)\/status$/);
    if (supplierStatusMatch && method === 'PATCH' && body) {
      const id = decodeURIComponent(supplierStatusMatch[1] ?? '');
      const supplier = suppliers.find((item) => item.id === id);
      if (!supplier) return jsonResponse(404, { error: { code: 'SUPPLIER_NOT_FOUND', message: 'تأمین‌کننده پیدا نشد.' } });
      const updated = { ...supplier, isActive: body.isActive === true, updatedAt: new Date().toISOString() };
      suppliers[suppliers.indexOf(supplier)] = updated;
      return jsonResponse(200, { data: updated });
    }
    const supplierMatch = url.pathname.match(/^\/api\/v1\/suppliers\/([^/]+)$/);
    if (supplierMatch) {
      const id = decodeURIComponent(supplierMatch[1] ?? '');
      const supplier = suppliers.find((item) => item.id === id);
      if (!supplier) return jsonResponse(404, { error: { code: 'SUPPLIER_NOT_FOUND', message: 'تأمین‌کننده پیدا نشد.' } });
      if (method === 'GET') return jsonResponse(200, { data: supplier });
      if (method === 'PATCH' && body) {
        const updated: Supplier = { ...supplier, ...body, updatedAt: new Date().toISOString() };
        suppliers[suppliers.indexOf(supplier)] = updated;
        return jsonResponse(200, { data: updated });
      }
      if (method === 'DELETE') {
        return jsonResponse(409, { error: { code: 'SUPPLIER_HAS_PURCHASE_HISTORY', message: 'تأمین‌کننده سابقهٔ خرید دارد.' } });
      }
    }

    if (url.pathname === '/api/v1/products' && method === 'GET') {
      const search = url.searchParams.get('search')?.trim().toLocaleLowerCase('fa');
      const active = url.searchParams.get('isActive');
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
      const filtered = products
        .filter((product) => !search || product.name.toLocaleLowerCase('fa').includes(search) || product.sku.toLocaleLowerCase('fa').includes(search))
        .filter((product) => active === null || product.isActive === (active === 'true'));
      const total = filtered.length;
      return jsonResponse(200, { data: { items: filtered.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } });
    }

    if (url.pathname === '/api/v1/purchases' && method === 'GET') {
      const search = url.searchParams.get('search')?.toLocaleLowerCase('en-US');
      const supplierFilter = url.searchParams.get('supplierId');
      const status = url.searchParams.get('status');
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
      const filtered = [...purchases.values()]
        .filter((purchase) => !supplierFilter || purchase.supplierId === supplierFilter)
        .filter((purchase) => !status || purchase.status === status)
        .filter((purchase) => !search || purchase.purchaseNumber.toLocaleLowerCase('en-US').includes(search) || purchase.supplier.name.toLocaleLowerCase('en-US').includes(search));
      const total = filtered.length;
      const items: PurchaseListItem[] = filtered.slice((page - 1) * pageSize, page * pageSize).map((purchase) => ({
        ...purchase,
        supplierName: purchase.supplier.name,
        itemCount: purchase.items.length,
      }));
      return jsonResponse(200, { data: { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } });
    }
    if (url.pathname === '/api/v1/purchases' && method === 'POST' && body) {
      const supplier = suppliers.find((item) => item.id === body.supplierId) ?? makeSupplier();
      const inputItems = Array.isArray(body.items) ? body.items.filter(isRecord) : [];
      const itemRows = inputItems.map((item, index) => {
        const product = products.find((candidate) => candidate.id === item.productId) ?? makeProduct();
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        return {
          id: `70000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
          purchaseId,
          productId: product.id,
          productNameSnapshot: product.name,
          productSkuSnapshot: product.sku,
          unitSnapshot: product.unit,
          quantity,
          unitPrice,
          lineTotal: quantity * unitPrice,
        };
      });
      const subtotal = itemRows.reduce((sum, item) => sum + item.lineTotal, 0);
      const discount = Number(body.discount ?? 0);
      purchaseSequence += 1;
      const created: PurchaseDetails = {
        ...makePurchase({ id: `70000000-0000-4000-8000-${String(purchaseSequence + 2).padStart(12, '0')}` }),
        purchaseNumber: `PUR-${String(purchaseSequence).padStart(6, '0')}`,
        supplierId: supplier.id,
        status: 'draft',
        subtotal,
        discount,
        total: subtotal - discount,
        note: typeof body.note === 'string' ? body.note : null,
        supplier: { id: supplier.id, name: supplier.name, phone: supplier.phone, email: supplier.email, isActive: supplier.isActive },
        items: itemRows,
      };
      purchases.set(created.id, created);
      return jsonResponse(201, { data: created });
    }
    const purchaseStatusMatch = url.pathname.match(/^\/api\/v1\/purchases\/([^/]+)\/status$/);
    if (purchaseStatusMatch && method === 'PATCH' && body) {
      const id = decodeURIComponent(purchaseStatusMatch[1] ?? '');
      const purchase = purchases.get(id);
      if (!purchase) return jsonResponse(404, { error: { code: 'PURCHASE_NOT_FOUND', message: 'خرید پیدا نشد.' } });
      const status = body.status === 'confirmed' ? 'confirmed' : 'cancelled';
      const updated: PurchaseDetails = { ...purchase, status, updatedAt: new Date().toISOString() };
      purchases.set(id, updated);
      return jsonResponse(200, { data: updated });
    }
    const purchaseMatch = url.pathname.match(/^\/api\/v1\/purchases\/([^/]+)$/);
    if (purchaseMatch) {
      const id = decodeURIComponent(purchaseMatch[1] ?? '');
      const purchase = purchases.get(id);
      if (!purchase) return jsonResponse(404, { error: { code: 'PURCHASE_NOT_FOUND', message: 'خرید پیدا نشد.' } });
      if (method === 'GET') return jsonResponse(200, { data: purchase });
      if (method === 'PATCH' && body) {
        const updated = { ...purchase, ...body, updatedAt: new Date().toISOString() } as PurchaseDetails;
        purchases.set(id, updated);
        return jsonResponse(200, { data: updated });
      }
    }
    return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, requests, suppliers, products, purchases };
}

function renderRoute(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
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

describe('Supplier and Purchase UI', () => {
  it('renders supplier directory, filters on contact details and creates a Supplier', async () => {
    const supplier = makeSupplier();
    const { requests } = installPurchasingFetch({ suppliers: [supplier] });
    renderRoute('/suppliers');

    expect(await screen.findByRole('heading', { name: 'تأمین‌کنندگان' })).toBeInTheDocument();
    expect(await screen.findAllByText('پخش چای بهار')).not.toHaveLength(0);
    fireEvent.change(screen.getByLabelText('جستجوی تأمین‌کنندگان'), { target: { value: 'orders@example.test' } });
    await waitFor(() => expect(requests.some((item) => item.path.includes('search=orders%40example.test'))).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'ثبت تأمین‌کننده' }));
    expect(await screen.findByRole('dialog', { name: 'ثبت تأمین‌کننده' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('نام تأمین‌کننده *'), { target: { value: 'پخش جدید' } });
    fireEvent.change(screen.getByLabelText('شماره تماس'), { target: { value: '021-12345678' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ تأمین‌کننده' }));
    expect(await screen.findByText('تأمین‌کننده ثبت شد.')).toBeInTheDocument();
    await waitFor(() => expect(requests.some((item) => item.method === 'POST' && item.path === '/api/v1/suppliers')).toBe(true));
  });

  it('creates and confirms a draft Purchase from the responsive Persian composer', async () => {
    const supplier = makeSupplier();
    const product = makeProduct();
    const { requests } = installPurchasingFetch({ suppliers: [supplier], products: [product] });
    renderRoute('/purchases/new');

    fireEvent.change(screen.getByLabelText('جستجوی تأمین‌کننده'), { target: { value: 'پخش چای' } });
    fireEvent.click(await screen.findByRole('button', { name: /پخش چای بهار/ }));
    fireEvent.change(screen.getByLabelText('جستجوی محصول فعال'), { target: { value: 'چای کیسه‌ای' } });
    fireEvent.click(await screen.findByRole('button', { name: /چای کیسه‌ای/ }));
    fireEvent.change(screen.getByLabelText('تعداد'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('قیمت خرید (تومان)'), { target: { value: '15000' } });
    fireEvent.change(screen.getByLabelText('تخفیف (تومان)'), { target: { value: '5000' } });
    fireEvent.change(screen.getByLabelText('یادداشت خرید'), { target: { value: 'رسید نمونه' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ پیش‌نویس خرید' }));

    expect(await screen.findByRole('heading', { name: 'PUR-000001' })).toBeInTheDocument();
    expect(await screen.findByText('۴۰٬۰۰۰ تومان')).toBeInTheDocument();
    const createRequest = requests.find((item) => item.method === 'POST' && item.path === '/api/v1/purchases');
    expect(createRequest?.body).toEqual({
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 3, unitPrice: 15_000 }],
      discount: 5_000,
      note: 'رسید نمونه',
    });

    fireEvent.click(screen.getByRole('button', { name: 'نهایی‌سازی خرید' }));
    expect(await screen.findByRole('dialog', { name: 'نهایی‌سازی خرید' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'بله، نهایی‌سازی خرید' }));
    expect(await screen.findByText('خرید نهایی شد و موجودی به‌روزرسانی شد.')).toBeInTheDocument();
    expect(requests.some((item) => item.method === 'PATCH' && item.path.endsWith('/status') && item.body?.status === 'confirmed')).toBe(true);
  });

  it('shows Supplier details and links to that Supplier’s filtered Purchases', async () => {
    const supplier = makeSupplier();
    const { requests } = installPurchasingFetch({ suppliers: [supplier] });
    renderRoute(`/suppliers/${supplier.id}`);

    expect(await screen.findByRole('heading', { name: supplier.name })).toBeInTheDocument();
    expect(screen.getByText('orders@example.test')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'خریدهای این تأمین‌کننده' }));
    expect(await screen.findByRole('heading', { name: 'خریدها' })).toBeInTheDocument();
    await waitFor(() => expect(requests.some((item) => {
      const url = new URL(item.path, 'http://bazariya.test');
      return url.pathname === '/api/v1/purchases' && url.searchParams.get('supplierId') === supplier.id;
    })).toBe(true));
  });

  it('shows Purchase history and immutable product snapshots in the details page', async () => {
    const purchase = makePurchase({ status: 'confirmed' });
    const { requests } = installPurchasingFetch({ purchases: [purchase] });
    renderRoute(`/purchases/${purchase.id}`);

    expect(await screen.findByRole('heading', { name: purchase.purchaseNumber })).toBeInTheDocument();
    expect(screen.getAllByText('چای کیسه‌ای').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TEA-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('نهایی‌شده').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'ویرایش پیش‌نویس' })).not.toBeInTheDocument();
    expect(requests.some((item) => item.path === `/api/v1/purchases/${purchase.id}`)).toBe(true);
  });
});
