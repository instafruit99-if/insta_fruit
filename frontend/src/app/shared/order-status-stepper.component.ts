import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Check, Package, Truck, ShoppingBag, MapPin, CheckSquare } from 'lucide-angular';

interface Step {
  label: string;
  icon: any;
}

@Component({
  selector: 'app-order-status-stepper',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div data-testid="order-status-stepper" class="space-y-4">
      @for (s of steps; track s.label; let i = $index) {
        <div class="flex items-start gap-4">
          <div class="flex flex-col items-center">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center transition-all"
              [class.bg-primary]="i <= activeIndex()"
              [class.text-white]="i <= activeIndex()"
              [class.bg-primary-light]="i > activeIndex()"
              [class.text-primary]="i > activeIndex()"
            >
              @if (i < activeIndex()) {
                <lucide-icon [img]="CheckIcon" [size]="18"></lucide-icon>
              } @else {
                <lucide-icon [img]="s.icon" [size]="18"></lucide-icon>
              }
            </div>
            @if (i < steps.length - 1) {
              <div
                class="w-0.5 h-8 my-1 transition-colors"
                [class.bg-primary]="i < activeIndex()"
                [class.bg-border-soft]="i >= activeIndex()"
              ></div>
            }
          </div>
          <div class="flex-1 pt-1.5">
            <p
              class="text-[14px] font-bold"
              [class.text-text-primary]="i <= activeIndex()"
              [class.text-text-secondary]="i > activeIndex()"
            >{{ s.label }}</p>
            @if (i === activeIndex()) {
              <p class="text-[11px] text-primary font-semibold mt-0.5">In progress…</p>
            } @else if (i < activeIndex()) {
              <p class="text-[11px] text-text-secondary mt-0.5">Completed</p>
            } @else {
              <p class="text-[11px] text-text-secondary/60 mt-0.5">Pending</p>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class OrderStatusStepperComponent {
  readonly activeIndex = input<number>(0);
  readonly CheckIcon = Check;
  readonly steps: Step[] = [
    { label: 'Order Placed', icon: ShoppingBag },
    { label: 'Accepted', icon: CheckSquare },
    { label: 'Preparing', icon: Package },
    { label: 'Packed', icon: Package },
    { label: 'Rider Assigned', icon: Truck },
    { label: 'Out for Delivery', icon: Truck },
    { label: 'Delivered', icon: MapPin },
  ];
}
