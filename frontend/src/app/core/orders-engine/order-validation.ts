import { Address, CartItem } from '../models';
import { CreateOrderInput } from './order-types';
import { orderTransactionError } from './order-errors';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidPaymentMethod(value: unknown): value is CreateOrderInput['paymentMethod'] {
  return value === 'cod' || value === 'razorpay';
}

function validateAddress(address: unknown): Address {
  if (!address || typeof address !== 'object') {
    throw orderTransactionError('INVALID_CART');
  }
  const a = address as Record<string, unknown>;
  if (
    !isNonEmptyString(a['label']) ||
    !isNonEmptyString(a['line1']) ||
    !isNonEmptyString(a['city']) ||
    !isNonEmptyString(a['state']) ||
    !isNonEmptyString(a['postalCode']) ||
    !isNonEmptyString(a['country'])
  ) {
    throw orderTransactionError('INVALID_CART');
  }
  return {
    label: a['label'].trim(),
    line1: a['line1'].trim(),
    line2: typeof a['line2'] === 'string' ? a['line2'].trim() : undefined,
    locality: typeof a['locality'] === 'string' ? a['locality'].trim() : undefined,
    city: a['city'].trim(),
    state: a['state'].trim(),
    postalCode: a['postalCode'].trim(),
    country: a['country'].trim(),
    phone: typeof a['phone'] === 'string' ? a['phone'].trim() : undefined,
    coordinates:
      a['coordinates'] &&
      typeof a['coordinates'] === 'object' &&
      typeof (a['coordinates'] as { lat: unknown }).lat === 'number' &&
      typeof (a['coordinates'] as { lng: unknown }).lng === 'number'
        ? {
            lat: (a['coordinates'] as { lat: number }).lat,
            lng: (a['coordinates'] as { lng: number }).lng,
          }
        : undefined,
  };
}

export function validateCreateOrderPayload(data: CreateOrderInput): CreateOrderInput {
  if (!isNonEmptyString(data.requestId)) {
    throw orderTransactionError('INVALID_CART');
  }
  if (!isNonEmptyString(data.userName) || !isNonEmptyString(data.userPhone)) {
    throw orderTransactionError('INVALID_CART');
  }
  if (!isNonEmptyString(data.deliverySlot)) {
    throw orderTransactionError('INVALID_CART');
  }
  if (!isValidPaymentMethod(data.paymentMethod)) {
    throw orderTransactionError('INVALID_CART');
  }
  return {
    requestId: data.requestId.trim(),
    userName: data.userName.trim(),
    userPhone: data.userPhone.trim(),
    paymentMethod: data.paymentMethod,
    deliverySlot: data.deliverySlot.trim(),
    address: validateAddress(data.address),
  };
}

export function validateCartLineItems(items: CartItem[]): void {
  if (!Array.isArray(items) || items.length === 0) {
    throw orderTransactionError('INVALID_CART');
  }
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      throw orderTransactionError('INVALID_CART');
    }
    if (!isNonEmptyString(item.productId)) {
      throw orderTransactionError('INVALID_CART');
    }
    const qty = item.quantity;
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0) {
      throw orderTransactionError('INVALID_CART');
    }
  }
}

export function productUnitPrice(price: number, discountPrice?: number): number {
  if (typeof discountPrice === 'number' && Number.isFinite(discountPrice) && discountPrice > 0) {
    return discountPrice;
  }
  return price;
}
