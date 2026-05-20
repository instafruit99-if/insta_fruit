import { Address, CartItem, OrderProduct, PaymentMethod } from '../models';

/** @deprecated Use delivery engine {@link calculateDeliveryFee} */
export { DEFAULT_DELIVERY_FEE_INR as DELIVERY_FEE_INR } from '../delivery/delivery-config.constants';
export { calculateDeliveryFee } from '../delivery/delivery-fee.service';

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
