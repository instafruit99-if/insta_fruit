import { Timestamp } from '@angular/fire/firestore';
import type { OrderLifecycleStatus } from '../order-lifecycle/order-status.enum';
import type { OrderTimelineEntry } from '../order-lifecycle/order-lifecycle.types';
import type { SavedAddress } from '../address/address.types';

export type UserRole = 'customer' | 'admin';

export interface Address {
  label: string;
  line1: string;
  line2?: string;
  /** Short area for header (e.g. Koramangala). */
  locality?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  coordinates?: { lat: number; lng: number };
}

export interface LastLocation {
  lat: number;
  lng: number;
  locality: string;
  city: string;
  fetchedAt: Timestamp | Date;
}

export interface AppUser {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  profileImage?: string;
  /** Product IDs saved under `users/{uid}.favoriteProductIds` in Firestore. */
  favoriteProductIds?: string[];
  defaultAddress?: Address;
  /** Saved delivery addresses under `users/{uid}.addresses`. */
  addresses?: SavedAddress[];
  /** Latest GPS snapshot; does not replace a saved defaultAddress. */
  lastLocation?: LastLocation;
  isPhoneVerified: boolean;
  isBlocked?: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface Category {
  id: string;
  name: string;
  imageUrl: string;
  icon?: string;
  isActive: boolean;
  sortOrder?: number;
  createdAt: Timestamp | Date;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPrice?: number;
  categoryId: string;
  categoryName: string;
  stock: number;
  unit: string;
  thumbnail: string;
  images: string[];
  searchKeywords: string[];
  rating?: number;
  isAvailable: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  imageUrl: string;
  redirectUrl: string;
  isActive: boolean;
  sortOrder?: number;
}

export interface CartItem {
  productId: string;
  name: string;
  thumbnail: string;
  price: number;
  unit: string;
  quantity: number;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  updatedAt: Timestamp | Date;
}

export type { OrderLifecycleStatus as OrderStatus } from '../order-lifecycle/order-status.enum';
export type { OrderTimelineEntry } from '../order-lifecycle/order-lifecycle.types';

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';
export type PaymentMethod = 'cod' | 'razorpay';

export interface OrderProduct {
  productId: string;
  name: string;
  thumbnail: string;
  price: number;
  quantity: number;
  total: number;
}

export interface Order {
  orderId: string;
  userId: string;
  userName: string;
  userPhone: string;
  products: OrderProduct[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentId?: string;
  orderStatus: OrderLifecycleStatus;
  /** Mirrors orderStatus for lifecycle queries / future migrations. */
  currentStatus?: OrderLifecycleStatus;
  statusUpdatedAt?: Timestamp | Date;
  timeline?: OrderTimelineEntry[];
  estimatedArrivalTime: Timestamp | Date;
  /** Human-readable delivery window label (e.g. "7AM – 9AM"). */
  estimatedDeliveryTime?: string;
  estimatedPreparationTime?: number;
  deliveryEligible?: boolean;
  address: Address;
  assignedAgentId?: string;
  assignedAgentName?: string;
  assignedAgentPhone?: string;
  cancelReason?: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface Payment {
  paymentId: string;
  orderId: string;
  userId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  amount: number;
  currency: 'INR';
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: Timestamp | Date;
}

export interface DeliveryAgent {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface Refund {
  refundId: string;
  orderId: string;
  paymentId: string;
  userId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  razorpayRefundId?: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

/** Firestore clients may deserialize numbers as strings; normalize before math / `toFixed`. */
export function coerceNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function productUnitPrice(p: Pick<Product, 'price' | 'discountPrice'>): number {
  return coerceNumber(p.discountPrice ?? p.price, 0);
}
