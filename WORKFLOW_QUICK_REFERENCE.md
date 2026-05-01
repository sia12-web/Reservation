# Git Workflow Quick Reference

## Branch Strategy

```
main  ──────────────────────► Production (Railway deployment, LIVE)
        ▲
        │ merge (after testing)
        │
demo  ──┴────────────────────► Development (all changes go here first)
```

---

## Daily Workflow

### Starting New Work

```bash
# Always start from demo branch
git checkout demo
git pull origin demo

# Make your changes
# ... edit files ...

# Commit changes
git add .
git commit -m "feat: your description here"

# Push to demo
git push origin demo
```

### Before Merging to Production

```bash
# 1. Run pre-merge checks
./scripts/pre-merge-check.ps1  # Windows
# OR
./scripts/pre-merge-check.sh   # Linux/Mac

# 2. Review MERGE_TO_PRODUCTION.md checklist
# Complete all manual tests

# 3. Merge to main
git checkout main
git pull origin main
git merge demo

# 4. Regenerate Prisma if schema changed
npx prisma generate

# 5. Final verification
npm run build
npm test

# 6. Deploy
git push origin main

# 7. Monitor Railway for 15+ minutes
# Check health endpoint
curl https://YOUR-RAILWAY-URL/health
```

---

## Common Commands

### Check Current Branch
```bash
git branch
# * indicates current branch
```

### Switch Branches
```bash
git checkout demo    # Switch to demo
git checkout main    # Switch to main
```

### View Changes
```bash
# See what changed between demo and main
git diff main..demo

# See changed files
git diff main..demo --name-only

# See commit history
git log main..demo --oneline
```

### Undo Changes (Emergency)
```bash
# Undo last commit (keeps changes)
git reset HEAD~1

# Undo last commit (discards changes) ⚠️ DANGEROUS
git reset --hard HEAD~1

# Revert a merge to main
git revert HEAD -m 1
git push origin main
```

---

## Emergency Hotfix

For critical production bugs:

```bash
# 1. Create hotfix from main
git checkout main
git checkout -b hotfix/critical-bug-name

# 2. Make minimal fix
# ... edit files ...
git commit -am "hotfix: description"

# 3. Merge to main
git checkout main
git merge hotfix/critical-bug-name
git push origin main

# 4. Merge to demo (keep in sync)
git checkout demo
git merge hotfix/critical-bug-name
git push origin demo

# 5. Delete hotfix branch
git branch -d hotfix/critical-bug-name
```

---

## Pre-Merge Checklist (Short Version)

Before merging demo → main:

- [ ] Run `./scripts/pre-merge-check.ps1`
- [ ] All tests pass locally
- [ ] Test deposit flow with Stripe
- [ ] Test concurrent reservations
- [ ] Test admin operations
- [ ] Verify email delivery
- [ ] Check health endpoint
- [ ] Review changes: `git diff main..demo`
- [ ] No secrets in code
- [ ] Regenerate Prisma if schema changed

**Full checklist**: See `MERGE_TO_PRODUCTION.md`

---

## Deployment Monitoring

After pushing to main:

```bash
# 1. Wait 2-3 minutes for deployment

# 2. Check health
curl https://YOUR-RAILWAY-URL/health

# 3. Watch Railway logs (dashboard)
# Look for:
#   - "Database initialization complete"
#   - No errors or warnings
#   - Normal request logs

# 4. Smoke test
# - Create test reservation
# - Verify admin dashboard
# - Cancel reservation

# 5. Monitor for 15+ minutes
# - Check error rates
# - Check response times
# - Watch for anomalies
```

---

## Branch Rules

### ✅ DO
- Always work on demo branch
- Test thoroughly before merging to main
- Commit often with clear messages
- Run pre-merge script before merging
- Monitor after deploying to main

### ❌ DON'T
- Never push directly to main (unless hotfix)
- Never merge without testing
- Never skip the pre-merge checklist
- Never merge with failing tests
- Never commit secrets or API keys

---

## Commit Message Format

Use conventional commits:

```
feat: add table reservation for party of 50
fix: resolve lock timeout in concurrent bookings
docs: update deployment guide
refactor: simplify table assignment logic
test: add tests for deposit timeout
chore: upgrade dependencies
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code restructure (no behavior change)
- `test`: Add/update tests
- `chore`: Maintenance (deps, config, etc.)

---

## Help Commands

```bash
# Where am I?
git branch

# What changed?
git status

# What's different from main?
git diff main

# Show recent commits
git log --oneline -10

# Show branches with last commit
git branch -v
```

---

## Emergency Contacts

- **Railway Issues**: https://railway.app/help
- **Stripe Issues**: https://support.stripe.com
- **Database Issues**: https://supabase.com/support

---

## Quick Links

- 📘 Full Merge Guide: `MERGE_TO_PRODUCTION.md`
- 🔒 Security Guide: `SECURITY.md`
- 📋 Deployment Guide: `RAILWAY_DEPLOY.md`
- 🐛 Bug Fixes Applied: `FIXES_APPLIED.md`
- 🚀 Production Ready: `PRODUCTION_READY.md`

---

**Remember**: `demo` for development, `main` for production. Test before you merge! 🚀
