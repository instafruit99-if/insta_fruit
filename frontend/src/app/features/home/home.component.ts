import { Component, computed, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule, MapPin, Bell, ChevronDown } from 'lucide-angular';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import { ProductsService } from '../../core/services/products.service';
import { NotificationService } from '../../core/services/notification.service';
import { CategoriesService } from '../../core/services/categories.service';
import { BannersService } from '../../core/services/banners.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductCardComponent } from '../../shared/product-card.component';
import { SearchBarComponent } from '../../shared/search-bar.component';
import { BottomNavbarComponent } from '../../shared/bottom-navbar.component';
import { LocationPickerComponent } from '../../shared/location-picker.component';
import { LocationService } from '../../core/services/location.service';
import { Banner } from '../../core/models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ProductCardComponent, SearchBarComponent, BottomNavbarComponent, LocationPickerComponent],
  template: `
    <div data-testid="home-page" class="min-h-screen pb-28" style="background:#FAFAFA;">
      <div class="px-5 pt-12 pb-8 text-white relative overflow-hidden"
           style="background:#08B44D; border-bottom-left-radius:32px; border-bottom-right-radius:32px;">
        <div class="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10"></div>
        <div class="absolute right-16 bottom-2 w-20 h-20 rounded-full bg-white/10"></div>
        <div class="relative flex items-start justify-between mb-5">
          <div>
            <div class="flex items-center gap-1.5 text-white/80 text-[11px] font-semibold mb-0.5">
              <lucide-icon [img]="MapPinIcon" [size]="12"></lucide-icon>
              <span>Deliver to</span>
            </div>
            <button type="button" data-testid="location-btn"
                    (click)="openLocationPicker()"
                    [disabled]="location.loading()"
                    class="flex items-center gap-1 text-white text-[15px] font-bold disabled:opacity-70 active:scale-95 transition-transform">
              {{ location.loading() ? 'Detecting…' : location.area() }}
              <lucide-icon [img]="ChevronIcon" [size]="16"></lucide-icon>
            </button>
          </div>
          <button data-testid="notification-btn" (click)="goNotifications()" class="w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center relative active:scale-95 transition-transform cursor-pointer">
            <lucide-icon [img]="BellIcon" [size]="18"></lucide-icon>
            @if (unreadCount() > 0) {
              <span class="absolute top-1 right-1.5 w-4 h-4 rounded-full bg-red-500 border-2 border-[#08B44D] flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                {{ unreadCount() > 9 ? '9+' : unreadCount() }}
              </span>
            }
          </button>
        </div>
        <h1 class="text-2xl font-extrabold leading-tight">Hello, {{ firstName() }} 👋</h1>
        <p class="text-white/85 text-[13px] mt-1">What fresh fruits today?</p>
      </div>

      <div class="px-5 -mt-6 relative z-10">
        <app-search-bar
          [hint]="searchHint"
          (searchSubmit)="onSearch($event)"></app-search-bar>
      </div>

      <!-- Promo banner carousel from Firestore (all active banners) -->
      <div class="px-5 mt-6">
        @if (banners().length > 0) {
          <div data-testid="banner-carousel">
            <div #carousel (scroll)="onCarouselScroll()"
                 class="flex overflow-x-auto no-scrollbar snap-x snap-mandatory gap-4 -mx-5 px-5">
              @for (b of banners(); track b.id) {
                <div data-testid="promo-banner" (click)="onBannerClick(b)"
                     class="relative rounded-card overflow-hidden text-white p-5 shadow-soft-lg flex-shrink-0 w-full snap-center cursor-pointer min-h-[150px]"
                     style="background: linear-gradient(120deg,#08B44D 0%,#00963F 100%);">
                  <div class="relative z-10 max-w-[60%]">
                    @if (b.subtitle) {
                      <span class="inline-block bg-white/20 backdrop-blur px-3 py-1 rounded-full text-[11px] font-semibold mb-3">{{ b.subtitle }}</span>
                    }
                    <h3 class="text-xl font-extrabold leading-tight mb-1">{{ b.title }}</h3>
                    @if (b.ctaLabel) {
                      <button class="mt-3 inline-flex items-center gap-2 bg-white text-primary text-[12px] font-bold rounded-full px-4 py-2 shadow-soft">{{ b.ctaLabel }}</button>
                    }
                  </div>
                  <div class="absolute -right-6 -bottom-4 w-40 h-40 rounded-full bg-white/10"></div>
                  <img [src]="b.imageUrl" alt="banner" class="absolute right-0 bottom-0 h-36 w-36 object-cover rounded-full shadow-2xl border-4 border-white/20" />
                </div>
              }
            </div>
            @if (banners().length > 1) {
              <div class="flex justify-center gap-1.5 mt-3">
                @for (b of banners(); track b.id; let i = $index) {
                  <button type="button" (click)="goToSlide(i)"
                          class="h-1.5 rounded-full transition-all duration-300"
                          [class.w-5]="activeSlide() === i"
                          [class.bg-primary]="activeSlide() === i"
                          [class.w-1.5]="activeSlide() !== i"
                          [class.bg-border-soft]="activeSlide() !== i"></button>
                }
              </div>
            }
          </div>
        } @else {
          <div class="relative rounded-card overflow-hidden text-white p-5 shadow-soft-lg" style="background: linear-gradient(120deg,#08B44D 0%,#00963F 100%);">
            <div class="relative z-10 max-w-[60%]">
              <span class="inline-block bg-white/20 backdrop-blur px-3 py-1 rounded-full text-[11px] font-semibold mb-3">Welcome</span>
              <h3 class="text-xl font-extrabold leading-tight mb-1">Fresh fruits<br/>delivered fast</h3>
              <p class="text-[12px] text-white/80 mb-4">Add Firebase config & seed data to start</p>
            </div>
            <div class="absolute -right-6 -bottom-4 w-40 h-40 rounded-full bg-white/10"></div>
          </div>
        }
      </div>

      <!-- Categories -->
      <div class="px-5 mt-7">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-[17px] font-extrabold text-text-primary">Categories</h2>
          <a class="text-[12px] text-primary font-semibold" (click)="goProducts()">See all</a>
        </div>
        <div class="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
          @if (categories() === undefined) {
            @for (i of [1,2,3,4,5]; track i) {
              <div class="flex-shrink-0 flex flex-col items-center gap-2 px-4 py-3 rounded-2xl bg-white shadow-soft animate-pulse">
                <div class="w-12 h-12 rounded-full bg-border-soft/30"></div>
                <div class="w-14 h-2.5 rounded-full bg-border-soft/30"></div>
              </div>
            }
          } @else if (categories()?.length === 0) {
            <span class="text-[12px] text-text-secondary py-3">No categories yet — add from admin panel.</span>
          } @else {
            @for (cat of categories(); track cat.id) {
              <button [attr.data-testid]="'category-' + cat.id" (click)="selectedCategory.set(cat.id)"
                      class="flex-shrink-0 flex flex-col items-center gap-2 px-4 py-3 rounded-2xl transition-all"
                      [class.bg-white]="selectedCategory() !== cat.id"
                      [class.shadow-soft]="selectedCategory() !== cat.id"
                      [class.bg-primary]="selectedCategory() === cat.id"
                      [class.text-white]="selectedCategory() === cat.id">
                <div class="w-12 h-12 rounded-full flex items-center justify-center text-2xl overflow-hidden"
                     [style.background]="selectedCategory() === cat.id ? 'rgba(255,255,255,0.18)' : '#EAF7EC'">
                  @if (cat.imageUrl) {
                    <img [src]="cat.imageUrl" [alt]="cat.name" class="w-10 h-10 object-contain" />
                  } @else {
                    <span>{{ cat.icon ?? '🍎' }}</span>
                  }
                </div>
                <span class="text-[12px] font-semibold">{{ cat.name }}</span>
              </button>
            }
          }
        </div>
      </div>

      <!-- Popular -->
      <div class="px-5 mt-7">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-[17px] font-extrabold text-text-primary">Popular Products</h2>
          <a data-testid="see-all-products" class="text-[12px] text-primary font-semibold cursor-pointer" (click)="goProducts()">See all</a>
        </div>
        <div class="grid grid-cols-2 gap-4">
          @if (popular() === undefined) {
            @for (i of [1,2,3,4]; track i) {
              <div class="bg-white rounded-card p-3 shadow-soft animate-pulse">
                <div class="w-full aspect-square rounded-xl bg-border-soft/30 mb-3"></div>
                <div class="w-3/4 h-3.5 rounded-full bg-border-soft/30 mb-2"></div>
                <div class="w-1/2 h-2.5 rounded-full bg-border-soft/30 mb-3"></div>
                <div class="flex justify-between items-center mt-2">
                  <div class="w-10 h-5 rounded-full bg-border-soft/30"></div>
                  <div class="w-8 h-8 rounded-full bg-border-soft/30"></div>
                </div>
              </div>
            }
          } @else if (popular()?.length === 0) {
            <div class="col-span-2 text-center text-[12px] text-text-secondary py-10">
              No products yet. Sign in as admin and add products to get started.
            </div>
          } @else {
            @for (p of popular()!; track p.id) {
              <app-product-card [product]="p"></app-product-card>
            }
          }
        </div>
      </div>

      <app-bottom-navbar></app-bottom-navbar>

      <app-location-picker [open]="showLocationPicker()" (closed)="showLocationPicker.set(false)" />
    </div>
  `,
})
export class HomeComponent implements OnInit, OnDestroy {
  /** Shown under the search field (static copy). */
  readonly searchHint =
    'Type a fruit name (for example kiwi), then press Enter on the keyboard or tap the green search button on the right.';

