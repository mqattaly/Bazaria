import type { PurchaseStatus } from '@bazariya/shared';
import type { BadgeVariant } from '../../components/ui/Badge';
import { formatOrderDate, localDateTimeToIso } from '../orders/orders.constants';

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  draft: 'پیش‌نویس',
  confirmed: 'نهایی‌شده',
  cancelled: 'لغوشده',
};

export const PURCHASE_STATUS_VARIANTS: Record<PurchaseStatus, BadgeVariant> = {
  draft: 'warning',
  confirmed: 'success',
  cancelled: 'neutral',
};

export function formatPurchaseDate(value: string): string {
  return formatOrderDate(value);
}

export function normalizePurchaseDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[٬,\s]/g, '');
}

export function parsePurchaseInteger(value: string): number | null {
  const normalized = normalizePurchaseDigits(value);
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

export const localPurchaseDateTimeToIso = localDateTimeToIso;
