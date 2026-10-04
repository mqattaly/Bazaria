import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type {
  InventoryItem,
  InventoryStatus,
  PaginatedData,
  StockMovement,
  StockMovementType,
} from '@bazariya/shared';
import { AppRoutes } from '../../App';
import { ThemeProvider } from '../../components/providers/ThemeProvider';
import { ToastProvider } from '../../components/ui/Toast';

const teaId = '40000000-0000-4000-8000-000000000051';
const boxId = '40000000-0000-4000-8000-000000000052';
const inactiveId = '40000000-0000-4000-8000-000000000053';
const emptyId = '40000000-0000-4000-8000-000000000054';
const now = '2026-10-04T09:00:00.000Z';

function makeInventoryItem(overrides: Partial<InventoryItem> & {
  productOverrides?: Partial<InventoryItem['product']>;
} = {}): InventoryItem {
  const { productOverrides, ...inventoryOverrides } = overrides;
  const quantity = inventoryOverrides.quantity ?? 6;
  const minimumQuantity = inventoryOverrides.minimumQuantity ?? 2;
  const status: InventoryStatus = quantity === 0 ? 'out-of-stock' : quantity <= minimumQuantity ? 'low-stock' : 'in-stock';
  return {
    product: {
      id: teaId,
      name: 'چای ممتاز',
      sku: 'TEA-001',
      unit: 'pack',
      isActive: true,
      ...productOverrides,
    },
    quantity,
    minimumQuantity,
    isLowStock: quantity <= minimumQuantity,
    status,
    updatedAt: now,
    ...inventoryOverrides,
  };
}

function makeMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: '70000000-0000-4000-8000-000000000001',
    productId: teaId,
    type: 'IN',
    quantity: 5,
    beforeQuantity: 0,
    afterQuantity: 5,
    note: 'ورود نمونه',
    createdAt: now,
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

interface InventoryFetchOptions {
  items?: InventoryItem[];
  movements?: StockMovement[];
  failList?: boolean;
  failMovement?: boolean;
  deferList?: boolean;
}

function makePage<T>(items: T[], page: number, pageSize: number): PaginatedData<T> {
  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    pagination: { page, pageSize, total: items.length, totalPages: Math.ceil(items.length / pageSize) },
  };
}

