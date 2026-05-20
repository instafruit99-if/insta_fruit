import { CreateOrderSecurityInput } from './security.types';
import { securityError } from './security-errors';

const MAX_NAME_LEN = 120;
const MAX_PHONE_LEN = 20;
const MAX_SLOT_LEN = 80;
const MAX_ADDRESS_LEN = 200;
const MAX_POSTAL_LEN = 12;
const MAX_CANCEL_REASON_LEN = 500;

function isNonEmptyString(value: unknown, maxLen: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLen;
}

function isValidPaymentMethod(value: unknown): boolean {
  return value === 'cod' || value === 'razorpay';
}

const PHONE_RE = /^[6-9]\d{9}$/;

export function validateCreateOrderInput(input: CreateOrderSecurityInput): void {
  if (!isNonEmptyString(input.userName, MAX_NAME_LEN)) {
    throw securityError('INVALID_REQUEST', 'Please enter your name.');
  }
  const phoneDigits = String(input.userPhone ?? '').replace(/\D/g, '').slice(-10);
  if (!PHONE_RE.test(phoneDigits)) {
    throw securityError('INVALID_REQUEST', 'Please enter a valid 10-digit mobile number.');
  }
  if (!isNonEmptyString(input.deliverySlot, MAX_SLOT_LEN)) {
    throw securityError('INVALID_REQUEST');
  }
  if (!isValidPaymentMethod(input.paymentMethod)) {
    throw securityError('INVALID_REQUEST');
  }

  const a = input.address;
  if (
    !a ||
    !isNonEmptyString(a.label, MAX_ADDRESS_LEN) ||
    !isNonEmptyString(a.line1, MAX_ADDRESS_LEN) ||
    !isNonEmptyString(a.city, MAX_ADDRESS_LEN) ||
    !isNonEmptyString(a.state, MAX_ADDRESS_LEN) ||
    !isNonEmptyString(a.postalCode, MAX_POSTAL_LEN) ||
    !isNonEmptyString(a.country || 'India', MAX_ADDRESS_LEN)
  ) {
    throw securityError('INVALID_REQUEST', 'Please complete your delivery address.');
  }
}

export function validateOrderId(orderId: string): void {
  if (!isNonEmptyString(orderId, 128)) {
    throw securityError('INVALID_REQUEST');
  }
}

export function validateCancelReason(reason: string): void {
  if (!isNonEmptyString(reason, MAX_CANCEL_REASON_LEN)) {
    throw securityError('INVALID_REQUEST');
  }
}

export function validateCartQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw securityError('INVALID_REQUEST');
  }
}
