import { Component, computed, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule, ChevronLeft, Phone, MessageSquare, Home } from 'lucide-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { OrdersService } from '../../core/services/orders.service';
import { Order } from '../../core/models';
import { OrderStatusStepperComponent } from '../../shared/order-status-stepper.component';
import { normalizeOrderStatus } from '../../core/order-lifecycle/order-transition-validator';
import { TRACK_ORDER_STEP_COUNT, trackOrderStepIndex } from '../../core/order-lifecycle/order-timeline';

@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, OrderStatusStepperComponent],
  template: `
    <div data-testid="track-order-page" class="min-h-screen bg-[#FAFAFA]">
      <div class="relative h-72 overflow-hidden" style="background:linear-gradient(135deg,#DCEEDB 0%,#EAF7EC 60%,#F4FAF1 100%);">
        <svg class="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 400 320" preserveAspectRatio="none">
          <path d="M0,80 Q100,40 200,120 T400,90" fill="none" stroke="#08B44D" stroke-width="2" stroke-dasharray="6 6"/>
          <path d="M0,200 Q120,180 240,220 T400,210" fill="none" stroke="#7A7A7A" stroke-width="1" stroke-dasharray="4 4" opacity="0.5"/>
          <path d="M40,0 Q60,120 140,160 T320,320" fill="none" stroke="#08B44D" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.4"/>
        </svg>
        <div class="absolute top-0 inset-x-0 px-5 pt-12 flex items-center justify-between">
          <button data-testid="back-btn" (click)="back()" class="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-soft">
            <lucide-icon [img]="ChevronIcon" [size]="20" class="text-text-primary"></lucide-icon>
          </button>
          <h1 class="text-[15px] font-extrabold text-text-primary">Track Order</h1>
          <div class="w-10"></div>
        </div>
        <div class="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/4 flex flex-col items-center">
          <div class="w-14 h-14 rounded-full bg-white shadow-soft-lg flex items-center justify-center border-2 border-primary">
            <span class="text-2xl">🛵</span>
          </div>
          <div class="w-3 h-3 rounded-full bg-primary mt-1 shadow-green"></div>
        </div>
      </div>

      <div class="-mt-12 px-5 relative z-10">
        <div data-testid="eta-card" class="bg-white rounded-card p-5 shadow-soft-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[11px] text-text-secondary font-semibold uppercase tracking-wider">Estimated Arrival</p>
              <p class="text-[22px] font-extrabold text-text-primary mt-1" data-testid="eta-time">{{ etaTime() }}</p>
            </div>
            <div class="text-right">
              <p class="text-[11px] text-text-secondary font-semibold">Time left</p>
              <p class="text-[18px] font-extrabold text-primary" data-testid="eta-remaining">{{ remainingMin() }} min</p>
            </div>
          </div>
          <div class="mt-4 h-1.5 rounded-full bg-primary-light overflow-hidden">
            <div class="h-full bg-primary transition-all duration-500" [style.width.%]="progress()"></div>
          </div>
        </div>
      </div>

      <div class="px-5 mt-5">
        <div data-testid="delivery-agent" class="bg-white rounded-card p-4 shadow-soft flex items-center gap-3">
          <img src="https://i.pravatar.cc/64?img=33" alt="agent" class="w-12 h-12 rounded-full object-cover" />
          <div class="flex-1">
            <p class="text-[14px] font-bold text-text-primary">Marcus Rivera</p>
            <p class="text-[11px] text-text-secondary">Your delivery partner</p>
          </div>
          <button class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
            <lucide-icon [img]="MessageIcon" [size]="16" class="text-primary"></lucide-icon>
          </button>
          <button class="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <lucide-icon [img]="PhoneIcon" [size]="16" class="text-white"></lucide-icon>
          </button>
        </div>
      </div>

      <div class="px-5 mt-6 pb-12">
        <h2 class="text-[14px] font-bold text-text-primary mb-4">Order Status</h2>
        <div class="bg-white rounded-card p-5 shadow-soft">
          <app-order-status-stepper [activeIndex]="activeIndex()"></app-order-status-stepper>
        </div>
        
        <button (click)="goHome()" class="w-full mt-6 h-12 bg-primary-light text-primary rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors">
          <lucide-icon [img]="HomeIcon" [size]="18"></lucide-icon> Back to Home
        </button>
      </div>
    </div>
  `,
})
export class TrackOrderComponent {
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ordersSvc = inject(OrdersService);

  readonly ChevronIcon = ChevronLeft;
  readonly PhoneIcon = Phone;
  readonly MessageIcon = MessageSquare;
  readonly HomeIcon = Home;

  private readonly orderId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly order = toSignal(this.ordersSvc.one(this.orderId), { initialValue: undefined as Order | undefined });

  readonly activeIndex = computed(() => {
    const s = this.order()?.orderStatus;
    if (!s) return 0;
    return trackOrderStepIndex(normalizeOrderStatus(s));
  });

  readonly progress = computed(() => ((this.activeIndex() + 1) / TRACK_ORDER_STEP_COUNT) * 100);

  readonly etaDate = computed(() => {
    const eta = this.order()?.estimatedArrivalTime as { toDate?: () => Date } | Date | undefined;
    if (!eta) return new Date(Date.now() + 30 * 60 * 1000);
    return typeof (eta as { toDate?: () => Date }).toDate === 'function'
      ? (eta as { toDate: () => Date }).toDate()
      : (eta as Date);
  });

  readonly etaTime = computed(() => this.etaDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  readonly remainingMin = computed(() => Math.max(0, Math.ceil((this.etaDate().getTime() - Date.now()) / 60000)));

  back(): void { this.location.back(); }
  goHome(): void { this.router.navigate(['/home']); }
}
