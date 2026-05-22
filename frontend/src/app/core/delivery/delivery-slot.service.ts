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

function startOfTomorrow(now: Date): Date {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
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

  private allTodaySlotsExpired(now: Date): boolean {
    return DELIVERY_CONFIG.supportedDeliverySlots.every((id) => this.isExpired(id, now));
  }

  getAvailableSlots(now = new Date()): DeliverySlotOption[] {
    const todayAvailable = DELIVERY_CONFIG.supportedDeliverySlots
      .filter((id) => !this.isExpired(id, now))
      .map((id, index) => ({
        id,
        label: formatSlotLabel(id),
        available: true,
        isNextAvailable: index === 0,
      }));

    if (todayAvailable.length > 0) {
      return todayAvailable;
    }

    const tomorrow = startOfTomorrow(now);
    return DELIVERY_CONFIG.supportedDeliverySlots
      .filter((id) => !this.isExpired(id, tomorrow))
      .map((id, index) => ({
        id,
        label: `${formatSlotLabel(id)} (tomorrow)`,
        available: true,
        isNextAvailable: index === 0,
      }));
  }

  defaultSlot(now = new Date()): DeliverySlotId {
    const next = this.getAvailableSlots(now).find((s) => s.available);
    return next?.id ?? DELIVERY_CONFIG.supportedDeliverySlots[0];
  }

  validateSelection(rawSlot: string, now = new Date()): DeliverySlotId {
    const slotId = normalizeDeliverySlotId(rawSlot);
    if (!slotId) {
      throw deliveryError('INVALID_SLOT');
    }
    if (!this.isExpired(slotId, now)) {
      return slotId;
    }
    if (this.allTodaySlotsExpired(now) && !this.isExpired(slotId, startOfTomorrow(now))) {
      return slotId;
    }
    throw deliveryError('SLOT_UNAVAILABLE');
  }

  slotStartDate(slotId: DeliverySlotId, now = new Date()): Date {
    const window = SLOT_WINDOWS[slotId];
    const day =
      !this.isExpired(slotId, now) || !this.allTodaySlotsExpired(now)
        ? now
        : startOfTomorrow(now);
    const start = new Date(day);
    start.setHours(window.startHour, 0, 0, 0);
    return start;
  }
}
