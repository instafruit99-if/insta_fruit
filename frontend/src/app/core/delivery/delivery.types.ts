import { DeliverySlotId } from './delivery-config.constants';

export interface DeliveryQuote {
  subtotal: number;
  deliveryFee: number;
  total: number;
  freeDeliveryApplied: boolean;
  freeDeliveryThresholdInr: number;
  amountToFreeDelivery: number;
  minimumOrderAmountInr: number;
  meetsMinimumOrder: boolean;
}

export interface DeliverySlotOption {
  id: DeliverySlotId;
  label: string;
  available: boolean;
  isNextAvailable?: boolean;
}

export interface DeliveryEstimate {
  estimatedArrivalTime: Date;
  estimatedDeliveryTime: string;
  estimatedPreparationTimeMinutes: number;
}

export interface CheckoutDeliveryValidationInput {
  subtotal: number;
  pincode: string;
  deliverySlot: string;
}

export interface OrderDeliveryFields {
  deliveryFee: number;
  deliverySlot: string;
  estimatedArrivalTime: Date;
  estimatedDeliveryTime: string;
  estimatedPreparationTime: number;
  deliveryEligible: boolean;
}
