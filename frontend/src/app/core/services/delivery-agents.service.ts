import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { DeliveryAgent } from '../models';

@Injectable({ providedIn: 'root' })
export class DeliveryAgentsService {
  private readonly db = inject(Firestore);
  private readonly col = collection(this.db, 'deliveryAgents');

  list(): Observable<DeliveryAgent[]> {
    return collectionData(
      query(this.col, orderBy('createdAt', 'desc')),
      { idField: 'id' },
    ) as Observable<DeliveryAgent[]>;
  }

  async create(name: string, phone: string): Promise<string> {
    const ref = await addDoc(this.col, {
      name: name.trim(),
      phone: phone.trim(),
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  async update(id: string, name: string, phone: string): Promise<void> {
    await updateDoc(doc(this.db, `deliveryAgents/${id}`), {
      name: name.trim(),
      phone: phone.trim(),
      updatedAt: serverTimestamp(),
    });
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await updateDoc(doc(this.db, `deliveryAgents/${id}`), {
      isActive,
      updatedAt: serverTimestamp(),
    });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.db, `deliveryAgents/${id}`));
  }
}
