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
          Temporary demo: creates a ₹500 Razorpay order via backend and opens checkout.
        </p>

        <button
          type="button"
          data-testid="demo-razorpay-pay-btn"
          (click)="pay()"
          [disabled]="loading()"
          class="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-[14px] py-3.5 rounded-card shadow-soft disabled:opacity-60"
        >
          <lucide-icon [img]="CardIcon" [size]="18"></lucide-icon>
          {{ loading() ? 'Opening…' : 'Pay ₹500 (Demo)' }}
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

  back(): void {
    this.location.back();
  }

  async pay(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.payment.runDemoPayment();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      this.loading.set(false);
    }
  }
}
