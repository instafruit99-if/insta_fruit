import { Injectable, inject } from '@angular/core';
import { DeliveryEligibilityService } from '../address/delivery-eligibility.service';
import { DELIVERY_CONFIG } from './delivery-config.constants';
import { DeliveryFeeService, calculateDeliveryFee } from './delivery-fee.service';
import { DeliverySlotService } from './delivery-slot.service';
import {
  CheckoutDeliveryValidationInput,
  DeliveryEstimate,
  DeliveryQuote,
  DeliverySlotOption,
  OrderDeliveryFields,
} from './delivery.types';
import { deliveryError, DELIVERY_ERROR_MESSAGES } from './delivery-errors';
import { validateMinimumOrder } from './delivery-validation';
import { DeliverySlotId } from './delivery-config.constants';

/** Pure builder for order transaction — keeps fee logic centralized. */
export function buildOrderDeliveryFields(
  subtotal: number,
  deliverySlot: string,
  deliveryEligible: boolean,
  now = new Date(),
): OrderDeliveryFields {
  const slotSvc = new DeliverySlotService();
  const slotId = slotSvc.validateSelection(deliverySlot, now);
  const estimate = buildDeliveryEstimate(slotId, now);
  return {
    deliveryFee: calculateDeliveryFee(subtotal),
    deliverySlot: slotId,
    estimatedArrivalTime: estimate.estimatedArrivalTime,
    estimatedDeliveryTime: estimate.estimatedDeliveryTime,
    estimatedPreparationTime: estimate.estimatedPreparationTimeMinutes,
    deliveryEligible,
  };
}

export function buildDeliveryEstimate(slotId: DeliverySlotId, now = new Date()): DeliveryEstimate {
  const slotSvc = new DeliverySlotService();
  const prep = DELIVERY_CONFIG.estimatedPreparationTimeMinutes;
  const readyAt = new Date(now.getTime() + prep * 60_000);
  const slotStart = slotSvc.slotStartDate(slotId, now);
  const arrival = readyAt > slotStart ? readyAt : slotStart;
  arrival.setMinutes(arrival.getMinutes() + DELIVERY_CONFIG.estimatedDeliveryWindowMinutes);

  return {
    estimatedArrivalTime: arrival,
    estimatedDeliveryTime: slotSvc.formatLabel(slotId),
    estimatedPreparationTimeMinutes: prep,
  };
}

@Injectable({ providedIn: 'root' })
export class DeliveryEngineService {
  private readonly fees = inject(DeliveryFeeService);
  private readonly slots = inject(DeliverySlotService);
  private readonly eligibility = inject(DeliveryEligibilityService);

  quoteCheckout(subtotal: number): DeliveryQuote {
    return this.fees.quote(subtotal);
  }

  getAvailableSlots(now = new Date()): DeliverySlotOption[] {
    return this.slots.getAvailableSlots(now);
  }

  defaultSlot(now = new Date()): DeliverySlotId {
    return this.slots.defaultSlot(now);
  }

  formatSlotLabel(slotId: DeliverySlotId): string {
    return this.slots.formatLabel(slotId);
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
    this.slots.validateSelection(input.deliverySlot, now);
    return this.fees.quote(input.subtotal);
  }

  buildOrderFields(
    subtotal: number,
    deliverySlot: string,
    pincode: string,
    now = new Date(),
  ): OrderDeliveryFields {
    const eligibility = this.eligibility.check(pincode);
    if (!eligibility.serviceable) {
      throw deliveryError('NOT_AVAILABLE', eligibility.message);
    }
    validateMinimumOrder(subtotal);
    return buildOrderDeliveryFields(subtotal, deliverySlot, true, now);
  }

  static toUserMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return DELIVERY_ERROR_MESSAGES.CALCULATION_FAILED;
  }
}
