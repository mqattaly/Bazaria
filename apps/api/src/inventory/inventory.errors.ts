import type { ApiError } from '@bazariya/shared';

export type InventoryDomainErrorCode =
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_NOT_AVAILABLE'
  | 'INVENTORY_NOT_FOUND'
  | 'INVALID_MOVEMENT_TYPE'
  | 'INVALID_QUANTITY'
  | 'INSUFFICIENT_STOCK'
  | 'INVALID_MINIMUM_QUANTITY'
  | 'INVALID_MOVEMENT_NOTE'
  | 'INVALID_DATE_RANGE';

export class InventoryDomainError extends Error {
  constructor(
    readonly code: InventoryDomainErrorCode,
    message: string,
    readonly status: number,
    readonly details?: ApiError['error']['details'],
  ) {
    super(message);
    this.name = 'InventoryDomainError';
  }
}
