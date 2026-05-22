import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { noAuthGuard } from './core/guards/no-auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/splash/splash.component').then((m) => m.SplashComponent),
  },
  {
    path: 'login',
    canActivate: [noAuthGuard],
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'signup',
    canActivate: [noAuthGuard],
    loadComponent: () => import('./features/auth/signup.component').then((m) => m.SignupComponent),
  },
  {
    path: 'otp',
    canActivate: [noAuthGuard],
    loadComponent: () => import('./features/auth/otp.component').then((m) => m.OtpComponent),
  },

  // Customer routes
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'products',
    canActivate: [authGuard],
    loadComponent: () => import('./features/products/products.component').then((m) => m.ProductsComponent),
  },
  {
    path: 'product/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/products/product-details.component').then((m) => m.ProductDetailsComponent),
  },
  {
    path: 'cart',
    canActivate: [authGuard],
    loadComponent: () => import('./features/cart/cart.component').then((m) => m.CartComponent),
  },
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadComponent: () => import('./features/checkout/checkout.component').then((m) => m.CheckoutComponent),
  },
  {
    path: 'order-success/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/orders/order-success.component').then((m) => m.OrderSuccessComponent),
  },
  {
    path: 'track-order/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/orders/track-order.component').then((m) => m.TrackOrderComponent),
  },
  {
    path: 'favorites',
    canActivate: [authGuard],
    loadComponent: () => import('./features/favorites/favorites.component').then((m) => m.FavoritesComponent),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'orders',
    canActivate: [authGuard],
    loadComponent: () => import('./features/orders/my-orders.component').then((m) => m.MyOrdersComponent),
  },
  {
    path: 'payment-methods',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/payment-methods.component').then((m) => m.PaymentMethodsComponent),
  },
  {
    path: 'payment-demo',
    canActivate: [authGuard],
    loadComponent: () => import('./features/payment/payment-demo.component').then((m) => m.PaymentDemoComponent),
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/notifications.component').then((m) => m.NotificationsComponent),
  },
  {
    path: 'help',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/help-support.component').then((m) => m.HelpSupportComponent),
  },

  // Admin routes
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard',  loadComponent: () => import('./features/admin/dashboard.component').then((m) => m.AdminDashboardComponent) },
      { path: 'products',   loadComponent: () => import('./features/admin/products-admin.component').then((m) => m.ProductsAdminComponent) },
      { path: 'categories', loadComponent: () => import('./features/admin/categories-admin.component').then((m) => m.CategoriesAdminComponent) },
      { path: 'banners',    loadComponent: () => import('./features/admin/banners-admin.component').then((m) => m.BannersAdminComponent) },
      { path: 'orders',     loadComponent: () => import('./features/admin/orders-admin.component').then((m) => m.OrdersAdminComponent) },
      { path: 'users',      loadComponent: () => import('./features/admin/users-admin.component').then((m) => m.UsersAdminComponent) },
      { path: 'refunds',    loadComponent: () => import('./features/admin/refunds-admin.component').then((m) => m.RefundsAdminComponent) },
    ],
  },

  { path: '**', redirectTo: '' },
];
