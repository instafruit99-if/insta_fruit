import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, addDoc, getDoc, updateDoc,
  query, where, orderBy, serverTimestamp } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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
    },
  ): Promise<string> {
    const requestId = order.requestId ?? crypto.randomUUID();
    try {
      const result = await this.security.guardCheckout(
        () =>
          this.orderEngine.createOrder({
            requestId,
            userName: order.userName,
            userPhone: order.userPhone,
            paymentMethod: order.paymentMethod,
            deliverySlot: order.deliverySlot,
            address: order.address,
          }),
        {
          userName: order.userName,
          userPhone: order.userPhone,
          paymentMethod: order.paymentMethod,
          deliverySlot: order.deliverySlot,
          address: order.address,
        },
      );
      return result.orderId;
    } catch (e) {
      throw new Error(this.formatError(e));
    }
  }

  async updateStatus(orderId: string, orderStatus: OrderStatus): Promise<void> {
    validateOrderId(orderId);
    try {
      await this.security.guardOrderStatusUpdate(async () => {
        const from = await this.readOrderStatus(orderId);
        await this.lifecycle.transition(orderId, orderStatus);
        if (from !== orderStatus) {
          await this.audit.logOrderStatusUpdated({ orderId, from, to: orderStatus });
        }
      });
    } catch (e) {
      throw new Error(this.formatError(e));
    }
  }

  async cancel(orderId: string, reason: string): Promise<void> {
    try {
      await this.security.guardOrderCancel(orderId, reason, async () => {
        const from = await this.readOrderStatus(orderId);
        await this.lifecycle.transition(orderId, 'cancelled', reason);
        if (from !== 'cancelled') {
          await this.audit.logOrderStatusUpdated({
            orderId,
            from,
            to: 'cancelled',
            action: 'order_cancelled',
            reason,
          });
        }
      });
    } catch (e) {
      throw new Error(this.formatError(e));
    }
  }

  private async readOrderStatus(orderId: string): Promise<OrderLifecycleStatus> {
    const snap = await getDoc(doc(this.db, `orders/${orderId}`));
    if (!snap.exists()) {
      throw new Error('Order not found');
    }
    return normalizeOrderStatus(snap.data()['orderStatus'] as string | undefined);
  }

  private formatError(error: unknown): string {
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

  async notifyUser(userId: string, orderId: string, status: OrderStatus): Promise<void> {
    await addDoc(collection(this.db, 'notifications'), {
      userId,
      orderId,
      title: 'Order Update',
      message: `Your order #${orderId.slice(-8).toUpperCase()} is now ${status}.`,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  }

  myNotifications(userId: string): Observable<any[]> {
    return (collectionData(
      query(collection(this.db, 'notifications'), where('userId', '==', userId)),
      { idField: 'id' }
    ) as Observable<any[]>).pipe(
      map(notifs => notifs.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      }))
    );
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await updateDoc(doc(this.db, `notifications/${id}`), { isRead: true });
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
