import type { OrderItemInput } from '@bazariya/shared';
import { OrderDomainError } from './orders.errors.js';

const MAX_SAFE_AMOUNT = Number.MAX_SAFE_INTEGER;
const MAX_QUANTITY = 2_147_483_647;

export interface OrderLineTotalInput {
  quantity: number;
  unitPrice: number;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  total: number;
  itemTotals: number[];
}

export function mergeDuplicateItems(items: readonly OrderItemInput[]): OrderItemInput[] {
  const quantities = new Map<string, number>();

  for (const item of items) {
    const quantity = (quantities.get(item.productId) ?? 0) + item.quantity;
    if (!Number.isSafeInteger(quantity) || quantity > MAX_QUANTITY) {
      throw new OrderDomainError('ORDER_INVALID', 'تعداد محصول از حد مجاز بیشتر است.', 400, [
        { field: 'items', message: 'تعداد هر محصول باید عدد صحیح مثبت و در محدودهٔ مجاز باشد.' },
      ]);
    }
    quantities.set(item.productId, quantity);
  }

  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}

export function calculateOrderTotals(items: readonly OrderLineTotalInput[], discount: number): OrderTotals {
  let subtotal = 0;
  const itemTotals: number[] = [];

  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0 || item.quantity > MAX_QUANTITY) {
      throw new OrderDomainError('ORDER_INVALID', 'تعداد هر محصول باید عدد صحیح مثبت باشد.', 400, [
        { field: 'items', message: 'تعداد هر محصول باید عدد صحیح مثبت باشد.' },
      ]);
    }
    if (!Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0) {
      throw new OrderDomainError('ORDER_AMOUNT_TOO_LARGE', 'مبلغ سفارش از محدودهٔ مجاز بیشتر است.', 400);
    }

    const lineTotal = item.quantity * item.unitPrice;
    if (!Number.isSafeInteger(lineTotal) || lineTotal < 0 || lineTotal > MAX_SAFE_AMOUNT - subtotal) {
      throw new OrderDomainError('ORDER_AMOUNT_TOO_LARGE', 'مبلغ سفارش از محدودهٔ مجاز بیشتر است.', 400);
    }
    itemTotals.push(lineTotal);
    subtotal += lineTotal;
  }

  if (!Number.isSafeInteger(discount) || discount < 0) {
    throw new OrderDomainError('ORDER_INVALID', 'تخفیف باید عدد صحیح نامنفی باشد.', 400, [
      { field: 'discount', message: 'تخفیف باید عدد صحیح نامنفی باشد.' },
    ]);
  }
  if (discount > subtotal) {
    throw new OrderDomainError('ORDER_DISCOUNT_INVALID', 'تخفیف نمی‌تواند از جمع اقلام بیشتر باشد.', 400, [
      { field: 'discount', message: 'تخفیف را حداکثر برابر با جمع اقلام وارد کنید.' },
    ]);
  }

  return { subtotal, discount, total: subtotal - discount, itemTotals };
}
