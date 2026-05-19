import { Timestamp } from '@angular/fire/firestore';
import { OrderLifecycleStatus } from './order-status.enum';

export interface OrderTimelineEntry {
  from: OrderLifecycleStatus;
  to: OrderLifecycleStatus;
  at: Timestamp | Date;
  by: string;
}

export interface OrderLifecycleUpdatePayload {
  orderStatus: OrderLifecycleStatus;
  currentStatus: OrderLifecycleStatus;
  statusUpdatedAt: ReturnType<typeof import('@angular/fire/firestore').serverTimestamp>;
  updatedAt: ReturnType<typeof import('@angular/fire/firestore').serverTimestamp>;
  timeline: OrderTimelineEntry;
}

export interface TransitionContext {
  orderId: string;
  from: OrderLifecycleStatus;
  to: OrderLifecycleStatus;
  actorUid: string;
  cancelReason?: string;
}
