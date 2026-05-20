import { Injectable } from '@angular/core';
import { DELIVERY_CONFIG, DeliverySlotId } from './delivery-config.constants';
import { DeliverySlotOption } from './delivery.types';
import { deliveryError } from './delivery-errors';

const SLOT_WINDOWS: Readonly<Record<DeliverySlotId, { startHour: number; endHour: number }>> = {
  '7AM-9AM': { startHour: 7, endHour: 9 },
  '9AM-11AM': { startHour: 9, endHour: 11 },
  '11AM-1PM': { startHour: 11, endHour: 13 },
  '1PM-3PM': { startHour: 13, endHour: 15 },
  '3PM-5PM': { startHour: 15, endHour: 17 },
  '5PM-7PM': { startHour: 17, endHour: 19 },
};

function formatSlotLabel(id: DeliverySlotId): string {
  const idx = id.indexOf('-');
  if (idx <= 0) return id;
  return `${id.slice(0, idx)} – ${id.slice(idx + 1)}`;
}

/** Normalize user/display slot values to canonical ids (e.g. "7AM - 9AM" → "7AM-9AM"). */
export function normalizeDeliverySlotId(raw: string): DeliverySlotId | null {
  const compact = raw.trim().replace(/\s+/g, '').replace('–', '-').toUpperCase();
  const match = DELIVERY_CONFIG.supportedDeliverySlots.find(
    (id) => id.toUpperCase() === compact,
  );
  return match ?? null;
}

@Injectable({ providedIn: 'root' })
export class DeliverySlotService {
  formatLabel(slotId: DeliverySlotId): string {
    return formatSlotLabel(slotId);
  }

  isSupported(slotId: string): slotId is DeliverySlotId {
    return normalizeDeliverySlotId(slotId) !== null;
  }

  isExpired(slotId: DeliverySlotId, now = new Date()): boolean {
    const window = SLOT_WINDOWS[slotId];
    const end = new Date(now);
    end.setHours(window.endHour, 0, 0, 0);
    return now >= end;
  }

  getAvailableSlots(now = new Date()): DeliverySlotOption[] {
    const available = DELIVERY_CONFIG.supportedDeliverySlots
      .filter((id) => !this.isExpired(id, now))
      .map((id) => ({
        id,
        label: formatSlotLabel(id),
        available: true,
      }));

    if (available.length === 0) {
      return DELIVERY_CONFIG.supportedDeliverySlots.map((id) => ({
        id,
        label: formatSlotLabel(id),
        available: false,
      }));
    }

    return available.map((slot, index) => ({
      ...slot,
      isNextAvailable: index === 0,
    }));
  }

  defaultSlot(now = new Date()): DeliverySlotId {
    const next = this.getAvailableSlots(now).find((s) => s.available);
    if (!next) {
      throw deliveryError('SLOT_UNAVAILABLE');
    }
    return next.id;
  }

  validateSelection(rawSlot: string, now = new Date()): DeliverySlotId {
    const slotId = normalizeDeliverySlotId(rawSlot);
    if (!slotId) {
      throw deliveryError('INVALID_SLOT');
    }
    if (this.isExpired(slotId, now)) {
      throw deliveryError('SLOT_UNAVAILABLE');
    }
    return slotId;
  }

  slotStartDate(slotId: DeliverySlotId, now = new Date()): Date {
    const window = SLOT_WINDOWS[slotId];
    const start = new Date(now);
    start.setHours(window.startHour, 0, 0, 0);
    return start;
  }
}
