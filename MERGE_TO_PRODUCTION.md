# Demo → Main Merge Guide

**Purpose**: Comprehensive testing and verification checklist before merging demo branch to production (main).

**Branch Strategy**:
- `demo`: Development branch for all new features, fixes, and experiments
- `main`: Production branch deployed to Railway (LIVE with real customers)

---

## 🚨 CRITICAL RULES

1. **NEVER push directly to main** - Always work on demo first
2. **NEVER merge without completing this checklist** - No exceptions
3. **NEVER skip security verification** - Customer data is at stake
4. **Test with LIVE Stripe keys** - Production uses live mode
5. **Verify database migrations** - Schema changes can break production

---

## Pre-Merge Checklist

### Phase 1: Code Quality ✅

- [ ] **All TypeScript compilation passes**
  ```bash
  git checkout demo
  npm run build
  # Should complete with no errors
  ```

- [ ] **No linting errors**
  ```bash
  npm run lint  # (if configured)
  # OR manually check for obvious code issues
  ```

- [ ] **Prisma client regenerated** (if schema changed)
  ```bash
  npx prisma generate
  ```

- [ ] **All tests pass**
  ```bash
  npm test
  # All tests should pass, no failures
  ```

- [ ] **Frontend builds successfully**
  ```bash
  cd frontend
  npm run build
  # Should complete with no errors
  cd ..
  ```

---

### Phase 2: Security Verification 🔒

- [ ] **Run security review**
  ```bash
  # Use the /security-review command or skill
  # This will scan for vulnerabilities in changes
  ```

- [ ] **No secrets in code**
  ```bash
  # Check for accidentally committed secrets
  git diff main..demo | grep -i "secret\|password\|key\|token"
  # Should return nothing sensitive
  ```

- [ ] **Input validation added** (for new endpoints)
  - All user inputs validated with Zod schemas
  - SQL injection prevention verified
  - XSS prevention verified

- [ ] **Authentication/Authorization checked** (for new admin routes)
  - JWT validation in place
  - Role checks implemented
  - Rate limiting configured

- [ ] **Rate limiting configured** (for new public endpoints)
  - Public endpoints have appropriate limits
  - Documented in SECURITY.md

---

### Phase 3: Database Safety 🗄️

- [ ] **Database migrations reviewed**
  ```bash
  # Check for new migrations
  git diff main..demo -- prisma/migrations/
  ```

- [ ] **Migration rollback plan exists**
  - Document how to rollback if migration fails
  - Test rollback locally first

- [ ] **No breaking schema changes**
  - Existing columns not removed (use deprecation instead)
  - New required fields have defaults
  - Indexes added for performance

- [ ] **Backup verified**
  - Confirm Railway/Supabase automatic backups are working
  - Know how to restore from backup

---

### Phase 4: Local Testing 🧪

- [ ] **Start local environment**
  ```bash
  git checkout demo
  docker-compose up -d
  npm run dev
  ```

- [ ] **Health check passes**
  ```bash
  curl http://localhost:3000/health
  # Should return: {"status":"healthy","database":"connected","redis":"connected"}
  ```

- [ ] **Test core reservation flow**
  - Create reservation for 1-4 guests (regular tables)
  - Create reservation for 5-7 guests (circular tables)
  - Create reservation for 8-14 guests (T11 or combos)
  - Create reservation for 10+ guests (deposit required)
  - ⚠️ Use Stripe test card: `4242 4242 4242 4242`

- [ ] **Test deposit flow**
  - Create reservation for 10+ guests
  - Complete payment successfully
  - Verify confirmation email received
  - Verify webhook processes correctly

- [ ] **Test deposit timeout**
  - Create reservation for 10+ guests
  - Wait 31 minutes (or set timeout to 1 minute for testing)
  - Verify auto-cancellation email sent
  - Verify tables released

- [ ] **Test table assignment edge cases**
  - Party of 1 (should assign regular table, not T15)
  - Party of 13 (should assign T11)
  - Party of 32+ (frontend warning, backend accepts)
  - Party of 50 (max allowed)

