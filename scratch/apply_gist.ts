import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Execute each statement individually since Prisma can't handle compound SQL with $$ blocks via file split
  
  const statements = [
    `CREATE EXTENSION IF NOT EXISTS btree_gist`,
    
    `CREATE INDEX IF NOT EXISTS "Reservation_time_gist" ON "Reservation" USING GIST (tstzrange("startTime", "endTime"))`,
    
    `ALTER TABLE "ReservationTable" DROP CONSTRAINT IF EXISTS "reservation_table_no_overlap"`,
    
    `CREATE OR REPLACE FUNCTION check_table_overlap()
RETURNS TRIGGER AS $$
DECLARE
  new_start TIMESTAMPTZ;
  new_end   TIMESTAMPTZ;
  conflict_count INT;
BEGIN
  SELECT "startTime", "endTime"
    INTO new_start, new_end
    FROM "Reservation"
   WHERE id = NEW."reservationId";

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
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,

    `DROP TRIGGER IF EXISTS trg_check_table_overlap ON "ReservationTable"`,
    
    `CREATE TRIGGER trg_check_table_overlap
  BEFORE INSERT ON "ReservationTable"
  FOR EACH ROW
  EXECUTE FUNCTION check_table_overlap()`,
  ];

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log("✅", stmt.substring(0, 70).replace(/\n/g, " ") + "...");
    } catch (err: any) {
      console.error("❌ Failed:", stmt.substring(0, 70).replace(/\n/g, " ") + "...");
      console.error("   Error:", err.message.split("\n")[0]);
    }
  }
}

main()
  .then(() => console.log("\nAll GIST migration steps complete."))
  .catch(e => console.error("Fatal:", e))
  .finally(() => prisma.$disconnect());
