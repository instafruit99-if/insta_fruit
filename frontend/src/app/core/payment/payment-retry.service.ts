import { Injectable } from '@angular/core';
import { paymentError } from './payment-errors';

const MAX_RETRIES_PER_ORDER = 3;
const RETRY_COOLDOWN_MS = 5_000;

@Injectable({ providedIn: 'root' })
export class PaymentRetryService {
  private readonly attempts = new Map<string, number[]>();

  assertCanRetry(orderId: string): void {
    const now = Date.now();
    const recent = (this.attempts.get(orderId) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= MAX_RETRIES_PER_ORDER) {
      throw paymentError('RETRY_LIMIT');
    }
    const last = recent[recent.length - 1];
    if (last && now - last < RETRY_COOLDOWN_MS) {
      throw paymentError('ALREADY_PROCESSING');
    }
    recent.push(now);
    this.attempts.set(orderId, recent);
  }

  clear(orderId: string): void {
    this.attempts.delete(orderId);
  }
}
