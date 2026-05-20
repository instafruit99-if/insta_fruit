import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Address, AppUser } from '../models';
import { SavedAddress, SavedAddressInput } from './address.types';
import { MAX_SAVED_ADDRESSES } from './address.constants';
import { addressError } from './address-errors';
import { normalizeLabel, validateSavedAddressInput } from './address-validation';
import { DeliveryEligibilityService } from './delivery-eligibility.service';

function newAddressId(): string {
  return crypto.randomUUID();
}

function validCoordinates(
  coords: SavedAddress['coordinates'],
): { lat: number; lng: number } | undefined {
  if (
    coords &&
    typeof coords.lat === 'number' &&
    typeof coords.lng === 'number' &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng)
  ) {
    return { lat: coords.lat, lng: coords.lng };
  }
  return undefined;
}

function ensureSingleDefault(list: SavedAddress[]): SavedAddress[] {
  if (list.length === 0) return list;
  const defaultIdx = list.findIndex((a) => a.isDefault);
  if (defaultIdx < 0) {
    return list.map((a, i) => ({ ...a, isDefault: i === 0 }));
  }
  return list.map((a, i) => ({ ...a, isDefault: i === defaultIdx }));
}

/** Firestore rejects `undefined` in nested maps — omit optional fields. */
function savedAddressToFirestore(saved: SavedAddress): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: saved.id,
    label: saved.label,
    fullName: saved.fullName,
    phone: saved.phone,
    addressLine1: saved.addressLine1,
    city: saved.city,
    state: saved.state,
    pincode: saved.pincode,
    country: saved.country,
    isDefault: saved.isDefault,
  };
  if (saved.addressLine2) row['addressLine2'] = saved.addressLine2;
  if (saved.landmark) row['landmark'] = saved.landmark;
  const coordinates = validCoordinates(saved.coordinates);
  if (coordinates) row['coordinates'] = coordinates;
  return row;
}

function defaultAddressToFirestore(saved: SavedAddress): Record<string, unknown> {
  const a = savedAddressToOrderAddress(saved);
  const row: Record<string, unknown> = {
    label: a.label,
    line1: a.line1,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    country: a.country,
  };
  if (a.line2) row['line2'] = a.line2;
  if (a.locality) row['locality'] = a.locality;
  if (a.phone) row['phone'] = a.phone;
  const coordinates = validCoordinates(a.coordinates);
  if (coordinates) row['coordinates'] = coordinates;
  return row;
}

/** Maps saved address → order/checkout `Address` shape. */
export function savedAddressToOrderAddress(saved: SavedAddress): Address {
  return {
    label: saved.label,
    line1: saved.addressLine1,
    line2: saved.addressLine2,
    locality: saved.landmark,
    city: saved.city,
    state: saved.state,
    postalCode: saved.pincode,
    country: saved.country || 'India',
    phone: saved.phone,
    coordinates: saved.coordinates,
  };
}

function legacyAddressToSaved(legacy: Address, fullName: string, phone: string): SavedAddress {
  return {
    id: newAddressId(),
    label: normalizeLabel(legacy.label || 'home'),
    fullName,
    phone: phone.replace(/\D/g, '').slice(-10),
    addressLine1: legacy.line1,
    addressLine2: legacy.line2,
    landmark: legacy.locality,
    city: legacy.city,
    state: legacy.state,
    pincode: legacy.postalCode,
    country: legacy.country || 'India',
    isDefault: true,
  };
}

@Injectable({ providedIn: 'root' })
export class AddressEngineService {
  private readonly auth = inject(AuthService);
  private readonly delivery = inject(DeliveryEligibilityService);

  private readonly _addresses = signal<SavedAddress[]>([]);
  private readonly _selectedId = signal<string | null>(null);

  readonly addresses = this._addresses.asReadonly();
  readonly selectedId = this._selectedId.asReadonly();

  readonly defaultAddress = computed(() =>
    this._addresses().find((a) => a.isDefault) ?? this._addresses()[0],
  );

  readonly selectedAddress = computed(() => {
    const list = this._addresses();
    const id = this._selectedId();
    if (id) {
      return list.find((a) => a.id === id) ?? this.defaultAddress();
    }
    return this.defaultAddress();
  });

  readonly checkoutOrderAddress = computed(() => {
    const selected = this.selectedAddress();
    return selected ? savedAddressToOrderAddress(selected) : undefined;
  });

  readonly deliveryEligibility = computed(() => {
    const selected = this.selectedAddress();
    if (!selected) return null;
    return this.delivery.check(selected.pincode);
  });

  constructor() {
    effect(() => {
      const profile = this.auth.profile();
      if (profile) {
        this.hydrateFromProfile(profile);
      } else {
        this._addresses.set([]);
        this._selectedId.set(null);
      }
    });
  }

  private hydrateFromProfile(profile: AppUser): void {
    let list = this.normalizeRawAddresses(profile.addresses);
    if (list.length === 0 && profile.defaultAddress) {
      list = [legacyAddressToSaved(profile.defaultAddress, profile.fullName, profile.phone)];
    }
    list = ensureSingleDefault(list);
    this._addresses.set(list);
    const defaultOne = list.find((a) => a.isDefault) ?? list[0];
    if (defaultOne && !this._selectedId()) {
      this._selectedId.set(defaultOne.id);
    }
  }

