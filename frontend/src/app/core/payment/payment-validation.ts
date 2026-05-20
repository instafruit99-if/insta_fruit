import { PaymentMethod } from '../models';
import {
  PaymentLifecycleStatus,
  canTransitionPayment,
  PAYMENT_LIFECYCLE_STATUSES,
} from './payment-state.enum';
import { paymentError } from './payment-errors';

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === 'cod' || value === 'razorpay';
}

export function validateCheckoutPaymentInput(
  orderId: string,
  userId: string,
  amount: number,
  method: PaymentMethod,
): void {
  if (!orderId?.trim() || !userId?.trim()) {
    throw paymentError('INVALID_REQUEST');
  }
  if (!isPaymentMethod(method)) {
    throw paymentError('VALIDATION_FAILED');
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw paymentError('INVALID_REQUEST');
  }
}

export function validatePaymentTransition(
  from: PaymentLifecycleStatus,
  to: PaymentLifecycleStatus,
): void {
  if (!PAYMENT_LIFECYCLE_STATUSES.includes(from) || !PAYMENT_LIFECYCLE_STATUSES.includes(to)) {
    throw paymentError('VALIDATION_FAILED');
  }
  if (!canTransitionPayment(from, to)) {
    throw paymentError('VALIDATION_FAILED');
  }
}

export function normalizePaymentStatus(raw: string | undefined): PaymentLifecycleStatus {
  const s = raw ?? 'pending';
  return (PAYMENT_LIFECYCLE_STATUSES as readonly string[]).includes(s)
    ? (s as PaymentLifecycleStatus)
    : 'pending';
}
