import { OrderTimelineEntry } from './order-lifecycle.types';
import { OrderLifecycleStatus } from './order-status.enum';

export function buildTimelineEntry(
  from: OrderLifecycleStatus,
  to: OrderLifecycleStatus,
  actorUid: string,
): Omit<OrderTimelineEntry, 'at'> {
  return { from, to, by: actorUid };
}

/** Maps lifecycle status to track-order stepper index (0-based). */
export function trackOrderStepIndex(status: OrderLifecycleStatus): number {
  if (status === 'cancelled') return 0;
  const steps: OrderLifecycleStatus[] = [
    'placed',
    'accepted',
    'preparing',
    'packed',
    'assigned_to_rider',
    'outForDelivery',
    'delivered',
  ];
  const idx = steps.indexOf(status);
  if (idx >= 0) return idx;
  if (status === 'returned' || status === 'refunded' || status === 'failed') return steps.length - 1;
  return 0;
}

export const TRACK_ORDER_STEP_COUNT = 7;
