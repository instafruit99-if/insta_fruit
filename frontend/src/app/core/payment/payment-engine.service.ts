import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { RazorpayService } from '../services/razorpay.service';
import { PaymentLifecycleStatus } from './payment-state.enum';
import { CheckoutPaymentInput, CheckoutPaymentResult } from './payment.types';
import { PaymentError, paymentError, PAYMENT_ERROR_MESSAGES } from './payment-errors';
import { PaymentLockService } from './payment-lock.service';
import { PaymentRetryService } from './payment-retry.service';
import {
  normalizePaymentStatus,
  validateCheckoutPaymentInput,
  validatePaymentTransition,
} from './payment-validation';

interface CreateRazorpayInput { orderId: string; amount: number; currency?: 'INR'; }
interface CreateRazorpayResult { razorpayOrderId: string; amount: number; currency: 'INR'; }
interface VerifyRazorpayInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  orderId: string;
}

/**
 * Centralized payment lifecycle engine.
 * Isolated for future webhook / Cloud Function migration.
 */
@Injectable({ providedIn: 'root' })
export class PaymentEngineService {
  private readonly db = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly fns = inject(Functions);
  private readonly razorpay = inject(RazorpayService);
  private readonly lock = inject(PaymentLockService);
  private readonly retry = inject(PaymentRetryService);

  isPaymentInProgress(): boolean {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return false;
    return this.lock.isLocked(`checkout-payment:${uid}`);
  }

  async processCheckout(input: CheckoutPaymentInput): Promise<CheckoutPaymentResult> {
    const uid = this.auth.currentUser?.uid;
    if (!uid || uid !== input.userId) {
      throw paymentError('INVALID_REQUEST');
    }
    validateCheckoutPaymentInput(input.orderId, input.userId, input.amount, input.method);

    return this.lock.runExclusive(`checkout-payment:${uid}`, async () => {
      await this.assertOrderOwnership(input.orderId, input.userId);

      if (input.method === 'cod') {
        const paymentId = await this.createPaymentDoc({
          orderId: input.orderId,
          userId: input.userId,
          method: 'cod',
          amount: input.amount,
          status: 'pending',
        });
        return { orderId: input.orderId, completed: true, paymentId };
      }

      return this.processRazorpay(input);
    });
  }

  private async processRazorpay(input: CheckoutPaymentInput): Promise<CheckoutPaymentResult> {
    this.retry.assertCanRetry(input.orderId);

    let razorpayOrderId: string | undefined;
    try {
      const rzpOrder = await this.createRazorpayOrderCallable({
        orderId: input.orderId,
        amount: input.amount,
        currency: 'INR',
      });
      razorpayOrderId = rzpOrder.razorpayOrderId;

      await this.updatePaymentStatus(razorpayOrderId, 'processing');

      const success = await this.razorpay.openCheckout({
        razorpayOrderId: rzpOrder.razorpayOrderId,
        amountInr: rzpOrder.amount,
        orderId: input.orderId,
      });

      await this.verifyRazorpayPaymentCallable({
        razorpayOrderId: success.razorpay_order_id,
        razorpayPaymentId: success.razorpay_payment_id,
        razorpaySignature: success.razorpay_signature,
        orderId: input.orderId,
      });

      this.retry.clear(input.orderId);
      return { orderId: input.orderId, completed: true, paymentId: razorpayOrderId };
    } catch (error) {
      const reason = error instanceof Error ? error.message : PAYMENT_ERROR_MESSAGES.PAYMENT_FAILED;
      if (razorpayOrderId) {
        await this.markPaymentFailed(razorpayOrderId, reason);
      }
      if (error instanceof PaymentError) {
        throw error;
      }
      if (reason.toLowerCase().includes('cancel')) {
        throw paymentError('PAYMENT_FAILED', 'Payment cancelled.');
      }
      throw paymentError('PAYMENT_FAILED', reason);
    }
  }

  private async createPaymentDoc(params: {
    orderId: string;
    userId: string;
    method: 'cod' | 'razorpay';
    amount: number;
    status: PaymentLifecycleStatus;
  }): Promise<string> {
    const ref = doc(collection(this.db, 'payments'));
    await setDoc(ref, {
      paymentId: ref.id,
      orderId: params.orderId,
      userId: params.userId,
      method: params.method,
      status: params.status,
      amount: params.amount,
      currency: 'INR',
      failureReason: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  private async updatePaymentStatus(
    paymentId: string,
    to: PaymentLifecycleStatus,
    failureReason?: string,
  ): Promise<void> {
    const ref = doc(this.db, `payments/${paymentId}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw paymentError('ORDER_NOT_FOUND');
    }
    const from = normalizePaymentStatus(snap.data()['status'] as string | undefined);
    validatePaymentTransition(from, to);
    if (to === 'success') {
      throw paymentError('VALIDATION_FAILED');
    }
    await updateDoc(ref, {
      status: to,
      updatedAt: serverTimestamp(),
      ...(failureReason !== undefined ? { failureReason } : {}),
    });
  }

  private async markPaymentFailed(paymentId: string, reason: string): Promise<void> {
    try {
      const ref = doc(this.db, `payments/${paymentId}`);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const from = normalizePaymentStatus(snap.data()['status'] as string | undefined);
      const target: PaymentLifecycleStatus =
        /cancel/i.test(reason) && from === 'pending' ? 'cancelled' : 'failed';
      if (!canMarkFailed(from, target)) return;
      await updateDoc(ref, {
        status: target,
        failureReason: reason,
        updatedAt: serverTimestamp(),
      });
    } catch {
      /* non-blocking */
    }
  }

  private async assertOrderOwnership(orderId: string, userId: string): Promise<void> {
    const snap = await getDoc(doc(this.db, `orders/${orderId}`));
    if (!snap.exists()) {
      throw paymentError('ORDER_NOT_FOUND');
    }
    if (snap.data()['userId'] !== userId) {
      throw paymentError('INVALID_REQUEST');
    }
    if (snap.data()['paymentStatus'] === 'success') {
      throw paymentError('DUPLICATE_BLOCKED');
    }
  }

  private createRazorpayOrderCallable(input: CreateRazorpayInput): Promise<CreateRazorpayResult> {
    const fn = httpsCallable<CreateRazorpayInput, CreateRazorpayResult>(this.fns, 'createRazorpayOrder');
    return fn(input).then((r) => r.data);
  }

  private verifyRazorpayPaymentCallable(
    input: VerifyRazorpayInput,
  ): Promise<{ success: boolean }> {
    const fn = httpsCallable<VerifyRazorpayInput, { success: boolean }>(
      this.fns,
      'verifyRazorpayPayment',
    );
    return fn(input).then((r) => r.data);
  }

  static toUserMessage(error: unknown): string {
    if (error instanceof PaymentError) {
      return error.message;
    }
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return PAYMENT_ERROR_MESSAGES.PAYMENT_FAILED;
  }
}

function canMarkFailed(from: PaymentLifecycleStatus, to: PaymentLifecycleStatus): boolean {
  try {
    validatePaymentTransition(from, to);
    return true;
  } catch {
    return false;
  }
}
