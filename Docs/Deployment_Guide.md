# Deployment & Operations Guide

This document provides instructions for setting up the **Diba Restaurant Reservation System** in local development environments and deploying it to production.

## 💻 Local Development Setup

### Prerequisites
-   **Node.js** (v18.x or later)
-   **PostgreSQL** (v14+)
-   **Redis** (v6+)

### Installation Steps
1.  **Clone & Install Dependencies**:
    ```bash
    npm install
    cd frontend && npm install
    ```
2.  **Environment Variables**: Create a `.env` file in the root directory:
    ```env
    DATABASE_URL="postgresql://user:pass@localhost:5432/reservation_db"
    REDIS_URL="redis://localhost:6379"
    ADMIN_PIN="1234"
    STRIPE_SECRET_KEY="sk_test_..."
    STRIPE_WEBHOOK_SECRET="whsec_..."
    FRONTEND_URL="http://localhost:5173"
    BUSINESS_HOURS_START="11:30"
    BUSINESS_HOURS_END="22:30"
    ```
3.  **Database Migration & Seeding**:
    ```bash
    npx prisma migrate dev
    npm run prisma:seed
    ```
4.  **Running the Servers**:
    ```bash
    # Root (Backend)
    npm run dev
    
    # In /frontend (Frontend)
    npm run dev
    ```

## 🚀 Production Deployment (Render Blueprint)

The project includes a `render.yaml` blueprint optimized for a single-service deployment where the Node.js API serves the compiled React frontend.

### Architecture
-   **Monolithic Serving**: One Render Web Service (Node.js) + Managed PostgreSQL + Managed Redis.
-   **Build Command**: The root `package.json` includes scripts to build both the frontend and the backend.

### Deployment Steps
1.  **Push to GitHub**: Ensure all changes (including `render.yaml`) are pushed.
2.  **Render Dashboard**:
    -   Go to [dashboard.render.com](https://dashboard.render.com/).
    -   Click **New +** -> **Blueprint**.
    -   Connect the GitHub repository.
3.  **Environment Configuration**: Populate the required secrets (JWT_SECRET, ADMIN_PIN, STRIPE_SECRET_KEY, etc.) in the Render dashboard.
4.  **Wait for Build**: Render will automatically detect the blueprint and provision the database, cache, and web service.

## 📦 Docker Containerization

For local containerized testing or alternative hosting provider (e.g., AWS ECS, DigitalOcean App Platform):
-   **Dockerfile**: Multi-stage build that builds the frontend assets and then packages the Node.js backend to serve them.
-   **Docker Compose**: Use `docker-compose.yml` to spin up the entire stack locally with:
    ```bash
    docker-compose up --build
    ```

## ⚠️ Important Considerations
-   **Free Tier Sleeping**: If using Render's free tier, the service will "sleep" after 15 minutes of inactivity. The first request after a sleep phase will have a high latency (30–60 seconds).
-   **Stripe Webhooks**: When running locally, use the Stripe CLI to forward webhooks:
    ```bash
    stripe listen --forward-to localhost:3000/webhooks/stripe
    ```

---
[Return to Documentation Index](./README.md)
