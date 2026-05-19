import { Injectable, inject } from '@angular/core';

import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc,

  query, where, orderBy, serverTimestamp } from '@angular/fire/firestore';

import { Functions, httpsCallable } from '@angular/fire/functions';

import { Observable } from 'rxjs';

import { map } from 'rxjs/operators';

import { Order, OrderStatus } from '../models';

import { OrderTransactionEngine } from '../orders-engine/order-transaction.engine';

import { OrderTransactionError } from '../orders-engine/order-errors';



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



  async create(

    order: Pick<Order, 'userName' | 'userPhone' | 'paymentMethod' | 'deliverySlot' | 'address'> & {

      requestId?: string;

    },

  ): Promise<string> {

    const requestId = order.requestId ?? crypto.randomUUID();

    try {

      const result = await this.orderEngine.createOrder({

        requestId,

        userName: order.userName,

        userPhone: order.userPhone,

        paymentMethod: order.paymentMethod,

        deliverySlot: order.deliverySlot,

        address: order.address,

      });

      return result.orderId;

    } catch (e) {

      throw new Error(this.transactionErrorMessage(e));

    }

  }



  private transactionErrorMessage(error: unknown): string {

    if (error instanceof OrderTransactionError) {

      return error.message;

    }

    if (error instanceof Error && error.message.trim()) {

      return error.message;

    }

    return 'Please try again';

  }



  async updateStatus(orderId: string, orderStatus: OrderStatus): Promise<void> {

    await updateDoc(doc(this.db, `orders/${orderId}`), {

      orderStatus,

      updatedAt: serverTimestamp(),

    });

  }



  async cancel(orderId: string, reason: string): Promise<void> {

    await updateDoc(doc(this.db, `orders/${orderId}`), {

      orderStatus: 'cancelled', cancelReason: reason, updatedAt: serverTimestamp(),

    });

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

