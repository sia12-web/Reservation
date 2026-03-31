-- Enable necessary extension for range and exclusion indexes
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- GIST index on Reservation time window for efficient overlap queries
CREATE INDEX IF NOT EXISTS "Reservation_time_gist"
  ON "Reservation"
  USING GIST (tstzrange("startTime", "endTime"));

-- Exclusion constraint to prevent overlapping reservations on the same table
-- This enforces: for the same tableId, time ranges cannot overlap.
ALTER TABLE "ReservationTable"
ADD CONSTRAINT "reservation_table_no_overlap"
EXCLUDE USING GIST (
  "tableId" WITH =,
  tstzrange(
    (SELECT "startTime" FROM "Reservation" r WHERE r.id = "reservationId"),
    (SELECT "endTime" FROM "Reservation" r WHERE r.id = "reservationId")
  ) WITH &&
);
