# Security Credentials Rotation Guide

## ⚠️ CRITICAL: Immediate Actions Required

Your production secrets were found in the `.env` file in the codebase. You must assume these credentials are **COMPROMISED** and rotate them immediately before going live.

## Updated Credentials (Already Done ✅)

1. **JWT_SECRET**: ✅ Rotated to new value
2. **ADMIN_PIN**: ✅ Changed from "1234" to "847291"

## Credentials You Must Rotate Manually

### 1. Stripe Keys (CRITICAL - Financial Risk)

**Current Issue**: Live Stripe keys are in development `.env`, test keys are in production `.env.production` (backwards!)

#### Option A: Use Test Keys Everywhere (Recommended for Testing)
```bash
# Development (.env)
STRIPE_SECRET_KEY="sk_test_[YOUR_TEST_KEY_HERE]"
VITE_STRIPE_PUBLISHABLE_KEY="pk_test_[YOUR_TEST_KEY_HERE]"
STRIPE_WEBHOOK_SECRET="whsec_[YOUR_WEBHOOK_SECRET_HERE]"

# Production (.env.production) - SAME TEST KEYS
STRIPE_SECRET_KEY="sk_test_[YOUR_TEST_KEY_HERE]"
STRIPE_WEBHOOK_SECRET="whsec_[YOUR_WEBHOOK_SECRET_HERE]"
```

#### Option B: Rotate Live Keys and Use Properly (For Production Launch)

1. **Assume current live keys are compromised**
2. Go to Stripe Dashboard → Developers → API keys
3. Click "Roll keys" to generate NEW live keys
4. Update:
   ```bash
   # Development (.env) - Use TEST keys
   STRIPE_SECRET_KEY="sk_test_..."
   VITE_STRIPE_PUBLISHABLE_KEY="pk_test_..."

   # Production (.env.production) - Use NEW LIVE keys
   STRIPE_SECRET_KEY="sk_live_NEW_KEY_HERE"
   VITE_STRIPE_PUBLISHABLE_KEY="pk_live_NEW_KEY_HERE"
   ```
5. Create NEW webhook endpoint in Stripe for production
6. Update `STRIPE_WEBHOOK_SECRET` with new webhook secret

**Security Best Practice**:
- NEVER commit these to git again
- Use Railway environment variables dashboard instead
- Keep `.env` files local only (already in .gitignore ✅)

---

### 2. Brevo API Key & SMTP Credentials (HIGH Priority)

**Current exposed credentials**:
- API Key: `xkeysib-[REDACTED]`
- SMTP Pass: `xsmtpsib-[REDACTED]`

**Steps to Rotate**:

1. Log into Brevo (SendInBlue) dashboard
2. Go to SMTP & API → API Keys
3. Delete the compromised API key
4. Create a new API key
5. Go to SMTP & API → SMTP Settings
6. Generate a new SMTP password
7. Update both `.env` files:
   ```bash
   BREVO_API_KEY=xkeysib-[NEW_KEY_HERE]
   SMTP_PASS=xsmtpsib-[NEW_PASSWORD_HERE]
   ```

---

### 3. Database Credentials (MEDIUM Priority)

**Current exposed password**: `_3newuLaC8eKsT%3A`

**Steps to Rotate**:

1. Log into Supabase dashboard
2. Go to Project Settings → Database
3. Reset database password
4. Update both `.env` and `.env.production`:
   ```bash
   DATABASE_URL="postgresql://postgres.exnrjqiwaxuosmjfiekj:NEW_PASSWORD@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
   DIRECT_URL="postgresql://postgres.exnrjqiwaxuosmjfiekj:NEW_PASSWORD@aws-0-us-west-2.pooler.supabase.com:5432/postgres"
   ```

---

### 4. Redis Password (MEDIUM Priority)

**Current exposed password**: `tVDcbFdBolsGGWIcfbXeHnAXePqVcWYe`

**Steps to Rotate**:

1. Log into Railway dashboard
2. Go to Redis service → Variables
3. Regenerate Redis password or redeploy Redis service
4. Update `.env.production`:
   ```bash
   REDIS_URL="redis://default:NEW_PASSWORD@redis.railway.internal:6379"
   ```

---

## Railway Deployment: Using Secrets Manager (RECOMMENDED)

Instead of storing secrets in `.env.production`, use Railway's environment variables:

1. Go to Railway dashboard → Your project
2. Click on "Variables" tab
3. Add all production secrets as individual variables:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `REDIS_URL`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `BREVO_API_KEY`
   - `SMTP_PASS`
   - `JWT_SECRET`
   - `ADMIN_PIN`
   - (etc.)

4. Remove `.env.production` from the repository
5. Railway will automatically inject these at runtime

**Benefits**:
- No secrets in codebase
- Easy rotation without redeploying code
- Per-environment configuration
- Audit log of changes

---

## Testing After Rotation

After rotating credentials, test:

1. **Database connectivity**:
   ```bash
   npm run prisma:studio  # Should connect successfully
   ```

2. **Stripe integration**:
   - Create test reservation with 10+ guests
   - Complete payment
   - Verify webhook received

3. **Email sending**:
   - Trigger confirmation email
   - Check inbox (not spam)

4. **Redis connection**:
   - Check server logs for Redis errors
   - Verify distributed locks work

5. **Admin login**:
   - Log into admin dashboard with new PIN
   - Verify JWT sessions work

---

## Post-Rotation Checklist

- [ ] Rotated Stripe keys (or switched to test mode)
- [ ] Rotated Brevo API key & SMTP password
- [ ] Rotated database password
- [ ] Rotated Redis password
- [ ] Moved all secrets to Railway variables
- [ ] Deleted `.env.production` from git
- [ ] Tested full reservation flow end-to-end
- [ ] Tested admin login
- [ ] Tested email delivery
- [ ] Verified health check passes

---

## Emergency Response

If credentials are leaked again:

1. **Immediately** disable the compromised credentials in the provider dashboard
2. Rotate within 15 minutes
3. Check logs for suspicious activity
4. Notify customers if PII was accessed
5. Review git history: `git log --all --full-history --source -- .env`

---

## Contact Information for Support

- **Stripe Support**: https://support.stripe.com
- **Brevo Support**: https://www.brevo.com/support
- **Supabase Support**: https://supabase.com/support
- **Railway Support**: https://railway.app/help
