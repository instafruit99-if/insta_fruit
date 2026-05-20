import { DELIVERY_CONFIG } from './delivery-config.constants';
import { deliveryError } from './delivery-errors';

export function validateMinimumOrder(subtotal: number): void {
  if (!Number.isFinite(subtotal) || subtotal < DELIVERY_CONFIG.minimumOrderAmountInr) {
    throw deliveryError('MINIMUM_ORDER');
  }
}

export function validateSubtotalForQuote(subtotal: number): void {
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw deliveryError('CALCULATION_FAILED');
  }
}
