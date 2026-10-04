import type { ApiError } from '@bazariya/shared';

export type OrderDomainErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'ORDER_INVALID'
  | 'ORDER_DISCOUNT_INVALID'
  | 'ORDER_AMOUNT_TOO_LARGE'
  | 'ORDER_NOT_EDITABLE'
  | 'ORDER_INVALID_STATUS_TRANSITION'
  | 'CUSTOMER_NOT_FOUND'
  | 'CUSTOMER_NOT_AVAILABLE'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_NOT_AVAILABLE';

export class OrderDomainError extends Error {
  constructor(
    readonly code: OrderDomainErrorCode,
    message: string,
    readonly status: number,
    readonly details?: ApiError['error']['details'],
  ) {
    super(message);
    this.name = 'OrderDomainError';
  }
}
