import { DeliveryZone } from './address.types';

/**
 * Raipur (Chhattisgarh) district — extended pincodes outside the 492xxx series.
 * All 492000–492999 are serviceable via {@link isRaipurDistrictPincode}.
 */
export const RAIPUR_EXTENDED_PINCODES: readonly string[] = [
  '493111', '493114', '493116', '493195', '493221', '493225',
  '493441', '493661', '493881', '493885',
  '494001', '494010', '494111', '494114', '494115',
  '494221', '494222', '494223',
  '494331', '494332', '494333', '494334', '494335', '494336', '494337',
  '494347', '494444', '494446', '494447', '494448', '494670',
];

/** @deprecated Use {@link isRaipurDistrictPincode} — kept for explicit lookups. */
export const SUPPORTED_PINCODES: readonly string[] = [
  '492001', '492002', '492003', '492004', '492005', '492008', '492009',
  '492010', '492012', '492013', '492014', '492015', '492016', '492017',
  '492018', '492099', '492101',
  ...RAIPUR_EXTENDED_PINCODES,
];

/** True for any Raipur district pincode (492xxx + listed 493/494 offices). */
export function isRaipurDistrictPincode(pincode: string): boolean {
  const p = pincode.trim();
  if (!/^\d{6}$/.test(p)) return false;
  if (p.startsWith('492')) return true;
  return (RAIPUR_EXTENDED_PINCODES as readonly string[]).includes(p);
}

/** Future-ready zone config for hyperlocal delivery. */
export const DELIVERY_ZONES: readonly DeliveryZone[] = [
  {
    id: 'raipur-district',
    name: 'Raipur',
    city: 'Raipur',
    state: 'Chhattisgarh',
    pincodes: [...SUPPORTED_PINCODES],
    baseDeliveryFeeInr: 25,
    maxRadiusKm: 15,
  },
];

export const MAX_SAVED_ADDRESSES = 10;
