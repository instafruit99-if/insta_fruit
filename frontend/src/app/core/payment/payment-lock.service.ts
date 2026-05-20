import { Injectable } from '@angular/core';
import { paymentError } from './payment-errors';

@Injectable({ providedIn: 'root' })
export class PaymentLockService {
  private readonly locks = new Map<string, Promise<unknown>>();

  async runExclusive<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
    if (this.locks.has(lockKey)) {
      throw paymentError('DUPLICATE_BLOCKED');
    }
    const run = fn();
    this.locks.set(lockKey, run);
    try {
      return await run;
    } finally {
      if (this.locks.get(lockKey) === run) {
        this.locks.delete(lockKey);
      }
    }
  }

  isLocked(lockKey: string): boolean {
    return this.locks.has(lockKey);
  }
}
