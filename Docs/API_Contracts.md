# API Contracts

This document specifies the technical contracts for the **Diba Restaurant Reservation System** API, including request/response formats, status codes, and security.

## 🔐 Security & Middleware
-   **Admin Authentication**: Sensitive routes require an `x-admin-pin` header matching the server's `ADMIN_PIN` environment variable.
-   **Rate Limiting**: `POST /reservations` is limited to 5 requests per hour per IP to prevent spam and resource exhaustion.
-   **PII Masking**: Internal logs redact sensitive customer information (names, phone numbers) before persistence.

## 📅 Guest API Endpoints

### `POST /reservations`
Create a new reservation with automated table assignment and optional deposit handling.
-   **Request Body**:
    ```json
    {
      "clientName": "John Doe",
      "clientPhone": "+14155551212",
      "partySize": 12,
      "startTime": "2026-04-01T18:30:00Z",
      "source": "WEB"
    }
    ```
-   **Logic**:
    -   Computes `endTime` based on `partySize` (e.g., 180m for 15+ guests).
    -   Triggers a Stripe `PaymentIntent` if `partySize > 10`.
    -   Acquires Redlock distributed locks for the selected tables.
-   **Success Response (201)**:
    ```json
    {
      "reservationId": "uuid-v4-string",
      "shortId": "XY72B9A1",
      "status": "PENDING_DEPOSIT",
      "tableIds": ["T1", "T2"],
      "clientSecret": "pi_..._secret_..."
    }
    ```
-   **Errors**: 400 (Validation), 409 (Conflict/Double-booking).

### `GET /reservations/:shortId`
Fetch details for an existing reservation using its unique 8-character ID.
-   **Response**: Returns the full reservation object including assigned tables and current status.

### `POST /reservations/:id/cancel`
Guest-initiated cancellation of a booking.
-   **Result**: Updates status to `CANCELLED` and immediately frees the associated tables.

## 🛠️ Admin API Endpoints

### `GET /admin/floor`
Retrieve the real-time status of all tables for the floor map view.
-   **Response**: A list of tables with their current occupancy, active reservation details, and capacity.

### `POST /admin/walkins`
Create an immediate reservation for a walk-in guest.
-   **Request**: Similar to `POST /reservations` but can include manual `tableIds`.
-   **Result**: Reservation created with `CHECKED_IN` status.

### `POST /admin/tables/:tableId/free`
Immediately "check out" a guest and free the table for new bookings.
-   **Result**: Sets the reservation status to `COMPLETED` and logs the action.

### `POST /admin/reservations/:id/reassign`
Move an existing reservation to a different set of tables.
-   **Logic**: Validates that the new tables are available for the *entire* remaining duration of the booking.

## 🛰️ Webhooks (Stripe)

### `POST /webhooks/stripe`
Handles asynchronous payment updates from Stripe.
-   **Supported Events**:
    -   `payment_intent.succeeded`: Sets reservation to `CONFIRMED`.
    -   `payment_intent.payment_failed`: Marks payment as `FAILED` for admin intervention.

---
[Return to Documentation Index](./README.md)
