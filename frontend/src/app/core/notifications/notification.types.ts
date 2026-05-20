import { Timestamp } from '@angular/fire/firestore';
import { NotificationType } from './notification-types.enum';

/** Firestore document (supports legacy fields). */
export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedOrderId: string | null;
  /** Legacy field — kept for existing UI compatibility. */
  orderId?: string | null;
  isRead: boolean;
  route: string;
  deduplicationKey: string;
  createdAt?: Timestamp | Date;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedOrderId?: string | null;
  deduplicationKey: string;
  route?: string;
}

/** Future FCM payload extension point. */
export interface FcmNotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}
