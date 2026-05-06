-- Add marketingOptIn column to Reservation table
-- Migration: Add marketing opt-in field for GDPR compliance

ALTER TABLE "Reservation"
ADD COLUMN IF NOT EXISTS "marketingOptIn" BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN "Reservation"."marketingOptIn" IS 'Indicates whether the customer opted in to marketing communications';
