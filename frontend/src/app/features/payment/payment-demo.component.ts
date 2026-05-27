import { Component, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { LucideAngularModule, ChevronLeft, CreditCard } from 'lucide-angular';
import { PaymentService } from '../../core/services/payment.service';
import { BottomNavbarComponent } from '../../shared/bottom-navbar.component';

@Component({
  selector: 'app-payment-demo',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, BottomNavbarComponent],
  template: `
    <div data-testid="payment-demo-page" class="min-h-screen bg-[#FAFAFA] pb-28">
      <div class="px-5 pt-12 pb-4 flex items-center justify-between bg-white border-b border-border-soft/50">
        <button type="button" (click)="back()" class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
          <lucide-icon [img]="ChevronIcon" [size]="20" class="text-primary"></lucide-icon>
        </button>
        <h1 class="text-[16px] font-extrabold text-text-primary">Payment Demo</h1>
        <div class="w-10"></div>
      </div>

      <div class="px-5 pt-6">
        <p class="text-[12px] text-text-secondary mb-4">
          Demo requires a real order id from checkout. Place an order first, then paste its id below.
        </p>

        <input
          type="text"
          data-testid="demo-order-id-input"
          class="w-full text-[13px] px-3 py-2 rounded-input border border-border-soft mb-3"
          placeholder="Order ID"
          [value]="orderId()"
          (input)="orderId.set(($any($event.target).value))"
        />

        <button
          type="button"
          data-testid="demo-razorpay-pay-btn"
          (click)="pay()"
          [disabled]="loading() || !orderId().trim()"
          class="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-[14px] py-3.5 rounded-card shadow-soft disabled:opacity-60"
        >
          <lucide-icon [img]="CardIcon" [size]="18"></lucide-icon>
          {{ loading() ? 'Opening…' : 'Pay with Razorpay (Demo)' }}
        </button>

        @if (error()) {
          <p class="mt-3 text-[12px] text-red-600">{{ error() }}</p>
        }
      </div>

      <app-bottom-navbar></app-bottom-navbar>
    </div>
  `,
})
export class PaymentDemoComponent {
  private readonly location = inject(Location);
  private readonly payment = inject(PaymentService);

  readonly ChevronIcon = ChevronLeft;
  readonly CardIcon = CreditCard;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly orderId = signal('');

  back(): void {
    this.location.back();
  }

  async pay(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.payment.runDemoPayment(this.orderId().trim());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      this.loading.set(false);
    }
  }
}
