import type {
  ApiError,
  Category,
  CategoryListItem,
  CreateCategoryInput,
  CreateProductInput,
  PaginatedData,
  Product,
  ProductListQuery,
  UpdateCategoryInput,
  UpdateProductInput,
} from '@bazariya/shared';

export class CatalogApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: ApiError['error']['details'],
  ) {
    super(message);
    this.name = 'CatalogApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiError(value: unknown): value is ApiError {
  if (!isRecord(value) || !isRecord(value.error)) return false;
  return typeof value.error.code === 'string' && typeof value.error.message === 'string';
}

async function requestData<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    throw new CatalogApiError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.', 'NETWORK_ERROR', 0);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CatalogApiError('پاسخ معتبری از سرور دریافت نشد.', 'INVALID_RESPONSE', response.status);
  }

  if (!response.ok) {
    if (isApiError(payload)) {
      throw new CatalogApiError(payload.error.message, payload.error.code, response.status, payload.error.details);
    }
    throw new CatalogApiError('انجام درخواست با مشکل مواجه شد.', 'REQUEST_FAILED', response.status);
  }

  if (!isRecord(payload) || !('data' in payload)) {
    throw new CatalogApiError('ساختار پاسخ سرور معتبر نیست.', 'INVALID_RESPONSE', response.status);
  }
  return payload.data as T;
}

export function listCategories(signal?: AbortSignal): Promise<CategoryListItem[]> {
  return requestData('/api/v1/categories', { signal });
}

export function getCategory(id: string, signal?: AbortSignal): Promise<Category> {
  return requestData(`/api/v1/categories/${encodeURIComponent(id)}`, { signal });
}

export function createCategory(input: CreateCategoryInput): Promise<Category> {
  return requestData('/api/v1/categories', { method: 'POST', body: input });
}

export function updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
  return requestData(`/api/v1/categories/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
}

export function deleteCategory(id: string): Promise<{ id: string }> {
  return requestData(`/api/v1/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function listProducts(query: ProductListQuery, signal?: AbortSignal): Promise<PaginatedData<Product>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.categoryId) params.set('categoryId', query.categoryId);
  if (query.isActive !== undefined) params.set('isActive', String(query.isActive));
  return requestData(`/api/v1/products?${params.toString()}`, { signal });
}

export function getProduct(id: string, signal?: AbortSignal): Promise<Product> {
  return requestData(`/api/v1/products/${encodeURIComponent(id)}`, { signal });
}

export function createProduct(input: CreateProductInput): Promise<Product> {
  return requestData('/api/v1/products', { method: 'POST', body: input });
}

export function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  return requestData(`/api/v1/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
}

export function deleteProduct(id: string): Promise<{ id: string }> {
  return requestData(`/api/v1/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
