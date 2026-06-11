import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Address, AppUser } from '../models';
import { savedAddressToOrderAddress } from '../address/address-engine.service';
import { SavedAddress } from '../address/address.types';
import { pincodeToCityState } from '../address/address.constants';
import { AuthService } from './auth.service';

const SESSION_KEY = 'instafruit_browse_location';

interface GeocodeResult {
  locality: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  line1: string;
  formattedAddress: string;
}

/** Guest browse location — pincode only, not a full delivery address. */
interface GuestBrowseLocation {
  pincode: string;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** Short label shown in the home header (e.g. "Shankar Nagar" or "492001"). */
  readonly area = signal('Add location');
  readonly loading = signal(false);
  /** Active browse pincode — from saved address or guest session. */
  readonly pincode = signal<string | null>(null);

  /** Home header: saved profile address (logged in) or guest pincode from session. */
  async loadSaved(): Promise<void> {
    await this.waitForProfile();
    const profile = this.auth.profile();
    if (profile) {
      this.applyProfileAddress(profile);
      return;
    }
    this.applyGuestSession();
  }

  /** Update header from a saved delivery address (logged-in user). */
  setFromSavedAddress(saved: SavedAddress): void {
    const orderAddr = savedAddressToOrderAddress(saved);
    this.area.set(shortAreaFromSaved(saved));
    this.pincode.set(saved.pincode);
    clearGuestSession();
  }

  /** Update header from guest pincode browse (not logged in). */
  setGuestPincode(pincode: string): void {
    const normalized = pincode.trim();
    const cityState = pincodeToCityState(normalized);
    this.area.set(cityState ? `${cityState.city} (${normalized})` : normalized);
    this.pincode.set(normalized);
    writeGuestSession({ pincode: normalized });
  }

  /**
   * GPS + reverse geocode via Node.js backend.
   * Fills header label; persists lastLocation for logged-in users.
   */
  async fetchFromGps(): Promise<void> {
    if (!navigator.geolocation) {
      this.area.set('Location unavailable');
      return;
    }

    this.loading.set(true);
    try {
      const coords = await getPosition();
      const data = await firstValueFrom(
        this.http.post<GeocodeResult>(
          `${environment.apiUrl}/api/location/reverse-geocode`,
          { lat: coords.lat, lng: coords.lng },
        ),
      );
      const label = data.locality || data.city || 'Your area';
      this.area.set(label);
      if (data.postalCode) {
        this.pincode.set(data.postalCode);
        if (!this.auth.user()?.uid) {
          writeGuestSession({ pincode: data.postalCode });
        }
      }
      await this.persist(coords, data);
    } catch {
      await this.loadSaved();
    } finally {
      this.loading.set(false);
    }
  }

  private applyProfileAddress(profile: AppUser): void {
    const savedEntry = profile.addresses?.find((a) => a.isDefault) ?? profile.addresses?.[0];
    if (savedEntry) {
      this.setFromSavedAddress(savedEntry);
      return;
    }
    const legacy = profile.defaultAddress;
    if (legacy) {
      this.area.set(shortAreaFromAddress(legacy));
      this.pincode.set(legacy.postalCode || null);
      clearGuestSession();
      return;
    }
    this.area.set('Add address');
    this.pincode.set(null);
  }

  private applyGuestSession(): void {
    const guest = readGuestSession();
    if (guest?.pincode) {
      const cityState = pincodeToCityState(guest.pincode);
      this.area.set(cityState ? `${cityState.city} (${guest.pincode})` : guest.pincode);
      this.pincode.set(guest.pincode);
      return;
    }
    this.area.set('Add location');
    this.pincode.set(null);
  }

  private async persist(coords: { lat: number; lng: number }, data: GeocodeResult): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;

    const profile = this.auth.profile();
    const lastLocation = {
      lat: coords.lat,
      lng: coords.lng,
      locality: data.locality,
      city: data.city,
      fetchedAt: new Date(),
    };

    const patch: Partial<AppUser> = { lastLocation };
    if (!profile?.defaultAddress) {
      patch.defaultAddress = geocodeToAddress(data, coords);
    }
    await this.auth.updateProfile(uid, patch);
  }

  private async waitForProfile(): Promise<void> {
    if (!this.auth.user()) return;
    for (let i = 0; i < 40 && this.auth.loading(); i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

function shortAreaFromSaved(saved: SavedAddress): string {
  const landmark = saved.landmark?.trim();
  const city = saved.city?.trim();
  if (landmark && city) return `${landmark}, ${city}`;
  if (saved.addressLine1?.trim() && city) return `${saved.addressLine1}, ${city}`;
  return city || saved.pincode || 'Add address';
}

function shortAreaFromAddress(addr: Address): string {
  return addr.locality?.trim() || addr.label?.trim() || addr.city?.trim() || 'Add address';
}

function geocodeToAddress(data: GeocodeResult, coords: { lat: number; lng: number }): Address {
  return {
    label: data.locality || data.city,
    line1: data.line1,
    locality: data.locality,
    city: data.city,
    state: data.state,
    postalCode: data.postalCode,
    country: data.country,
    coordinates: coords,
  };
}

function writeGuestSession(loc: GuestBrowseLocation): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(loc));
  } catch {
    /* private mode / quota */
  }
}

function readGuestSession(): GuestBrowseLocation | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestBrowseLocation;
    if (typeof parsed.pincode === 'string' && /^\d{6}$/.test(parsed.pincode)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function clearGuestSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
    );
  });
}
