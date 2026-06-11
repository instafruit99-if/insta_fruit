import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule, X, MapPin, Navigation, Loader2 } from 'lucide-angular';
import { LocationService } from '../core/services/location.service';
import { AuthService } from '../core/services/auth.service';
import { AddressEngineService } from '../core/address/address-engine.service';
import { DeliveryEligibilityService } from '../core/address/delivery-eligibility.service';
import { validatePincode } from '../core/address/address-validation';
import { AddressError } from '../core/address/address-errors';
import { SavedAddress } from '../core/address/address.types';

@Component({
  selector: 'app-location-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    @if (open()) {
      <div
        data-testid="location-picker"
        class="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
        (click)="close()"
      >
        <div
          class="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <div class="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-border-soft/50 flex items-center justify-between">
            <h2 class="text-[16px] font-extrabold text-text-primary">Choose delivery location</h2>
            <button type="button" (click)="close()" class="w-9 h-9 rounded-full bg-[#F0F0F0] flex items-center justify-center">
              <lucide-icon [img]="CloseIcon" [size]="18"></lucide-icon>
            </button>
          </div>

          <div class="px-5 py-4 space-y-4">
            <!-- GPS -->
            <button
              type="button"
              data-testid="use-gps-btn"
              (click)="useGps()"
              [disabled]="location.loading()"
              class="w-full flex items-center gap-3 bg-primary-light rounded-card p-4 text-left active:scale-[0.99] transition-transform disabled:opacity-60"
            >
              <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                @if (location.loading()) {
                  <lucide-icon [img]="LoaderIcon" [size]="18" class="text-white animate-spin"></lucide-icon>
                } @else {
                  <lucide-icon [img]="GpsIcon" [size]="18" class="text-white"></lucide-icon>
                }
              </div>
              <div>
                <p class="text-[13px] font-bold text-text-primary">Use current location</p>
                <p class="text-[11px] text-text-secondary">Detect area using GPS</p>
              </div>
            </button>

            <!-- Guest pincode OR logged-in quick check -->
            @if (!isLoggedIn()) {
              <div class="bg-white rounded-card p-4 shadow-soft border border-border-soft/50">
                <p class="text-[13px] font-bold text-text-primary mb-2">Enter pincode</p>
                <div class="flex gap-2">
                  <input
                    data-testid="guest-pincode-input"
                    type="text"
                    inputmode="numeric"
                    maxlength="6"
                    placeholder="6-digit pincode"
                    class="flex-1 text-[13px] px-3 py-2.5 rounded-input border border-border-soft"
                    [ngModel]="pincodeInput()"
                    (ngModelChange)="pincodeInput.set($event); error.set('')"
                  />
                  <button
                    type="button"
                    data-testid="guest-pincode-submit"
                    (click)="submitGuestPincode()"
                    class="px-4 py-2.5 rounded-xl bg-primary text-white text-[13px] font-bold"
                  >
                    Check
                  </button>
                </div>
              </div>
            }

            <!-- Saved addresses (logged in) -->
            @if (isLoggedIn()) {
              <div>
                <p class="text-[13px] font-bold text-text-primary mb-2">Saved addresses</p>
                @if (addresses().length === 0) {
                  <p class="text-[12px] text-text-secondary mb-3">No saved address yet.</p>
                } @else {
                  <div class="space-y-2">
                    @for (addr of addresses(); track addr.id) {
                      <button
                        type="button"
                        [attr.data-testid]="'location-address-' + addr.id"
                        (click)="selectSaved(addr)"
                        [disabled]="saving()"
                        class="w-full bg-white rounded-card p-4 shadow-soft flex items-start gap-3 text-left border border-border-soft/50 disabled:opacity-60"
                        [class.ring-2]="selectedId() === addr.id"
                        [class.ring-primary]="selectedId() === addr.id"
                      >
                        <div class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                          <lucide-icon [img]="MapPinIcon" [size]="18" class="text-primary"></lucide-icon>
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-[13px] font-bold text-text-primary capitalize">
                            {{ addr.label }}
                            @if (addr.isDefault) {
                              <span class="text-[10px] text-primary font-semibold">· Default</span>
                            }
                          </p>
                          <p class="text-[12px] text-text-secondary leading-relaxed mt-0.5">
                            {{ addr.addressLine1 }}<br />
                            @if (addr.landmark) { Near {{ addr.landmark }}<br /> }
                            {{ addr.city }}, {{ addr.state }} {{ addr.pincode }}
                          </p>
                        </div>
                      </button>
                    }
                  </div>
                }
                <button
                  type="button"
                  data-testid="add-address-btn"
                  (click)="goAddAddress()"
                  class="mt-3 w-full text-[13px] font-bold text-primary border border-primary/30 py-3 rounded-xl bg-primary-light"
                >
                  + Add delivery address
                </button>
              </div>
            }

            @if (eligibilityMessage()) {
              <p
                data-testid="location-eligibility"
                class="text-[11px] font-semibold"
                [class.text-primary]="eligibilityOk()"
                [class.text-red-500]="!eligibilityOk()"
              >
                {{ eligibilityMessage() }}
              </p>
            }

            @if (error()) {
              <p data-testid="location-error" class="text-[12px] text-red-500 font-semibold">{{ error() }}</p>
            }

            @if (!isLoggedIn()) {
              <p class="text-[11px] text-text-secondary text-center pt-1">
                Sign in to save a full delivery address for checkout.
              </p>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class LocationPickerComponent {
  readonly open = input.required<boolean>();
  readonly closed = output<void>();

  private readonly router = inject(Router);
  readonly location = inject(LocationService);
  private readonly auth = inject(AuthService);
  private readonly addressEngine = inject(AddressEngineService);
  private readonly delivery = inject(DeliveryEligibilityService);

  readonly CloseIcon = X;
  readonly GpsIcon = Navigation;
  readonly MapPinIcon = MapPin;
  readonly LoaderIcon = Loader2;

  readonly pincodeInput = signal('');
  readonly error = signal('');
  readonly saving = signal(false);
  readonly eligibilityMessage = signal('');
  readonly eligibilityOk = signal(false);

  readonly addresses = this.addressEngine.addresses;
  readonly selectedId = this.addressEngine.selectedId;

  isLoggedIn(): boolean {
    return !!this.auth.user();
  }

  close(): void {
    this.closed.emit();
  }

  async useGps(): Promise<void> {
    this.error.set('');
    this.eligibilityMessage.set('');
    await this.location.fetchFromGps();
    const pin = this.location.pincode();
    if (pin) {
      const elig = this.delivery.check(pin);
      this.eligibilityMessage.set(elig.message);
      this.eligibilityOk.set(elig.serviceable);
      if (elig.serviceable) {
        this.close();
      }
      return;
    }
    if (this.location.area() !== 'Add location' && this.location.area() !== 'Location unavailable') {
      this.close();
    }
  }

  submitGuestPincode(): void {
    this.error.set('');
    this.eligibilityMessage.set('');
    const pin = this.pincodeInput().trim();
    try {
      validatePincode(pin);
    } catch (e) {
      this.error.set(e instanceof AddressError ? e.message : 'Invalid pincode.');
      return;
    }
    const elig = this.delivery.check(pin);
    this.eligibilityMessage.set(elig.message);
    this.eligibilityOk.set(elig.serviceable);
    if (!elig.serviceable) return;
    this.location.setGuestPincode(pin);
    this.close();
  }

  async selectSaved(addr: SavedAddress): Promise<void> {
    this.error.set('');
    this.saving.set(true);
    try {
      this.addressEngine.selectAddress(addr.id);
      await this.addressEngine.setDefault(addr.id);
      this.location.setFromSavedAddress(addr);
      this.close();
    } catch {
      this.error.set('Failed to update delivery location.');
    } finally {
      this.saving.set(false);
    }
  }

  goAddAddress(): void {
    this.close();
    this.router.navigate(['/checkout']);
  }
}
