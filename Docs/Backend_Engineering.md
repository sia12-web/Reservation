# Backend Engineering

This document explores the internal logic of the **Diba Restaurant Reservation System** backend, specifically focusing on the Table Assignment Engine, API structure, and concurrency management.

## 🛠️ Technology Stack
-   **Runtime**: Node.js (v18.x) + Express
-   **Language**: TypeScript (strict)
-   **Database**: PostgreSQL + Prisma ORM
-   **Locking**: Redis (ioredis) + Redlock
-   **Jobs**: BullMQ (for TTL cleanups and emails)
-   **Payments**: Stripe API

## 🔄 Table Assignment Engine

The engine is the core intelligence of the system, responsible for finding the best table combinations.

### Key Logic
1.  **Inputs**: Party size, requested time, active layout (tables + adjacency graph).
2.  **Candidate Generation**:
    -   Generates all possible single tables.
    -   Generates connected subgraphs (using BFS/DFS) up to 3 tables based on adjacency.
    -   Excludes `CIRCULAR` tables for parties > 7 (they never combine).
3.  **Scoring & Ranking**:
    -   **Waste Minimization**: Prioritizes tables whose capacity is closest to the party size.
    -   **Multi-Table Penalty**: Penalizes combinations of multiple tables to keep groups compact.
    -   **Chain Preservation**: Penalizes breaking up long chains (e.g., T9–T13) for small parties.
    -   **Priority Score**: Uses a configurable `priorityScore` on each table to break ties.

## 🛡️ Concurrency & Locking

To prevent double-bookings, the system uses a dual-layered protection strategy:

1.  **Distributed Locking (Redis/Redlock)**:
    -   Before creating a reservation, the system acquires locks for the specific tables and time buckets.
    -   Key format: `LOCK:TABLE:{tableId}:{YYYY-MM-DD}:{HH}`.
    -   Locks cover the entire reservation duration (plus a buffer).
2.  **Database Transactions (Prisma)**:
    -   Uses `Serializable` isolation level.
    -   Re-checks overlaps inside the transaction before creating records.
    -   Integrates PostgreSQL **Exclusion Constraints** (GIST) for time-range overlap protection.

## 💰 Payment Integration (Stripe)

For large parties (>10 guests), the system enforces a mandatory deposit:
-   **PaymentIntent Creation**: Triggered during the initial POST `/reservations` call.
-   **Client Secret**: Returned to the frontend to mount the Stripe Elements modal.
-   **Webhook Processing**: Listens for `payment_intent.succeeded` to update the reservation status to `CONFIRMED`.
-   **Auto-Cleanup**: A BullMQ worker cancels `PENDING_DEPOSIT` reservations after 15 minutes of inactivity.

## 📡 API Endpoints

### Guest APIs
-   `POST /reservations`: Creates a new reservation (with optional Stripe setup).
-   `GET /reservations/:shortId`: Retrieves reservation details for guests (management view).
-   `POST /reservations/:id/cancel`: Guest-initiated cancellation.

### Admin APIs
-   `GET /admin/floor-map`: Current occupancy and upcoming reservations for the floor view.
-   `POST /admin/reservations/:id/check-in`: Updates status to `CHECKED_IN`.
-   `POST /admin/reservations/:id/reassign`: Reassigns an existing reservation to different tables.
-   `POST /admin/tables/:id/free`: Immediately frees an occupied table (completes reservation).
-   `POST /admin/reservations/:id/late-warning`: Triggers manual notification for late arrivals.

---
[Return to Documentation Index](./README.md)
