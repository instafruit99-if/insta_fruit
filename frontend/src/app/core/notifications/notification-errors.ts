export const NOTIFICATION_ERROR_MESSAGES = {
  LOAD_FAILED: 'Notification load failed.',
  ALREADY_EXISTS: 'Notification already exists.',
  MARK_READ_FAILED: 'Failed to mark notification as read.',
  INVALID_REQUEST: 'Invalid notification request.',
} as const;

export type NotificationErrorCode = keyof typeof NOTIFICATION_ERROR_MESSAGES;

export class NotificationError extends Error {
  readonly code: NotificationErrorCode;

  constructor(code: NotificationErrorCode, message?: string) {
    super(message ?? NOTIFICATION_ERROR_MESSAGES[code]);
    this.name = 'NotificationError';
    this.code = code;
  }
}
