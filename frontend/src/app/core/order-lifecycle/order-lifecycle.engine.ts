import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  Firestore,
  Timestamp,
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from '@angular/fire/firestore';
import { buildTimelineEntry } from './order-timeline';
import { OrderLifecycleStatus } from './order-status.enum';
import {
  OrderLifecycleError,
  normalizeOrderStatus,
  validateTransition,
} from './order-transition-validator';
import { getAllowedNextStatuses } from './order-state-machine';

@Injectable({ providedIn: 'root' })
export class OrderLifecycleEngine {
  private readonly db = inject(Firestore);
  private readonly auth = inject(Auth);

  getAllowedNextStatuses(from: OrderLifecycleStatus): OrderLifecycleStatus[] {
    return getAllowedNextStatuses(from);
  }

  async transition(orderId: string, to: OrderLifecycleStatus, cancelReason?: string): Promise<void> {
    const actorUid = this.auth.currentUser?.uid;
    if (!actorUid) {
      throw new OrderLifecycleError('UPDATE_FAILED', 'Authentication required');
    }

    const orderRef = doc(this.db, `orders/${orderId}`);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) {
      throw new OrderLifecycleError('UPDATE_FAILED', 'Order not found');
    }

    const data = snap.data();
    const from = normalizeOrderStatus(data['orderStatus'] as string | undefined);
    validateTransition(from, to);

    if (from === to) return;

    // serverTimestamp() cannot be used inside arrayUnion — use client Timestamp.
    const timelineEntry = {
      ...buildTimelineEntry(from, to, actorUid),
      at: Timestamp.now(),
    };

    const patch: Record<string, unknown> = {
      orderStatus: to,
      currentStatus: to,
      statusUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      timeline: arrayUnion(timelineEntry),
    };

    if (to === 'cancelled' && cancelReason !== undefined) {
      patch['cancelReason'] = cancelReason;
    }

    try {
      await updateDoc(orderRef, patch);
    } catch (error) {
      console.error('[OrderLifecycle] update failed', error);
      const code = (error as { code?: string })?.code;
      if (code === 'permission-denied') {
        throw new OrderLifecycleError(
          'UPDATE_FAILED',
          'Permission denied. Ensure your user has admin role in Firestore.',
        );
      }
      throw new OrderLifecycleError('UPDATE_FAILED');
    }
  }
}
