import { OrderLifecycleStatus } from './order-status.enum';

/** Allowed transitions: from → [to, …] */
export const ORDER_TRANSITION_RULES: Readonly<Record<string, readonly OrderLifecycleStatus[]>> = {
  placed: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['packed', 'cancelled'],
  packed: ['assigned_to_rider'],
  assigned_to_rider: ['outForDelivery'],
  outForDelivery: ['delivered'],
  delivered: [],
  cancelled: [],
  returned: [],
  refunded: [],
  payment_pending: [],
  payment_verified: [],
  refund_pending: [],
  return_requested: [],
  failed: [],
};

export function getAllowedNextStatuses(from: OrderLifecycleStatus): OrderLifecycleStatus[] {
  return [...(ORDER_TRANSITION_RULES[from] ?? [])];
}

export function canTransition(from: OrderLifecycleStatus, to: OrderLifecycleStatus): boolean {
  if (from === to) return true;
  return getAllowedNextStatuses(from).includes(to);
}

/** Customer-facing cancel is allowed only before packing. */
export const CUSTOMER_CANCELLABLE_STATUSES: readonly OrderLifecycleStatus[] = [
  'placed',
  'accepted',
  'preparing',
];
