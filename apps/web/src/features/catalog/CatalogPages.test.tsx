import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { Category, CategoryListItem, Product } from '@bazariya/shared';
import { AppRoutes } from '../../App';
import { ThemeProvider } from '../../components/providers/ThemeProvider';
import { ToastProvider } from '../../components/ui/Toast';

const categoryId = '10000000-0000-4000-8000-000000000001';
const otherCategoryId = '10000000-0000-4000-8000-000000000002';
const productId = '20000000-0000-4000-8000-000000000001';
const now = '2026-09-20T10:00:00.000Z';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: categoryId,
    name: 'ظروف یکبار مصرف',
    description: 'ظروف و لیوان‌ها',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: productId,
    name: 'لیوان شیشه‌ای',
    sku: 'CUP-001',
    categoryId,
    unit: 'piece',
    description: 'شفاف و مقاوم',
    salePrice: 125_000,
    purchasePrice: 80_000,
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
  products?: Product[];
  categories?: Category[];
  failCatalog?: boolean;
  loadingCatalog?: boolean;
}

function installCatalogFetch(options: MockOptions = {}) {
  const products = [...(options.products ?? [])];
  const categories = [...(options.categories ?? [makeCategory(), makeCategory({
    id: otherCategoryId,
    name: 'نظافت',
    description: null,
  })])];
  const requests: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];

  const categoryList = (): CategoryListItem[] => categories.map((category) => ({
    ...category,
    productCount: products.filter((product) => product.categoryId === category.id).length,
  }));

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
    if (options.loadingCatalog && (url.pathname === '/api/v1/categories' || url.pathname === '/api/v1/products')) {
      return new Promise<Response>(() => undefined);
    }
    if (options.failCatalog && (url.pathname === '/api/v1/categories' || url.pathname === '/api/v1/products')) {
      return jsonResponse(500, { error: { code: 'INTERNAL_SERVER_ERROR', message: 'request failed' } });
    }

    if (url.pathname === '/api/v1/categories' && method === 'GET') {
      return jsonResponse(200, { data: categoryList() });
    }
    if (url.pathname === '/api/v1/categories' && method === 'POST' && body) {
      const created = makeCategory({
        id: `30000000-0000-4000-8000-${String(categories.length + 1).padStart(12, '0')}`,
        name: String(body.name),
        description: typeof body.description === 'string' ? body.description : null,
        isActive: body.isActive !== false,
      });
      categories.push(created);
      return jsonResponse(201, { data: created });
    }

    const categoryMatch = url.pathname.match(/^\/api\/v1\/categories\/([^/]+)$/);
    if (categoryMatch) {
      const id = decodeURIComponent(categoryMatch[1] ?? '');
      const category = categories.find((item) => item.id === id);
      if (!category) return jsonResponse(404, { error: { code: 'CATEGORY_NOT_FOUND', message: 'دسته‌بندی پیدا نشد.' } });
      if (method === 'GET') return jsonResponse(200, { data: category });
      if (method === 'PATCH' && body) {
        const updated: Category = {
          ...category,
          ...(typeof body.name === 'string' ? { name: body.name } : {}),
          ...(body.description === null || typeof body.description === 'string' ? { description: body.description } : {}),
          ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
          updatedAt: new Date().toISOString(),
        };
        categories[categories.indexOf(category)] = updated;
        return jsonResponse(200, { data: updated });
      }
      if (method === 'DELETE') {
        if (products.some((product) => product.categoryId === id)) {
          return jsonResponse(409, { error: { code: 'CATEGORY_HAS_PRODUCTS', message: 'این دسته‌بندی دارای محصول است و نمی‌توان آن را حذف کرد.' } });
        }
        categories.splice(categories.indexOf(category), 1);
        return jsonResponse(200, { data: { id } });
      }
    }

    if (url.pathname === '/api/v1/products' && method === 'GET') {
      const search = url.searchParams.get('search')?.trim().toLocaleLowerCase();
      const selectedCategory = url.searchParams.get('categoryId');
      const active = url.searchParams.get('isActive');
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
      const filtered = products
        .filter((product) => !search
          || product.name.toLocaleLowerCase().startsWith(search)
          || product.sku.startsWith(search.toUpperCase()))
        .filter((product) => !selectedCategory || product.categoryId === selectedCategory)
        .filter((product) => active === null || product.isActive === (active === 'true'))
        .sort((left, right) => left.name.localeCompare(right.name, 'fa') || left.sku.localeCompare(right.sku));
      const total = filtered.length;
      const offset = (page - 1) * pageSize;
      return jsonResponse(200, {
        data: {
          items: filtered.slice(offset, offset + pageSize),
          pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        },
      });
    }
    if (url.pathname === '/api/v1/products' && method === 'POST' && body) {
      const sku = String(body.sku);
      if (products.some((product) => product.sku === sku)) {
        return jsonResponse(409, {
          error: {
            code: 'PRODUCT_SKU_EXISTS',
            message: 'این کد کالا قبلاً ثبت شده است.',
            details: [{ field: 'sku', message: 'یک کد کالای دیگر وارد کنید.' }],
          },
        });
      }
      const created = makeProduct({
        id: `40000000-0000-4000-8000-${String(products.length + 1).padStart(12, '0')}`,
        name: String(body.name),
        sku,
        categoryId: String(body.categoryId),
        unit: body.unit as Product['unit'],
        description: typeof body.description === 'string' ? body.description : null,
        salePrice: Number(body.salePrice),
        purchasePrice: typeof body.purchasePrice === 'number' ? body.purchasePrice : null,
        isActive: body.isActive !== false,
      });
      products.push(created);
      return jsonResponse(201, { data: created });
    }

    const productMatch = url.pathname.match(/^\/api\/v1\/products\/([^/]+)$/);
    if (productMatch) {
      const id = decodeURIComponent(productMatch[1] ?? '');
      const product = products.find((item) => item.id === id);
      if (!product) return jsonResponse(404, { error: { code: 'PRODUCT_NOT_FOUND', message: 'محصول پیدا نشد.' } });
      if (method === 'GET') return jsonResponse(200, { data: product });
      if (method === 'PATCH' && body) {
        const updated: Product = {
          ...product,
          ...(typeof body.name === 'string' ? { name: body.name } : {}),
          ...(typeof body.sku === 'string' ? { sku: body.sku } : {}),
          ...(typeof body.categoryId === 'string' ? { categoryId: body.categoryId } : {}),
          ...(typeof body.unit === 'string' ? { unit: body.unit as Product['unit'] } : {}),
          ...(body.description === null || typeof body.description === 'string' ? { description: body.description } : {}),
          ...(typeof body.salePrice === 'number' ? { salePrice: body.salePrice } : {}),
          ...(body.purchasePrice === null || typeof body.purchasePrice === 'number' ? { purchasePrice: body.purchasePrice } : {}),
          ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
          updatedAt: new Date().toISOString(),
        };
        products[products.indexOf(product)] = updated;
        return jsonResponse(200, { data: updated });
      }
      if (method === 'DELETE') {
        products.splice(products.indexOf(product), 1);
        return jsonResponse(200, { data: { id } });
      }
    }

    return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, requests, categories, products };
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

