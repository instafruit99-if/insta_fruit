import { Injectable, inject } from '@angular/core';
import { PaymentEngineService } from '../payment/payment-engine.service';
import { CheckoutPaymentInput, CheckoutPaymentResult } from '../payment/payment.types';
import { PaymentError } from '../payment/payment-errors';

/**
 * Public payment API — delegates to PaymentEngineService.
 */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly engine = inject(PaymentEngineService);

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
}
