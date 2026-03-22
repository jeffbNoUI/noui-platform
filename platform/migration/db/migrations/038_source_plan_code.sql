-- Migration 038: Add source_plan_code to stored_calculations
-- Preserves the original legacy plan code for UI display while
-- plan_code holds the canonical tier ID used by the reconciler.

ALTER TABLE migration.stored_calculations
  ADD COLUMN IF NOT EXISTS source_plan_code TEXT;

COMMENT ON COLUMN migration.stored_calculations.source_plan_code IS
  'Original plan code from the legacy source system (e.g., DB-T1, DB_MAIN). Displayed in UI so clients see their own terminology. The plan_code column holds the canonical tier ID (e.g., TIER_1) used by the reconciler.';
