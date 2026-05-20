import { Injectable } from '@angular/core';
import { DELIVERY_CONFIG } from './delivery-config.constants';
import { DeliveryQuote } from './delivery.types';
import { validateSubtotalForQuote } from './delivery-validation';

/** Pure fee calculation — safe for order transaction engine. */
export function calculateDeliveryFee(subtotal: number): number {
  validateSubtotalForQuote(subtotal);
  if (subtotal >= DELIVERY_CONFIG.freeDeliveryThresholdInr) {
    return 0;
  }
  return DELIVERY_CONFIG.defaultDeliveryFeeInr;
}

@Injectable({ providedIn: 'root' })
export class DeliveryFeeService {
  quote(subtotal: number): DeliveryQuote {
    validateSubtotalForQuote(subtotal);
    const deliveryFee = calculateDeliveryFee(subtotal);
    const freeDeliveryApplied = deliveryFee === 0 && subtotal > 0;
    const amountToFreeDelivery = Math.max(
      0,
      +(DELIVERY_CONFIG.freeDeliveryThresholdInr - subtotal).toFixed(2),
    );
    return {
      subtotal: +subtotal.toFixed(2),
      deliveryFee,
      total: +(subtotal + deliveryFee).toFixed(2),
      freeDeliveryApplied,
      freeDeliveryThresholdInr: DELIVERY_CONFIG.freeDeliveryThresholdInr,
      amountToFreeDelivery,
      minimumOrderAmountInr: DELIVERY_CONFIG.minimumOrderAmountInr,
      meetsMinimumOrder: subtotal >= DELIVERY_CONFIG.minimumOrderAmountInr,
    };
  }
}
