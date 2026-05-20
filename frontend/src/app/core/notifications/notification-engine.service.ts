import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { OrderLifecycleStatus } from '../order-lifecycle/order-status.enum';
import { NotificationType, isNotificationType } from './notification-types.enum';
import { AppNotification, CreateNotificationInput } from './notification.types';
import { NotificationDeduplicationService } from './notification-deduplication.service';
import { NotificationRoutingService } from './notification-routing.service';
import { NotificationCleanupService, NOTIFICATION_LOAD_LIMIT } from './notification-cleanup.service';
import { NotificationError } from './notification-errors';

@Injectable({ providedIn: 'root' })
export class NotificationEngineService {
  private readonly db = inject(Firestore);
  private readonly dedup = inject(NotificationDeduplicationService);
  private readonly routing = inject(NotificationRoutingService);
  private readonly cleanup = inject(NotificationCleanupService);

  watch(userId: string): Observable<AppNotification[]> {
    return collectionData(
      query(collection(this.db, 'notifications'), where('userId', '==', userId)),
      { idField: 'id' },
    ).pipe(
      map((rows) =>
        this.cleanup.trimForDisplay(
          rows.map((r) => this.normalize(r as Record<string, unknown> & { id: string })),
        ),
      ),
      map((list) =>
        list.sort((a, b) => {
          const tA = this.toMillis(a.createdAt);
          const tB = this.toMillis(b.createdAt);
          return tB - tA;
        }),
      ),
    );
  }

  unreadCount(notifications: AppNotification[]): number {
    return notifications.filter((n) => !n.isRead).length;
  }

  async create(input: CreateNotificationInput): Promise<string | null> {
    if (!input.userId?.trim() || !input.deduplicationKey?.trim()) {
      throw new NotificationError('INVALID_REQUEST');
    }
    if (!this.dedup.shouldCreate(input.deduplicationKey)) {
      return null;
    }

    const relatedOrderId = input.relatedOrderId ?? null;
    const route =
      input.route ?? this.routing.resolveRoute({ route: '', relatedOrderId, orderId: relatedOrderId });

    try {
      const ref = await addDoc(collection(this.db, 'notifications'), {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        relatedOrderId,
        orderId: relatedOrderId,
        route,
        deduplicationKey: input.deduplicationKey,
        isRead: false,
        createdAt: serverTimestamp(),
      });
      this.dedup.markCreated(input.deduplicationKey);
      return ref.id;
    } catch {
      throw new NotificationError('INVALID_REQUEST', 'Notification load failed.');
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    if (!notificationId?.trim()) return;
    try {
      await updateDoc(doc(this.db, `notifications/${notificationId}`), { isRead: true });
    } catch {
      throw new NotificationError('MARK_READ_FAILED');
    }
  }

  async markAllRead(userId: string, notifications: AppNotification[]): Promise<void> {
    const unread = notifications.filter((n) => !n.isRead && n.userId === userId);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(this.db);
      unread.slice(0, NOTIFICATION_LOAD_LIMIT).forEach((n) => {
        batch.update(doc(this.db, `notifications/${n.id}`), { isRead: true });
      });
      await batch.commit();
    } catch {
      throw new NotificationError('MARK_READ_FAILED');
    }
  }

  async notifyOrderStatus(
    userId: string,
    orderId: string,
    status: OrderLifecycleStatus,
  ): Promise<void> {
    const type = this.statusToType(status);
    if (!type) return;
    await this.create({
      userId,
      type,
      title: 'Order Update',
      message: `Your order #${orderId.slice(-8).toUpperCase()} is now ${status}.`,
      relatedOrderId: orderId,
      deduplicationKey: this.dedup.buildOrderStatusKey(userId, orderId, type),
    });
  }

  async notifyOrderPlaced(userId: string, orderId: string): Promise<void> {
    await this.create({
      userId,
      type: 'ORDER_PLACED',
      title: 'Order Placed',
      message: `Your order #${orderId.slice(-8).toUpperCase()} has been placed successfully.`,
      relatedOrderId: orderId,
      deduplicationKey: this.dedup.buildOrderStatusKey(userId, orderId, 'ORDER_PLACED'),
    });
    await this.notifyAdminsNewOrder(orderId);
  }

