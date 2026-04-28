-- ============================================================================
-- Database-level overlap protection for table reservations
-- ============================================================================
-- PostgreSQL EXCLUDE USING GIST cannot use subqueries, so we implement
-- overlap protection via a BEFORE INSERT trigger on ReservationTable.
-- This is the database-level safety net that catches any double-booking
-- that bypasses application-level locks.
-- ============================================================================

-- Enable necessary extension for range operations
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- GIST index on Reservation time window for efficient overlap queries
CREATE INDEX IF NOT EXISTS "Reservation_time_gist"
  ON "Reservation"
  USING GIST (tstzrange("startTime", "endTime"));

-- Drop the old (invalid) exclusion constraint if it somehow exists
ALTER TABLE "ReservationTable"
  DROP CONSTRAINT IF EXISTS "reservation_table_no_overlap";

-- Create a function that checks for overlapping reservations on the same table
CREATE OR REPLACE FUNCTION check_table_overlap()
RETURNS TRIGGER AS $$
DECLARE
  new_start TIMESTAMPTZ;
  new_end   TIMESTAMPTZ;
  conflict_count INT;
BEGIN
  -- Get the time range for the reservation being inserted
  SELECT "startTime", "endTime"
    INTO new_start, new_end
    FROM "Reservation"
   WHERE id = NEW."reservationId";

  -- Count any existing reservations on the same table with overlapping time
  -- Exclude CANCELLED and NO_SHOW statuses (they don't block tables)
  SELECT COUNT(*) INTO conflict_count
    FROM "ReservationTable" rt
    JOIN "Reservation" r ON r.id = rt."reservationId"
   WHERE rt."tableId" = NEW."tableId"
     AND rt."reservationId" != NEW."reservationId"
     AND r.status NOT IN ('CANCELLED', 'NO_SHOW', 'COMPLETED')
     AND tstzrange(r."startTime", r."endTime") && tstzrange(new_start, new_end);

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Table % is already booked during % to %',
      NEW."tableId", new_start, new_end
      USING ERRCODE = '23P01'; -- exclusion_violation
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to ReservationTable
DROP TRIGGER IF EXISTS trg_check_table_overlap ON "ReservationTable";
CREATE TRIGGER trg_check_table_overlap
  BEFORE INSERT ON "ReservationTable"
  FOR EACH ROW
  EXECUTE FUNCTION check_table_overlap();
