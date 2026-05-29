import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule, LayoutDashboard, Package, FolderTree, Image, ShoppingBag, Users, Undo2, LogOut, Leaf, ArrowLeft } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, LucideAngularModule],
  styles: [`
    :host { display: block; }
    @media (min-width: 768px) { 
      :host { position: fixed; inset: 0; z-index: 50; overflow: hidden; }
    }
    .nav-active { background: rgba(8, 180, 77, 0.1) !important; color: #08B44D !important; font-weight: 800 !important; }
    .nav-active lucide-icon { color: #08B44D !important; }
  `],
  template: `
    <div data-testid="admin-layout" class="min-h-screen md:h-full bg-[#F9F9F9] flex flex-col md:flex-row font-sans">
      
      <!-- Sidebar / Topbar -->
      <aside class="w-full md:w-[260px] bg-white border-b md:border-b-0 md:border-r border-border-soft flex flex-col shadow-[2px_0_8px_rgba(0,0,0,0.02)] z-10 shrink-0">
        <!-- Logo Area -->
        <div class="px-6 py-5 flex items-center justify-between md:justify-start gap-4 border-b border-border-soft/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-[#00963F] flex items-center justify-center shadow-soft">
              <lucide-icon [img]="LeafIcon" [size]="20" class="text-white"></lucide-icon>
            </div>
            <div>
              <p class="text-[17px] font-extrabold text-text-primary leading-tight tracking-tight">InstaFruit</p>
              <p class="text-[12px] font-semibold text-text-secondary">Admin Console</p>
            </div>
          </div>
          <!-- Mobile back to store -->
          <a routerLink="/home" class="md:hidden w-10 h-10 rounded-full bg-primary-light/50 flex items-center justify-center text-primary">
            <lucide-icon [img]="BackIcon" [size]="18"></lucide-icon>
          </a>
        </div>

        <!-- Navigation -->
        <nav class="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto no-scrollbar px-4 py-3 md:py-6 flex-1 border-border-soft/50">
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="nav-active"
               [routerLinkActiveOptions]="{ exact: false }"
               class="flex items-center gap-3.5 px-4 py-3 rounded-xl text-[14px] font-semibold text-text-secondary hover:bg-gray-50 hover:text-text-primary transition-all whitespace-nowrap shrink-0 group">
              <lucide-icon [img]="item.icon" [size]="18" class="text-text-secondary/70 group-hover:text-text-primary transition-colors"></lucide-icon>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <!-- Bottom Actions (Desktop) -->
        <div class="hidden md:flex flex-col gap-4 p-5 border-t border-border-soft bg-gray-50/50">
          <a routerLink="/home" class="flex items-center justify-center gap-2 w-full h-12 rounded-xl text-[13px] font-bold text-primary bg-primary-light/60 hover:bg-primary-light transition-colors border border-primary/10 shadow-sm">
            <lucide-icon [img]="BackIcon" [size]="16"></lucide-icon> Back to Store
          </a>
          
          <div class="flex items-center gap-3 bg-white p-3 rounded-xl border border-border-soft shadow-sm">
            <div class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold text-[14px]">
              {{ profile()?.fullName?.[0] || 'A' }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-bold text-text-primary truncate">{{ profile()?.fullName }}</p>
              <p class="text-[11px] text-text-secondary truncate">{{ profile()?.email }}</p>
            </div>
            <button (click)="logout()" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-red-500 hover:bg-red-50 transition-colors" title="Logout">
              <lucide-icon [img]="LogoutIcon" [size]="16"></lucide-icon>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 min-w-0 h-full overflow-y-auto bg-[#FAFAFA] p-4 md:p-8">
        <div class="max-w-6xl mx-auto">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `,
})
export class AdminLayoutComponent {
  private readonly auth = inject(AuthService);
  readonly profile = this.auth.profile;
  readonly LeafIcon = Leaf; readonly LogoutIcon = LogOut; readonly BackIcon = ArrowLeft;

  readonly nav = [
    { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Products', path: '/admin/products', icon: Package },
    { id: 'categories', label: 'Categories', path: '/admin/categories', icon: FolderTree },
    { id: 'banners', label: 'Banners', path: '/admin/banners', icon: Image },
    { id: 'orders', label: 'Orders', path: '/admin/orders', icon: ShoppingBag },
    { id: 'users', label: 'Users', path: '/admin/users', icon: Users },
    { id: 'refunds', label: 'Refunds', path: '/admin/refunds', icon: Undo2 },
  ];

  async logout(): Promise<void> { await this.auth.signOutUser(); }
}
