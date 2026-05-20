export const NOTIFICATION_TYPES = [
  'ORDER_PLACED',
  'ORDER_ACCEPTED',
  'ORDER_PREPARING',
  'ORDER_PACKED',
  'ORDER_OUT_FOR_DELIVERY',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'ADMIN_NEW_ORDER',
  'SYSTEM_NOTIFICATION',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}
