import { HttpsError } from 'firebase-functions/v2/https';

export const ORDER_ERROR_MESSAGES = {
  AUTH_REQUIRED: 'Authentication required',
  INVALID_CART: 'Invalid cart',
  OUT_OF_STOCK: 'Product out of stock',
  PRODUCT_UNAVAILABLE: 'Product unavailable',
  INVALID_PRODUCT: 'Invalid product',
  ALREADY_PROCESSING: 'Order already processing',
  TRANSACTION_FAILED: 'Transaction failed',
} as const;

export type OrderErrorCode = keyof typeof ORDER_ERROR_MESSAGES;

const ERROR_HTTP_CODE: Record<OrderErrorCode, HttpsError['code']> = {
  AUTH_REQUIRED: 'unauthenticated',
  INVALID_CART: 'invalid-argument',
  OUT_OF_STOCK: 'failed-precondition',
  PRODUCT_UNAVAILABLE: 'failed-precondition',
  INVALID_PRODUCT: 'invalid-argument',
  ALREADY_PROCESSING: 'already-exists',
  TRANSACTION_FAILED: 'internal',
};

export function orderHttpsError(code: OrderErrorCode): HttpsError {
  return new HttpsError(ERROR_HTTP_CODE[code], ORDER_ERROR_MESSAGES[code]);
}
