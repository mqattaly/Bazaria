import type {
  ApiError,
  CreateCustomerInput,
  Customer,
  CustomerListQuery,
  PaginatedData,
  UpdateCustomerInput,
} from '@bazariya/shared';

export class CustomerApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: ApiError['error']['details'],
  ) {
    super(message);
    this.name = 'CustomerApiError';
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
    throw new CustomerApiError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.', 'NETWORK_ERROR', 0);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CustomerApiError('پاسخ معتبری از سرور دریافت نشد.', 'INVALID_RESPONSE', response.status);
  }

  if (!response.ok) {
    if (isApiError(payload)) {
      throw new CustomerApiError(payload.error.message, payload.error.code, response.status, payload.error.details);
    }
    throw new CustomerApiError('انجام درخواست با مشکل مواجه شد.', 'REQUEST_FAILED', response.status);
  }

  if (!isRecord(payload) || !('data' in payload)) {
    throw new CustomerApiError('ساختار پاسخ سرور معتبر نیست.', 'INVALID_RESPONSE', response.status);
  }
  return payload.data as T;
}

export function listCustomers(query: CustomerListQuery, signal?: AbortSignal): Promise<PaginatedData<Customer>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.isActive !== undefined) params.set('isActive', String(query.isActive));
  return requestData(`/api/v1/customers?${params.toString()}`, { signal });
}

export function getCustomer(id: string, signal?: AbortSignal): Promise<Customer> {
  return requestData(`/api/v1/customers/${encodeURIComponent(id)}`, { signal });
}

export function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return requestData('/api/v1/customers', { method: 'POST', body: input });
}

export function updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
  return requestData(`/api/v1/customers/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
}

export function deleteCustomer(id: string): Promise<{ id: string }> {
  return requestData(`/api/v1/customers/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
