import type { PurchaseItemInput } from '@bazariya/shared';
import { PurchaseDomainError } from './purchases.errors.js';

const MAX_SAFE_AMOUNT = Number.MAX_SAFE_INTEGER;

export interface PurchaseLineCalculation {
  subtotal: number;
  discount: number;
  total: number;
  lineTotals: number[];
}

export function mergeDuplicatePurchaseItems(items: readonly PurchaseItemInput[]): PurchaseItemInput[] {
  if (items.length === 0) {
    throw new PurchaseDomainError('EMPTY_PURCHASE_ITEMS', 'خرید باید دست‌کم یک قلم داشته باشد.', 400, [
      { field: 'items', message: 'برای خرید دست‌کم یک محصول اضافه کنید.' },
    ]);
  }

  const merged = new Map<string, PurchaseItemInput>();
  for (const item of items) {
    if (!item.productId || typeof item.productId !== 'string') {
      throw new PurchaseDomainError('PRODUCT_NOT_FOUND', 'شناسهٔ محصول خرید معتبر نیست.', 400, [
        { field: 'items', message: 'یک محصول معتبر انتخاب کنید.' },
      ]);
    }
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new PurchaseDomainError('INVALID_QUANTITY', 'تعداد هر قلم باید عدد صحیح مثبت باشد.', 400, [
        { field: 'items', message: 'تعداد هر محصول باید عدد صحیح و بیشتر از صفر باشد.' },
      ]);
    }
    if (!Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0) {
      throw new PurchaseDomainError('INVALID_UNIT_PRICE', 'قیمت خرید باید عدد صحیح نامنفی باشد.', 400, [
        { field: 'items', message: 'قیمت خرید هر محصول را به‌صورت عدد صحیح صفر یا بیشتر وارد کنید.' },
      ]);
    }

    const previous = merged.get(item.productId);
    if (!previous) {
      merged.set(item.productId, { ...item });
      continue;
    }
    if (previous.unitPrice !== item.unitPrice) {
      throw new PurchaseDomainError(
        'DUPLICATE_PRODUCT_PRICE_MISMATCH',
        'برای محصول تکراری، قیمت خرید یکسان وارد کنید.',
        400,
        [{ field: 'items', message: 'ردیف‌های تکراری یک محصول باید قیمت خرید یکسان داشته باشند.' }],
      );
    }
    const quantity = previous.quantity + item.quantity;
    if (!Number.isSafeInteger(quantity)) {
      throw new PurchaseDomainError('INVALID_QUANTITY', 'تعداد تجمیعی محصول از حد مجاز بیشتر است.', 400, [
        { field: 'items', message: 'تعداد تجمیعی هر محصول باید در محدودهٔ عدد صحیح امن باشد.' },
      ]);
    }
    merged.set(item.productId, { productId: item.productId, quantity, unitPrice: item.unitPrice });
  }
  return [...merged.values()];
}

export function calculatePurchaseTotals(
  items: readonly Pick<PurchaseItemInput, 'quantity' | 'unitPrice'>[],
  discount: number,
): PurchaseLineCalculation {
  if (items.length === 0) {
    throw new PurchaseDomainError('EMPTY_PURCHASE_ITEMS', 'خرید باید دست‌کم یک قلم داشته باشد.', 400);
  }
  let subtotal = 0;
  const lineTotals: number[] = [];
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new PurchaseDomainError('INVALID_QUANTITY', 'تعداد هر قلم باید عدد صحیح مثبت باشد.', 400);
    }
    if (!Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0) {
      throw new PurchaseDomainError('INVALID_UNIT_PRICE', 'قیمت خرید باید عدد صحیح نامنفی باشد.', 400);
    }
    const lineTotal = item.quantity * item.unitPrice;
    if (!Number.isSafeInteger(lineTotal) || lineTotal < 0 || lineTotal > MAX_SAFE_AMOUNT - subtotal) {
      throw new PurchaseDomainError('PURCHASE_AMOUNT_TOO_LARGE', 'مبلغ خرید از محدودهٔ امن بیشتر است.', 400);
    }
    lineTotals.push(lineTotal);
    subtotal += lineTotal;
  }

  if (!Number.isSafeInteger(discount) || discount < 0 || discount > subtotal) {
    throw new PurchaseDomainError('INVALID_DISCOUNT', 'تخفیف باید عدد صحیح نامنفی و حداکثر برابر با جمع اقلام باشد.', 400, [
      { field: 'discount', message: 'تخفیف را به‌صورت عدد صحیح و حداکثر برابر با جمع اقلام وارد کنید.' },
    ]);
  }
  return { subtotal, discount, total: subtotal - discount, lineTotals };
}
