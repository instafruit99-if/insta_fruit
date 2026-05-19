import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, addDoc, collection, serverTimestamp } from '@angular/fire/firestore';
import { AuditAction } from './security.types';

export interface OrderStatusAuditParams {
  orderId: string;
  from: string;
  to: string;
  action?: AuditAction;
  reason?: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLoggerService {
  private readonly db = inject(Firestore);
  private readonly auth = inject(Auth);

  async logOrderStatusUpdated(params: OrderStatusAuditParams): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return;

    const action: AuditAction =
      params.action ?? (params.to === 'cancelled' ? 'order_cancelled' : 'order_status_updated');

    try {
      await addDoc(collection(this.db, 'auditLogs'), {
        action,
        orderId: params.orderId,
        from: params.from,
        to: params.to,
        by: uid,
        at: serverTimestamp(),
        ...(params.reason ? { reason: params.reason } : {}),
      });
    } catch {
      // Audit failure must not block the primary operation.
    }
  }
}
