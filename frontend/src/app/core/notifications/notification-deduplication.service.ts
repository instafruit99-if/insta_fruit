import { Injectable } from '@angular/core';

const DEDUP_TTL_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class NotificationDeduplicationService {
  private readonly keys = new Map<string, number>();

  shouldCreate(deduplicationKey: string): boolean {
    const now = Date.now();
    const last = this.keys.get(deduplicationKey);
    if (last !== undefined && now - last < DEDUP_TTL_MS) {
      return false;
    }
    return true;
  }

  markCreated(deduplicationKey: string): void {
    this.keys.set(deduplicationKey, Date.now());
  }

  buildOrderStatusKey(userId: string, orderId: string, type: string): string {
    return `order:${userId}:${orderId}:${type}`;
  }

  buildPaymentKey(userId: string, orderId: string, type: string): string {
    return `payment:${userId}:${orderId}:${type}`;
  }

  buildAdminOrderKey(orderId: string, type: string): string {
    return `admin:${orderId}:${type}`;
  }
}
