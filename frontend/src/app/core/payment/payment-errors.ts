export const PAYMENT_ERROR_MESSAGES = {
  ALREADY_PROCESSING: 'Payment already processing.',
  INVALID_REQUEST: 'Invalid payment request.',
  PAYMENT_FAILED: 'Payment failed. Please try again.',
  DUPLICATE_BLOCKED: 'Duplicate payment blocked.',
  ORDER_NOT_FOUND: 'Order not found.',
  VALIDATION_FAILED: 'Payment validation failed.',
  RETRY_LIMIT: 'Too many payment attempts. Please try again later.',
} as const;

export type PaymentErrorCode = keyof typeof PAYMENT_ERROR_MESSAGES;

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;

  constructor(code: PaymentErrorCode, message?: string) {
    super(message ?? PAYMENT_ERROR_MESSAGES[code]);
    this.name = 'PaymentError';
    this.code = code;
  }
}

export function paymentError(code: PaymentErrorCode, message?: string): PaymentError {
  return new PaymentError(code, message);
}
