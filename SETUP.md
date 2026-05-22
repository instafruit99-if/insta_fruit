# InstaFruit — Setup Guide

## 1. Add Firebase Web Config

1. Go to **Firebase Console → Project Settings → Your apps → SDK setup and configuration**
2. Copy the `firebaseConfig` object values
3. Paste into `/app/frontend/src/environments/environment.ts` (and `environment.production.ts` for prod):

```ts
firebase: {
  apiKey: '...',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: '...',
  appId: '...',
  measurementId: 'G-XXXXXX',
},
```

## 2. Enable Firebase Services

In Firebase Console, enable:
- **Authentication** → Email/Password ✓ and Phone ✓ (add your preview URL + production URL to authorized domains)
- **Cloud Firestore** → create database in `asia-south1`
- **Storage** → create default bucket
## 3. Deploy Security Rules + Indexes

From `/app/`:
```bash
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules,firestore:indexes,storage:rules
```

Indexes are defined in `firestore.indexes.json` (project root). After adding/changing any `where` + `orderBy` query in Angular services, update that file and run:

```bash
firebase deploy --only firestore:indexes
```

New composite indexes can take a few minutes to build in Firebase Console → Firestore → Indexes.

## 4. Run Node.js Backend (Razorpay, geocode, refunds)

```bash
cd backend
npm install
cp .env.example .env   # if present; otherwise create .env locally
npm run dev
```

Set in `backend/.env` (never commit this file):

- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_PATH=src/config/service-account.json`
- `GOOGLE_MAPS_API_KEY` (optional, for GPS reverse geocode)
- `PORT=5000`

Set the **public** Razorpay Key ID in `frontend/src/environments/environment.ts`:

```ts
apiUrl: 'http://localhost:5000',
razorpayKeyId: 'rzp_test_XXXXXXXXXXXX',
```

## 5. Create the Admin Account

Two-step (one-time):

**a) Sign up with the admin email** through the app's signup page
   - Email: `admin@instafruit.app`
   - Password: `Admin@123`
   - Full name: `InstaFruit Admin`

**b) Promote to admin** in Firebase Console → Firestore → `users/{uid}` → set field `role: "admin"`

That's it. Log back in — you'll see the **Admin Panel** card on `/profile` and can navigate to `/admin/dashboard`.

From the admin dashboard, click **"Seed sample data"** to populate Firestore with 4 categories and 6 fruit products. The customer home page will instantly show them via realtime listeners.

## 6. Build & Deploy to Firebase Hosting

```bash
cd /app/frontend
yarn build
cd /app
firebase deploy --only hosting
```

The PWA service worker is auto-registered in production builds.

---

## Default credentials (after step 5)

| Role     | Email                    | Password    |
|----------|--------------------------|-------------|
| Admin    | admin@instafruit.app     | Admin@123   |
| Customer | (sign up freely)         | —           |

## Environment files

- `src/environments/environment.ts`             — used in dev (`ng serve`)
- `src/environments/environment.development.ts` — re-exports the above
- `src/environments/environment.production.ts`  — used in `ng build` (production)

Keep both prod and dev configs in sync; only `production: true/false` should differ if you use the same Firebase project for both.
