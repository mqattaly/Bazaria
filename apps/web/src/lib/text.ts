import {
  ROLE_LABELS_FA,
  type RoleCode,
  type StoreStatus,
  type SubscriptionState,
} from '@bazaria/shared';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

export function roleLabel(role: RoleCode): string {
  return ROLE_LABELS_FA[role] ?? role;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fa-IR').format(value);
}

const CURRENCY_LABELS: Record<string, string> = {
  IRR: 'ریال',
  IRT: 'تومان',
};

export function currencyLabel(code: string): string {
  return CURRENCY_LABELS[code] ?? code;
}

const STORE_STATUS_LABELS: Record<StoreStatus, string> = {
  active: 'فعال',
  inactive: 'غیرفعال',
};

export function storeStatusLabel(status: StoreStatus): string {
  return STORE_STATUS_LABELS[status] ?? status;
}

const SUBSCRIPTION_STATE_LABELS: Record<SubscriptionState, string> = {
  active: 'فعال',
  grace_period: 'دوره ارفاقی',
  read_only: 'فقط‌خواندنی',
  suspended: 'تعلیق‌شده',
};

export function subscriptionStateLabel(state: SubscriptionState): string {
  return SUBSCRIPTION_STATE_LABELS[state] ?? state;
}
