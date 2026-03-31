---
description: Deploy code with mandatory code reviews for dev and prod
---

# Deployment Workflow

This workflow ensures code quality through mandatory reviews before deploying to dev or prod.

---

## Phase 1: Development (dev branch)

### 1.1 Before Committing to Dev
Run these checks locally:

// turbo
```bash
npm run lint
npm run build
```

### 1.2 Dev Code Review Checklist
Before pushing to `dev`, verify:

- [ ] **No hardcoded secrets** - Check for API keys, passwords, tokens
- [ ] **Environment separation** - Verify `.env` uses local/dev values (localhost DBs, test keys)
- [ ] **No production data access** - Confirm DATABASE_URL points to local/dev DB
- [ ] **TypeScript compiles** - No type errors
- [ ] **No console.log** in production code (use proper logging)
- [ ] **Error handling** - All async operations have try/catch
- [ ] **Input validation** - User inputs are validated (zod schemas)

### 1.3 Push to Dev
// turbo
```bash
git add -A
git commit -m "feat/fix/chore: <description>"
git push origin dev
```

### 1.4 Test on Dev Environment
- Open `http://localhost:5173` and test the feature manually
- Check Docker logs for errors: `docker-compose logs --tail=50 api`
- Verify no crashes in browser console

---

## Phase 2: Production (main branch)

### 2.1 Pre-Production Code Review Checklist (CRITICAL)
**DO NOT merge to main until ALL items are verified:**

#### Security
- [ ] **No sensitive data exposed** - Check API responses don't leak internal data
- [ ] **Auth checks in place** - Protected routes require authentication
- [ ] **Rate limiting** - Sensitive endpoints have rate limits
- [ ] **Input sanitization** - SQL injection, XSS prevention

#### Data Integrity
- [ ] **Database migrations safe** - No destructive migrations (DROP TABLE, DELETE)
- [ ] **Backwards compatible** - API changes don't break existing clients
- [ ] **Rollback plan** - Know how to revert if deployment fails

#### Environment
- [ ] **No dev-only code** - Remove debug endpoints, test data
- [ ] **Environment vars** - Verify prod uses correct values (real DB, real Stripe keys)
- [ ] **SMTP_SECURE** - Should be `true` for production (TLS)
- [ ] **CORS origins** - Only allow production domains

#### Performance
- [ ] **No N+1 queries** - Check Prisma includes
- [ ] **Caching where needed** - Redis caching for hot paths
- [ ] **Indexes** - Database queries use proper indexes

### 2.2 Merge to Main
Only after completing the checklist above:

```bash
git checkout main
git merge dev
```

### 2.3 Final Production Build Test
// turbo
```bash
npm run build
```

### 2.4 Push to Production
```bash
git push origin main
```

### 2.5 Post-Deployment Verification
- [ ] Check Koyeb deployment status
- [ ] Verify production site loads correctly
- [ ] Test critical user flows (reservation, admin login)
- [ ] Monitor error logs for 15 minutes

---

## Quick Reference Commands

| Action | Command |
|--------|---------|
| Push to dev | `git add -A && git commit -m "..." && git push origin dev` |
| Merge to main | `git checkout main && git merge dev && git push origin main` |
| Check API logs | `docker-compose logs --tail=50 api` |
| Rebuild API | `docker-compose up -d --build api` |
| View MailHog | `http://localhost:8025` |

---

## Emergency Rollback

If production breaks after deployment:

```bash
git checkout main
git revert HEAD
git push origin main
```

Or reset to previous commit:
```bash
git reset --hard HEAD~1
git push origin main --force
```

⚠️ **Force push only as last resort** - coordinate with team first.
