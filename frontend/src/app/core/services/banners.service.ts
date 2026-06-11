import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, addDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { Banner } from '../models';

@Injectable({ providedIn: 'root' })
export class BannersService {
  private readonly db = inject(Firestore);
  private readonly col = collection(this.db, 'banners');

  /** Same pattern as categories: no composite index — filter/sort client-side. */
  list(): Observable<Banner[]> {
    return collectionData(this.col, { idField: 'id' }).pipe(
      map((rows) =>
        (rows as Banner[])
          .filter((b) => b.isActive === true)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      ),
    );
  }

  listAll(): Observable<Banner[]> {
    return collectionData(this.col, { idField: 'id' }) as Observable<Banner[]>;
  }

  async create(b: Omit<Banner, 'id'>): Promise<string> {
    const clean = Object.fromEntries(
      Object.entries(b).filter(([, value]) => value !== undefined),
    );
    const ref = await addDoc(this.col, clean);
    return ref.id;
  }

  async update(id: string, patch: Partial<Banner>): Promise<void> {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
    await updateDoc(doc(this.db, `banners/${id}`), clean);
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.db, `banners/${id}`));
  }
}
