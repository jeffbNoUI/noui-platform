-- Migration 050: Reconciliation rule sets (M09a)
-- Versioned rule definitions with audit trail and activation lifecycle.
-- Only one ACTIVE ruleset per engagement at any time.

BEGIN;

CREATE TABLE IF NOT EXISTS migration.recon_rule_set (
    ruleset_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id  UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    version        INT NOT NULL,
    label          VARCHAR(200),
    status         VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                   CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED')),
    rules          JSONB NOT NULL DEFAULT '[]',
    created_by     VARCHAR(100) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at   TIMESTAMPTZ,
    superseded_at  TIMESTAMPTZ,
    UNIQUE(engagement_id, version)
);

-- Index for fast lookup of active ruleset per engagement.
CREATE INDEX IF NOT EXISTS idx_recon_rule_set_engagement_status
    ON migration.recon_rule_set(engagement_id, status);

-- BEFORE DELETE trigger: recon_rule_set records cannot be deleted (immutable audit trail).
CREATE OR REPLACE FUNCTION migration.prevent_recon_rule_set_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'recon_rule_set records cannot be deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_recon_rule_set_delete
    BEFORE DELETE ON migration.recon_rule_set
    FOR EACH ROW
    EXECUTE FUNCTION migration.prevent_recon_rule_set_delete();

-- RLS Tier B: tenant isolation via engagement FK.
ALTER TABLE migration.recon_rule_set ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.recon_rule_set FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_engagement ON migration.recon_rule_set
  USING (engagement_id IN (
    SELECT engagement_id FROM migration.engagement
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

COMMIT;
