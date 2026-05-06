# Pull Request: demo → main

## 📋 Pre-Merge Checklist

Before merging this PR, verify all items are checked:

### Code Quality ✅
- [ ] TypeScript compiles with no errors (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] Frontend builds successfully (`cd frontend && npm run build`)
- [ ] Prisma client regenerated if schema changed (`npx prisma generate`)
- [ ] No console.log or debug code left in

### Security 🔒
- [ ] No secrets or API keys in code
- [ ] Input validation added for new endpoints (Zod schemas)
- [ ] Authentication/authorization verified for admin routes
- [ ] Rate limiting configured for new public endpoints
- [ ] XSS/SQL injection prevention verified

### Database 🗄️
- [ ] New migrations tested locally
- [ ] No breaking schema changes (columns not removed)
- [ ] Rollback plan documented (if migrations exist)
- [ ] Indexes added for performance (if needed)

### Testing 🧪
- [ ] Tested reservation flow end-to-end
- [ ] Tested with Stripe test card (4242 4242 4242 4242)
- [ ] Tested concurrent reservations (no race conditions)
- [ ] Tested admin operations
- [ ] Email delivery verified (not in spam)
- [ ] Health check endpoint returns healthy status

### Documentation 📄
- [ ] CHANGELOG.md updated (if user-facing changes)
- [ ] SECURITY.md updated (if security changes)
- [ ] README.md updated (if setup changed)
- [ ] Comments added for complex logic

---

## 📝 Description

**What does this PR do?**
<!-- Describe the changes in this PR -->

**Why is this change needed?**
<!-- Explain the problem this PR solves -->

**How was this tested?**
<!-- Describe your testing approach -->

---

## 🔄 Changes Summary

**Files changed:** <!-- Number of files -->

**Key changes:**
-
-
-

---

## 🗄️ Database Changes

**Are there database migrations?** <!-- Yes/No -->

If yes:
- Migration file: `prisma/migrations/XXXXXX_description/migration.sql`
- Rollback plan: <!-- Describe how to rollback -->
- Breaking changes: <!-- Yes/No, describe if yes -->

---

## 🚨 Risk Assessment

**Risk Level:** <!-- Low / Medium / High -->

**Potential Issues:**
<!-- List any potential issues or edge cases -->

**Mitigation:**
<!-- How are these risks mitigated? -->

---

## 📸 Screenshots (if UI changes)

<!-- Add screenshots if applicable -->

---

## 🔗 Related Issues

Fixes #<!-- issue number -->
Closes #<!-- issue number -->

---

## 🚀 Deployment Notes

**Post-deployment steps:**
<!-- Any manual steps needed after deployment? -->

**Monitoring checklist:**
- [ ] Monitor Railway logs for 15+ minutes after deployment
- [ ] Verify health check endpoint
- [ ] Test one reservation in production (with Stripe test card)
- [ ] Check error rates in Railway dashboard

---

## ✅ Automated Checks

The following should pass automatically:
- [ ] CI build passes
- [ ] Tests pass
- [ ] No merge conflicts

---

## 👀 Reviewer Notes

**Special attention needed for:**
<!-- Highlight areas that need careful review -->

**Questions for reviewer:**
<!-- Any specific questions or concerns? -->

---

## 📚 Reference

See `MERGE_TO_PRODUCTION.md` for complete merge checklist.

---

**Before merging**: Run `./scripts/pre-merge-check.ps1` (Windows) or `./scripts/pre-merge-check.sh` (Linux/Mac)
