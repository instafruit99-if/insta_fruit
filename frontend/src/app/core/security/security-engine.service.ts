import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { RateLimiterService } from './rate-limiter.service';
import { RequestLockService } from './request-lock.service';
import { CreateOrderSecurityInput } from './security.types';
import { validateCreateOrderInput, validateCancelReason, validateOrderId } from './security-validation';
import { SecurityError, securityError } from './security-errors';

@Injectable({ providedIn: 'root' })
export class SecurityEngineService {
  private readonly auth = inject(Auth);
  private readonly rateLimiter = inject(RateLimiterService);
  private readonly requestLock = inject(RequestLockService);

  requireAuthUid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      throw securityError('UNAUTHORIZED');
    }
    return uid;
  }

  async guardCheckout<T>(fn: () => Promise<T>, input: CreateOrderSecurityInput): Promise<T> {
    const uid = this.requireAuthUid();
    validateCreateOrderInput(input);
    this.rateLimiter.assertAllowed('checkout', uid);
    return this.requestLock.runExclusive(`checkout:${uid}`, fn);
  }

  guardCartMutation(uid: string): void {
    this.requireAuthUid();
    if (this.auth.currentUser?.uid !== uid) {
      throw securityError('UNAUTHORIZED');
    }
    this.rateLimiter.assertAllowed('cart_update', uid);
  }

  async guardOrderStatusUpdate<T>(fn: () => Promise<T>): Promise<T> {
    const uid = this.requireAuthUid();
    this.rateLimiter.assertAllowed('order_status_update', uid);
    return this.requestLock.runExclusive(`order_status:${uid}`, fn);
  }

  async guardOrderCancel<T>(orderId: string, reason: string, fn: () => Promise<T>): Promise<T> {
    validateOrderId(orderId);
    validateCancelReason(reason);
    return this.guardOrderStatusUpdate(fn);
  }

  isCheckoutLocked(): boolean {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return false;
    return this.requestLock.isLocked(`checkout:${uid}`);
  }

  static toUserMessage(error: unknown): string {
    if (error instanceof SecurityError) {
      return error.message;
    }
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return 'Please try again later';
  }
}
