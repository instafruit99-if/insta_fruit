import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Firestore, collection, collectionData, addDoc, query, orderBy, serverTimestamp,
  doc, updateDoc, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Refund } from '../models';

@Injectable({ providedIn: 'root' })
export class RefundsService {
  private readonly db = inject(Firestore);
  private readonly http = inject(HttpClient);
  private readonly col = collection(this.db, 'refunds');

  list(): Observable<Refund[]> {
    return collectionData(query(this.col, orderBy('createdAt', 'desc')), { idField: 'refundId' }) as Observable<Refund[]>;
  }

  myRefunds(userId: string): Observable<Refund[]> {
    return collectionData(
      query(this.col, where('userId', '==', userId), orderBy('createdAt', 'desc')),
      { idField: 'refundId' }
    ) as Observable<Refund[]>;
  }

  async request(orderId: string, userId: string, paymentId: string, amount: number, reason: string): Promise<string> {
    const ref = await addDoc(this.col, {
      orderId, userId, paymentId, amount, reason,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  async approveAndProcess(orderId: string, reason: string): Promise<{ success: boolean; razorpayRefundId: string }> {
    return firstValueFrom(
      this.http.post<{ success: boolean; razorpayRefundId: string }>(
        `${environment.apiUrl}/api/refunds/process`,
        { orderId, reason },
      ),
    );
  }

  async reject(refundId: string): Promise<void> {
    await updateDoc(doc(this.db, `refunds/${refundId}`), { status: 'rejected', updatedAt: serverTimestamp() });
  }
}
