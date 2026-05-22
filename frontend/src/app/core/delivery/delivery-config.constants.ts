/** Central delivery business configuration (future: load from Firestore `deliveryConfig`). */
export const DELIVERY_CONFIG = {
  defaultDeliveryFeeInr: 25,
  freeDeliveryThresholdInr: 499,
  minimumOrderAmountInr: 0,
  estimatedPreparationTimeMinutes: 20,
  /** Average last-mile delivery time after preparation. */
  estimatedDeliveryWindowMinutes: 30,
  supportedDeliverySlots: [
    '7AM-9AM',
    '9AM-11AM',
    '11AM-1PM',
    '1PM-3PM',
    '3PM-5PM',
    '5PM-7PM',
  ] as const,
} as const;

export type DeliverySlotId = (typeof DELIVERY_CONFIG.supportedDeliverySlots)[number];

/** @deprecated Use {@link DELIVERY_CONFIG.defaultDeliveryFeeInr} */
export const DEFAULT_DELIVERY_FEE_INR = DELIVERY_CONFIG.defaultDeliveryFeeInr;
