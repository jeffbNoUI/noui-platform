-- 009: Migrate case_id from INTEGER to TEXT to support string case IDs (e.g., RET-2026-0147)
-- Case management uses composite string IDs; correspondence must match.

ALTER TABLE correspondence_history
  ALTER COLUMN case_id TYPE TEXT USING case_id::TEXT;

-- Add index for case_id filtering (new in this migration)
CREATE INDEX IF NOT EXISTS idx_corr_hist_case_id
  ON correspondence_history (case_id)
  WHERE case_id IS NOT NULL;