function installInventoryFetch(options: InventoryFetchOptions = {}) {
  const inventory = new Map((options.items ?? [makeInventoryItem()]).map((item) => [item.product.id, item]));
  const movements = new Map<string, StockMovement[]>();
  for (const item of inventory.values()) {
    movements.set(item.product.id, (options.movements ?? []).filter((movement) => movement.productId === item.product.id));
  }
  const requests: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];
  let movementSequence = 100;
  let releaseList!: () => void;
  const listReady = options.deferList ? new Promise<void>((resolve) => { releaseList = resolve; }) : Promise.resolve();

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

    if (url.pathname === '/api/v1/inventory' && method === 'GET') {
      await listReady;
      if (options.failList) return jsonResponse(500, { error: { code: 'INTERNAL_SERVER_ERROR', message: 'فهرست موجودی دریافت نشد.' } });
      const search = url.searchParams.get('search')?.toLocaleLowerCase('fa');
      const status = url.searchParams.get('status');
      const lowStock = url.searchParams.get('lowStock');
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
      const filtered = [...inventory.values()]
        .filter((item) => !search || item.product.name.toLocaleLowerCase('fa').includes(search) || item.product.sku.toLocaleLowerCase('fa').includes(search))
        .filter((item) => !status || item.status === status)
        .filter((item) => lowStock === null || item.isLowStock === (lowStock === 'true'));
      return jsonResponse(200, { data: makePage(filtered, page, pageSize) });
    }

    const minimumMatch = url.pathname.match(/^\/api\/v1\/inventory\/([^/]+)\/minimum$/);
    if (minimumMatch && method === 'PATCH' && body) {
      const id = decodeURIComponent(minimumMatch[1] ?? '');
      const current = inventory.get(id);
      if (!current) return jsonResponse(404, { error: { code: 'PRODUCT_NOT_FOUND', message: 'محصول پیدا نشد.' } });
      const minimumQuantity = Number(body.minimumQuantity);
      const status: InventoryStatus = current.quantity === 0 ? 'out-of-stock' : current.quantity <= minimumQuantity ? 'low-stock' : 'in-stock';
      const updated: InventoryItem = {
        ...current,
        minimumQuantity,
        isLowStock: current.quantity <= minimumQuantity,
        status,
        updatedAt: new Date().toISOString(),
      };
      inventory.set(id, updated);
      return jsonResponse(200, { data: updated });
    }

    const movementMatch = url.pathname.match(/^\/api\/v1\/inventory\/([^/]+)\/movements$/);
    if (movementMatch) {
      const id = decodeURIComponent(movementMatch[1] ?? '');
      if (method === 'GET') {
        const type = url.searchParams.get('type');
        const page = Number(url.searchParams.get('page') ?? '1');
        const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
        const rows = (movements.get(id) ?? []).filter((movement) => !type || movement.type === type);
        return jsonResponse(200, { data: makePage([...rows].reverse(), page, pageSize) });
      }
      if (method === 'POST' && body) {
        if (options.failMovement) {
          return jsonResponse(409, { error: { code: 'INSUFFICIENT_STOCK', message: 'موجودی فعلی برای این خروج کافی نیست.' } });
        }
        const current = inventory.get(id);
        if (!current) return jsonResponse(404, { error: { code: 'PRODUCT_NOT_FOUND', message: 'محصول پیدا نشد.' } });
        const type = body.type as StockMovementType;
        const quantity = Number(body.quantity);
        const afterQuantity = type === 'IN'
          ? current.quantity + quantity
          : type === 'OUT'
            ? current.quantity - quantity
            : quantity;
        const movement: StockMovement = {
          id: `70000000-0000-4000-8000-${String(++movementSequence).padStart(12, '0')}`,
          productId: id,
          type,
          quantity: type === 'ADJUSTMENT' ? Math.abs(afterQuantity - current.quantity) : quantity,
          beforeQuantity: current.quantity,
          afterQuantity,
          note: typeof body.note === 'string' ? body.note : null,
          createdAt: new Date(Date.now() + movementSequence * 1000).toISOString(),
        };
        const status: InventoryStatus = afterQuantity === 0 ? 'out-of-stock' : afterQuantity <= current.minimumQuantity ? 'low-stock' : 'in-stock';
        const updated: InventoryItem = {
          ...current,
          quantity: afterQuantity,
          isLowStock: afterQuantity <= current.minimumQuantity,
          status,
          updatedAt: movement.createdAt,
        };
        inventory.set(id, updated);
        movements.set(id, [...(movements.get(id) ?? []), movement]);
        return jsonResponse(201, { data: { inventory: updated, movement } });
      }
    }

    const detailMatch = url.pathname.match(/^\/api\/v1\/inventory\/([^/]+)$/);
    if (detailMatch && method === 'GET') {
      const id = decodeURIComponent(detailMatch[1] ?? '');
      const item = inventory.get(id);
      return item
        ? jsonResponse(200, { data: item })
        : jsonResponse(404, { error: { code: 'PRODUCT_NOT_FOUND', message: 'محصول پیدا نشد.' } });
    }
    return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, requests, releaseList: () => releaseList?.(), inventory, movements };
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