- [ ] **Test admin operations**
  - Login with PIN: 1234
  - View all reservations
  - Cancel reservation (verify refund if deposit paid)
  - Free table manually
  - Create manual reservation

- [ ] **Test concurrent reservations**
  - Open 2 browser windows
  - Try to book same table at same time
  - Verify only one succeeds (distributed lock works)

- [ ] **Test email delivery**
  - Confirmation email arrives
  - Cancellation email arrives
  - Deposit request email arrives
  - Check spam folder

---

### Phase 5: Integration Testing 🔗

- [ ] **Stripe webhook delivery**
  - Use Stripe CLI to forward webhooks locally:
    ```bash
    stripe listen --forward-to localhost:3000/webhooks/stripe
    ```
  - Create deposit payment
  - Verify webhook received and processed

- [ ] **Database connection pooling**
  - Run 10+ concurrent requests
  - Verify no connection pool exhaustion
  - Check logs for P1001 errors (should be none)

- [ ] **Redis distributed locks**
  - Create concurrent reservations
  - Check logs for lock timeout errors (should be none)
  - Verify lock TTL is 35 seconds

- [ ] **Rate limiting**
  - Hit /api/slots endpoint 31 times in 10 minutes
  - Verify 31st request is rate limited (429 status)
  - Check logs for rate limit violation

---

### Phase 6: Performance Testing ⚡

- [ ] **API response times acceptable**
  - `/api/slots`: < 2 seconds
  - `/api/availability`: < 1 second
  - `/api/reservations` (POST): < 5 seconds (with Stripe)
  - `/health`: < 100ms

- [ ] **No memory leaks**
  - Run server for 10+ minutes under load
  - Monitor memory usage (should be stable)

- [ ] **Database query performance**
  - Check slow query logs (should be none)
  - Verify indexes are used (EXPLAIN queries)

---

### Phase 7: Error Handling 🚨

- [ ] **Graceful degradation**
  - Disconnect database, verify 503 health check
  - Disconnect Redis, verify 503 health check
  - Stripe API timeout, verify proper error message

- [ ] **User-friendly error messages**
  - No stack traces exposed to users
  - Clear error messages for common issues
  - Errors logged with context

- [ ] **No sensitive data in logs**
  - PII is masked (phone, email, name)
  - No credit card numbers in logs
  - No API keys in logs

---

### Phase 8: Documentation 📄

- [ ] **CHANGELOG.md updated** (if exists)
  - Document all user-facing changes
  - Document breaking changes (if any)

- [ ] **API documentation updated** (if API changed)
  - New endpoints documented
  - Request/response examples updated

- [ ] **SECURITY.md updated** (if security changes)
  - New rate limits documented
  - New security measures documented

- [ ] **README.md updated** (if setup changed)
  - New environment variables documented
  - New dependencies documented

---

## Merge Process

### Step 1: Final Verification

```bash
# Ensure you're on demo branch
git checkout demo

# Pull latest changes
git pull origin demo

# Run all tests one final time
npm run build
npm test
cd frontend && npm run build && cd ..

# Verify health check
curl http://localhost:3000/health
```

### Step 2: Create Pull Request (Optional but Recommended)

```bash
# Push demo to remote
git push origin demo

# Create PR on GitHub: demo → main
# Review changes carefully
# Look for:
#   - Accidentally committed secrets
#   - Debug code left in
#   - Console.logs
#   - TODOs that should be addressed
```

### Step 3: Merge to Main

```bash
# Switch to main
git checkout main

# Pull latest main
git pull origin main

# Merge demo into main
git merge demo

# If conflicts, resolve carefully
# Prefer changes from demo if unsure
```

### Step 4: Pre-Deploy Verification

```bash
# On main branch now
git checkout main

# Regenerate Prisma client
npx prisma generate

# Final build test
npm run build
cd frontend && npm run build && cd ..

# Final test run
npm test
```

### Step 5: Deploy to Production

```bash
# Push to main (triggers Railway auto-deploy)
git push origin main

# Monitor deployment
# Go to Railway dashboard
# Watch logs for errors
```

