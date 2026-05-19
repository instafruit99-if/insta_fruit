import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { CartItem } from '../models';
import { CreateOrderInput, CreateOrderResult, DELIVERY_FEE_INR, TransactionProductData } from './order-types';
import {
  OrderTransactionError,
  orderTransactionError,
} from './order-errors';
import {
  productUnitPrice,
  validateCartLineItems,
  validateCreateOrderPayload,
} from './order-validation';

function aggregateCartQuantities(items: CartItem[]): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  return quantities;
}

/**
 * Centralized Firestore transactional order engine.
 * Business logic is isolated here for future migration to Cloud Functions.
 */
@Injectable({ providedIn: 'root' })
export class OrderTransactionEngine {
  private readonly db = inject(Firestore);
  private readonly auth = inject(Auth);

  /** Prevents duplicate in-flight submissions per user. */
  private readonly inFlightByUid = new Map<string, Promise<CreateOrderResult>>();

  async createOrder(rawInput: CreateOrderInput): Promise<CreateOrderResult> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      throw orderTransactionError('AUTH_REQUIRED');
    }

    const input = validateCreateOrderPayload(rawInput);
    const existing = this.inFlightByUid.get(uid);
    if (existing) {
      throw orderTransactionError('ALREADY_PROCESSING');
    }

    const run = this.executeTransaction(uid, input);
    this.inFlightByUid.set(uid, run);
    try {
      return await run;
    } finally {
      if (this.inFlightByUid.get(uid) === run) {
        this.inFlightByUid.delete(uid);
      }
    }
  }

  private async executeTransaction(uid: string, input: CreateOrderInput): Promise<CreateOrderResult> {
    const orderRef = doc(collection(this.db, 'orders'));
    const cartRef = doc(this.db, `cart/${uid}`);

    try {
      const orderId = await runTransaction(this.db, async (tx) => {
        const cartSnap = await tx.get(cartRef);
        if (!cartSnap.exists()) {
          throw orderTransactionError('INVALID_CART');
        }

        const cart = cartSnap.data() as { userId?: string; items?: CartItem[] };
        if (cart.userId && cart.userId !== uid) {
          throw orderTransactionError('INVALID_CART');
        }

        const cartItems = cart.items ?? [];
        validateCartLineItems(cartItems);

        const quantityByProduct = aggregateCartQuantities(cartItems);
        const productIds = [...quantityByProduct.keys()];

        const productSnaps = await Promise.all(
          productIds.map((productId) => tx.get(doc(this.db, `products/${productId}`))),
        );

        const orderProducts: Array<{
          productId: string;
          name: string;
          thumbnail: string;
          price: number;
          quantity: number;
          total: number;
        }> = [];
        let subtotal = 0;

        productSnaps.forEach((productSnap, index) => {
          const productId = productIds[index];
          const quantity = quantityByProduct.get(productId) ?? 0;

          if (!productSnap.exists()) {
            throw orderTransactionError('INVALID_PRODUCT');
          }

          const product = productSnap.data() as TransactionProductData;
          if (product.isAvailable !== true) {
            throw orderTransactionError('PRODUCT_UNAVAILABLE');
          }

          const stock = typeof product.stock === 'number' ? product.stock : 0;
          if (stock < quantity) {
            throw orderTransactionError('OUT_OF_STOCK');
          }

          const unitPrice = productUnitPrice(product.price, product.discountPrice);
          const lineTotal = +(unitPrice * quantity).toFixed(2);
          subtotal += lineTotal;

          const cartLine = cartItems.find((i) => i.productId === productId);
          orderProducts.push({
            productId,
            name: product.name,
            thumbnail: product.thumbnail ?? cartLine?.thumbnail ?? '',
            price: unitPrice,
            quantity,
            total: lineTotal,
          });

          tx.update(productSnap.ref, {
            stock: stock - quantity,
            updatedAt: serverTimestamp(),
          });
        });

        subtotal = +subtotal.toFixed(2);
        const deliveryFee = DELIVERY_FEE_INR;
        const total = +(subtotal + deliveryFee).toFixed(2);
        const eta = Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000));

        tx.set(orderRef, {
          userId: uid,
          userName: input.userName,
          userPhone: input.userPhone,
          products: orderProducts,
          subtotal,
          deliveryFee,
          total,
          paymentMethod: input.paymentMethod,
          paymentStatus: 'pending',
          orderStatus: 'placed',
          deliverySlot: input.deliverySlot,
          estimatedArrivalTime: eta,
          address: input.address,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        return orderRef.id;
      });

      return { orderId };
    } catch (error) {
      if (error instanceof OrderTransactionError) {
        throw error;
      }
      throw orderTransactionError('TRANSACTION_FAILED');
    }
  }
}