describe('Inventory UI', () => {
  it('shows loading, empty, and error states on the inventory list', async () => {
    const deferred = installInventoryFetch({ items: [], deferList: true });
    renderRoute('/inventory');
    expect(screen.getByRole('status')).toHaveTextContent('در حال دریافت موجودی محصولات');
    deferred.releaseList();
    expect(await screen.findByText('محصولی برای نمایش وجود ندارد')).toBeInTheDocument();

    cleanup();
    installInventoryFetch({ failList: true });
    renderRoute('/inventory');
    expect(await screen.findByText('دریافت فهرست موجودی با مشکل مواجه شد.')).toBeInTheDocument();
  });

  it('searches and filters inventory, opens a Product detail, and paginates movement history', async () => {
    const tea = makeInventoryItem();
    const low = makeInventoryItem({
      productOverrides: { id: boxId, name: 'ظرف غذا', sku: 'BOX-001' },
      quantity: 2,
      minimumQuantity: 5,
    });
    const inactive = makeInventoryItem({
      productOverrides: { id: inactiveId, name: 'قوری غیرفعال', sku: 'POT-002', isActive: false },
    });
    const empty = makeInventoryItem({
      productOverrides: { id: emptyId, name: 'محصول صفر', sku: 'ZERO-001' },
      quantity: 0,
      minimumQuantity: 0,
    });
    const history = Array.from({ length: 12 }, (_, index) => makeMovement({
      id: `70000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      productId: tea.product.id,
      type: index % 2 === 0 ? 'IN' : 'OUT',
      quantity: index + 1,
      beforeQuantity: index,
      afterQuantity: index + 1,
      note: `گردش ${index + 1}`,
      createdAt: new Date(Date.parse(now) - index * 60_000).toISOString(),
    }));
    const { requests } = installInventoryFetch({ items: [tea, low, inactive, empty], movements: history });
    renderRoute('/inventory');

    expect(await screen.findByRole('heading', { name: 'مدیریت موجودی' })).toBeInTheDocument();
    expect(await screen.findAllByText('ظرف غذا')).not.toHaveLength(0);
    expect(await screen.findAllByText('ناموجود')).not.toHaveLength(0);

    fireEvent.change(screen.getByLabelText('جستجوی موجودی'), { target: { value: 'BOX' } });
    await waitFor(() => expect(requests.some(({ path }) => new URL(path, 'http://bazariya.test').searchParams.get('search') === 'BOX')).toBe(true));
    fireEvent.change(screen.getByLabelText('وضعیت موجودی'), { target: { value: 'low-stock' } });
    await waitFor(() => expect(requests.some(({ path }) => {
      const url = new URL(path, 'http://bazariya.test');
      return url.searchParams.get('status') === 'low-stock' && url.searchParams.get('search') === 'BOX';
    })).toBe(true));

    const requestOffset = requests.length;
    fireEvent.change(screen.getByLabelText('جستجوی موجودی'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('وضعیت موجودی'), { target: { value: 'all' } });
    await waitFor(() => expect(requests.slice(requestOffset).some(({ path }) => {
      const url = new URL(path, 'http://bazariya.test');
      return url.pathname === '/api/v1/inventory' && url.searchParams.get('search') === null && url.searchParams.get('status') === null;
    })).toBe(true));
    expect(await screen.findAllByRole('button', { name: 'چای ممتاز' })).not.toHaveLength(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'چای ممتاز' })[0]!);
    expect(await screen.findByRole('heading', { name: 'چای ممتاز' })).toBeInTheDocument();
    expect(screen.getByText('محصول فعال')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'سابقهٔ گردش موجودی' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'رفتن به صفحهٔ بعد' }));
    await waitFor(() => expect(requests.some(({ path }) => {
      const url = new URL(path, 'http://bazariya.test');
      return url.pathname.endsWith(`/inventory/${tea.product.id}/movements`) && url.searchParams.get('page') === '2';
    })).toBe(true));

    fireEvent.change(screen.getByLabelText('نوع گردش'), { target: { value: 'OUT' } });
    await waitFor(() => expect(requests.some(({ path }) => new URL(path, 'http://bazariya.test').searchParams.get('type') === 'OUT')).toBe(true));
  });

  it('edits minimum quantity without creating a movement and preserves inactive-product read access', async () => {
    const item = makeInventoryItem({ quantity: 3, minimumQuantity: 1 });
    const inactive = makeInventoryItem({
      productOverrides: { id: inactiveId, name: 'محصول غیرفعال', sku: 'INACTIVE-1', isActive: false },
    });
    const { requests } = installInventoryFetch({ items: [item, inactive] });
    renderRoute(`/inventory/${inactive.product.id}`);

    expect(await screen.findByRole('heading', { name: 'محصول غیرفعال' })).toBeInTheDocument();
    expect(screen.getByText('محصول غیرفعال است؛ موجودی و سابقه قابل مشاهده‌اند، اما ثبت گردش جدید مجاز نیست.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ورود محصول غیرفعال' })).toBeDisabled();

    cleanup();
    renderRoute(`/inventory/${item.product.id}`);
    expect(await screen.findByRole('heading', { name: 'چای ممتاز' })).toBeInTheDocument();
    const movementRequestsBefore = requests.filter((request) => request.method === 'POST').length;
    fireEvent.change(screen.getByLabelText('حداقل قابل‌قبول (بسته)'), { target: { value: '۴' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ حداقل' }));
    expect(await screen.findByText('حداقل موجودی به‌روزرسانی شد.')).toBeInTheDocument();

    const patch = requests.find((request) => request.method === 'PATCH');
    expect(patch?.body).toEqual({ minimumQuantity: 4 });
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(movementRequestsBefore);
  });

  it('submits IN, OUT, and ADJUSTMENT inputs, showing calculated stock and preserving history snapshots', async () => {
    const item = makeInventoryItem({ quantity: 6, minimumQuantity: 2 });
    const { requests, inventory, movements } = installInventoryFetch({ items: [item] });
    renderRoute('/inventory');

    await screen.findByRole('heading', { name: 'مدیریت موجودی' });
    fireEvent.click((await screen.findAllByRole('button', { name: 'ورود چای ممتاز' }))[0]!);
    const quantityInput = screen.getByLabelText('تعداد');
    fireEvent.change(quantityInput, { target: { value: '۳' } });
    fireEvent.change(screen.getByLabelText('یادداشت (اختیاری)'), { target: { value: 'رسید جدید' } });
    expect(screen.getAllByRole('status').find((element) => element.textContent?.includes('موجودی پس از ثبت'))).toHaveTextContent('۹ بسته');
    fireEvent.click(screen.getByRole('button', { name: 'ثبت ورود' }));
    await screen.findByText('گردش موجودی ثبت شد.');
    await waitFor(() => expect(inventory.get(item.product.id)?.quantity).toBe(9));

    fireEvent.click((await screen.findAllByRole('button', { name: 'خروج چای ممتاز' }))[0]!);
    fireEvent.change(screen.getByLabelText('تعداد'), { target: { value: '۵' } });
    fireEvent.click(screen.getByRole('button', { name: 'ثبت خروج' }));
    await waitFor(() => expect(inventory.get(item.product.id)?.quantity).toBe(4));

    fireEvent.click((await screen.findAllByRole('button', { name: 'اصلاح موجودی چای ممتاز' }))[0]!);
    fireEvent.change(screen.getByLabelText('موجودی نهایی'), { target: { value: '۰' } });
    expect(screen.getAllByRole('status').find((element) => element.textContent?.includes('موجودی پس از ثبت'))).toHaveTextContent('۰ بسته');
    fireEvent.click(screen.getByRole('button', { name: 'ثبت اصلاح' }));
    await waitFor(() => expect(inventory.get(item.product.id)?.quantity).toBe(0));

    const creates = requests.filter((request) => request.method === 'POST');
    expect(creates.map((request) => request.body)).toEqual([
      { type: 'IN', quantity: 3, note: 'رسید جدید' },
      { type: 'OUT', quantity: 5, note: null },
      { type: 'ADJUSTMENT', quantity: 0, note: null },
    ]);
    expect(creates[0]?.body).not.toHaveProperty('beforeQuantity');
    expect(movements.get(item.product.id)?.map((movement) => [movement.beforeQuantity, movement.afterQuantity, movement.quantity])).toEqual([
      [6, 9, 3],
      [9, 4, 5],
      [4, 0, 4],
    ]);
  });

  it('shows validation feedback for an insufficient-stock response', async () => {
    const item = makeInventoryItem({ quantity: 2, minimumQuantity: 0 });
    installInventoryFetch({ items: [item], failMovement: true });
    renderRoute('/inventory');

    await screen.findByRole('heading', { name: 'مدیریت موجودی' });
    fireEvent.click((await screen.findAllByRole('button', { name: 'خروج چای ممتاز' }))[0]!);
    fireEvent.change(screen.getByLabelText('تعداد'), { target: { value: '۱' } });
    fireEvent.click(screen.getByRole('button', { name: 'ثبت خروج' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('موجودی فعلی برای این خروج کافی نیست.');
    expect(screen.getByRole('heading', { name: 'خروج' })).toBeInTheDocument();
  });
});