  private readonly router = inject(Router);
  private readonly productsSvc = inject(ProductsService);
  private readonly catsSvc = inject(CategoriesService);
  private readonly bannersSvc = inject(BannersService);
  private readonly auth = inject(AuthService);
  private readonly notificationsSvc = inject(NotificationService);
  readonly location = inject(LocationService);

  readonly MapPinIcon = MapPin; readonly BellIcon = Bell; readonly ChevronIcon = ChevronDown;

  readonly notifications = toSignal(
    toObservable(this.auth.user).pipe(
      switchMap((u) => u ? this.notificationsSvc.myNotifications(u.uid) : of([]))
    ),
    { initialValue: [] }
  );

  readonly unreadCount = computed(() => this.notificationsSvc.unreadCount(this.notifications()));

  ngOnInit(): void {
    void this.location.loadSaved();
    this.autoSlideTimer = setInterval(() => this.nextSlide(), 4000);
  }

  ngOnDestroy(): void {
    clearInterval(this.autoSlideTimer);
  }

  readonly categories = toSignal(this.catsSvc.list());
  readonly banners = toSignal(this.bannersSvc.list(), { initialValue: [] });
  readonly products = toSignal(this.productsSvc.list());

  // ----- Banner carousel -----
  private readonly carouselEl = viewChild<ElementRef<HTMLDivElement>>('carousel');
  readonly activeSlide = signal(0);
  private autoSlideTimer: ReturnType<typeof setInterval> | undefined;

