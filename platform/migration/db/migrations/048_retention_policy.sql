-- Migration 048: Retention policy support for audit subsystem (M06b)
-- Adds configurable retention policy per engagement and soft-archive capability.

-- 1. Add retention policy JSONB column to engagement
ALTER TABLE migration.engagement
  ADD COLUMN IF NOT EXISTS audit_retention_policy JSONB;

-- 2. Add archived_at column to event table for soft-archive
ALTER TABLE migration.event
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 3. Replace the event delete trigger to allow retention-based purges.
--    The trigger checks for the session variable app.retention_purge;
--    if set to 'true', deletes are allowed (for the purge job).
--    Otherwise, deletes are blocked to preserve the audit trail.
CREATE OR REPLACE FUNCTION migration.prevent_event_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow deletes when the retention purge session variable is set.
  IF current_setting('app.retention_purge', true) = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'event records cannot be deleted outside retention purge';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_event_delete_trigger ON migration.event;
CREATE TRIGGER prevent_event_delete_trigger
  BEFORE DELETE ON migration.event
  FOR EACH ROW
  EXECUTE FUNCTION migration.prevent_event_delete();

-- 4. Index for retention purge queries
CREATE INDEX IF NOT EXISTS idx_event_engagement_created
  ON migration.event (engagement_id, created_at);
