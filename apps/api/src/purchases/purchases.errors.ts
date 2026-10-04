import type { ApiError } from '@bazariya/shared';

export type PurchaseDomainErrorCode =
  | 'PURCHASE_NOT_FOUND'
  | 'PURCHASE_NOT_EDITABLE'
  | 'PURCHASE_NOT_CONFIRMABLE'
  | 'PURCHASE_ALREADY_CONFIRMED'
  | 'PURCHASE_DATE_RANGE_INVALID'
  | 'EMPTY_PURCHASE_ITEMS'
  | 'INVALID_QUANTITY'
  | 'INVALID_UNIT_PRICE'
  | 'INVALID_DISCOUNT'
  | 'PURCHASE_AMOUNT_TOO_LARGE'
  | 'DUPLICATE_PRODUCT_PRICE_MISMATCH'
  | 'SUPPLIER_NOT_FOUND'
  | 'SUPPLIER_NOT_ACTIVE'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_NOT_AVAILABLE';

export class PurchaseDomainError extends Error {
  constructor(
    readonly code: PurchaseDomainErrorCode,
    message: string,
    readonly status: number,
    readonly details?: ApiError['error']['details'],
  ) {
    super(message);
    this.name = 'PurchaseDomainError';
  }
}
