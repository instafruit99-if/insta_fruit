import { Injectable } from '@angular/core';
import { DELIVERY_ZONES, SUPPORTED_PINCODES } from './address.constants';
import { DeliveryEligibilityResult } from './address.types';
import { validatePincode } from './address-validation';

@Injectable({ providedIn: 'root' })
export class DeliveryEligibilityService {
  isServiceable(pincode: string): boolean {
    return this.check(pincode).serviceable;
  }

  check(pincode: string): DeliveryEligibilityResult {
    const normalized = pincode.trim();
    try {
      validatePincode(normalized);
    } catch {
      return {
        serviceable: false,
        message: 'Invalid pincode.',
      };
    }

    const zone = DELIVERY_ZONES.find((z) => z.pincodes.includes(normalized));
    if (zone) {
      return {
        serviceable: true,
        zoneId: zone.id,
        zoneName: zone.name,
        message: `Delivery available in ${zone.name}.`,
      };
    }

    if ((SUPPORTED_PINCODES as readonly string[]).includes(normalized)) {
      return {
        serviceable: true,
        message: 'Delivery available in your area.',
      };
    }

    return {
      serviceable: false,
      message: 'Delivery not available in this area.',
    };
  }

  /** Future: distance-based eligibility using coordinates. */
  checkWithCoordinates(
    pincode: string,
    _coordinates?: { lat: number; lng: number },
  ): DeliveryEligibilityResult {
    return this.check(pincode);
  }
}
