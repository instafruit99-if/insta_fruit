import { Injectable } from '@angular/core';
import { AppNotification } from './notification.types';

/** Max notifications loaded per user (prevents unbounded reads). */
export const NOTIFICATION_LOAD_LIMIT = 100;

/** Future server-side cleanup threshold (days). */
export const NOTIFICATION_RETENTION_DAYS = 90;

@Injectable({ providedIn: 'root' })
export class NotificationCleanupService {
  trimForDisplay(notifications: AppNotification[]): AppNotification[] {
    return notifications.slice(0, NOTIFICATION_LOAD_LIMIT);
  }

  /**
   * Returns IDs eligible for future batch cleanup (not executed client-side by default).
   */
  findStaleIds(notifications: AppNotification[], maxAgeDays = NOTIFICATION_RETENTION_DAYS): string[] {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    return notifications
      .filter((n) => {
        const created = n.createdAt;
        if (!created) return false;
        const ms =
          typeof (created as { toMillis?: () => number }).toMillis === 'function'
            ? (created as { toMillis: () => number }).toMillis()
            : new Date(created as Date).getTime();
        return ms < cutoff;
      })
      .map((n) => n.id);
  }
}
