export const ADDRESS_ERROR_MESSAGES = {
  DELIVERY_UNAVAILABLE: 'Delivery not available in this area.',
  INVALID_PINCODE: 'Invalid pincode.',
  INVALID_PHONE: 'Invalid phone number.',
  ADDRESS_REQUIRED: 'Address required.',
  SELECT_ADDRESS: 'Please select delivery address.',
  UNSUPPORTED_LOCATION: 'Unsupported delivery location.',
  MAX_ADDRESSES: 'Maximum saved addresses reached.',
  NOT_FOUND: 'Address not found.',
  SAVE_FAILED: 'Failed to save address.',
} as const;

export type AddressErrorCode = keyof typeof ADDRESS_ERROR_MESSAGES;

export class AddressError extends Error {
  readonly code: AddressErrorCode;

  constructor(code: AddressErrorCode, message?: string) {
    super(message ?? ADDRESS_ERROR_MESSAGES[code]);
    this.name = 'AddressError';
    this.code = code;
  }
}

export function addressError(code: AddressErrorCode, message?: string): AddressError {
  return new AddressError(code, message);
}
