-- Fix minCapacity for regular tables to allow solo diners (party of 1)
-- Previously all regular tables had minCapacity=2, which forced solo diners to OVERFLOW

UPDATE "Table"
SET "minCapacity" = 1
WHERE "type" = 'STANDARD'
  AND "id" NOT IN ('T15'); -- T15 already has minCapacity=1

-- Explanation:
-- Before: T1-T3, T5, T7-T8, T10, T12, T14 had minCapacity=2
-- After: All standard tables now accept parties of 1+
-- This prevents solo diners from being assigned to OVERFLOW (T15)
