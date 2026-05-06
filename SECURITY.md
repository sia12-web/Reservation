# Security Documentation

## Rate Limiting Strategy

This document outlines the comprehensive rate limiting implemented to prevent abuse of the reservation system.

### Architecture

The system uses a **defense-in-depth** approach with multiple layers of rate limiting:

1. **Global Rate Limiter** - Baseline protection for all endpoints
2. **Route-Specific Rate Limiters** - Tailored limits based on resource intensity
3. **Webhook Signature Validation** - Cryptographic validation for payment webhooks

### Rate Limit Configuration

All rate limiters are configured with:
- `standardHeaders: true` - Returns `RateLimit-*` headers for transparency
- `legacyHeaders: false` - Disables deprecated `X-RateLimit-*` headers
- IP-based tracking (using `trust proxy` setting)
- Security logging for rate limit violations

---

## Rate Limit Tiers

### 🔒 Global Protection (All Routes)

**Endpoint:** `*` (all routes except `/health` and `/webhooks`)
**Limit:** 500 requests per 15 minutes per IP
**Purpose:** Catch-all protection against obvious abuse
**Status:** ✅ Active

```typescript
Location: src/app.ts
Handler: Logs violations with IP, path, method, and user agent
```

---

### 🎯 Public API Endpoints

#### 1. **Reservation Creation**
- **Endpoint:** `POST /api/reservations`
- **Limit:** 10 requests per hour per IP
- **Rationale:** Prevents reservation spam and resource exhaustion
- **Status:** ✅ Active

#### 2. **Availability Checking**
- **Endpoint:** `GET /api/availability`
- **Limit:** 100 requests per 5 minutes per IP
- **Rationale:** Light database query but needs protection from rapid polling
- **Status:** ✅ Active

#### 3. **Time Slots Query** (Heavy Operation)
- **Endpoint:** `GET /api/slots`
- **Limit:** 30 requests per 10 minutes per IP
- **Rationale:** **Most resource-intensive endpoint** - performs complex calculations and multiple DB queries with loops
- **Status:** ✅ Active
- **⚠️ Critical:** This endpoint was previously unprotected and could have caused DoS

#### 4. **Layout Information**
- **Endpoint:** `GET /api/layout`
- **Limit:** 200 requests per 5 minutes per IP
- **Rationale:** Read-only but needs basic protection
- **Status:** ✅ Active

#### 5. **Reservation Lookup**
- **Endpoint:** `GET /api/reservations/:shortId`
- **Limit:** 50 requests per hour per IP
- **Rationale:** Prevents enumeration attacks on reservation IDs
- **Status:** ✅ Active

#### 6. **Cancellation**
- **Endpoint:** `POST /api/reservations/:id/cancel`
- **Limit:** 20 requests per hour per IP
- **Rationale:** Prevents malicious mass cancellations
- **Status:** ✅ Active

#### 7. **Demo Payment Bypass** (Development Only)
- **Endpoint:** `POST /api/reservations/:id/confirm-payment-demo`
- **Limit:** 20 requests per 15 minutes per IP
- **Rationale:** Additional protection even though disabled in production
- **Status:** ✅ Active (disabled in production by environment check)

---

### 🔐 Admin Endpoints

#### 1. **Admin Login**
- **Endpoint:** `POST /api/admin/login`
- **Limit:** 10 requests per 15 minutes per IP
- **Rationale:** Prevents brute-force attacks on admin PIN
- **Status:** ✅ Active

#### 2. **All Admin Actions**
- **Endpoint:** `POST/GET/DELETE /api/admin/*`
- **Limit:** 1000 requests per 15 minutes per IP
- **Rationale:** Protects authenticated admin operations
- **Status:** ✅ Active
- **Note:** Applied via middleware to all admin routes

---

### 🪝 Webhook Endpoints

#### **Stripe Webhook**
- **Endpoint:** `POST /webhooks/stripe`
- **Primary Protection:** Stripe signature validation (cryptographic)
- **Secondary Protection:** 100 requests per minute per IP (rate limit)
- **Rationale:** Defense-in-depth approach - signature validation is primary, rate limiting prevents brute force attempts
- **Status:** ✅ Active
- **Exempt from:** Global rate limiter (has its own specific limits)

---

## Security Monitoring

### Rate Limit Violation Logging

All rate limit violations are logged with the following information:
- Event type: `rate_limit_exceeded`
- IP address
- Request path
- HTTP method
- User agent

**Log Location:** Application logs (via Pino logger)
**Use Case:** Security monitoring and abuse detection

