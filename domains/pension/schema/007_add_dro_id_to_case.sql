-- Add dro_id to retirement_case for case-scoped DRO lookups.
-- Previously, DRO data was fetched per-member (all DRO records for a member),
-- which caused incorrect DRO application on non-DRO retirement cases.
-- Now each case explicitly links to the specific DRO record that applies.

ALTER TABLE retirement_case
  ADD COLUMN IF NOT EXISTS dro_id INTEGER REFERENCES dro_master(dro_id);

CREATE INDEX IF NOT EXISTS idx_retirement_case_dro ON retirement_case(dro_id);
