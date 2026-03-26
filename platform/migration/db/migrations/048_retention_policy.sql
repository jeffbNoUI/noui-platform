-- Migration 048: Retention policy (M06b)
-- Adds audit_retention_policy JSONB column, archived_at soft-delete column,
-- and trigger that blocks event deletes unless retention purge session var is set.

BEGIN;

-- Add retention policy column to engagement
ALTER TABLE migration.engagement
    ADD COLUMN IF NOT EXISTS audit_retention_policy JSONB;

-- Add archived_at column for soft-delete pattern
ALTER TABLE migration.event
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Trigger function: blocks DELETEs on migration.event unless app.retention_purge is set.
-- The retention purge background job sets this session variable before deleting.
CREATE OR REPLACE FUNCTION migration.prevent_event_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.retention_purge', true) = 'true' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'direct DELETE on migration.event is not allowed — use retention purge';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_event_delete ON migration.event;
CREATE TRIGGER trg_prevent_event_delete
    BEFORE DELETE ON migration.event
    FOR EACH ROW
    EXECUTE FUNCTION migration.prevent_event_delete();

COMMIT;
