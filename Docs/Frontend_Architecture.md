# Frontend Architecture

This document describes the architectural design and implementation of the **Diba Restaurant Reservation System** frontend.

## 🏗️ Technical Overview
-   **Framework**: React 18+ (TypeScript)
-   **Build Tool**: Vite
-   **Routing**: React Router
-   **State Management**: TanStack Query (React Query)
-   **Styling**: TailwindCSS
-   **Validation**: Zod (matching backend rules)
-   **Icons**: Lucide Icons

## 📱 User Interface Modes

The frontend is strategically divided into three primary interaction modes:

1.  **Staff Kiosk / Tablet**:
    -   Optimized for touchscreen usage and high-speed entry.
    -   Includes an **Inactivity Guard** that auto-resets the form after 60 seconds of idle time for guest privacy.
    -   Focuses on rapid creation and immediate table feedback.
2.  **Guest Web Booking**:
    -   Mobile-responsive flow for public reservations.
    -   Includes the **Stripe Payment Elements** integration for deposit handling.
    -   Provides a "Manage Booking" view for guests to view/cancel their own reservations.
3.  **Admin Dashboard**:
    -   Real-time **Floor Map** view for staff to track occupancy.
    -   Advanced controls: Check-in, Reassign Tables, Free Table, and Late Warning prompts.
    -   Requires authentication (Admin PIN) for sensitive operations.

## 🕰️ Time & Timezone Management

Strict compliance with the restaurant's local timezone is enforced:
-   **Source of Truth**: The `VITE_RESTAURANT_TIMEZONE` environment variable defines the operational clock.
-   **Alignment**: All selectable time slots are aligned to 15-minute intervals.
-   **UTC Communication**: The frontend computes local times but communicates with the backend using ISO UTC timestamps to ensure consistency.

## 🔒 State & Cache Management (TanStack Query)

-   **Server State**: All data (reservations, floor map, tables) is managed via TanStack Query.
-   **Mutations**: Handlers for `createReservation`, `checkIn`, and `cancelReservation` include optimistic updates where appropriate.
-   **Cache Invalidation**: Successful admin actions trigger targeted invalidations of the `floor-map` and `reservations` queries to ensure real-time accuracy.
-   **Conflict Handling (409)**: Specific logic handles 409 responses by offering "one-tap" time adjustments (+15m, +30m, etc.) to the user.

## 📁 Key Components & Structure

```text
src/
├── routes/
│   ├── kiosk/              # Staff-specific screens
│   ├── client/             # Guest-specific screens
│   └── admin/              # Management screens
├── components/
│   ├── reservation/        # Shared reservation logic & forms
│   ├── floor/              # Interactive floor map & table UI
│   ├── ui/                 # Reusable primitive components (Button, Modal, etc.)
│   └── kiosk/              # Kiosk-specific guards (Inactivity)
├── hooks/                  # Custom logic (useInactivityTimer, useRestaurantTime)
└── api/                    # API client layer (Axios/Fetch)
```

## 🎨 UI/UX Principles (Touch-First)
-   **Tappable Targets**: All interactive elements are at least 48px to accommodate fingers.
-   **Keypads**: Numeric inputs use optimized virtual keypads for phone numbers and party sizes.
-   **Feedback**: Clear, high-contrast status indicators (Confirmed = Green, Pending Deposit = Yellow, Occupied = Red).

---
[Return to Documentation Index](./README.md)
