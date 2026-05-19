import { Injectable } from '@angular/core';
import { RateLimitAction, RATE_LIMIT_RULES } from './security.types';
import { securityError } from './security-errors';

@Injectable({ providedIn: 'root' })
export class RateLimiterService {
  private readonly attempts = new Map<string, number[]>();

  assertAllowed(action: RateLimitAction, scopeKey: string): void {
    const rule = RATE_LIMIT_RULES[action];
    const key = `${action}:${scopeKey}`;
    const windowMs = rule.windowMinutes * 60 * 1000;
    const now = Date.now();
    const recent = (this.attempts.get(key) ?? []).filter((t) => now - t < windowMs);

    if (recent.length >= rule.maxAttempts) {
      throw securityError('RATE_LIMITED');
    }

    recent.push(now);
    this.attempts.set(key, recent);
  }

  reset(action: RateLimitAction, scopeKey: string): void {
    this.attempts.delete(`${action}:${scopeKey}`);
  }
}
