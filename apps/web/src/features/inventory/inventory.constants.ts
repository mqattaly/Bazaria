import type { InventoryStatus, StockMovementType } from '@bazariya/shared';
import type { BadgeVariant } from '../../components/ui/Badge';

export const inventoryStatusLabels: Record<InventoryStatus, string> = {
  'in-stock': 'موجود',
  'low-stock': 'موجودی کم',
  'out-of-stock': 'ناموجود',
};

export const inventoryStatusVariants: Record<InventoryStatus, BadgeVariant> = {
  'in-stock': 'success',
  'low-stock': 'warning',
  'out-of-stock': 'danger',
};

export const movementTypeLabels: Record<StockMovementType, string> = {
  IN: 'ورود',
  OUT: 'خروج',
  ADJUSTMENT: 'اصلاح موجودی',
};

export const inventoryNumber = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });

const persianDateTime = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
});

export function formatInventoryDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : persianDateTime.format(date);
}
