export const PAYMENT_LIFECYCLE_STATUSES = [
  'pending',
  'processing',
  'success',
  'failed',
  'cancelled',
] as const;

export type PaymentLifecycleStatus = (typeof PAYMENT_LIFECYCLE_STATUSES)[number];

export const PAYMENT_TRANSITION_RULES: Readonly<
  Record<PaymentLifecycleStatus, readonly PaymentLifecycleStatus[]>
> = {
  pending: ['processing', 'failed', 'cancelled'],
  processing: ['success', 'failed'],
  success: [],
  failed: ['processing'],
  cancelled: [],
};

export function canTransitionPayment(
  from: PaymentLifecycleStatus,
  to: PaymentLifecycleStatus,
): boolean {
  if (from === to) return true;
  return PAYMENT_TRANSITION_RULES[from].includes(to);
}
