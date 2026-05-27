# Production deployment (GitHub Pages now → Firebase Hosting for client)

Same build for both frontends: `frontend/scripts/write-production-env.js` + `ng build --configuration production`.

Shared frontend origins: `config/production-frontends.json`

---

## 1. Deploy backend (HTTPS) — Render

GitHub Pages **cannot** call `localhost`. Backend must be public HTTPS.

1. Open [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect this repo — Render reads `render.yaml`
3. Set **secret** env vars on the `instafruit-backend` service:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — paste full JSON from Firebase Console → Service accounts → Generate key (one line)
   - `GOOGLE_MAPS_API_KEY` (optional)
4. Deploy → copy service URL, e.g. `https://instafruit-backend.onrender.com`

### Razorpay webhook (production)

Dashboard → Settings → Webhooks:

- URL: `https://YOUR-RENDER-URL/api/payment/webhook`
- Secret: same as `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.captured`, `payment.failed`, `refund.processed`

---

## 2. GitHub repo secrets (required for Pages deploy)

Repo → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Example |
|--------|---------|
| `BACKEND_API_URL` | `https://instafruit-backend.onrender.com` |
| `RAZORPAY_KEY_ID` | `rzp_live_…` |

Optional **variable** (not secret):

| Variable | Value |
|----------|--------|
| `FRONTEND_BASE_HREF` | `/` for `username.github.io`, or `/repo-name/` for project Pages |

Push to `main` → workflow **Deploy GitHub Pages** runs → site uses production API URL.

---

## 3. Firebase Auth authorized domains

Firebase Console → **Authentication** → **Settings** → **Authorized domains** — add:

- `instafruit99-if.github.io` (GitHub Pages now)
- `instafruit99-13755.web.app` (Firebase Hosting later)
- `instafruit99-13755.firebaseapp.com`

(List also in `config/production-frontends.json`.)

---

## 4. Local development

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm start
# → http://localhost:3000  (apiUrl: http://localhost:5000 in environment.ts)
```

---

## 5. Firebase Hosting (client delivery — later)

Same secrets as GitHub: `BACKEND_API_URL`, `RAZORPAY_KEY_ID`, plus `FIREBASE_SERVICE_ACCOUNT` (JSON for deploy).

Actions → **Deploy Firebase Hosting** → **Run workflow** (manual).

Build uses `--base-href /` (Firebase Hosting root). Backend URL and CORS stay the same — no backend change when switching frontend host.

---

## Checklist before Razorpay on live site

- [ ] Backend live on Render (health: `GET /health` → 200)
- [ ] GitHub secrets `BACKEND_API_URL` + `RAZORPAY_KEY_ID` set
- [ ] GitHub Pages redeployed after secrets added
- [ ] Firebase Auth domain `instafruit99-if.github.io` added
- [ ] Razorpay webhook URL points to Render backend
