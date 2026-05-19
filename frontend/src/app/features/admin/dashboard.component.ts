import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ShoppingBag, Wallet, Users, Clock, CheckCheck, Sparkles } from 'lucide-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { OrdersService } from '../../core/services/orders.service';
import { UsersService } from '../../core/services/users.service';
import { ProductsService } from '../../core/services/products.service';
import { CategoriesService } from '../../core/services/categories.service';
import { Order } from '../../core/models';

const SEED_PRODUCTS = [
  { name: 'Orange',    price: 249, unit: '1 kg',    thumbnail: 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=600&q=80', description: 'Juicy, sun-ripened Valencia oranges packed with vitamin C.' },
  { name: 'Banana',    price: 80,  unit: '1 dozen', thumbnail: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80', description: 'Naturally sweet, creamy Cavendish bananas.' },
  { name: 'Kiwi',      price: 120, unit: '500 g',   thumbnail: 'https://images.unsplash.com/photo-1585059895524-72359e06133a?auto=format&fit=crop&w=600&q=80', description: 'Tangy, emerald-green kiwifruit bursting with vitamin C.' },
  { name: 'Avocado',   price: 499, unit: '2 pcs',   thumbnail: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=600&q=80', description: 'Buttery Hass avocados with rich, creamy flesh.' },
  { name: 'Strawberry',price: 289, unit: '250 g',   thumbnail: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=600&q=80', description: 'Plump, ruby-red strawberries with intense sweetness.' },
  { name: 'Mango',     price: 359, unit: '1 kg',    thumbnail: 'https://images.unsplash.com/photo-1605027990121-cbae9e0642db?auto=format&fit=crop&w=600&q=80', description: 'Golden Alphonso mangoes — the king of fruits.' },
];

const SEED_CATEGORIES = [
  { name: 'Fruits',   icon: '🍎', imageUrl: '' },
  { name: 'Berries',  icon: '🫐', imageUrl: '' },
  { name: 'Tropical', icon: '🥭', imageUrl: '' },
  { name: 'Citrus',   icon: '🍊', imageUrl: '' },
];

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div data-testid="admin-dashboard" class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-[22px] font-extrabold text-text-primary">Dashboard</h1>
          <p class="text-[13px] text-text-secondary">Real-time overview of your store</p>
        </div>
        <button data-testid="admin-seed" (click)="seed()" [disabled]="seeding()"
                class="bg-primary text-white px-4 py-2 rounded-btn text-[13px] font-bold shadow-green flex items-center gap-2 disabled:opacity-60">
          <lucide-icon [img]="SeedIcon" [size]="14"></lucide-icon>
          {{ seeding() ? 'Seeding…' : 'Seed sample data' }}
        </button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        @for (s of stats(); track s.label) {
          <div [attr.data-testid]="'stat-' + s.id" class="bg-white rounded-card p-4 shadow-soft">
            <div class="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center mb-3">
              <lucide-icon [img]="s.icon" [size]="18" class="text-primary"></lucide-icon>
            </div>
            <p class="text-[11px] text-text-secondary font-semibold">{{ s.label }}</p>
            <p class="text-[20px] font-extrabold text-text-primary mt-0.5">{{ s.value }}</p>
          </div>
        }
      </div>

      <div class="bg-white rounded-card p-5 shadow-soft">
        <h2 class="text-[15px] font-bold text-text-primary mb-3">Recent Orders</h2>
        <div class="space-y-2">
          @for (o of recent(); track o.orderId) {
            <div class="flex items-center justify-between py-2 border-b border-border-soft/60 last:border-0">
              <div>
                <p class="text-[13px] font-semibold">#{{ o.orderId.slice(-8).toUpperCase() }}</p>
                <p class="text-[11px] text-text-secondary">{{ o.userName }} • {{ o?.products?.length ?? 0 }} items</p>
              </div>
              <div class="text-right">
                <p class="text-[13px] font-extrabold text-primary">₹{{ (o?.total ?? 0).toFixed(0) }}</p>
                <span class="text-[10px] bg-primary-light text-primary px-2 py-0.5 rounded-full font-semibold">{{ o.orderStatus }}</span>
              </div>
            </div>
          } @empty {
            <p class="text-[12px] text-text-secondary py-4 text-center">No orders yet.</p>
          }
        </div>
      </div>

      @if (seedMsg()) {
        <div class="bg-primary-light text-primary rounded-card p-3 text-[12px] font-semibold">{{ seedMsg() }}</div>
      }
    </div>
  `,
})
export class AdminDashboardComponent {
  private readonly ordersSvc = inject(OrdersService);
  private readonly usersSvc = inject(UsersService);
  private readonly productsSvc = inject(ProductsService);
  private readonly catsSvc = inject(CategoriesService);

  readonly orders = toSignal(this.ordersSvc.all(), { initialValue: [] as Order[] });
  readonly users = toSignal(this.usersSvc.list(), { initialValue: [] });

  readonly totalOrders = computed(() => this.orders().length);
  readonly totalSales = computed(() => this.orders().reduce((s, o) => s + (o.total ?? 0), 0));
  readonly pending = computed(() => this.orders().filter((o) =>
    ['placed', 'accepted', 'preparing', 'packed', 'assigned_to_rider', 'outForDelivery'].includes(o.orderStatus)
  ).length);
  readonly delivered = computed(() => this.orders().filter((o) => o.orderStatus === 'delivered').length);

  readonly stats = computed(() => [
    { id: 'orders',   label: 'Total Orders',    value: this.totalOrders(),                  icon: ShoppingBag },
    { id: 'sales',    label: 'Total Sales',     value: '₹' + this.totalSales().toFixed(0), icon: Wallet },
    { id: 'users',    label: 'Total Users',     value: this.users().length,                icon: Users },
    { id: 'pending',  label: 'Pending Orders',  value: this.pending(),                     icon: Clock },
    { id: 'done',     label: 'Completed',       value: this.delivered(),                   icon: CheckCheck },
  ]);

  readonly recent = computed(() => this.orders().slice(0, 5));

  readonly seeding = signal(false);
  readonly seedMsg = signal('');
  readonly SeedIcon = Sparkles;

  async seed(): Promise<void> {
    this.seeding.set(true); this.seedMsg.set('');
    try {
      const fruitsCat = SEED_CATEGORIES[0];
      const catIds: Record<string, string> = {};
      for (const c of SEED_CATEGORIES) {
        const id = await this.catsSvc.create({
          name: c.name, imageUrl: c.imageUrl, icon: c.icon, isActive: true,
          sortOrder: SEED_CATEGORIES.indexOf(c),
        });
        catIds[c.name] = id;
      }
      for (const p of SEED_PRODUCTS) {
        const categoryName = p.name === 'Strawberry' ? 'Berries' : p.name === 'Mango' ? 'Tropical' : p.name === 'Orange' ? 'Citrus' : 'Fruits';
        await this.productsSvc.create({
          name: p.name,
          slug: p.name.toLowerCase().replace(/\s+/g, '-'),
          description: p.description,
          price: p.price,
          categoryId: catIds[categoryName] ?? catIds[fruitsCat.name],
          categoryName,
          stock: 100,
          unit: p.unit,
          thumbnail: p.thumbnail,
          images: [p.thumbnail],
          searchKeywords: [p.name.toLowerCase(), categoryName.toLowerCase()],
          rating: 4.5,
          isAvailable: true,
        });
      }
      this.seedMsg.set(`Seeded ${SEED_CATEGORIES.length} categories and ${SEED_PRODUCTS.length} products.`);
    } catch (e) {
      this.seedMsg.set('Seed failed: ' + ((e as Error)?.message ?? 'unknown error'));
    } finally {
      this.seeding.set(false);
    }
  }
}
