import type { CreateStockMovementInput, StockMovementType } from '@bazariya/shared';
import { InventoryDomainError } from './inventory.errors.js';

export interface CalculatedStockMovement {
  type: StockMovementType;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
}

export function calculateStockMovement(
  beforeQuantity: number,
  input: CreateStockMovementInput,
): CalculatedStockMovement {
  if (!Number.isSafeInteger(beforeQuantity) || beforeQuantity < 0) {
    throw new InventoryDomainError('INVALID_QUANTITY', 'موجودی فعلی معتبر نیست.', 400);
  }
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 0) {
    throw new InventoryDomainError('INVALID_QUANTITY', 'تعداد باید یک عدد صحیح نامنفی و در محدودهٔ مجاز باشد.', 400);
  }

  let afterQuantity: number;
  let movementQuantity: number;

  switch (input.type) {
    case 'IN':
      if (input.quantity === 0) {
        throw new InventoryDomainError('INVALID_QUANTITY', 'تعداد ورود باید بیشتر از صفر باشد.', 400);
      }
      afterQuantity = beforeQuantity + input.quantity;
      movementQuantity = input.quantity;
      if (!Number.isSafeInteger(afterQuantity)) {
        throw new InventoryDomainError('INVALID_QUANTITY', 'موجودی از محدودهٔ مجاز بیشتر می‌شود.', 400);
      }
      break;
    case 'OUT':
      if (input.quantity === 0) {
        throw new InventoryDomainError('INVALID_QUANTITY', 'تعداد خروج باید بیشتر از صفر باشد.', 400);
      }
      if (input.quantity > beforeQuantity) {
        throw new InventoryDomainError(
          'INSUFFICIENT_STOCK',
          'موجودی برای ثبت این خروج کافی نیست.',
          409,
          [
            { field: 'quantity', message: `موجودی فعلی ${beforeQuantity} است و خروج ${input.quantity} واحد درخواست شده است.` },
          ],
        );
      }
      afterQuantity = beforeQuantity - input.quantity;
      movementQuantity = input.quantity;
      break;
    case 'ADJUSTMENT':
      afterQuantity = input.quantity;
      movementQuantity = Math.abs(afterQuantity - beforeQuantity);
      break;
    default:
      throw new InventoryDomainError('INVALID_MOVEMENT_TYPE', 'نوع گردش موجودی معتبر نیست.', 400);
  }

  return {
    type: input.type,
    quantity: movementQuantity,
    beforeQuantity,
    afterQuantity,
  };
}
