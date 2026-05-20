import { AddressLabelType, SavedAddressInput } from './address.types';
import { addressError } from './address-errors';

const LABELS: AddressLabelType[] = ['home', 'work', 'other'];
const PHONE_RE = /^[6-9]\d{9}$/;
const PINCODE_RE = /^\d{6}$/;

function trim(value: string): string {
  return value.trim();
}

export function normalizeLabel(value: string): AddressLabelType {
  const lower = value.trim().toLowerCase();
  if (lower === 'home' || lower === 'work' || lower === 'other') {
    return lower;
  }
  if (lower.includes('work')) return 'work';
  if (lower.includes('other')) return 'other';
  return 'home';
}

export function validatePincode(pincode: string): void {
  if (!PINCODE_RE.test(trim(pincode))) {
    throw addressError('INVALID_PINCODE');
  }
}

export function validatePhone(phone: string): void {
  const digits = trim(phone).replace(/\D/g, '').slice(-10);
  if (!PHONE_RE.test(digits)) {
    throw addressError('INVALID_PHONE');
  }
}

export function validateSavedAddressInput(input: SavedAddressInput): SavedAddressInput {
  const label = LABELS.includes(input.label) ? input.label : normalizeLabel(String(input.label));
  const fullName = trim(input.fullName);
  const addressLine1 = trim(input.addressLine1);
  const city = trim(input.city);
  const state = trim(input.state);
  const pincode = trim(input.pincode);
  const country = trim(input.country ?? 'India') || 'India';

  if (!fullName || !addressLine1 || !city || !state) {
    throw addressError('ADDRESS_REQUIRED');
  }

  validatePincode(pincode);
  validatePhone(input.phone);

  return {
    label,
    fullName,
    phone: trim(input.phone).replace(/\D/g, '').slice(-10),
    addressLine1,
    addressLine2: input.addressLine2?.trim() || '',
    landmark: input.landmark?.trim() || '',
    city,
    state,
    pincode,
    country,
    isDefault: input.isDefault,
  };
}
