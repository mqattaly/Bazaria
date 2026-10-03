import type { ProductUnit } from '@bazariya/shared';

export const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  piece: 'عدد',
  pack: 'بسته',
  carton: 'کارتن',
  kilogram: 'کیلوگرم',
  gram: 'گرم',
  liter: 'لیتر',
  meter: 'متر',
};

export const persianNumber = new Intl.NumberFormat('fa-IR');
export const tomanNumber = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });

export function formatToman(value: number): string {
  return `${tomanNumber.format(value)} تومان`;
}