  async notifyAdminsNewOrder(orderId: string): Promise<void> {
    const adminIds = await this.getAdminUserIds();
    await Promise.all(
      adminIds.map((adminId) =>
        this.create({
          userId: adminId,
          type: 'ADMIN_NEW_ORDER',
          title: 'New Order',
          message: `New order #${orderId.slice(-8).toUpperCase()} received.`,
          relatedOrderId: orderId,
          route: '/admin/orders',
          deduplicationKey: this.dedup.buildAdminOrderKey(orderId, 'ADMIN_NEW_ORDER'),
        }),
      ),
    );
  }

  async notifyAdminOrderCancelled(orderId: string): Promise<void> {
    const adminIds = await this.getAdminUserIds();
    await Promise.all(
      adminIds.map((adminId) =>
        this.create({
          userId: adminId,
          type: 'ORDER_CANCELLED',
          title: 'Order Cancelled',
          message: `Order #${orderId.slice(-8).toUpperCase()} was cancelled.`,
          relatedOrderId: orderId,
          route: '/admin/orders',
          deduplicationKey: this.dedup.buildAdminOrderKey(orderId, 'ADMIN_CANCELLED'),
        }),
      ),
    );
  }

  async notifyPaymentSuccess(userId: string, orderId: string): Promise<void> {
    await this.create({
      userId,
      type: 'PAYMENT_SUCCESS',
      title: 'Payment Successful',
      message: `Payment for order #${orderId.slice(-8).toUpperCase()} was successful.`,
      relatedOrderId: orderId,
      deduplicationKey: this.dedup.buildPaymentKey(userId, orderId, 'PAYMENT_SUCCESS'),
    });
  }

  async notifyPaymentFailed(userId: string, orderId: string, reason?: string): Promise<void> {
    await this.create({
      userId,
      type: 'PAYMENT_FAILED',
      title: 'Payment Failed',
      message: reason?.trim() || `Payment for order #${orderId.slice(-8).toUpperCase()} failed. Please try again.`,
      relatedOrderId: orderId,
      deduplicationKey: this.dedup.buildPaymentKey(userId, orderId, 'PAYMENT_FAILED'),
    });
  }

  /** Backward-compatible alias for admin status updates. */
  async notifyUser(userId: string, orderId: string, status: OrderLifecycleStatus): Promise<void> {
    if (status === 'cancelled') {
      await this.notifyOrderStatus(userId, orderId, status);
      await this.notifyAdminOrderCancelled(orderId);
      return;
    }
    await this.notifyOrderStatus(userId, orderId, status);
  }

  private async getAdminUserIds(): Promise<string[]> {
    try {
      const snap = await getDocs(query(collection(this.db, 'users'), where('role', '==', 'admin')));
      return snap.docs.map((d) => d.id);
    } catch {
      return [];
    }
  }

  private statusToType(status: OrderLifecycleStatus): NotificationType | null {
    const map: Partial<Record<OrderLifecycleStatus, NotificationType>> = {
      placed: 'ORDER_PLACED',
      accepted: 'ORDER_ACCEPTED',
      preparing: 'ORDER_PREPARING',
      packed: 'ORDER_PACKED',
      assigned_to_rider: 'ORDER_OUT_FOR_DELIVERY',
      outForDelivery: 'ORDER_OUT_FOR_DELIVERY',
      delivered: 'ORDER_DELIVERED',
      cancelled: 'ORDER_CANCELLED',
    };
    return map[status] ?? null;
  }

  private normalize(raw: Record<string, unknown> & { id: string }): AppNotification {
    const typeRaw = String(raw['type'] ?? 'SYSTEM_NOTIFICATION');
    const type = isNotificationType(typeRaw) ? typeRaw : 'SYSTEM_NOTIFICATION';
    const relatedOrderId =
      (raw['relatedOrderId'] as string | null | undefined) ??
      (raw['orderId'] as string | null | undefined) ??
      null;

    return {
      id: raw.id,
      userId: String(raw['userId'] ?? ''),
      type,
      title: String(raw['title'] ?? 'Notification'),
      message: String(raw['message'] ?? ''),
      relatedOrderId,
      orderId: relatedOrderId,
      isRead: raw['isRead'] === true,
      route: String(raw['route'] ?? this.routing.resolveRoute({ route: '', relatedOrderId, orderId: relatedOrderId })),
      deduplicationKey: String(raw['deduplicationKey'] ?? `${raw.id}:${type}`),
      createdAt: raw['createdAt'] as AppNotification['createdAt'],
    };
  }

  private toMillis(value: AppNotification['createdAt']): number {
    if (!value) return 0;
    if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
      return (value as { toMillis: () => number }).toMillis();
    }
    return new Date(value as Date).getTime();
  }
}