### Step 6: Post-Deploy Monitoring

```bash
# Wait 2-3 minutes for deployment
# Then verify production health
curl https://YOUR-RAILWAY-URL/health
# Should return: {"status":"healthy",...}

# Monitor Railway logs for 10-15 minutes
# Watch for:
#   - Database connection errors
#   - Redis connection errors
#   - Stripe webhook failures
#   - Rate limit violations
#   - Unexpected errors
```

### Step 7: Smoke Testing Production

- [ ] Create a real test reservation (⚠️ uses live Stripe!)
  - Use Stripe test card: `4242 4242 4242 4242`
  - Verify confirmation email
  - Verify admin dashboard shows reservation
  - Cancel reservation
  - Verify refund processes (if deposit was paid)

- [ ] Check admin dashboard
  - Login with PIN: 1234
  - Verify all reservations visible
  - Test filters and search

- [ ] Monitor metrics
  - Check Railway metrics dashboard
  - Verify no spike in error rates
  - Verify response times are normal

---

## Rollback Procedure

If something goes wrong after merge:

### Immediate Rollback (< 5 minutes)

```bash
# Revert the merge commit
git checkout main
git revert HEAD -m 1
git push origin main

# Railway will auto-deploy the reverted state
# Monitor deployment logs
```

### Database Migration Rollback (if schema changed)

```bash
# Connect to production database
# Run rollback migration manually
# Document the process in migration file
```

### Notify Stakeholders

- If customer-facing issue: Notify via status page
- If data integrity issue: Investigate immediately
- If security issue: Follow incident response plan

---

## Emergency Hotfix Process

For critical production bugs that need immediate fix:

1. **Create hotfix branch from main**
   ```bash
   git checkout main
   git checkout -b hotfix/DESCRIPTION
   ```

2. **Make minimal fix**
   - Only fix the critical bug
   - Don't refactor or add features

3. **Test locally**
   - Verify fix works
   - Run full test suite

4. **Merge to main AND demo**
   ```bash
   # Merge to main
   git checkout main
   git merge hotfix/DESCRIPTION
   git push origin main

   # Merge to demo (to keep in sync)
   git checkout demo
   git merge hotfix/DESCRIPTION
   git push origin demo

   # Delete hotfix branch
   git branch -d hotfix/DESCRIPTION
   ```

---

## Common Pitfalls to Avoid

1. **Forgetting to regenerate Prisma client** after schema changes
   - Symptom: TypeScript errors about missing fields
   - Fix: `npx prisma generate`

2. **Testing with test Stripe keys when production uses live keys**
   - Symptom: Webhooks fail in production
   - Fix: Test with live Stripe keys locally (carefully!)

3. **Not testing concurrent reservations**
   - Symptom: Double-bookings in production
   - Fix: Open multiple browser windows and test race conditions

4. **Skipping email delivery test**
   - Symptom: Confirmation emails go to spam
   - Fix: Test email delivery and check spam folder

5. **Not monitoring after deployment**
   - Symptom: Issues discovered by customers
   - Fix: Monitor logs for 30+ minutes after deploy

6. **Merging breaking changes without migration**
   - Symptom: Production crashes after deploy
   - Fix: Always test migrations locally first

---

## Automation (Future Improvement)

Consider automating this checklist with:

- **GitHub Actions**: Run tests on PR creation
- **Pre-commit hooks**: Run linting before commit
- **Pre-push hooks**: Run tests before push
- **Automated smoke tests**: Run after deployment
- **Slack notifications**: Alert team on deployment

---

## Quick Reference Commands

```bash
# Check current branch
git branch

# Switch to demo for development
git checkout demo

# When ready to merge to production
git checkout main
git merge demo
npx prisma generate
npm run build
npm test
git push origin main

# Monitor production after deploy
curl https://YOUR-RAILWAY-URL/health
# Watch Railway logs for 15+ minutes
```

---

**Remember**: Better to over-test than to debug in production! 🚀

When in doubt, go through the full checklist. Your customers will thank you.
