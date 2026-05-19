import { Timestamp } from '@angular/fire/firestore';
import { Address } from '../models';

export type AddressLabelType = 'home' | 'work' | 'other';

export interface SavedAddress {
  id: string;
  label: AddressLabelType;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
  /** Future: Google Maps / hyperlocal delivery. */
  coordinates?: { lat: number; lng: number };
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface SavedAddressInput {
  label: AddressLabelType;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  isDefault?: boolean;
}

export interface DeliveryZone {
  id: string;
  name: string;
  city: string;
  state: string;
  pincodes: string[];
  /** Future: dynamic fee by zone. */
  baseDeliveryFeeInr?: number;
  /** Future: max delivery radius km. */
  maxRadiusKm?: number;
}

export interface DeliveryEligibilityResult {
  serviceable: boolean;
  zoneId?: string;
  zoneName?: string;
  message: string;
}

export type { Address };
