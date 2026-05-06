-- Enable Row Level Security on all public tables.
-- Since the application connects as the `postgres` role (superuser/owner),
-- RLS policies are bypassed for the backend. This blocks unauthorized access
-- via Supabase's PostgREST (anon/authenticated) API.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReservationTable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Layout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Table" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Blackout" ENABLE ROW LEVEL SECURITY;

-- Force RLS for all roles except the table owner (postgres).
-- This ensures even if a non-owner role is used in the future, RLS applies.
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Reservation" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ReservationTable" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Layout" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Table" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Blackout" FORCE ROW LEVEL SECURITY;
