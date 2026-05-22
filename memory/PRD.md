# InstaFruit — PRD

## Vision
Pixel-perfect Angular + Firebase enterprise SaaS for premium fruit delivery. Customer mobile app + full Admin Panel. Production architecture, scalable, secure, real-time, PWA-enabled.

## Tech Stack
- **Angular 21** standalone components, lazy routes, Signals + RxJS
- **TailwindCSS 3** + Poppins
- **@angular/fire** + Firebase 11 (Auth, Firestore, Storage, Functions, Analytics)
- **Node.js Express backend** for Razorpay create/verify/refund, reverse geocode
- **Razorpay** payment gateway (HMAC verification on Node backend)
- **@angular/service-worker** for PWA
- **Firebase Hosting** target

## Folder Structure (enterprise feature-first)
```
src/app/
  core/
    models/          — typed domain models (User, Product, Order, Payment, Refund, Banner, Cart, Category)
    services/        — auth, products, categories, banners, cart, orders, users, storage, payments, refunds, razorpay, analytics
    guards/          — authGuard, adminGuard, noAuthGuard
  shared/            — product-card, bottom-navbar, search-bar, promo-banner, quantity-selector, order-status-stepper
  features/
    auth/            — login, signup, otp (phone)
    splash/          — auth-aware splash
    home/            — banners + categories + products from Firestore
    products/        — list + details (realtime)
    cart/            — Firestore-persisted cart
    checkout/        — COD + Razorpay flow
    orders/          — order-success, track-order (realtime listener)
    profile/         — Firestore profile + order history + admin entry point
    favorites/
    admin/
      admin-layout   — desktop sidebar + mobile tab
      dashboard      — KPIs, recent orders, seed button
      products-admin — CRUD + image upload
      categories-admin — CRUD + image upload
      banners-admin  — CRUD + image upload + toggle
      orders-admin   — list + status update + cancel
      users-admin    — list + block + role
      refunds-admin  — list + approve (calls processRefund function) + reject

backend/
  src/               — Express API: payment, location, refunds, health

firestore.rules      — strict role-based (customer/admin)
firestore.indexes.json — products/orders/refunds query indexes
storage.rules        — admin-only writes for catalog, owner-only for avatars
firebase.json        — hosting + firestore + storage emulators
ngsw-config.json     — PWA caching strategy
manifest.webmanifest — PWA install manifest
```

## Implemented (May 12, 2026)
- ✅ UI preserved pixel-perfect (no design changes) — verified via screenshot
- ✅ All 11 customer pages wired to Firestore via services
- ✅ Firebase Auth: email/password signup+login+reset, **Phone OTP** with reCAPTCHA
- ✅ Auth-aware routing with `authGuard` / `adminGuard` / `noAuthGuard`
- ✅ Firestore CRUD services for users, products, categories, banners, cart, orders, payments, refunds
- ✅ Firestore-persisted cart with Signals + reactive sync via effect()
- ✅ Realtime order tracking (Firestore listener → stepper progresses with `orderStatus` field)
- ✅ Razorpay flow: createOrder (Node API) → checkout.js → verify (Node API) → orders/payments updated
- ✅ Admin Panel — 7 modules, all wired to Firestore CRUD + Storage image upload
- ✅ Node backend (Razorpay create/verify/refund, reverse geocode)
- ✅ Strict Firestore + Storage security rules (role-based)
- ✅ Composite indexes for product/order/refund queries
- ✅ PWA: `manifest.webmanifest` + `ngsw-config.json` + service worker registered in prod
- ✅ Analytics events (purchase, screen tracking, user tracking)
- ✅ Strict typing, no `any`, models in `core/models`, Smart/Dumb pattern

## What works without Firebase keys
- App loads, splash → login UI renders correctly (verified via Playwright screenshot)
- All routes resolve

## What requires keys (instructions in `/app/SETUP.md`)
- Auth (signup/login/OTP) — needs Firebase Auth enabled + real Firebase config
- Catalog/cart/orders persistence — needs Firestore enabled
- Image uploads from admin — needs Storage enabled
- Razorpay checkout — needs Razorpay keys + Node backend running (`backend/npm run dev`)
- Real refunds — needs same as above

## P1/P2 Backlog
- P1: Search bar on /products wired to `ProductsService.search()` (UI exists, query exists)
- P1: Address book CRUD (UI shows single default address)
- P1: Cancel order from `/profile` order history
- P2: Push notifications (FCM) via backend webhook or scheduled job
- P2: Admin sales charts (analytics aggregate already running)
- P2: SSR (Angular Universal) — recommended deferred until Firebase Hosting deploy
- P2: i18n + multi-currency
