-- Migration 046: Audit trail — immutable audit_log, analyst_decision table, DELETE protection triggers
--
-- audit_log is the immutable compliance record (structured before/after state, 7-year retention,
-- no UPDATE/DELETE). Distinct from migration.event which is a real-time activity feed (WebSocket
-- broadcast substrate, short-retention). Both tables coexist — audit_log does not replace event.
--
-- analyst_decision: table definition that matches the Tier A RLS policy already created in 043.
--
-- DELETE protection triggers: BEFORE DELETE on lineage, event, analyst_decision, audit_log
-- that RAISE EXCEPTION to prevent accidental or malicious deletion of audit data.

BEGIN;

-- ============================================================
-- analyst_decision: CREATE TABLE (fixes gap where 043 enables RLS on non-existent table)
-- Tier A RLS policy already exists in 043_rls_policies.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS migration.analyst_decision (
    decision_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    engagement_id UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    decision_type TEXT NOT NULL CHECK (decision_type IN (
        'MAPPING_APPROVED', 'MAPPING_REJECTED',
        'CORRECTION_APPROVED', 'CORRECTION_REJECTED',
        'EXCEPTION_RESOLVED'
    )),
    entity_type   TEXT NOT NULL,
    entity_id     TEXT NOT NULL,
    decided_by    TEXT NOT NULL,
    context       JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analyst_decision_engagement
    ON migration.analyst_decision(engagement_id);

-- ============================================================
-- audit_log: immutable compliance record (INSERT only)
-- ============================================================

CREATE TABLE migration.audit_log (
    log_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id  UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    actor          TEXT NOT NULL,
    action         TEXT NOT NULL,
    entity_type    TEXT NOT NULL,
    entity_id      TEXT NOT NULL,
    before_state   JSONB,
    after_state    JSONB,
    metadata       JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance index for listing endpoint (engagement scoped, newest first).
CREATE INDEX idx_audit_log_engagement_created
    ON migration.audit_log(engagement_id, created_at DESC);

-- REVOKE UPDATE and DELETE — audit_log is INSERT only.
-- The migration_app_role (or current_user running the app) cannot modify or delete rows.
REVOKE UPDATE, DELETE ON migration.audit_log FROM PUBLIC;

-- ============================================================
-- RLS for audit_log: Tier B pattern (engagement_id → engagement → tenant_id)
-- ============================================================

ALTER TABLE migration.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_engagement ON migration.audit_log
  USING (engagement_id IN (
    SELECT engagement_id FROM migration.engagement
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

-- ============================================================
-- Reconciliation integrity hash column
-- ============================================================

ALTER TABLE migration.reconciliation
    ADD COLUMN IF NOT EXISTS integrity_hash TEXT;

-- ============================================================
-- DELETE protection triggers
-- BEFORE DELETE raises EXCEPTION — prevents deletion of audit data.
-- ============================================================

CREATE OR REPLACE FUNCTION migration.prevent_audit_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'DELETE not permitted on audit table: %', TG_TABLE_NAME;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_delete_lineage
    BEFORE DELETE ON migration.lineage
    FOR EACH ROW EXECUTE FUNCTION migration.prevent_audit_delete();

CREATE TRIGGER no_delete_event
    BEFORE DELETE ON migration.event
    FOR EACH ROW EXECUTE FUNCTION migration.prevent_audit_delete();

CREATE TRIGGER no_delete_analyst_decision
    BEFORE DELETE ON migration.analyst_decision
    FOR EACH ROW EXECUTE FUNCTION migration.prevent_audit_delete();

CREATE TRIGGER no_delete_audit_log
    BEFORE DELETE ON migration.audit_log
    FOR EACH ROW EXECUTE FUNCTION migration.prevent_audit_delete();

COMMIT;
