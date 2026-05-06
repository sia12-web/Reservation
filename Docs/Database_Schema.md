# Database Schema

The **Diba Restaurant Reservation System** uses PostgreSQL as its primary data store, managed via **Prisma ORM**. This document outlines the core models, relationships, and constraints.

## 📊 Entity Relationship Summary

The schema is built around the core concept of a **Reservation** linked to specific **Tables** within a versioned **Layout**.

### Core Models

#### `Reservation`
-   **Purpose**: Stores guest booking details, status, and time windows.
-   **Fields**: `shortId` (unique 8-char), `startTime`, `endTime`, `status`, `partySize`, `clientPhone`, etc.
-   **Enums**: `ReservationStatus` (HOLD, PENDING_DEPOSIT, CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED, NO_SHOW).
-   **Indices**: Optimized for time-range queries (`startTime`, `endTime`) and client lookups.

#### `Table` & `Layout`
-   **Layout**: Versioned floor plans. Only one layout is `isActive` at a time. Stores the `adjacencyGraph` as JSON.
-   **Table**: Individual seating units tied to a layout.
-   **Fields**: `type` (STANDARD, MERGED_FIXED, CIRCULAR), `minCapacity`, `maxCapacity`, `priorityScore`, and spatial coordinates (`x`, `y`, `width`, `height`).

#### `ReservationTable`
-   **Purpose**: Junction table linking Reservations to specific Tables.
-   **Composite Key**: `[reservationId, tableId, layoutId]`.
-   **Constraint**: Database-level triggers/constraints (via GIST) prevent overlapping time ranges for the same `tableId`.

#### `Payment`
-   **Purpose**: Tracks Stripe transactions for large party deposits.
-   **Fields**: `providerIntentId`, `amountCents`, `status` (SUCCEEDED, PROCESSING, FAILED).
-   **Link**: Linked 1:1 or 1:N with `Reservation`.

#### `AuditLog`
-   **Purpose**: Immutable log of administrative actions.
-   **Fields**: `action`, `before` (JSON), `after` (JSON), `reason`, `adminId`.

## 🛠️ Performance & Constraints

1.  **Timezone Consistency**: All timestamp fields (`startTime`, `endTime`) are stored as `timestamptz` to handle timezone offsets correctly.
2.  **Overlap Protection**:
    -   While the application uses Redis/Redlock, the database enforces a final safety net using a PostgreSQL GIST index.
    -   See `prisma/migrations/manual_overlap_gist.sql` for the raw SQL implementation of the exclusion constraint.
3.  **Indexing Strategy**:
    -   Indices on `clientPhone` for fast "Find My Reservation" lookups.
    -   Indices on `startTime` for efficient calendar and floor-map rendering.

## 📁 Related Files
-   **Schema Definition**: [schema.prisma](../prisma/schema.prisma)
-   **Seed Data**: [seed.ts](../prisma/seed.ts) — contains the initial T1–T14 table definitions and adjacency graph.

---
[Return to Documentation Index](./README.md)
