import { Injectable, inject } from '@angular/core';
import { DeliveryEligibilityService } from '../address/delivery-eligibility.service';
import { DELIVERY_CONFIG } from './delivery-config.constants';
import { DeliveryFeeService, calculateDeliveryFee } from './delivery-fee.service';
import {
  CheckoutDeliveryValidationInput,
  DeliveryEstimate,
  DeliveryQuote,
  OrderDeliveryFields,
} from './delivery.types';
import { deliveryError, DELIVERY_ERROR_MESSAGES } from './delivery-errors';
import { validateMinimumOrder } from './delivery-validation';

/** Pure builder for order transaction — keeps fee logic centralized. */
export function buildOrderDeliveryFields(
  subtotal: number,
  deliveryEligible: boolean,
  now = new Date(),
): OrderDeliveryFields {
  const estimate = buildDeliveryEstimate(now);
  return {
    deliveryFee: calculateDeliveryFee(subtotal),
    estimatedArrivalTime: estimate.estimatedArrivalTime,
    estimatedDeliveryTime: estimate.estimatedDeliveryTime,
    estimatedPreparationTime: estimate.estimatedPreparationTimeMinutes,
    deliveryEligible,
  };
}

export function buildDeliveryEstimate(now = new Date()): DeliveryEstimate {
  const totalMinutes =
    DELIVERY_CONFIG.estimatedPreparationTimeMinutes +
    DELIVERY_CONFIG.estimatedDeliveryWindowMinutes;
  const arrival = new Date(now.getTime() + totalMinutes * 60_000);
  return {
    estimatedArrivalTime: arrival,
    estimatedDeliveryTime: '',
    estimatedPreparationTimeMinutes: DELIVERY_CONFIG.estimatedPreparationTimeMinutes,
  };
}

@Injectable({ providedIn: 'root' })
export class DeliveryEngineService {
  private readonly fees = inject(DeliveryFeeService);
  private readonly eligibility = inject(DeliveryEligibilityService);

  quoteCheckout(subtotal: number): DeliveryQuote {
    return this.fees.quote(subtotal);
  }

  freeDeliveryMessage(quote: DeliveryQuote): string | null {
    if (quote.freeDeliveryApplied) {
      return 'Free delivery applied on this order.';
    }
    if (quote.subtotal > 0 && quote.amountToFreeDelivery > 0) {
      return `Add ₹${quote.amountToFreeDelivery.toFixed(0)} more for free delivery.`;
    }
    return null;
  }

  validateCheckout(input: CheckoutDeliveryValidationInput, now = new Date()): DeliveryQuote {
    validateMinimumOrder(input.subtotal);
    const eligibility = this.eligibility.check(input.pincode);
    if (!eligibility.serviceable) {
      throw deliveryError('NOT_AVAILABLE', eligibility.message);
    }
    return this.fees.quote(input.subtotal);
  }

  buildOrderFields(
    subtotal: number,
    pincode: string,
    now = new Date(),
  ): OrderDeliveryFields {
    const eligibility = this.eligibility.check(pincode);
    if (!eligibility.serviceable) {
      throw deliveryError('NOT_AVAILABLE', eligibility.message);
    }
    validateMinimumOrder(subtotal);
    return buildOrderDeliveryFields(subtotal, true, now);
  }

  static toUserMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return DELIVERY_ERROR_MESSAGES.CALCULATION_FAILED;
  }
}
