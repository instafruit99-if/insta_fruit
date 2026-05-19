import { Injectable } from '@angular/core';
import { securityError } from './security-errors';

@Injectable({ providedIn: 'root' })
export class RequestLockService {
  private readonly locks = new Map<string, Promise<unknown>>();

  async runExclusive<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.locks.get(lockKey);
    if (existing) {
      throw securityError('REQUEST_IN_PROGRESS');
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
