# Diba Restaurant Reservation System Documentation

Welcome to the official documentation for the **Diba Restaurant Reservation System**. This project is a production-ready solution for managing restaurant seatings, designed for both staff (kiosk) and guests (web).

## 📚 Documentation Index

1.  **[System Architecture](./System_Architecture.md)**
    *   High-level overview of the system design, tech stack, and core business logic.
2.  **[Backend Engineering](./Backend_Engineering.md)**
    *   Deep dive into the Node.js/Express API, the Table Assignment Engine, and concurrency management (Redis/Redlock).
3.  **[API Contracts](./API_Contracts.md)**
    *   Specific endpoint details, technical request/response formats, and security rules.
4.  **[Frontend Architecture](./Frontend_Architecture.md)**
    *   Overview of the React + Vite frontend, state management with TanStack Query, and styling with TailwindCSS.
5.  **[Database Schema](./Database_Schema.md)**
    *   Details on Prisma models, PostgreSQL enums, and database-level constraints.
6.  **[Deployment Guide](./Deployment_Guide.md)**
    *   Instructions for local setup, Docker configuration, and production deployment on platforms like Render.
7.  **[Testing & Quality Assurance](./Testing_and_Quality.md)**
    *   Overview of the testing strategy, including unit tests for the seating engine and E2E verification.

## 🚀 Key Features

*   **Intelligent Seating Engine**: Automatically finds the best table combinations to maximize capacity and minimize waste.
*   **Real-time Floor Map**: Visual representation of the restaurant for staff to manage live occupancy.
*   **Stripe Integration**: Automated deposit handling for large parties (>10 guests).
*   **Concurrency Protection**: Robust locking mechanisms using Redis and PostgreSQL serializable transactions to prevent double-bookings.
*   **Audit Logging**: Native tracking of all administrative actions and reservation changes.

---
*Maintained by the Diba Development Team.*