  private normalizeRawAddresses(raw: unknown): SavedAddress[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        id: String(item['id'] ?? newAddressId()),
        label: normalizeLabel(String(item['label'] ?? 'home')),
        fullName: String(item['fullName'] ?? ''),
        phone: String(item['phone'] ?? '').replace(/\D/g, '').slice(-10),
        addressLine1: String(item['addressLine1'] ?? item['line1'] ?? ''),
        addressLine2: item['addressLine2'] ? String(item['addressLine2']) : undefined,
        landmark: item['landmark'] ? String(item['landmark']) : undefined,
        city: String(item['city'] ?? ''),
        state: String(item['state'] ?? ''),
        pincode: String(item['pincode'] ?? item['postalCode'] ?? ''),
        country: String(item['country'] ?? 'India'),
        isDefault: item['isDefault'] === true,
        coordinates: validCoordinates(item['coordinates'] as SavedAddress['coordinates']),
      }))
      .filter((a) => a.addressLine1 && a.city && a.pincode);
  }

  selectAddress(id: string): void {
    if (this._addresses().some((a) => a.id === id)) {
      this._selectedId.set(id);
    }
  }

  assertCheckoutReady(): Address {
    const selected = this.selectedAddress();
    if (!selected) {
      throw addressError('SELECT_ADDRESS');
    }
    const eligibility = this.delivery.check(selected.pincode);
    if (!eligibility.serviceable) {
      throw addressError('DELIVERY_UNAVAILABLE', eligibility.message);
    }
    return savedAddressToOrderAddress(selected);
  }

  async addAddress(input: SavedAddressInput): Promise<void> {
    const profile = this.auth.profile();
    if (!profile) throw addressError('ADDRESS_REQUIRED');

    const validated = validateSavedAddressInput(input);
    const eligibility = this.delivery.check(validated.pincode);
    if (!eligibility.serviceable) {
      throw addressError('DELIVERY_UNAVAILABLE', eligibility.message);
    }

    const current = [...this._addresses()];
    if (current.length >= MAX_SAVED_ADDRESSES) {
      throw addressError('MAX_ADDRESSES');
    }

    const makeDefault = validated.isDefault ?? current.length === 0;
    const entry: SavedAddress = {
      id: newAddressId(),
      ...validated,
      country: validated.country ?? 'India',
      isDefault: makeDefault,
    };

    let next = [...current, entry];
    if (makeDefault) {
      next = next.map((a) => ({ ...a, isDefault: a.id === entry.id }));
    }
    await this.persist(profile.uid, next);
    this._selectedId.set(entry.id);
  }

  async updateAddress(id: string, input: SavedAddressInput): Promise<void> {
    const profile = this.auth.profile();
    if (!profile) throw addressError('ADDRESS_REQUIRED');

    const validated = validateSavedAddressInput(input);
    const eligibility = this.delivery.check(validated.pincode);
    if (!eligibility.serviceable) {
      throw addressError('DELIVERY_UNAVAILABLE', eligibility.message);
    }

    const idx = this._addresses().findIndex((a) => a.id === id);
    if (idx < 0) throw addressError('NOT_FOUND');

    const makeDefault = validated.isDefault ?? this._addresses()[idx].isDefault;
    let next = this._addresses().map((a) =>
      a.id === id
        ? {
            ...a,
            ...validated,
            country: validated.country ?? 'India',
            isDefault: makeDefault ? true : a.isDefault,
          }
        : a,
    );
    if (makeDefault) {
      next = next.map((a) => ({ ...a, isDefault: a.id === id }));
    }
    await this.persist(profile.uid, next);
    this._selectedId.set(id);
  }

  async deleteAddress(id: string): Promise<void> {
    const profile = this.auth.profile();
    if (!profile) return;

    const next = this._addresses().filter((a) => a.id !== id);
    if (next.length === this._addresses().length) {
      throw addressError('NOT_FOUND');
    }
    await this.persist(profile.uid, ensureSingleDefault(next));
    if (this._selectedId() === id) {
      const def = this._addresses().find((a) => a.isDefault);
      this._selectedId.set(def?.id ?? null);
    }
  }

  async setDefault(id: string): Promise<void> {
    const profile = this.auth.profile();
    if (!profile) return;
    if (!this._addresses().some((a) => a.id === id)) {
      throw addressError('NOT_FOUND');
    }
    const next = this._addresses().map((a) => ({ ...a, isDefault: a.id === id }));
    await this.persist(profile.uid, next);
    this._selectedId.set(id);
  }

  private async persist(_uid: string, addresses: SavedAddress[]): Promise<void> {
    const authUid = this.auth.user()?.uid;
    if (!authUid) throw addressError('ADDRESS_REQUIRED');

    const normalized = ensureSingleDefault(addresses);
    const defaultOne = normalized.find((a) => a.isDefault);
    try {
      await this.auth.updateProfile(authUid, {
        addresses: normalized.map((a) => savedAddressToFirestore(a) as unknown as SavedAddress),
        ...(defaultOne
          ? { defaultAddress: defaultAddressToFirestore(defaultOne) as unknown as Address }
          : {}),
      });
      this._addresses.set(normalized);
    } catch (e) {
      console.error('[AddressEngine] persist failed', e);
      throw addressError('SAVE_FAILED');
    }
  }
}