describe('Product and category UI', () => {
  it('opens the product form from the dashboard quick action', async () => {
    installCatalogFetch({ categories: [], products: [] });
    renderRoute('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: /افزودن محصول/ }));

    expect(await screen.findByRole('heading', { name: 'مدیریت محصولات' })).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'افزودن محصول' })).toBeInTheDocument();
  });

  it('renders products and searches by name/SKU with category and active filters', async () => {
    const { requests } = installCatalogFetch({ products: [makeProduct(), makeProduct({
      id: '20000000-0000-4000-8000-000000000002',
      name: 'برس ظرف‌شویی',
      sku: 'BRSH-002',
      categoryId: otherCategoryId,
    })] });
    renderRoute('/products');

    expect(await screen.findByRole('heading', { name: 'مدیریت محصولات' })).toBeInTheDocument();
    await screen.findByRole('option', { name: 'ظروف یکبار مصرف' });
    await waitFor(() => expect(screen.getAllByText('لیوان شیشه‌ای').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText('جستجوی محصولات'), { target: { value: 'برس' } });
    await waitFor(() => expect(requests.some((item) => item.path.includes('search=%D8%A8%D8%B1%D8%B3'))).toBe(true));
    await waitFor(() => expect(screen.queryByText('لیوان شیشه‌ای')).not.toBeInTheDocument());
    expect(screen.getAllByText('برس ظرف‌شویی').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('دسته‌بندی'), { target: { value: categoryId } });
    await waitFor(() => expect(requests.some((item) => item.path.includes(`categoryId=${categoryId}`))).toBe(true));
    expect(await screen.findByText('محصولی با این مشخصات پیدا نشد')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('جستجوی محصولات'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('دسته‌بندی'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('وضعیت'), { target: { value: 'inactive' } });
    await waitFor(() => expect(requests.some((item) => item.path.includes('isActive=false'))).toBe(true));
  });

  it('shows the product empty, loading, and error states', async () => {
    installCatalogFetch({ products: [] });
    const empty = renderRoute('/products');
    expect(await screen.findByText('هنوز محصولی ثبت نشده است')).toBeInTheDocument();
    empty.unmount();
    cleanup();

    installCatalogFetch({ loadingCatalog: true });
    renderRoute('/products');
    expect(await screen.findByText('در حال دریافت محصولات…')).toBeInTheDocument();
    cleanup();

    installCatalogFetch({ failCatalog: true });
    renderRoute('/products');
    expect(await screen.findByText('دریافت فهرست محصولات با مشکل مواجه شد.')).toBeInTheDocument();
  });

  it('validates the product form and focuses the first required field', async () => {
    installCatalogFetch({ products: [] });
    renderRoute('/products');
    await screen.findByRole('heading', { name: 'مدیریت محصولات' });
    await screen.findByRole('option', { name: 'ظروف یکبار مصرف' });
    fireEvent.click(screen.getAllByRole('button', { name: /افزودن محصول/ })[0]!);
    expect(await screen.findByRole('dialog', { name: 'افزودن محصول' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ محصول' }));

    expect(await screen.findByText('نام محصول باید دست‌کم ۲ نویسه باشد.')).toBeInTheDocument();
    expect(screen.getByLabelText('نام محصول *')).toHaveFocus();
    expect(screen.getByText('قیمت فروش را وارد کنید.')).toBeInTheDocument();
  });

  it('creates a product and sends integer prices with normalized SKU', async () => {
    const { requests, products } = installCatalogFetch({ products: [] });
    renderRoute('/products');
    await screen.findByRole('heading', { name: 'مدیریت محصولات' });
    await screen.findByRole('option', { name: 'ظروف یکبار مصرف' });
    fireEvent.click(screen.getAllByRole('button', { name: /افزودن محصول/ })[0]!);
    await screen.findByRole('dialog', { name: 'افزودن محصول' });

    fireEvent.change(screen.getByLabelText('نام محصول *'), { target: { value: '  فنجان سرامیکی  ' } });
    fireEvent.change(screen.getByLabelText('کد کالا *'), { target: { value: ' fn-100 ' } });
    fireEvent.blur(screen.getByLabelText('کد کالا *'));
    fireEvent.change(screen.getByLabelText('دسته‌بندی *'), { target: { value: categoryId } });
    fireEvent.change(screen.getByLabelText('قیمت فروش *'), { target: { value: '125000' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ محصول' }));

    await waitFor(() => expect(requests.some((item) => item.method === 'POST' && item.path === '/api/v1/products')).toBe(true));
    const createRequest = requests.find((item) => item.method === 'POST' && item.path === '/api/v1/products');
    expect(createRequest?.body?.name).toBe('فنجان سرامیکی');
    expect(createRequest?.body?.sku).toBe('FN-100');
    expect(createRequest?.body?.salePrice).toBe(125_000);
    expect(createRequest?.body?.purchasePrice).toBeNull();
    await waitFor(() => expect(products.some((product) => product.sku === 'FN-100')).toBe(true));
  });

  it('keeps product form values and associates server validation errors with SKU', async () => {
    const { requests } = installCatalogFetch({ products: [makeProduct({ sku: 'DUP-01' })] });
    renderRoute('/products');
    await screen.findAllByRole('button', { name: 'عملیات محصول لیوان شیشه‌ای' });
    await screen.findByRole('option', { name: 'ظروف یکبار مصرف' });
    fireEvent.click(screen.getAllByRole('button', { name: /افزودن محصول/ })[0]!);
    await screen.findByRole('dialog', { name: 'افزودن محصول' });

    fireEvent.change(screen.getByLabelText('نام محصول *'), { target: { value: 'محصول جدید' } });
    fireEvent.change(screen.getByLabelText('کد کالا *'), { target: { value: 'dup-01' } });
    fireEvent.blur(screen.getByLabelText('کد کالا *'));
    fireEvent.change(screen.getByLabelText('دسته‌بندی *'), { target: { value: categoryId } });
    fireEvent.change(screen.getByLabelText('قیمت فروش *'), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ محصول' }));

    await waitFor(() => expect(requests.some((item) => item.method === 'POST' && item.path === '/api/v1/products')).toBe(true));
    const createRequest = requests.find((item) => item.method === 'POST' && item.path === '/api/v1/products');
    expect(createRequest?.body?.sku).toBe('DUP-01');
    expect(await screen.findByText('یک کد کالای دیگر وارد کنید.')).toBeInTheDocument();
    expect(screen.getByLabelText('نام محصول *')).toHaveValue('محصول جدید');
    expect(screen.getByLabelText('کد کالا *')).toHaveValue('DUP-01');
    expect(requests.some((item) => item.method === 'POST' && item.path === '/api/v1/products')).toBe(true);
  });

  it('edits a product and shows its detail route without future-domain fields', async () => {
    const product = makeProduct();
    installCatalogFetch({ products: [product] });
    renderRoute(`/products/${product.id}`);

    expect(await screen.findByRole('heading', { name: 'لیوان شیشه‌ای' })).toBeInTheDocument();
    expect((await screen.findAllByText('ظروف یکبار مصرف')).length).toBeGreaterThan(0);
    expect(screen.getByText('CUP-001')).toBeInTheDocument();
    expect(screen.getByText('۱۲۵٬۰۰۰ تومان')).toBeInTheDocument();
    expect(screen.getByText('۸۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(screen.queryByText('موجودی')).not.toBeInTheDocument();
    expect(screen.queryByText('سود')).not.toBeInTheDocument();
    expect(screen.queryByText('سفارش‌ها')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ویرایش محصول' }));
    expect(await screen.findByRole('dialog', { name: 'ویرایش محصول' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('نام محصول *'), { target: { value: 'لیوان شیشه‌ای بزرگ' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ محصول' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'لیوان شیشه‌ای بزرگ' })).toBeInTheDocument());
  });

  it('requires confirmation before deleting a product', async () => {
    const product = makeProduct();
    const { requests, products } = installCatalogFetch({ products: [product] });
    renderRoute('/products');
    await screen.findByRole('heading', { name: 'مدیریت محصولات' });
    await screen.findAllByRole('button', { name: `عملیات محصول ${product.name}` });

    fireEvent.click(screen.getAllByRole('button', { name: `عملیات محصول ${product.name}` })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'حذف محصول' }));
    expect(await screen.findByRole('dialog', { name: 'حذف محصول' })).toBeInTheDocument();
    expect(screen.getAllByText(/این عملیات قابل بازگشت نیست/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'انصراف' }));
    expect(requests.some((item) => item.method === 'DELETE' && item.path.includes(product.id))).toBe(false);

    fireEvent.click(screen.getAllByRole('button', { name: `عملیات محصول ${product.name}` })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'حذف محصول' }));
    fireEvent.click(await screen.findByRole('button', { name: 'حذف' }));
    await waitFor(() => expect(products).toHaveLength(0));
  });

  it('creates and edits categories and protects categories with products', async () => {
    const { requests } = installCatalogFetch({ products: [makeProduct()] });
    renderRoute('/categories');
    expect(await screen.findByRole('heading', { name: 'مدیریت دسته‌بندی‌ها' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /افزودن دسته‌بندی/ })[0]!);
    await screen.findByRole('dialog', { name: 'افزودن دسته‌بندی' });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ دسته‌بندی' }));
    expect(await screen.findByText('نام دسته‌بندی باید دست‌کم ۲ نویسه باشد.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('نام دسته‌بندی *'), { target: { value: 'نوشیدنی‌ها' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ دسته‌بندی' }));
    await waitFor(() => expect(requests.some((item) => item.method === 'POST' && item.path === '/api/v1/categories')).toBe(true));

    fireEvent.click(screen.getAllByRole('button', { name: 'عملیات دسته‌بندی ظروف یکبار مصرف' })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'ویرایش دسته‌بندی' }));
    await screen.findByRole('dialog', { name: 'ویرایش دسته‌بندی' });
    fireEvent.change(screen.getByLabelText('نام دسته‌بندی *'), { target: { value: 'ظروف روزمره' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ دسته‌بندی' }));
    await waitFor(() => expect(requests.some((item) => item.method === 'PATCH' && item.path.includes(categoryId))).toBe(true));

    fireEvent.click(screen.getAllByRole('button', { name: 'عملیات دسته‌بندی ظروف روزمره' })[0]!);
    expect(screen.getByRole('menuitem', { name: /حذف ناممکن است/ })).toBeDisabled();
  });
});
