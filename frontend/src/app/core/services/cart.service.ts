import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { CartItem, Product, productUnitPrice } from '../models';
import { SecurityEngineService } from '../security/security-engine.service';
import { SecurityError } from '../security/security-errors';
import { validateCartQuantity } from '../security/security-validation';

const DELIVERY_FEE_INR = 25;

/** Firestore may contain junk entries like `[""]`; keep only non-empty product IDs. */
function normalizeFavoriteIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly db = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly security = inject(SecurityEngineService);

  private readonly _items = signal<CartItem[]>([]);
  private readonly _favorites = signal<string[]>([]);
  private readonly _favoritesHydrated = signal(false);
  private readonly _cartHydrated = signal(false);
  /** Must match auth.user().uid before reading/writing cart. */
  private readonly _activeCartUid = signal<string | null>(null);

  readonly items = this._items.asReadonly();
  readonly favorites = this._favorites.asReadonly();

  readonly count = computed(() => this._items().reduce((s, i) => s + i.quantity, 0));
  readonly subtotal = computed(() =>
    this._items().reduce((s, i) => s + i.price * i.quantity, 0));
  readonly deliveryFee = computed(() => (this._items().length > 0 ? DELIVERY_FEE_INR : 0));
  readonly total = computed(() => this.subtotal() + this.deliveryFee());

  constructor() {
    // Cart: Firestore only — collection `cart/{uid}` (no localStorage / sessionStorage).
    effect(() => {
      const user = this.auth.user();
      const loading = this.auth.loading();
      const items = this._items();
      const activeUid = this._activeCartUid();
      if (!user || !this._cartHydrated() || loading) return;
      if (user.uid !== activeUid) return;

      void setDoc(doc(this.db, `cart/${user.uid}`), {
        userId: user.uid,
        items,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });

    effect(() => {
      const user = this.auth.user();
      const loading = this.auth.loading();
      if (loading) return;

      this._cartHydrated.set(false);
      this._activeCartUid.set(null);
      this._items.set([]);

      if (!user) {
        this._cartHydrated.set(true);
        return;
      }

      void this.hydrateFromFirestore(user.uid).finally(() => {
        if (this.auth.user()?.uid !== user.uid) return;
        this._activeCartUid.set(user.uid);
        this._cartHydrated.set(true);
      });
    });

    effect(() => {
      const user = this.auth.user();
      if (!user) {
        this._favoritesHydrated.set(false);
        this._favorites.set([]);
        return;
      }
      this._favoritesHydrated.set(false);
      void this.hydrateFavorites(user.uid);
    });

    effect(() => {
      const user = this.auth.user();
      const favs = this._favorites();
      if (!user || !this._favoritesHydrated()) return;
      void setDoc(
        doc(this.db, `users/${user.uid}`),
        { favoriteProductIds: favs, updatedAt: serverTimestamp() },
        { merge: true },
      );
    });
  }

  private async hydrateFromFirestore(uid: string): Promise<void> {
    try {
      const snap = await getDoc(doc(this.db, `cart/${uid}`));
      if (this.auth.user()?.uid !== uid) return;
      this._items.set(snap.exists() ? ((snap.data() as { items?: CartItem[] }).items ?? []) : []);
    } catch (e) {
      console.error('Failed to load cart', e);
      if (this.auth.user()?.uid === uid) this._items.set([]);
    }
  }

  private async hydrateFavorites(uid: string): Promise<void> {
    try {
      const snap = await getDoc(doc(this.db, `users/${uid}`));
      if (this.auth.user()?.uid !== uid) return;
      const ids = snap.exists()
        ? normalizeFavoriteIds((snap.data() as { favoriteProductIds?: unknown }).favoriteProductIds)
        : [];
      this._favorites.set(ids);
      this._favoritesHydrated.set(true);
    } catch (e) {
      console.error('Failed to load favorites', e);
    }
  }

  private guardCartMutation(quantity: number): void {
    const user = this.auth.user();
    if (!user) return;
    validateCartQuantity(quantity);
    try {
      this.security.guardCartMutation(user.uid);
    } catch (e) {
      if (e instanceof SecurityError) {
        console.warn('[cart]', e.message);
      }
      throw e;
    }
  }

  add(product: Product, quantity = 1): void {
    this.guardCartMutation(quantity);
    const items = [...this._items()];
    const idx = items.findIndex((i) => i.productId === product.id);
    const item: CartItem = {
      productId: product.id,
      name: product.name,
      thumbnail: product.thumbnail,
      price: productUnitPrice(product),
      unit: product.unit,
      quantity: idx >= 0 ? items[idx].quantity + quantity : quantity,
    };
    if (idx >= 0) items[idx] = item; else items.push(item);
    this._items.set(items);
  }

  increment(productId: string): void {
    const item = this._items().find((i) => i.productId === productId);
    if (item) this.guardCartMutation(item.quantity + 1);
    this._items.set(this._items().map((i) =>
      i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i));
  }

  decrement(productId: string): void {
    const item = this._items().find((i) => i.productId === productId);
    if (item && item.quantity > 1) this.guardCartMutation(item.quantity - 1);
    this._items.set(this._items()
      .map((i) => i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i)
      .filter((i) => i.quantity > 0));
  }

  remove(productId: string): void {
    const item = this._items().find((i) => i.productId === productId);
    if (item) this.guardCartMutation(1);
    this._items.set(this._items().filter((i) => i.productId !== productId));
  }

  clear(): void { this._items.set([]); }

  toggleFavorite(productId: string): void {
    const favs = this._favorites();
    this._favorites.set(favs.includes(productId) ? favs.filter((id) => id !== productId) : [...favs, productId]);
  }

  isFavorite(productId: string): boolean {
    return this._favorites().includes(productId);
  }
}
