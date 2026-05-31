export type RateLimitAction = 'checkout' | 'cart_update' | 'order_status_update';

export interface RateLimitRule {
  maxAttempts: number;
  windowMinutes: number;
}

export const RATE_LIMIT_RULES: Record<RateLimitAction, RateLimitRule> = {
  checkout: { maxAttempts: 5, windowMinutes: 1 },
  cart_update: { maxAttempts: 20, windowMinutes: 1 },
  order_status_update: { maxAttempts: 20, windowMinutes: 1 },
};

export type AuditAction =
  | 'order_status_updated'
  | 'order_cancelled';

export interface AuditLogEntry {
  action: AuditAction;
  orderId: string;
  from: string;
  to: string;
  by: string;
  at: ReturnType<typeof import('@angular/fire/firestore').serverTimestamp>;
  reason?: string;
}

export interface CreateOrderSecurityInput {
  userName: string;
  userPhone: string;
  paymentMethod: string;
  address: {
    label: string;
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}
