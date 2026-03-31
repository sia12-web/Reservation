# Reservation Kiosk Frontend

## Local setup

```bash
cd frontend
npm install
npm run dev
```

## Environment variables

Create a `.env.local` file in `frontend/`:

```
VITE_API_BASE_URL=http://localhost:3000
VITE_RESTAURANT_TIMEZONE=America/Montreal
VITE_SLOT_INTERVAL_MINUTES=15
VITE_KIOSK_INACTIVITY_SECONDS=60
```

## Example POST payload

```
{
  "clientName": "Ada Lovelace",
  "clientPhone": "+15145551212",
  "partySize": 4,
  "startTime": "2026-01-15T23:15:00.000Z",
  "source": "KIOSK"
}
```
