/** Active lifecycle states used in the main fulfillment flow. */
export const ORDER_FLOW_STATUSES = [
  'placed',
  'accepted',
  'preparing',
  'packed',
  'assigned_to_rider',
  'outForDelivery',
  'delivered',
] as const;

/** Terminal and exceptional states. */
export const ORDER_TERMINAL_STATUSES = [
  'cancelled',
  'returned',
  'refunded',
] as const;

/** Reserved for future payment / refund / return modules (not in transition map yet). */
export const ORDER_FUTURE_STATUSES = [
  'payment_pending',
  'payment_verified',
  'refund_pending',
  'return_requested',
  'failed',
] as const;

export const ORDER_STATUSES = [
  ...ORDER_FLOW_STATUSES,
  ...ORDER_TERMINAL_STATUSES,
  ...ORDER_FUTURE_STATUSES,
] as const;

export type OrderLifecycleStatus = (typeof ORDER_STATUSES)[number];

export type OrderFlowStatus = (typeof ORDER_FLOW_STATUSES)[number];

export function isOrderLifecycleStatus(value: string): value is OrderLifecycleStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isTerminalOrderStatus(status: OrderLifecycleStatus): boolean {
  return (ORDER_TERMINAL_STATUSES as readonly string[]).includes(status)
    || status === 'delivered';
}
