import type {
  ApiError,
  CreatePurchaseInput,
  CreateSupplierInput,
  PaginatedData,
  PurchaseDetails,
  PurchaseListItem,
  PurchaseListQuery,
  Supplier,
  SupplierListQuery,
  UpdatePurchaseInput,
  UpdateSupplierInput,
} from '@bazariya/shared';

export class PurchasingApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: ApiError['error']['details'],
  ) {
    super(message);
    this.name = 'PurchasingApiError';
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
    throw new PurchasingApiError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.', 'NETWORK_ERROR', 0);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PurchasingApiError('پاسخ معتبری از سرور دریافت نشد.', 'INVALID_RESPONSE', response.status);
  }

  if (!response.ok) {
    if (isApiError(payload)) {
      throw new PurchasingApiError(payload.error.message, payload.error.code, response.status, payload.error.details);
    }
    throw new PurchasingApiError('انجام درخواست با مشکل مواجه شد.', 'REQUEST_FAILED', response.status);
  }
  if (!isRecord(payload) || !('data' in payload)) {
    throw new PurchasingApiError('ساختار پاسخ سرور معتبر نیست.', 'INVALID_RESPONSE', response.status);
  }
  return payload.data as T;
}

export function listSuppliers(query: SupplierListQuery, signal?: AbortSignal): Promise<PaginatedData<Supplier>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.status) params.set('status', query.status);
  return requestData(`/api/v1/suppliers?${params.toString()}`, { signal });
}

export function getSupplier(id: string, signal?: AbortSignal): Promise<Supplier> {
  return requestData(`/api/v1/suppliers/${encodeURIComponent(id)}`, { signal });
}

export function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  return requestData('/api/v1/suppliers', { method: 'POST', body: input });
}

export function updateSupplier(id: string, input: UpdateSupplierInput): Promise<Supplier> {
  return requestData(`/api/v1/suppliers/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
}

export function updateSupplierStatus(id: string, isActive: boolean): Promise<Supplier> {
  return requestData(`/api/v1/suppliers/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { isActive } });
}

export function deleteSupplier(id: string): Promise<{ id: string }> {
  return requestData(`/api/v1/suppliers/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function listPurchases(query: PurchaseListQuery, signal?: AbortSignal): Promise<PaginatedData<PurchaseListItem>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.supplierId) params.set('supplierId', query.supplierId);
  if (query.status) params.set('status', query.status);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return requestData(`/api/v1/purchases?${params.toString()}`, { signal });
}

export function getPurchase(id: string, signal?: AbortSignal): Promise<PurchaseDetails> {
  return requestData(`/api/v1/purchases/${encodeURIComponent(id)}`, { signal });
}

export function createPurchase(input: CreatePurchaseInput): Promise<PurchaseDetails> {
  return requestData('/api/v1/purchases', { method: 'POST', body: input });
}

export function updatePurchase(id: string, input: UpdatePurchaseInput): Promise<PurchaseDetails> {
  return requestData(`/api/v1/purchases/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
}

export function updatePurchaseStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<PurchaseDetails> {
  return requestData(`/api/v1/purchases/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } });
}
