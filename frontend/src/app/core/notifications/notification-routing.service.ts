import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AppNotification } from './notification.types';

@Injectable({ providedIn: 'root' })
export class NotificationRoutingService {
  resolveRoute(notification: Pick<AppNotification, 'route' | 'relatedOrderId' | 'orderId'>): string {
    if (notification.route?.trim()) {
      return notification.route;
    }
    const orderId = notification.relatedOrderId ?? notification.orderId;
    if (orderId) {
      return `/track-order/${orderId}`;
    }
    return '/notifications';
  }

  navigate(router: Router, notification: Pick<AppNotification, 'route' | 'relatedOrderId' | 'orderId'>): void {
    const route = this.resolveRoute(notification);
    void router.navigateByUrl(route);
  }
}
