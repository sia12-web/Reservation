# Testing & Quality Assurance

This document outlines the testing strategy, tools, and methodologies used to ensure the reliability and security of the **Diba Restaurant Reservation System**.

## 🧪 Testing Strategy

The system prioritizes high-confidence testing for the most critical business logic: **availability and seating**.

### 1.  **Unit Tests (Table Assignment Engine)**
-   **Focus**: Ensuring the engine correctly handles combinations, adjacency constraints, and capacity limits.
-   **Files**: `tests/tableAssignment.engine.test.ts`, `tests/intelligent.test.ts`.
-   **Scenarios**: Large party combinations (e.g., T9–T13 chain), circular table isolation, and waste minimization logic.

### 2.  **API Integration Tests**
-   **Focus**: End-to-end flow from HTTP request to database record creation.
-   **Files**: `tests/api.reservations.test.ts`, `tests/api.admin.test.ts`.
-   **Includes**: Validation (Zod), status code correctness (e.g., 409 Conflict), and logic for Stripe payment creation.

### 3.  **Concurrency & Race Condition Tests**
-   **Focus**: Verifying that distributed locks (Redis) and database transactions (Serializable) prevent double-bookings.
-   **Files**: `tests/api.reservations.test.ts` (specifically concurrent submission blocks).

### 4.  **Security & Privacy Tests**
-   **Focus**: Compliance with PII protection and role-based access control.
-   **Files**: `tests/pii.masking.test.ts`.
-   **Includes**: Ensuring logs are redacted and that the Admin PIN is required for sensitive routes.

## 🛠️ Testing Tools
-   **Jest**: The primary test runner for all backend logic and API tests.
-   **Supertest**: Used for simulating HTTP requests during integration tests.
-   **Redis Mock/Docker**: Real Redis environment used during automated test runs to verify Redlock behavior.
-   **Prisma Mock/Postgres Docker**: Integration tests run against a fresh database container to ensure schema compatibility.

## 🚀 Running Tests
To execute the backend test suite:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run a specific test file
npx jest tests/intelligent.test.ts
```

## 📋 Quality Assurance Checklist (for Developers)
Before merging any new feature, ensure:
-   [ ] All existing tests pass (`npm test`).
-   [ ] New features have corresponding unit/integration tests in the `tests/` directory.
-   [ ] API inputs are strictly validated with Zod.
-   [ ] Any schema changes are accompanied by matching tests for overlapping time ranges.
-   [ ] Sensitive logs (PII) are verified to be masked or excluded.

---
[Return to Documentation Index](./README.md)
