# System Architecture Overview

This document provides a high-level overview of the **Diba Restaurant Reservation System** architecture, outlining the core design patterns and technologies.

## 🏗️ Core Design Pattern

The system follows a strict **Source of Truth** model where the backend handles all availability logic, table assignments, and business rule enforcement. The frontend is a purely visual layer that adapts its view based on user roles (Admin vs Guest) and real-time state.

### Key Components

1.  **Backend (Express API)**:
    -   Centralizes all business logic (validation, pricing, availability).
    -   Exposes REST endpoints for both Guest and Admin interactions.
    -   Communicates with PostgreSQL (via Prisma) and Redis (for concurrency).
2.  **Frontend (React + Vite)**:
    -   Modularized into a Guest flow (web/mobile) and an Admin/Staff flow (kiosk/tablet).
    -   Uses **TanStack Query** for efficient server state synchronization.
    -   Styled with **TailwindCSS** for a premium, responsive UI.
3.  **Database Layer (PostgreSQL)**:
    -   Relational data model (Prisma schema).
    -   Uses `btree_gist` for database-level exclusion constraints to prevent overlapping reservations on the same table.
4.  **Concurrency Layer (Redis)**:
    -   Uses **Redlock** for distributed locking across table/time buckets.
    -   Ensures atomic operations during the critical reservation window.

## 🛠️ Tech Stack

### Backend
-   **Runtime**: Node.js (v18+)
-   **Service**: Express.js
-   **Language**: TypeScript (Strict Mode)
-   **Database**: PostgreSQL
-   **ORM**: Prisma
-   **Caching/Locks**: Redis (ioredis) + Redlock
-   **Payments**: Stripe API

### Frontend
-   **Framework**: React 18+
-   **Build Tool**: Vite
-   **State Management**: TanStack Query (React Query)
-   **UI Framework**: TailwindCSS
-   **Iconography**: Lucide Icons

## 🔄 Core Data Flow: Reservation Creation

1.  **Guest Input**: Guest enters party size, date, and time via the frontend.
2.  **Validation**: Backend validates party size, business hours (15m alignment), and future-date constraints.
3.  **Availability Search**:
    -   Backend fetches the active floor layout and existing reservations for that day.
    -   Table Assignment Engine generates valid table combinations based on adjacency and capacity.
4.  **Deposit Check**: If party size > 10, a Stripe `PaymentIntent` is created and returned for secure payment.
5.  **Locking & Transaction**:
    -   System acquires distributed Redlock keys for the selected tables/time slots.
    -   Prisma performs a **Serializable** transaction to create the reservation and link tables.
6.  **Confirmation**: Success response returned; status set to `CONFIRMED` (or `PENDING_DEPOSIT`).

---
[Return to Documentation Index](./README.md)
