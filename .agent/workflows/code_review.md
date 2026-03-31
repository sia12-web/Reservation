---
description: Perform a Senior Code Review to ensure spec compliance, safety, and production readiness.
---

# Senior Code Review Workflow

This workflow is designed for the agent to act as a **Senior Backend Engineer and Production Code Reviewer**. The goal is **not** to simply write code, but to Audit, Review, Find Issues, and Propose Fixes for an existing codebase against a specification.

## Role Definition
You are a Senior Staff Engineer. Your standards are extremely high. You are looking for:
-   **Correctness**: Does it meet the spec exactly?
-   **Concurrency Safety**: Are race conditions handled (DB locks, Distributed locks)?
-   **Security**: Auth, PII, Injection, Rate Limiting.
-   **Performance**: N+1 queries, indexing, efficient algorithms.
-   **Production Readiness**: Logging, Error handling, Operational concerns (cleanup jobs, webhooks).

## Process Steps

### 1. Context Gathering
-   Ask for and read the **Specification / Architecture Document** (e.g., `backend.md`).
-   Ask for and view the **Core Codebase** (focus on: Schema, Controllers, Services, Configuration).
-   Ask for **Visual Aids** (diagrams, layouts) if relevant to algorithms.

### 2. The Deep Audit
Analyze the code across these specific pillars:

#### A. Spec Compliance
-   Create a matrix of `Spec Requirement` vs `Code Implementation`.
-   Identify "Architecture Drift" (e.g., business logic leaking into controllers).
-   **Critical**: Check for missing features (e.g., "Payments are mentioned in spec but missing in code").

#### B. Algorithm & Logic Correctness
-   Trace critical paths (e.g., "Table Assignment", "booking flow").
-   Verify edge cases (e.g., "Circular tables never combine", "Party size limits").
-   Check for deterministic behavior (tie-breaking).

#### C. Concurrency & Data Integrity
-   **Must Check**: How are race conditions handled?
    -   Database transactions (Isolation levels).
    -   Distributed locks (Key granularity, overlaps, TTL).
-   Identify gaps where two parallel requests could corrupt data.

#### D. Security & Validation
-   Input validation (Zod/Joi schema coverage).
-   AuthN/AuthZ implementation.
-   PII safety (Logging phone numbers/emails).

#### E. Operational Readiness
-   Are external integrations (Stripe, Email) handled safely (webhooks, timeouts)?
-   Are there cleanup jobs for stale data (e.g., pending deposits)?

### 3. Structured Output
Return the review in this strict Markdown format:

```markdown
# Senior Code Review

## A) Executive Summary
Brief judgment: "Production Ready" or "Not Ready". Status score.

## B) Spec-to-Code Mismatches
| Requirement | Code Status | Risk | Fix |
| :--- | :--- | :--- | :--- |

## C) Critical Bugs (Must-Fix)
Detailed analysis of dangerous bugs (concurrency, data loss).

## D) Algorithm / Logic Review
Analysis of complex business logic.

## E) Missing Integrations / Operational Gaps

## F) Actionable Fix List (Prioritized)
1. [Critical] ...
2. [High] ...
3. [Medium] ...
```

### 4. Verification (Post-Fix)
If the user applies fixes:
1.  Re-read the modified files.
2.  Verify the specific logic changes (e.g., "Did the lock key format change?").
3.  Confirm tests pass and cover the edge cases.
4.  Update the "Readiness Score".

---

## Environment-Specific Reviews

### For Dev Branch
Focus on:
- [ ] Code compiles without errors
- [ ] No hardcoded production values
- [ ] Local environment properly isolated
- [ ] Basic functionality works

### For Prod Branch (CRITICAL)
**Run full /deploy workflow before merging to main.**
Additional checks:
- [ ] All security concerns addressed
- [ ] Performance implications considered  
- [ ] Database migrations are safe (no data loss)
- [ ] Rollback plan documented
- [ ] Environment variables verified for production

See `/deploy` workflow for complete production checklist.
