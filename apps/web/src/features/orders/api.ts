import type {
  ApiError,
  CreateOrderInput,
  OrderDetails,
  OrderListQuery,
  OrderListItem,
  PaginatedData,
  UpdateOrderInput,
} from '@bazariya/shared';

export class OrderApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: ApiError['error']['details'],
  ) {
    super(message);
    this.name = 'OrderApiError';
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
    throw new OrderApiError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.', 'NETWORK_ERROR', 0);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new OrderApiError('پاسخ معتبری از سرور دریافت نشد.', 'INVALID_RESPONSE', response.status);
  }

  if (!response.ok) {
    if (isApiError(payload)) {
      throw new OrderApiError(payload.error.message, payload.error.code, response.status, payload.error.details);
    }
    throw new OrderApiError('انجام درخواست با مشکل مواجه شد.', 'REQUEST_FAILED', response.status);
  }
  if (!isRecord(payload) || !('data' in payload)) {
    throw new OrderApiError('ساختار پاسخ سرور معتبر نیست.', 'INVALID_RESPONSE', response.status);
  }
  return payload.data as T;
}

export function listOrders(query: OrderListQuery, signal?: AbortSignal): Promise<PaginatedData<OrderListItem>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.customerId) params.set('customerId', query.customerId);
  if (query.status) params.set('status', query.status);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return requestData(`/api/v1/orders?${params.toString()}`, { signal });
}

export function getOrder(id: string, signal?: AbortSignal): Promise<OrderDetails> {
  return requestData(`/api/v1/orders/${encodeURIComponent(id)}`, { signal });
}

export function createOrder(input: CreateOrderInput): Promise<OrderDetails> {
  return requestData('/api/v1/orders', { method: 'POST', body: input });
}

export function updateOrder(id: string, input: UpdateOrderInput): Promise<OrderDetails> {
  return requestData(`/api/v1/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
}

export function updateOrderStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<OrderDetails> {
  return requestData(`/api/v1/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } });
}
