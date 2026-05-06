-- Add depositRequestedAt column to Reservation table
ALTER TABLE "Reservation"
ADD COLUMN IF NOT EXISTS "depositRequestedAt" TIMESTAMPTZ(6);
