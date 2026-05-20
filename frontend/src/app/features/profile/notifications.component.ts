import { Component, effect, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { LucideAngularModule, ChevronLeft, Bell, Calendar } from 'lucide-angular';
import { Router } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { AppNotification } from '../../core/notifications/notification.types';
import { BottomNavbarComponent } from '../../shared/bottom-navbar.component';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, BottomNavbarComponent],
  template: `
    <div data-testid="notifications-page" class="min-h-screen bg-[#FAFAFA] pb-28">
      <div class="px-5 pt-12 pb-4 flex items-center justify-between bg-white border-b border-border-soft/50">
        <button type="button" (click)="back()" class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
          <lucide-icon [img]="ChevronIcon" [size]="20" class="text-primary"></lucide-icon>
        </button>
        <h1 class="text-[16px] font-extrabold text-text-primary">Notifications</h1>
        <div class="w-10"></div>
      </div>

      <div class="px-5 pt-6 space-y-3">
        @for (n of notifications(); track n.id) {
          @if (n.relatedOrderId || n.orderId) {
            <button type="button" (click)="openNotification(n)" class="w-full text-left bg-white rounded-card p-4 shadow-soft flex gap-3 active:scale-[0.98] transition-transform">
              <div class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                <lucide-icon [img]="BellIcon" [size]="18" class="text-primary"></lucide-icon>
              </div>
              <div>
                <p class="text-[13px] font-bold text-text-primary">{{ n.title }}</p>
                <p class="text-[12px] text-text-secondary mt-1 leading-relaxed">{{ n.message }}</p>
              </div>
            </button>
          } @else {
            <div class="w-full text-left bg-white rounded-card p-4 shadow-soft flex gap-3">
              <div class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                <lucide-icon [img]="BellIcon" [size]="18" class="text-primary"></lucide-icon>
              </div>
              <div>
                <p class="text-[13px] font-bold text-text-primary">{{ n.title }}</p>
                <p class="text-[12px] text-text-secondary mt-1 leading-relaxed">{{ n.message }}</p>
              </div>
            </div>
          }
        } @empty {
          <div class="bg-white rounded-card p-4 shadow-soft flex gap-3">
            <div class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0">
              <lucide-icon [img]="BellIcon" [size]="18" class="text-primary"></lucide-icon>
            </div>
            <div>
              <p class="text-[13px] font-bold text-text-primary">Order updates</p>
              <p class="text-[12px] text-text-secondary mt-1 leading-relaxed">
                You will see order status on the track-order screen. We will also notify you here.
              </p>
            </div>
          </div>
          <p class="text-[11px] text-text-secondary text-center px-4">No new notifications yet.</p>
        }
      </div>

      <app-bottom-navbar></app-bottom-navbar>
    </div>
  `,
})
export class NotificationsComponent {
  private readonly location = inject(Location);
  private readonly notificationsSvc = inject(NotificationService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  
  readonly notifications = toSignal(
    toObservable(this.auth.user).pipe(
      switchMap((u) => u ? this.notificationsSvc.myNotifications(u.uid) : of([] as AppNotification[]))
    ),
    { initialValue: [] }
  );

  readonly ChevronIcon = ChevronLeft;
  readonly BellIcon = Bell;

  constructor() {
    effect(() => {
      const list = this.notifications();
      for (const n of list) {
        if (!n.isRead && n.id) {
          void this.notificationsSvc.markNotificationAsRead(n.id);
        }
      }
    });
  }

  back(): void { this.location.back(); }
  openNotification(n: AppNotification): void {
    this.notificationsSvc.routing.navigate(this.router, n);
    void this.notificationsSvc.markNotificationAsRead(n.id);
  }
}
