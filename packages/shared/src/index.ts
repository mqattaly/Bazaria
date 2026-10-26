/**
 * Shared contracts between the API and the web client.
 *
 * Only values that both sides genuinely rely on live here: role codes,
 * Phase 1 permission codes, stable error codes/messages and header names.
 */

export const ROLE_CODES = [
  'manager',
  'sales_representative',
  'warehouse_user',
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_LABELS_FA: Record<RoleCode, string> = {
  manager: 'مدیر شرکت',
  sales_representative: 'کارشناس فروش',
  warehouse_user: 'کارشناس انبار',
};

/**
 * Phase 1 permission catalog. Permissions for later modules are deliberately
 * absent: they will be added when the owning module is implemented and the
 * open permission decisions are resolved (OD-PERM-001 / OD-PERM-002).
 */
export const PERMISSIONS = [
  'company.view',
  'company.settings.manage',
  'membership.view',
  'membership.manage',
  'license.view',
  'store.view',
  'store.create',
  'store.update',
  'store.deactivate',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<RoleCode, readonly Permission[]> = {
  manager: [
    'company.view',
    'company.settings.manage',
    'membership.view',
    'membership.manage',
    'license.view',
    'store.view',
    'store.create',
    'store.update',
    'store.deactivate',
  ],
  sales_representative: ['company.view'],
  warehouse_user: ['company.view'],
};

/**
 * Store permissions. Phase 2 grants them to the company manager only. The
 * sales-representative visibility scope is still open (OD-PERM-001); no global
 * sales access is guessed here.
 */
export const STORE_PERMISSIONS = [
  'store.view',
  'store.create',
  'store.update',
  'store.deactivate',
] as const;

export const STORE_STATUSES = ['active', 'inactive'] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

export const STORE_SORT_FIELDS = [
  'createdAt',
  '-createdAt',
  'name',
  '-name',
  'updatedAt',
  '-updatedAt',
] as const;
export type StoreSort = (typeof STORE_SORT_FIELDS)[number];

export const PLATFORM_PERMISSIONS = [
  'platform.company.manage',
  'platform.license.manage',
] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value);
}

export function hasPermission(
  role: RoleCode,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const COMPANY_ID_HEADER = 'x-company-id';
export const REQUEST_ID_HEADER = 'x-request-id';

export const SESSION_COOKIE_NAME = 'bz_session';
export const PLATFORM_SESSION_COOKIE_NAME = 'bz_platform_session';

export const PLATFORM_COMPANY_MANAGE = 'platform.company.manage';
export const PLATFORM_LICENSE_MANAGE = 'platform.license.manage';

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'MALFORMED_REQUEST',
  'COMPANY_CONTEXT_REQUIRED',
  'AUTH_REQUIRED',
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_ACCOUNT_LOCKED',
  'COMPANY_ACCESS_DENIED',
  'PERMISSION_DENIED',
  'SELF_MANAGEMENT_FORBIDDEN',
  'RESOURCE_NOT_FOUND',
  'STATE_CONFLICT',
  'MEMBERSHIP_EXISTS',
  'LAST_MANAGER_REQUIRED',
  'INVALID_RESET_TOKEN',
  'PASSWORD_POLICY_VIOLATION',
  'COMPANY_CODE_TAKEN',
  'LICENSE_INACTIVE',
  'LICENSE_STORE_LIMIT_REACHED',
  'COMPANY_SUBSCRIPTION_READ_ONLY',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_MESSAGES_FA: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'اطلاعات ورودی معتبر نیست.',
  MALFORMED_REQUEST: 'ساختار درخواست معتبر نیست.',
  COMPANY_CONTEXT_REQUIRED: 'شرکت فعال انتخاب نشده است.',
  AUTH_REQUIRED: 'برای ادامه باید وارد شوید.',
  AUTH_INVALID_CREDENTIALS: 'شماره موبایل یا رمز عبور نادرست است.',
  AUTH_ACCOUNT_LOCKED:
    'تلاش‌های ناموفق بیش از حد مجاز بوده است. کمی بعد دوباره تلاش کنید.',
  COMPANY_ACCESS_DENIED: 'دسترسی به این شرکت وجود ندارد.',
  PERMISSION_DENIED: 'برای انجام این عملیات مجوز ندارید.',
  SELF_MANAGEMENT_FORBIDDEN: 'تغییر نقش یا وضعیت عضویت خودتان مجاز نیست.',
  RESOURCE_NOT_FOUND: 'مورد درخواستی در محدوده دسترسی شما یافت نشد.',
  STATE_CONFLICT: 'وضعیت فعلی اجازه این عملیات را نمی‌دهد.',
  MEMBERSHIP_EXISTS: 'این کاربر از قبل عضو شرکت است.',
  LAST_MANAGER_REQUIRED: 'شرکت باید حداقل یک مدیر فعال داشته باشد.',
  INVALID_RESET_TOKEN: 'لینک یا کد فعال‌سازی معتبر نیست یا منقضی شده است.',
  PASSWORD_POLICY_VIOLATION: 'رمز عبور شرایط امنیتی را برآورده نمی‌کند.',
  COMPANY_CODE_TAKEN: 'کد شرکت تکراری است.',
  LICENSE_INACTIVE: 'مجوز فعال شرکت اجازه این عملیات را نمی‌دهد.',
  LICENSE_STORE_LIMIT_REACHED:
    'سقف فروشگاه‌های مجاز این شرکت تکمیل شده است؛ برای افزایش سقف با مدیر پلتفرم تماس بگیرید.',
  COMPANY_SUBSCRIPTION_READ_ONLY:
    'مهلت ارفاقی اشتراک شرکت پایان یافته است؛ امکان ثبت تغییرات وجود ندارد.',
  RATE_LIMITED: 'تعداد درخواست‌ها بیش از حد مجاز است. بعداً تلاش کنید.',
  INTERNAL_ERROR: 'خطای پیش‌بینی‌نشده‌ای رخ داد.',
  SERVICE_UNAVAILABLE: 'سرویس موقتاً در دسترس نیست.',
};

