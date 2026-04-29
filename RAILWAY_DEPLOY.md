# 🚂 Railway Deployment Guide — Diba Reservation System

## Architecture on Railway

```
┌──────────────────────────────────────────────────┐
│                  Railway Project                 │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Web API  │  │  Redis   │  │  PostgreSQL   │  │
│  │ (Node.js) │──│ (Valkey) │  │  (or Supabase)│  │
│  │  :3000    │  │  :6379   │  │  :5432        │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│       │                            │             │
│       └────── Stripe Webhooks ─────┘             │
└──────────────────────────────────────────────────┘
```

---

## Step 1 — Create Railway Services

1. Go to [railway.app](https://railway.app) → **New Project**
2. Add **3 services**:
   - **Web Service** → Connect your GitHub repo
   - **Redis** → Click **+ New** → **Database** → **Redis**
   - **PostgreSQL** → Click **+ New** → **Database** → **PostgreSQL**
     - *Or use your existing Supabase DB (skip this if so)*

---

## Step 2 — Environment Variables

Copy these into Railway's **Variables** tab for the **Web Service**.

### 🔴 Required — Will CRASH Without These

| Variable | Value | Where to Get It |
|:---|:---|:---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway auto-fills if you link the Postgres service. If using Supabase, **MUST** use the Transaction Pooler URL (aws-0-[region].pooler.supabase.com:6543) with `?pgbouncer=true`. Direct IPv6 connections (`db.*.supabase.co:5432`) will crash with P1001. |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | Railway auto-fills if you link the Redis service. |
| `STRIPE_SECRET_KEY` | `sk_live_...` | [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe Dashboard → Webhooks (create endpoint first, see Step 4) |
| `JWT_SECRET` | *Random 32+ char string* | Generate: `openssl rand -base64 32` |
| `ADMIN_PIN` | *Your manager PIN* | Choose a strong numeric PIN (e.g. `847291`) |
| `NODE_ENV` | `production` | Literal string |

### 🟠 Email (SMTP) — Required for Guest Notifications

| Variable | Value | Notes |
|:---|:---|:---|
| `SMTP_HOST` | `smtp.gmail.com` | Or your provider (Brevo, SendGrid, Mailgun) |
| `SMTP_PORT` | `465` | Use `587` for STARTTLS, `465` for SSL |
| `SMTP_USER` | `reservations@dibarestaurant.ca` | Your sending email |
| `SMTP_PASS` | *App password* | Gmail: [Generate App Password](https://myaccount.google.com/apppasswords) |
| `SMTP_SECURE` | `true` | Set `true` for port 465, omit for 587 |
| `MAIL_FROM` | `Diba Restaurant <no-reply@dibarestaurant.ca>` | Display name + email |

### 🟡 Business Logic — Has Defaults, Override if Needed

| Variable | Default | Description |
|:---|:---|:---|
| `PORT` | `3000` | Railway sets `${{PORT}}` automatically — **don't set this manually** |
| `DEPOSIT_THRESHOLD` | `10` | Party size ≥ this triggers Stripe deposit |
| `BUSINESS_HOURS_START` | `17` | Opening hour (24h format, restaurant TZ) |
| `BUSINESS_HOURS_END` | `22` | Closing hour |
| `MAX_BOOKING_DAYS` | `60` | How far ahead guests can book |
| `REVIEW_LINK` | *Bing search link* | Google/Bing review link sent in thank-you emails |

### 🟢 CORS & Frontend

| Variable | Value | Notes |
|:---|:---|:---|
| `FRONTEND_URL` | `https://reservation.dibarestaurant.ca` | Your frontend domain |
| `ALLOWED_ORIGINS` | `https://reservation.dibarestaurant.ca,https://admin.dibarestaurant.ca` | Comma-separated list of allowed origins |

### 🔵 Optional Integrations

| Variable | Value | Notes |
|:---|:---|:---|
| `BREVO_API_KEY` | `xkeysib-...` | For marketing contact sync. Skip if not using. |
| `BREVO_LIST_ID` | `2` | Brevo contact list ID |
| `TELEGRAM_BOT_TOKEN` | `123456:ABC...` | For staff alerts via Telegram |
| `TELEGRAM_CHAT_ID` | `-100...` | Telegram group chat ID |

---

## Step 3 — Railway Build & Deploy Settings

In the Web Service **Settings** tab:

| Setting | Value |
|:---|:---|
| **Root Directory** | `/` (leave default) |
| **Build Command** | `npm ci && npx prisma generate && npx prisma migrate deploy && cd frontend && npm ci && npm run build && cd .. && npm run build` |
| **Start Command** | `node dist/index.js` |
| **Health Check Path** | `/health` |
| **Restart Policy** | `Always` |

> **Why this build command?**
> 1. `npm ci` — installs backend deps
> 2. `prisma generate` — generates DB client
> 3. `prisma migrate deploy` — runs pending migrations on the live DB
> 4. Frontend build — compiles React → `frontend/dist/`
> 5. `npm run build` — compiles backend TS → `dist/`

### Alternative: Use the Dockerfile

Railway auto-detects the `Dockerfile`. If you prefer Docker builds, just set:

| Setting | Value |
|:---|:---|
| **Builder** | Dockerfile |
| **Dockerfile Path** | `./Dockerfile` |

⚠️ The current Dockerfile **does NOT build the frontend**. If you need the monolithic serve mode (backend serves frontend), update the Dockerfile to include the frontend build step.

---

## Step 4 — Stripe Webhook Setup

After your first deploy, you'll have a public URL (e.g. `https://diba-api.up.railway.app`).

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Set URL: `https://YOUR-RAILWAY-URL/webhooks/stripe`
   - ⚠️ The path is `/webhooks/stripe` — NOT `/api/webhooks/stripe`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the **Signing secret** (`whsec_...`) → paste as `STRIPE_WEBHOOK_SECRET` in Railway

---

## Step 5 — Run the GIST Migration (One-Time)

After the first deploy, run this SQL against your production DB to enable the overlap protection trigger:

```sql
-- Connect to your Railway/Supabase Postgres and run:
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE INDEX IF NOT EXISTS "Reservation_time_gist"
  ON "Reservation" USING GIST (tstzrange("startTime", "endTime"));

-- (The full trigger SQL is in prisma/migrations/manual_overlap_gist.sql)
```

You can run this via:
- **Railway**: Click Postgres service → **Query** tab → paste the SQL from `prisma/migrations/manual_overlap_gist.sql`
- **Supabase**: SQL Editor → paste and run

---

## Step 6 — Seed the Database (One-Time)

After the first deploy, seed the floor layout (tables T1–T15):

```bash
# Option A: Railway CLI
railway run npx ts-node prisma/seed.ts

# Option B: Use the admin API
curl -X POST https://YOUR-RAILWAY-URL/api/admin/debug/force-seed \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_token=YOUR_JWT"
```

---

## Quick Copy-Paste Template

Here's every variable in one block. Replace the `<PLACEHOLDER>` values:

```env
# --- CORE ---
DATABASE_URL="postgresql://postgres.[YOUR_PROJECT_REF]:[YOUR_SUPABASE_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
REDIS_URL=<RAILWAY_REDIS_URL>
NODE_ENV=production

# --- PAYMENTS ---
STRIPE_SECRET_KEY=<sk_live_...>
STRIPE_WEBHOOK_SECRET=<whsec_...>

# --- AUTH ---
JWT_SECRET=<RANDOM_32_CHAR_STRING>
ADMIN_PIN=<YOUR_MANAGER_PIN>

# --- EMAIL ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<YOUR_EMAIL>
SMTP_PASS=<YOUR_APP_PASSWORD>
MAIL_FROM=Diba Restaurant <no-reply@dibarestaurant.ca>

# --- CORS ---
FRONTEND_URL=<https://your-frontend-domain.com>
ALLOWED_ORIGINS=<https://your-frontend-domain.com>

# --- BUSINESS ---
DEPOSIT_THRESHOLD=10
BUSINESS_HOURS_START=17
BUSINESS_HOURS_END=22
MAX_BOOKING_DAYS=60
REVIEW_LINK=<YOUR_GOOGLE_REVIEW_LINK>

# --- OPTIONAL ---
BREVO_API_KEY=<xkeysib-...>
BREVO_LIST_ID=2
```

---

## Post-Deploy Checklist

- [ ] Hit `https://YOUR-URL/health` — should return `{"status":"ok"}`
- [ ] Verify Stripe webhook is receiving events (Stripe Dashboard → Webhooks → check for green checkmarks)
- [ ] Create a test reservation and verify email arrives
- [ ] Test admin login at `https://YOUR-URL/api/admin/login`
- [ ] Verify the GIST trigger exists: `SELECT tgname FROM pg_trigger WHERE tgname = 'trg_check_table_overlap';`
- [ ] Monitor logs in Railway dashboard for any startup errors
