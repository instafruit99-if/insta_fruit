import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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
import { environment } from '../../../environments/environment';
import { RazorpayService } from '../services/razorpay.service';
import {
  CreateOrderResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
} from './payment-api.types';
import { NotificationService } from '../services/notification.service';
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
 * Razorpay checkout lifecycle via Node.js backend APIs.
 */
@Injectable({ providedIn: 'root' })
export class PaymentEngineService {
  private readonly db = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly http = inject(HttpClient);
  private readonly razorpay = inject(RazorpayService);
  private readonly notifications = inject(NotificationService);
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

  private razorpayChargeAmount(cartAmountInr: number): number {
    const testAmount = environment.razorpayTestAmountInr;
    return testAmount != null ? testAmount : cartAmountInr;
  }

  private async processRazorpay(input: CheckoutPaymentInput): Promise<CheckoutPaymentResult> {
    this.retry.assertCanRetry(input.orderId);
    const chargeAmount = this.razorpayChargeAmount(input.amount);

    let razorpayOrderId: string | undefined;
    try {
      const rzpOrder = await this.createRazorpayOrderViaBackend({
        orderId: input.orderId,
        amount: chargeAmount,
        currency: 'INR',
      });
      razorpayOrderId = rzpOrder.razorpayOrderId;

      await this.createRazorpayPaymentDoc({
        razorpayOrderId: rzpOrder.razorpayOrderId,
        orderId: input.orderId,
        userId: input.userId,
        amount: chargeAmount,
      });

      await this.updatePaymentStatus(razorpayOrderId, 'processing');

      const success = await this.razorpay.openCheckout({
        razorpayOrderId: rzpOrder.razorpayOrderId,
        amountInr: chargeAmount,
        orderId: input.orderId,
      });

      await this.verifyRazorpayPaymentViaBackend({
        razorpayOrderId: success.razorpay_order_id,
        razorpayPaymentId: success.razorpay_payment_id,
        razorpaySignature: success.razorpay_signature,
        orderId: input.orderId,
      });

      this.retry.clear(input.orderId);
      void this.notifications.notifyPaymentSuccess(input.userId, input.orderId);
      return { orderId: input.orderId, completed: true, paymentId: razorpayOrderId };
    } catch (error) {
      const reason = error instanceof Error ? error.message : PAYMENT_ERROR_MESSAGES.PAYMENT_FAILED;
      void this.notifications.notifyPaymentFailed(input.userId, input.orderId, reason);
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

  private async createRazorpayOrderViaBackend(
    input: CreateRazorpayInput,
  ): Promise<CreateRazorpayResult> {
    const created = await firstValueFrom(
      this.http.post<CreateOrderResponse>(
        `${environment.apiUrl}/api/payment/create-order`,
        {
          amount: input.amount,
          currency: input.currency ?? 'INR',
          receipt: input.orderId,
        },
      ),
    );

    return {
      razorpayOrderId: created.id,
      amount: input.amount,
      currency: 'INR',
    };
  }

  private async createRazorpayPaymentDoc(params: {
    razorpayOrderId: string;
    orderId: string;
    userId: string;
    amount: number;
  }): Promise<void> {
    await setDoc(doc(this.db, `payments/${params.razorpayOrderId}`), {
      paymentId: params.razorpayOrderId,
      orderId: params.orderId,
      userId: params.userId,
      razorpayOrderId: params.razorpayOrderId,
      amount: params.amount,
      currency: 'INR',
      method: 'razorpay',
      status: 'pending',
      failureReason: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  private verifyRazorpayPaymentViaBackend(
    input: VerifyRazorpayInput,
  ): Promise<VerifyPaymentResponse> {
    const body: VerifyPaymentRequest = {
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
      razorpaySignature: input.razorpaySignature,
      orderId: input.orderId,
    };
    return firstValueFrom(
      this.http.post<VerifyPaymentResponse>(
        `${environment.apiUrl}/api/payment/verify`,
        body,
      ),
    );
  }

  static toUserMessage(error: unknown): string {
    if (error instanceof PaymentError) {
      return error.message;
    }
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: string } | null;
      if (body?.message?.trim()) {
        return body.message.trim();
      }
    }
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: string }).code)
        : '';
    if (code === 'internal') {
      return 'Payment service is unavailable. Check that the backend is running.';
    }
    if (error instanceof Error && error.message.trim()) {
      const msg = error.message.trim();
      if (msg === 'internal' || msg === 'Http failure response') {
        return 'Payment verification failed. Ensure the backend is running on port 5000.';
      }
      return msg;
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
