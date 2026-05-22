import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Address, AppUser } from '../models';
import { savedAddressToOrderAddress } from '../address/address-engine.service';
import { AuthService } from './auth.service';

const SESSION_KEY = 'instafruit_location';

interface GeocodeResult {
  locality: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  line1: string;
  formattedAddress: string;
}

interface SessionLocation {
  locality: string;
  city: string;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly area = signal('Add address');
  readonly loading = signal(false);

  /** Home header: only saved profile address (no GPS). */
  async loadSaved(): Promise<void> {
    await this.waitForProfile();
    const profile = this.auth.profile();
    const savedEntry = profile?.addresses?.find((a) => a.isDefault) ?? profile?.addresses?.[0];
    const saved = profile?.defaultAddress
      ?? (savedEntry ? savedAddressToOrderAddress(savedEntry) : undefined);
    this.area.set(saved ? shortAreaFromAddress(saved) : 'Add address');
  }

  /**
   * GPS + reverse geocode via Node.js backend.
   * Call from UI when enabling auto-location later.
   */
  async fetchFromGps(): Promise<void> {
    if (!navigator.geolocation) {
      this.area.set('Set location');
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
      writeSession({ locality: label, city: data.city });
      await this.persist(coords, data);
    } catch {
      await this.loadSaved();
    } finally {
      this.loading.set(false);
    }
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

function writeSession(loc: SessionLocation): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(loc));
  } catch {
    /* private mode / quota */
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
