import { DeliveryZone } from './address.types';

/**
 * Supported 6-digit pincodes (extend per city rollout).
 * Future: load from Firestore `deliveryZones` collection.
 */
export const SUPPORTED_PINCODES: readonly string[] = [
  '560001', '560002', '560003', '560004', '560005',
  '560008', '560009', '560010', '560011', '560016',
  '560017', '560025', '560027', '560029', '560030',
  '560034', '560037', '560038', '560043', '560047',
  '560048', '560066', '560068', '560070', '560076',
  '560078', '560095', '560100', '560102', '560103',
];

/** Future-ready zone config for hyperlocal delivery. */
export const DELIVERY_ZONES: readonly DeliveryZone[] = [
  {
    id: 'blr-central',
    name: 'Bangalore Central',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincodes: [...SUPPORTED_PINCODES],
    baseDeliveryFeeInr: 25,
    maxRadiusKm: 8,
  },
];

export const MAX_SAVED_ADDRESSES = 10;
