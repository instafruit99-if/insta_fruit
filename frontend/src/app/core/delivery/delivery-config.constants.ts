/** Central delivery business configuration (future: load from Firestore `deliveryConfig`). */
export const DELIVERY_CONFIG = {
  defaultDeliveryFeeInr: 25,
  freeDeliveryThresholdInr: 499,
  minimumOrderAmountInr: 50,
  estimatedPreparationTimeMinutes: 20,
  /** Average last-mile delivery time after preparation. */
  estimatedDeliveryWindowMinutes: 30,
} as const;

/** @deprecated Use {@link DELIVERY_CONFIG.defaultDeliveryFeeInr} */
export const DEFAULT_DELIVERY_FEE_INR = DELIVERY_CONFIG.defaultDeliveryFeeInr;
