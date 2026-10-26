import type {
  ApiErrorBody,
  CompanyEntitlementView,
  ErrorCode,
  MeResponse,
  MembershipView,
  MyCompany,
  PageMeta,
  RoleCode,
  StoreStatus,
  StoreUsage,
  StoreView,
  SubscriptionSnapshot,
} from '@bazaria/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly details: { field?: string; code: string; message: string }[];
  readonly requestId?: string;
  readonly retryable: boolean;

  constructor(input: {
    status: number;
    code: ErrorCode | 'NETWORK_ERROR';
    message: string;
    details?: { field?: string; code: string; message: string }[];
    requestId?: string;
    retryable?: boolean;
  }) {
    super(input.message);
    this.name = 'ApiError';
    this.status = input.status;
    this.code = input.code;
    this.details = input.details ?? [];
    this.requestId = input.requestId;
    this.retryable = input.retryable ?? false;
  }
}

export interface CompanyView {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'suspended';
  currency: string;
  role: RoleCode;
  permissions: string[];
  subscription: SubscriptionSnapshot;
  storeUsage: StoreUsage;
}

export interface StoreListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: StoreStatus;
  sort?: string;
}

export interface StoreInput {
  name: string;
  contactName?: string | null;
  contactMobile?: string | null;
  address?: string | null;
  note?: string | null;
}

export interface StorePage {
  data: StoreView[];
  meta: PageMeta;
}

interface CallOptions {
  method?: string;
  body?: unknown;
  companyId?: string | null;
}

export interface AddMembershipResult {
  membership: MembershipView;
  inviteToken?: string;
  inviteExpiresAt?: string;
}

const BASE = '/api/v1';

async function request<T>(
  path: string,
  options: CallOptions = {},
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.companyId) headers['X-Company-Id'] = options.companyId;

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'ارتباط با سرور برقرار نشد. اتصال شبکه را بررسی کنید.',
      retryable: true,
    });
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; meta?: Record<string, unknown>; error?: ApiErrorBody['error'] }
    | null;

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError({
      status: response.status,
      code: error?.code ?? 'INTERNAL_ERROR',
      message: error?.message ?? 'خطای پیش‌بینی‌نشده‌ای رخ داد.',
      details: error?.details,
      requestId: error?.requestId ?? response.headers.get('x-request-id') ?? undefined,
      retryable: error?.retryable,
    });
  }

  return {
    data: payload?.data as T,
    meta: payload?.meta,
  };
}

async function call<T>(path: string, options: CallOptions = {}): Promise<T> {
  return (await request<T>(path, options)).data;
}

function storesQuery(query: StoreListQuery): string {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.q) params.set('q', query.q);
  if (query.status) params.set('status', query.status);
  if (query.sort) params.set('sort', query.sort);
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export const api = {
  login: (mobile: string, password: string) =>
    call<{ user: MeResponse }>('/auth/login', {
      method: 'POST',
      body: { mobile, password },
    }),

  logout: () => call<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  setPassword: (token: string, newPassword: string) =>
    call<{ ok: boolean }>('/auth/password/set', {
      method: 'POST',
      body: { token, newPassword },
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    call<{ ok: boolean }>('/auth/password/change', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),

  me: () => call<MeResponse>('/me'),

  myCompanies: () => call<MyCompany[]>('/me/companies'),

  company: (companyId: string) =>
    call<CompanyView>('/company', { companyId }),

  updateCompany: (companyId: string, body: { name?: string; currency?: string }) =>
    call<CompanyView>('/company', { method: 'PATCH', companyId, body }),

  license: (companyId: string) =>
    call<CompanyEntitlementView>('/license', { companyId }),

  memberships: (companyId: string) =>
    call<MembershipView[]>('/memberships', { companyId }),

  addMembership: (
    companyId: string,
    body: { mobile: string; fullName: string; role: RoleCode },
  ) => call<AddMembershipResult>('/memberships', { method: 'POST', companyId, body }),

  updateMembership: (
    companyId: string,
    membershipId: string,
    body: { role?: RoleCode; status?: 'active' | 'inactive' },
  ) =>
    call<MembershipView>(`/memberships/${membershipId}`, {
      method: 'PATCH',
      companyId,
      body,
    }),

  resetMembershipPassword: (companyId: string, membershipId: string) =>
    call<{ token: string; expiresAt: string }>(
      `/memberships/${membershipId}/password-reset`,
      { method: 'POST', companyId },
    ),

  stores: async (
    companyId: string,
    query: StoreListQuery = {},
  ): Promise<StorePage> => {
    const response = await request<StoreView[]>(
      `/stores${storesQuery(query)}`,
      { companyId },
    );
    const meta = response.meta ?? {};
    return {
      data: response.data,
      meta: {
        page: Number(meta.page ?? query.page ?? 1),
        pageSize: Number(meta.pageSize ?? query.pageSize ?? 20),
        totalItems: Number(meta.totalItems ?? response.data.length),
        totalPages: Number(meta.totalPages ?? 0),
      },
    };
  },

  store: (companyId: string, storeId: string) =>
    call<StoreView>(`/stores/${storeId}`, { companyId }),

  createStore: (companyId: string, body: StoreInput) =>
    call<StoreView>('/stores', { method: 'POST', companyId, body }),

  updateStore: (companyId: string, storeId: string, body: Partial<StoreInput>) =>
    call<StoreView>(`/stores/${storeId}`, { method: 'PATCH', companyId, body }),

  updateStoreStatus: (
    companyId: string,
    storeId: string,
    status: StoreStatus,
  ) =>
    call<StoreView>(`/stores/${storeId}/status`, {
      method: 'PATCH',
      companyId,
      body: { status },
    }),
};
