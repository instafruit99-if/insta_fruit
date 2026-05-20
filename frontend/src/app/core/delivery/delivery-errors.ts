export const DELIVERY_ERROR_MESSAGES = {
  NOT_AVAILABLE: 'Delivery not available for this location.',
  MINIMUM_ORDER: 'Minimum order amount not reached.',
  INVALID_SLOT: 'Invalid delivery slot.',
  SLOT_UNAVAILABLE: 'Selected delivery slot unavailable.',
  CALCULATION_FAILED: 'Delivery calculation failed.',
} as const;

export type DeliveryErrorCode = keyof typeof DELIVERY_ERROR_MESSAGES;

export class DeliveryError extends Error {
  readonly code: DeliveryErrorCode;

  constructor(code: DeliveryErrorCode, message?: string) {
    super(message ?? DELIVERY_ERROR_MESSAGES[code]);
    this.name = 'DeliveryError';
    this.code = code;
  }
}

export function deliveryError(code: DeliveryErrorCode, message?: string): DeliveryError {
  return new DeliveryError(code, message);
}
