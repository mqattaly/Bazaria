import type {
  ApiError,
  CreateStockMovementInput,
  CreateStockMovementResult,
  InventoryItem,
  InventoryListQuery,
  PaginatedData,
  StockMovement,
  StockMovementListQuery,
  UpdateInventoryMinimumInput,
} from '@bazariya/shared';

export class InventoryApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: ApiError['error']['details'],
  ) {
    super(message);
    this.name = 'InventoryApiError';
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
  options: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown; signal?: AbortSignal } = {},
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
    throw new InventoryApiError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.', 'NETWORK_ERROR', 0);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new InventoryApiError('پاسخ معتبری از سرور دریافت نشد.', 'INVALID_RESPONSE', response.status);
  }

  if (!response.ok) {
    if (isApiError(payload)) {
      throw new InventoryApiError(payload.error.message, payload.error.code, response.status, payload.error.details);
    }
    throw new InventoryApiError('انجام درخواست با مشکل مواجه شد.', 'REQUEST_FAILED', response.status);
  }
  if (!isRecord(payload) || !('data' in payload)) {
    throw new InventoryApiError('ساختار پاسخ سرور معتبر نیست.', 'INVALID_RESPONSE', response.status);
  }
  return payload.data as T;
}

export function listInventory(query: InventoryListQuery, signal?: AbortSignal): Promise<PaginatedData<InventoryItem>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.status) params.set('status', query.status);
  if (query.lowStock !== undefined) params.set('lowStock', String(query.lowStock));
  return requestData(`/api/v1/inventory?${params.toString()}`, { signal });
}

export function getInventoryItem(productId: string, signal?: AbortSignal): Promise<InventoryItem> {
  return requestData(`/api/v1/inventory/${encodeURIComponent(productId)}`, { signal });
}

export function updateMinimumQuantity(
  productId: string,
  input: UpdateInventoryMinimumInput,
): Promise<InventoryItem> {
  return requestData(`/api/v1/inventory/${encodeURIComponent(productId)}/minimum`, { method: 'PATCH', body: input });
}

export function createStockMovement(
  productId: string,
  input: CreateStockMovementInput,
): Promise<CreateStockMovementResult> {
  return requestData(`/api/v1/inventory/${encodeURIComponent(productId)}/movements`, { method: 'POST', body: input });
}

export function listStockMovements(
  productId: string,
  query: StockMovementListQuery,
  signal?: AbortSignal,
): Promise<PaginatedData<StockMovement>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.type) params.set('type', query.type);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return requestData(`/api/v1/inventory/${encodeURIComponent(productId)}/movements?${params.toString()}`, { signal });
}
