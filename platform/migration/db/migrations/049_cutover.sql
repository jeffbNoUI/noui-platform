-- Migration 049: Cutover execution engine (M04b)
-- Adds cutover_plan table with step-based execution, rollback support,
-- and RLS Tier B (engagement_id → engagement → tenant_id).

BEGIN;

-- Update engagement status enum to include cutover states
-- (No-op if using text column; the application layer validates via ValidTransitions.)

CREATE TABLE IF NOT EXISTS migration.cutover_plan (
    plan_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id  UUID NOT NULL REFERENCES migration.engagement(engagement_id) ON DELETE CASCADE,
    status         TEXT NOT NULL DEFAULT 'DRAFT'
                   CHECK (status IN ('DRAFT','APPROVED','EXECUTING','COMPLETED','ROLLED_BACK','FAILED')),
    steps          JSONB NOT NULL DEFAULT '[]'::jsonb,
    rollback_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    approved_by    TEXT,
    approved_at    TIMESTAMPTZ,
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast engagement lookups
CREATE INDEX IF NOT EXISTS idx_cutover_plan_engagement ON migration.cutover_plan(engagement_id);

-- Immutability trigger: prevent updates after COMPLETED or ROLLED_BACK
CREATE OR REPLACE FUNCTION migration.cutover_plan_immutable()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('COMPLETED', 'ROLLED_BACK') THEN
        RAISE EXCEPTION 'cutover plan in status % is immutable', OLD.status;
    END IF;
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cutover_plan_immutable ON migration.cutover_plan;
CREATE TRIGGER trg_cutover_plan_immutable
    BEFORE UPDATE ON migration.cutover_plan
    FOR EACH ROW
    EXECUTE FUNCTION migration.cutover_plan_immutable();

-- RLS Tier B: engagement_id → engagement → tenant_id
ALTER TABLE migration.cutover_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.cutover_plan FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cutover_plan_tenant_isolation ON migration.cutover_plan;
CREATE POLICY cutover_plan_tenant_isolation ON migration.cutover_plan
    USING (
        engagement_id IN (
            SELECT engagement_id FROM migration.engagement
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::TEXT
        )
    );

COMMIT;
