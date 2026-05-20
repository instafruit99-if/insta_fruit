export const ORDER_ERROR_MESSAGES = {
  AUTH_REQUIRED: 'Authentication required',
  INVALID_CART: 'Invalid cart',
  OUT_OF_STOCK: 'Product out of stock',
  PRODUCT_UNAVAILABLE: 'Product unavailable',
  INVALID_PRODUCT: 'Invalid product',
  ALREADY_PROCESSING: 'Order already processing',
  TRANSACTION_FAILED: 'Transaction failed',
  PLEASE_TRY_AGAIN: 'Please try again',
} as const;

export type OrderErrorCode = keyof typeof ORDER_ERROR_MESSAGES;

export class OrderTransactionError extends Error {
  readonly code: OrderErrorCode;

  constructor(code: OrderErrorCode, message?: string) {
    super(message ?? ORDER_ERROR_MESSAGES[code]);
    this.name = 'OrderTransactionError';
    this.code = code;
  }
}

export function orderTransactionError(code: OrderErrorCode, message?: string): OrderTransactionError {
  return new OrderTransactionError(code, message);
}
