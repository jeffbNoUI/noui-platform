-- Migration 048: Retention policy support (M06b)
-- Adds retention policy column to engagement and soft-delete support for events.

BEGIN;

-- Add retention policy JSONB column to engagement.
ALTER TABLE migration.engagement
  ADD COLUMN IF NOT EXISTS audit_retention_policy JSONB;

-- Add archived_at for soft-delete tracking.
ALTER TABLE migration.engagement
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Replace the event delete trigger to allow retention-based purges.
-- When the session variable app.retention_purge is set to 'true',
-- DELETE is allowed (for automated retention cleanup).
-- Otherwise, DELETE raises an exception to prevent accidental deletion.
CREATE OR REPLACE FUNCTION migration.prevent_event_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.retention_purge', true) = 'true' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'event records cannot be deleted outside retention purge';
END;
$$ LANGUAGE plpgsql;

COMMIT;
