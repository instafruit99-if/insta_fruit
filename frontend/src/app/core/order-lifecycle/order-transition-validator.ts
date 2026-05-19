import { OrderLifecycleStatus } from './order-status.enum';
import { canTransition } from './order-state-machine';

export const LIFECYCLE_ERROR_MESSAGES = {
  INVALID_TRANSITION: 'Invalid order transition',
  ALREADY_DELIVERED: 'Order already delivered',
  CANCELLED_LOCKED: 'Cancelled orders cannot be updated',
  TRANSITION_NOT_ALLOWED: 'Transition not allowed',
  UPDATE_FAILED: 'Order status update failed',
} as const;

export type LifecycleErrorCode = keyof typeof LIFECYCLE_ERROR_MESSAGES;

export class OrderLifecycleError extends Error {
  readonly code: LifecycleErrorCode;

  constructor(code: LifecycleErrorCode, message?: string) {
    super(message ?? LIFECYCLE_ERROR_MESSAGES[code]);
    this.name = 'OrderLifecycleError';
    this.code = code;
  }
}

export function validateTransition(
  from: OrderLifecycleStatus,
  to: OrderLifecycleStatus,
): void {
  if (from === to) return;

  if (from === 'delivered') {
    throw new OrderLifecycleError('ALREADY_DELIVERED');
  }
  if (from === 'cancelled') {
    throw new OrderLifecycleError('CANCELLED_LOCKED');
  }
  if (!canTransition(from, to)) {
    throw new OrderLifecycleError('INVALID_TRANSITION');
  }
}

export function normalizeOrderStatus(raw: string | undefined): OrderLifecycleStatus {
  const status = raw ?? 'placed';
  const known: OrderLifecycleStatus[] = [
    'placed', 'accepted', 'preparing', 'packed', 'assigned_to_rider',
    'outForDelivery', 'delivered', 'cancelled', 'returned', 'refunded',
    'payment_pending', 'payment_verified', 'refund_pending',
    'return_requested', 'failed',
  ];
  return known.includes(status as OrderLifecycleStatus)
    ? (status as OrderLifecycleStatus)
    : 'placed';
}
