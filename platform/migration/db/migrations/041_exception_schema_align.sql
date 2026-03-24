-- Migration 041: Align exception table with Go model (MigrationException).
-- The exception table was created with a simpler schema (row_key, handler_name, column_name)
-- but the Go loader/query code writes/reads richer columns (source_table, source_id, etc.).
-- Add the missing columns and keep backwards compatibility with existing rows.

ALTER TABLE migration.exception
  ADD COLUMN IF NOT EXISTS source_table        VARCHAR(200),
  ADD COLUMN IF NOT EXISTS source_id           VARCHAR(200),
  ADD COLUMN IF NOT EXISTS canonical_table     VARCHAR(200),
  ADD COLUMN IF NOT EXISTS field_name          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS attempted_value     TEXT,
  ADD COLUMN IF NOT EXISTS constraint_violated VARCHAR(200),
  ADD COLUMN IF NOT EXISTS disposition         VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS resolution_note     TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by         VARCHAR(200),
  ADD COLUMN IF NOT EXISTS resolved_at         TIMESTAMPTZ;

-- Add check constraint for disposition values
ALTER TABLE migration.exception
  DROP CONSTRAINT IF EXISTS exception_disposition_check;
ALTER TABLE migration.exception
  ADD CONSTRAINT exception_disposition_check
  CHECK (disposition IN ('OPEN', 'ACCEPTED', 'REJECTED', 'WAIVED'));