### Recommended Monitoring

1. **Alert on repeated violations** from the same IP
2. **Track endpoint-specific violation patterns** to adjust limits
3. **Monitor `/slots` endpoint** specifically (most resource-intensive)
4. **Watch for brute-force login attempts** on `/api/admin/login`

---

## Attack Scenarios Prevented

### ✅ Prevented Attack Vectors

1. **DoS via Slot Queries**
   - ❌ Before: Unlimited slot queries could exhaust server resources
   - ✅ After: Limited to 30/10min per IP

2. **Reservation Spam**
   - ❌ Before: Could create unlimited reservations
   - ✅ After: Limited to 10/hour per IP

3. **Availability Polling Abuse**
   - ❌ Before: Could poll availability endpoint infinitely
   - ✅ After: Limited to 100/5min per IP

4. **Admin Brute Force**
   - ❌ Before: Could attempt unlimited login attempts
   - ✅ After: Limited to 10/15min per IP

5. **Reservation Enumeration**
   - ❌ Before: Could enumerate all reservation IDs
   - ✅ After: Limited to 50/hour per IP

6. **Webhook Brute Force**
   - ❌ Before: Could attempt signature bypass via brute force
   - ✅ After: Limited to 100/min per IP + signature validation

7. **General API Abuse**
   - ❌ Before: No baseline protection
   - ✅ After: Global 500 requests/15min per IP

---

## Configuration Files

```
src/app.ts                  - Global rate limiter
src/routes/reservations.ts  - Reservation, availability, slots, lookup, cancel
src/routes/layout.ts        - Layout information
src/routes/auth.ts          - Admin login
src/routes/admin.ts         - Admin actions
src/routes/webhooks.ts      - Stripe webhooks
```

---

## Testing Rate Limits

To verify rate limits are working:

```bash
# Test global rate limiter (should block after 500 requests in 15 minutes)
for i in {1..600}; do curl http://localhost:3000/api/layout; done

# Test slots endpoint (should block after 30 requests in 10 minutes)
for i in {1..35}; do curl "http://localhost:3000/api/slots?date=2025-01-01&partySize=4"; done

# Test admin login (should block after 10 attempts in 15 minutes)
for i in {1..15}; do curl -X POST http://localhost:3000/api/admin/login -d '{"pin":"wrong"}'; done
```

Expected response when rate limited:
```json
{
  "error": "Too many requests, please try again later"
}
```

With headers:
```
RateLimit-Limit: 500
RateLimit-Remaining: 0
RateLimit-Reset: 1234567890
```

---

## Future Enhancements

### Recommended Additions:

1. **Redis-backed rate limiting** - For distributed environments
2. **User-based rate limiting** - Different limits for authenticated users
3. **Progressive penalties** - Increasing timeouts for repeat offenders
4. **IP allowlist** - Bypass rate limits for trusted IPs (e.g., monitoring services)
5. **CAPTCHA integration** - For endpoints like reservation creation after rate limit
6. **Distributed rate limiting** - Using Redis for multi-instance deployments

### Current Limitations:

- **In-memory storage**: Rate limits reset on server restart (acceptable for single-instance deployment)
- **IP-based only**: Authenticated users share the same limits as anonymous users
- **No dynamic adjustment**: Limits are static (could be made configurable via environment variables)

---

## Environment Configuration

Rate limits are currently hard-coded but can be externalized to environment variables if needed:

```env
# Example future configuration
RATE_LIMIT_GLOBAL_WINDOW_MS=900000
RATE_LIMIT_GLOBAL_MAX=500
RATE_LIMIT_RESERVATIONS_MAX=10
RATE_LIMIT_SLOTS_MAX=30
RATE_LIMIT_LOGIN_MAX=10
```

---

## Compliance

This rate limiting strategy helps comply with:
- **OWASP Top 10** - Protection against A05:2021 Security Misconfiguration
- **OWASP API Security** - API4:2023 Unrestricted Resource Consumption
- **PCI DSS** - Requirement 6.5.10 (Broken Authentication and Session Management)

---

## Incident Response

If you suspect an ongoing rate limit bypass or abuse:

1. Check application logs for `rate_limit_exceeded` events
2. Identify the attacking IP address
3. Add IP to firewall/load balancer block list if needed
4. Review and adjust rate limits if legitimate traffic is blocked
5. Consider implementing additional protections (e.g., CAPTCHA, more restrictive limits)

---

**Last Updated:** 2025-01-XX
**Version:** 1.0
**Status:** ✅ All endpoints protected
