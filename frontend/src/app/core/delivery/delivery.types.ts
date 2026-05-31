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

export interface DeliveryEstimate {
  estimatedArrivalTime: Date;
  estimatedDeliveryTime: string;
  estimatedPreparationTimeMinutes: number;
}

export interface CheckoutDeliveryValidationInput {
  subtotal: number;
  pincode: string;
}

export interface OrderDeliveryFields {
  deliveryFee: number;
  estimatedArrivalTime: Date;
  estimatedDeliveryTime: string;
  estimatedPreparationTime: number;
  deliveryEligible: boolean;
}
