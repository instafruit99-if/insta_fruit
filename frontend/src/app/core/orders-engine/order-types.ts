import { Address, CartItem, OrderProduct, PaymentMethod } from '../models';

export const DELIVERY_FEE_INR = 25;

export interface CreateOrderInput {
  requestId: string;
  userName: string;
  userPhone: string;
  paymentMethod: PaymentMethod;
  deliverySlot: string;
  address: Address;
}

export interface CreateOrderResult {
  orderId: string;
}

/** Product fields read inside a Firestore transaction. */
export interface TransactionProductData {
  name: string;
  price: number;
  discountPrice?: number;
  stock: number;
  isAvailable: boolean;
  thumbnail: string;
}

export interface BuiltOrderLine extends OrderProduct {
  productId: string;
}

export type { CartItem };
