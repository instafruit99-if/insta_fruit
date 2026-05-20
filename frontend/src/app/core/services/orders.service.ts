import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, collectionData, doc, docData, getDoc,
  query, where, orderBy } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable } from 'rxjs';
import { Order, OrderStatus } from '../models';
import { OrderTransactionEngine } from '../orders-engine/order-transaction.engine';
import { OrderTransactionError } from '../orders-engine/order-errors';
import { OrderLifecycleEngine } from '../order-lifecycle/order-lifecycle.engine';
import { OrderLifecycleError } from '../order-lifecycle/order-transition-validator';
import { OrderLifecycleStatus } from '../order-lifecycle/order-status.enum';
import { normalizeOrderStatus } from '../order-lifecycle/order-transition-validator';
import { SecurityEngineService } from '../security/security-engine.service';
import { SecurityError } from '../security/security-errors';
import { AuditLoggerService } from '../security/audit-logger.service';
import { validateOrderId } from '../security/security-validation';
import { AddressError } from '../address/address-errors';
import { DeliveryEngineService } from '../delivery/delivery-engine.service';
import { DeliveryError } from '../delivery/delivery-errors';
import { PaymentEngineService } from '../payment/payment-engine.service';
import { PaymentError } from '../payment/payment-errors';
import { NotificationService } from './notification.service';

interface CreateRazorpayInput { orderId: string; amount: number; currency?: 'INR'; }
interface CreateRazorpayResult { razorpayOrderId: string; amount: number; currency: 'INR'; }
interface VerifyRazorpayInput {
  razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string; orderId: string;
}

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly db = inject(Firestore);
  private readonly fns = inject(Functions);
  private readonly orderEngine = inject(OrderTransactionEngine);
  private readonly lifecycle = inject(OrderLifecycleEngine);
  private readonly security = inject(SecurityEngineService);
  private readonly audit = inject(AuditLoggerService);
  private readonly delivery = inject(DeliveryEngineService);
  private readonly notifications = inject(NotificationService);
  private readonly auth = inject(Auth);
  private readonly col = collection(this.db, 'orders');

  myOrders(userId: string): Observable<Order[]> {
    return collectionData(
      query(this.col, where('userId', '==', userId), orderBy('createdAt', 'desc')),
      { idField: 'orderId' }
    ) as Observable<Order[]>;
  }

  byStatus(status: OrderStatus): Observable<Order[]> {
    return collectionData(
      query(this.col, where('orderStatus', '==', status), orderBy('createdAt', 'desc')),
      { idField: 'orderId' }
    ) as Observable<Order[]>;
  }

  all(): Observable<Order[]> {
    return collectionData(query(this.col, orderBy('createdAt', 'desc')), { idField: 'orderId' }) as Observable<Order[]>;
  }

  one(orderId: string): Observable<Order | undefined> {
    return docData(doc(this.db, `orders/${orderId}`), { idField: 'orderId' }) as Observable<Order | undefined>;
  }

  getAllowedNextStatuses(status: string): OrderLifecycleStatus[] {
    return this.lifecycle.getAllowedNextStatuses(normalizeOrderStatus(status));
  }

  isCheckoutInProgress(): boolean {
    return this.security.isCheckoutLocked();
  }

  async create(
    order: Pick<Order, 'userName' | 'userPhone' | 'paymentMethod' | 'deliverySlot' | 'address'> & {
      requestId?: string;
      subtotal: number;
    },
  ): Promise<string> {
    const requestId = order.requestId ?? crypto.randomUUID();
    const deliveryFields = this.delivery.buildOrderFields(
      order.subtotal,
      order.deliverySlot,
      order.address.postalCode,
    );
    const userPhone = order.userPhone.replace(/\D/g, '').slice(-10);
    const payload = {
      userName: order.userName.trim(),
      userPhone,
      paymentMethod: order.paymentMethod,
      deliverySlot: deliveryFields.deliverySlot,
      address: {
        ...order.address,
        country: order.address.country?.trim() || 'India',
      },
    };
    try {
      const result = await this.security.guardCheckout(
        () =>
          this.orderEngine.createOrder({
            requestId,
            ...payload,
          }),
        payload,
      );
      const orderId = result.orderId;
      const uid = this.auth.currentUser?.uid;
      if (uid) {
        void this.notifications.onOrderPlaced(uid, orderId);
      }
      return orderId;
    } catch (e) {
      throw new Error(this.formatError(e));
    }
  }

  async updateStatus(orderId: string, orderStatus: OrderStatus): Promise<void> {
    validateOrderId(orderId);
    try {
      await this.security.guardOrderStatusUpdate(async () => {
        const meta = await this.readOrderMeta(orderId);
        const from = meta.status;
        await this.lifecycle.transition(orderId, orderStatus);
        if (from !== orderStatus) {
          await this.audit.logOrderStatusUpdated({ orderId, from, to: orderStatus });
          await this.notifications.notifyUser(meta.userId, orderId, orderStatus);
        }
      });
    } catch (e) {
      throw new Error(this.formatError(e));
    }
  }

  async cancel(orderId: string, reason: string): Promise<void> {
    try {
      await this.security.guardOrderCancel(orderId, reason, async () => {
        const meta = await this.readOrderMeta(orderId);
        const from = meta.status;
        await this.lifecycle.transition(orderId, 'cancelled', reason);
        if (from !== 'cancelled') {
          await this.audit.logOrderStatusUpdated({
            orderId,
            from,
            to: 'cancelled',
            action: 'order_cancelled',
            reason,
          });
          await this.notifications.notifyUser(meta.userId, orderId, 'cancelled');
        }
      });
    } catch (e) {
      throw new Error(this.formatError(e));
    }
  }

  private async readOrderMeta(orderId: string): Promise<{ userId: string; status: OrderLifecycleStatus }> {
    const snap = await getDoc(doc(this.db, `orders/${orderId}`));
    if (!snap.exists()) {
      throw new Error('Order not found');
    }
    const data = snap.data();
    return {
      userId: String(data['userId'] ?? ''),
      status: normalizeOrderStatus(data['orderStatus'] as string | undefined),
    };
  }

  async notifyUser(userId: string, orderId: string, status: OrderStatus): Promise<void> {
    await this.notifications.notifyUser(userId, orderId, status);
  }

  myNotifications(userId: string): Observable<import('../notifications/notification.types').AppNotification[]> {
    return this.notifications.myNotifications(userId);
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await this.notifications.markNotificationAsRead(id);
  }

  private formatError(error: unknown): string {
    if (error instanceof PaymentError) {
      return PaymentEngineService.toUserMessage(error);
    }
    if (error instanceof AddressError) {
      return error.message;
    }
    if (error instanceof DeliveryError) {
      return error.message;
    }
    if (error instanceof SecurityError) {
      return SecurityEngineService.toUserMessage(error);
    }
    if (error instanceof OrderTransactionError) {
      return error.message;
    }
    if (error instanceof OrderLifecycleError) {
      return error.message;
    }
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return 'Please try again later';
  }

  // ---- Razorpay (via Cloud Functions) ----
  createRazorpayOrder(input: CreateRazorpayInput): Promise<CreateRazorpayResult> {
    const fn = httpsCallable<CreateRazorpayInput, CreateRazorpayResult>(this.fns, 'createRazorpayOrder');
    return fn(input).then((r) => r.data);
  }

  verifyRazorpayPayment(input: VerifyRazorpayInput): Promise<{ success: boolean }> {
    const fn = httpsCallable<VerifyRazorpayInput, { success: boolean }>(this.fns, 'verifyRazorpayPayment');
    return fn(input).then((r) => r.data);
  }
}