export interface ApiErrorDetail {
  field?: string;
  code: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetail[];
    /** Non-sensitive, additive context (e.g. grace-period end). */
    meta?: Record<string, unknown>;
    requestId: string;
    retryable: boolean;
  };
}

export interface ApiSuccess<T> {
  data: T;
  meta: { requestId: string };
}

export type SubscriptionState =
  | 'active'
  | 'grace_period'
  | 'read_only'
  | 'suspended';

/**
 * Server-computed subscription snapshot. `validUntil` is the stored calendar
 * date (UTC); `graceEndsAt` is an exact UTC instant.
 */
export interface SubscriptionSnapshot {
  state: SubscriptionState;
  validUntil: string | null;
  graceEndsAt: string | null;
  writeAllowed: boolean;
  gracePeriodDays: number;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface StoreView {
  id: string;
  name: string;
  contactName: string | null;
  contactMobile: string | null;
  address: string | null;
  note: string | null;
  status: StoreStatus;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UserStatus = 'active' | 'inactive';
export type CompanyStatus = 'active' | 'suspended';
export type MembershipStatus = 'active' | 'inactive';

export interface MeResponse {
  id: string;
  mobile: string;
  fullName: string;
  status: UserStatus;
}

export interface CompanySummary {
  id: string;
  name: string;
  code: string;
  status: CompanyStatus;
  currency: string;
}

export interface MyCompany extends CompanySummary {
  role: RoleCode;
  membershipId: string;
  permissions: readonly Permission[];
}

export interface StoreUsage {
  /** Active (non-deactivated) stores, which is what the license limits. */
  active: number;
  limit: number;
}

export interface CompanyDetail extends CompanySummary {
  role: RoleCode;
  permissions: readonly Permission[];
  subscription: SubscriptionSnapshot;
  storeUsage: StoreUsage;
}

export interface MembershipView {
  id: string;
  userId: string;
  mobile: string;
  fullName: string;
  role: RoleCode;
  status: MembershipStatus;
  createdAt: string;
}

export interface CompanyEntitlementView {
  companyId: string;
  status: 'active' | 'suspended';
  maxStores: number;
  validUntil: string | null;
  subscription: SubscriptionSnapshot;
  createdAt: string;
  updatedAt: string;
}
