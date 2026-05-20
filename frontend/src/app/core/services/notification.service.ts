import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { OrderLifecycleStatus } from '../order-lifecycle/order-status.enum';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import { NotificationRoutingService } from '../notifications/notification-routing.service';
import { AppNotification } from '../notifications/notification.types';

/**
 * Public notification API — preserves legacy OrdersService method names via delegation.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly engine = inject(NotificationEngineService);
  readonly routing = inject(NotificationRoutingService);

  myNotifications(userId: string): Observable<AppNotification[]> {
    return this.engine.watch(userId);
  }

  unreadCount(notifications: AppNotification[]): number {
    return this.engine.unreadCount(notifications);
  }

  markNotificationAsRead(id: string): Promise<void> {
    return this.engine.markAsRead(id);
  }

  markAllRead(userId: string, notifications: AppNotification[]): Promise<void> {
    return this.engine.markAllRead(userId, notifications);
  }

  notifyUser(userId: string, orderId: string, status: OrderLifecycleStatus): Promise<void> {
    return this.engine.notifyUser(userId, orderId, status);
  }

  onOrderPlaced(userId: string, orderId: string): Promise<void> {
    return this.engine.notifyOrderPlaced(userId, orderId);
  }

  notifyPaymentSuccess(userId: string, orderId: string): Promise<void> {
    return this.engine.notifyPaymentSuccess(userId, orderId);
  }

  notifyPaymentFailed(userId: string, orderId: string, reason?: string): Promise<void> {
    return this.engine.notifyPaymentFailed(userId, orderId, reason);
  }
}
