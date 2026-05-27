import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaymentEngineService } from '../payment/payment-engine.service';
import { CheckoutPaymentInput, CheckoutPaymentResult } from '../payment/payment.types';
import { PaymentError } from '../payment/payment-errors';
import {
  CreateOrderRequest,
  CreateOrderResponse,
  OpenRazorpayCheckoutInput,
} from '../payment/payment-api.types';
import { RazorpaySuccess } from './razorpay.service';

/**
 * Payment API — backend Razorpay order creation + checkout popup,
 * and existing checkout flow via PaymentEngineService.
 */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly engine = inject(PaymentEngineService);

  createOrder(request: CreateOrderRequest): Observable<CreateOrderResponse> {
    return new Observable((subscriber) => {
      this.authHeaders()
        .then((headers) =>
          firstValueFrom(
            this.http.post<CreateOrderResponse>(
              `${environment.apiUrl}/api/payment/create-order`,
              request,
              { headers },
            ),
          ),
        )
        .then((response) => {
          subscriber.next(response);
          subscriber.complete();
        })
        .catch((error) => subscriber.error(error));
    });
  }

  openRazorpayCheckout(input: OpenRazorpayCheckoutInput): void {
    if (!window.Razorpay) {
      throw new Error('Razorpay checkout script is not loaded');
    }

    const instance = new window.Razorpay({
      key: environment.razorpayKeyId,
      amount: input.amount,
      currency: input.currency as 'INR',
      order_id: input.orderId,
      name: input.name ?? 'InstaFruit',
      description: input.description ?? 'InstaFruit order payment',
      theme: { color: '#08B44D' },
      handler: (response: RazorpaySuccess) => input.onSuccess(response),
    });

    instance.open();
  }

  /** Demo flow requires a real Firestore order id (use checkout for end-to-end payment). */
  async runDemoPayment(orderId: string): Promise<void> {
    const order = await firstValueFrom(this.createOrder({ orderId }));

    this.openRazorpayCheckout({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      name: 'InstaFruit',
      description: 'Demo payment',
      onSuccess: (response) => console.log('Razorpay payment success:', response),
    });
  }

  isPaymentInProgress(): boolean {
    return this.engine.isPaymentInProgress();
  }

  processCheckout(input: CheckoutPaymentInput): Promise<CheckoutPaymentResult> {
    return this.engine.processCheckout(input);
  }

  static toUserMessage(error: unknown): string {
    if (error instanceof PaymentError) {
      return error.message;
    }
    return PaymentEngineService.toUserMessage(error);
  }

  private async authHeaders(): Promise<{ Authorization: string }> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('Sign in required');
    }
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }
}
