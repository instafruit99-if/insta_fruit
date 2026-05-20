import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { OrdersService } from '../../core/services/orders.service';
import { Order, OrderStatus } from '../../core/models';
import { normalizeOrderStatus } from '../../core/order-lifecycle/order-transition-validator';

@Component({
  selector: 'app-orders-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div data-testid="orders-admin" class="space-y-5">
      <h1 class="text-[22px] font-extrabold">Orders</h1>
      @if (statusError()) {
        <p class="text-[12px] text-red-500 font-semibold" data-testid="admin-status-error">{{ statusError() }}</p>
      }
      <div class="bg-white rounded-card shadow-soft overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-[13px]">
            <thead class="bg-[#FAFAFA] text-text-secondary text-[11px] uppercase tracking-wider">
              <tr><th class="px-4 py-3 text-left">Order</th><th class="px-4 py-3 text-left">Customer</th><th class="px-4 py-3 text-right">Total</th><th class="px-4 py-3 text-left">Payment</th><th class="px-4 py-3 text-left">Status</th><th class="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              @for (o of orders(); track o.orderId) {
                <tr class="border-t border-border-soft/60">
                  <td class="px-4 py-3 font-semibold">#{{ o.orderId.slice(-8).toUpperCase() }}</td>
                  <td class="px-4 py-3">
                    <p class="font-semibold">{{ o.userName || 'Unknown Customer' }}</p>
                    <p class="text-[11px] text-text-secondary">{{ o.userPhone || 'No Phone' }}</p>
                  </td>
                  <td class="px-4 py-3 text-right font-bold">₹{{ (o?.total ?? 0).toFixed(0) }}</td>
                  <td class="px-4 py-3">
                    <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase"
                          [class.bg-primary-light]="o.paymentStatus === 'success'" [class.text-primary]="o.paymentStatus === 'success'"
                          [class.bg-yellow-50]="o.paymentStatus === 'pending'" [class.text-yellow-600]="o.paymentStatus === 'pending'"
                          [class.bg-red-50]="o.paymentStatus === 'failed' || o.paymentStatus === 'refunded'"
                          [class.text-red-500]="o.paymentStatus === 'failed' || o.paymentStatus === 'refunded'">{{ o.paymentMethod }}/{{ o.paymentStatus }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <select [ngModel]="normalizeStatus(o.orderStatus)" (ngModelChange)="updateStatus(o, $event)"
                            [attr.data-testid]="'status-' + o.orderId"
                            [disabled]="statusOptions(o).length <= 1 || statusUpdating()"
                            class="text-[12px] px-2 py-1.5 rounded-input border border-border-soft font-semibold">
                      @for (s of statusOptions(o); track s) { <option [value]="s">{{ s }}</option> }
                    </select>
                  </td>
                  <td class="px-4 py-3 text-right flex items-center justify-end gap-3">
                    @if (o.orderStatus === 'placed') {
                      <button (click)="accept(o)" [disabled]="statusUpdating()" class="text-primary text-[12px] font-semibold disabled:opacity-50">Accept</button>
                    }
                    @if (o.orderStatus !== 'delivered' && o.orderStatus !== 'cancelled') {
                      <button (click)="cancel(o)" [disabled]="statusUpdating()" class="text-red-500 text-[12px] font-semibold disabled:opacity-50">Cancel</button>
                    } @else {
                      <span class="text-text-secondary text-[12px] font-semibold capitalize">{{ o.orderStatus }}</span>
                    }
                  </td>
                </tr>
              } @empty { <tr><td colspan="6" class="px-4 py-10 text-center text-text-secondary">No orders.</td></tr> }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class OrdersAdminComponent {
  private readonly ordersSvc = inject(OrdersService);
  readonly orders = toSignal(this.ordersSvc.all(), { initialValue: [] as Order[] });
  readonly statusError = signal('');
  readonly statusUpdating = signal(false);
  readonly normalizeStatus = normalizeOrderStatus;

  statusOptions(order: Order): OrderStatus[] {
    const current = normalizeOrderStatus(order.orderStatus);
    const next = this.ordersSvc.getAllowedNextStatuses(current);
    return [current, ...next];
  }

  async updateStatus(order: Order, status: OrderStatus): Promise<void> {
    const current = normalizeOrderStatus(order.orderStatus);
    if (status === current || this.statusUpdating()) return;
    this.statusError.set('');
    this.statusUpdating.set(true);
    try {
      await this.ordersSvc.updateStatus(order.orderId, status);
    } catch (e) {
      this.statusError.set((e as Error).message);
    } finally {
      this.statusUpdating.set(false);
    }
  }

  async accept(order: Order): Promise<void> {
    await this.updateStatus(order, 'accepted');
  }

  async cancel(order: Order): Promise<void> {
    if (this.statusUpdating()) return;
    const reason = prompt('Cancellation reason?') ?? '';
    if (!reason) return;
    this.statusError.set('');
    this.statusUpdating.set(true);
    try {
      await this.ordersSvc.cancel(order.orderId, reason);
    } catch (e) {
      this.statusError.set((e as Error).message);
    } finally {
      this.statusUpdating.set(false);
    }
  }
}