  /** Width of one slide step: slide (full width minus px-5 padding) + gap-4. */
  private slideStep(el: HTMLDivElement): number {
    return el.clientWidth - 40 + 16;
  }

  onCarouselScroll(): void {
    const el = this.carouselEl()?.nativeElement;
    if (!el) return;
    this.activeSlide.set(Math.round(el.scrollLeft / this.slideStep(el)));
  }

  goToSlide(i: number): void {
    const el = this.carouselEl()?.nativeElement;
    if (!el) return;
    el.scrollTo({ left: i * this.slideStep(el), behavior: 'smooth' });
  }

  private nextSlide(): void {
    const count = this.banners().length;
    if (count < 2) return;
    this.goToSlide((this.activeSlide() + 1) % count);
  }

  onBannerClick(b: Banner): void {
    if (!b.redirectUrl) return;
    if (b.redirectUrl.startsWith('http')) {
      window.open(b.redirectUrl, '_blank');
    } else {
      this.router.navigateByUrl(b.redirectUrl);
    }
  }

  readonly popular = computed(() => {
    const list = this.products();
    if (list === undefined) return undefined;
    const catId = this.selectedCategory();
    let filtered = list;
    if (catId) {
      const cats = this.categories();
      const cat = cats?.find((c) => c.id === catId);
      filtered = list.filter(
        (p) => p.categoryId === catId || (cat != null && p.categoryName === cat.name),
      );
    }
    return filtered.slice(0, 6);
  });
  readonly selectedCategory = signal<string>('');
  readonly showLocationPicker = signal(false);
  readonly firstName = computed(() => (this.auth.profile()?.fullName ?? '').split(' ')[0] || 'there');

  openLocationPicker(): void {
    this.showLocationPicker.set(true);
  }

  goProducts(): void {
    const cat = this.selectedCategory();
    this.router.navigate(['/products'], cat ? { queryParams: { category: cat } } : {});
  }

  onSearch(raw: string): void {
    const q = raw.trim();
    const cat = this.selectedCategory();
    const queryParams: Record<string, string> = {};
    if (cat) queryParams['category'] = cat;
    if (q) queryParams['search'] = q;
    this.router.navigate(['/products'], Object.keys(queryParams).length ? { queryParams } : {});
  }

  goNotifications(): void {
    this.router.navigate(['/notifications']);
  }
}
