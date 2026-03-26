-- Migration 052: Reconciliation execution engine (M09b)
-- Evaluates active ruleset against parallel run results, producing scored mismatches.
-- Depends on: 050_recon_rules.sql (recon_rule_set), 045_parallel_run.sql (parallel_run)

BEGIN;

CREATE TABLE IF NOT EXISTS migration.recon_execution_run (
    execution_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id  UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    ruleset_id     UUID NOT NULL REFERENCES migration.recon_rule_set(ruleset_id),
    parallel_run_id UUID NOT NULL REFERENCES migration.parallel_run(run_id),
    status         VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    total_evaluated INT NOT NULL DEFAULT 0,
    match_count     INT NOT NULL DEFAULT 0,
    mismatch_count  INT NOT NULL DEFAULT 0,
    p1_count        INT NOT NULL DEFAULT 0,
    p2_count        INT NOT NULL DEFAULT 0,
    p3_count        INT NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recon_execution_run_engagement
    ON migration.recon_execution_run(engagement_id, created_at DESC);

-- RLS Tier B: tenant isolation via engagement FK.
ALTER TABLE migration.recon_execution_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.recon_execution_run FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_engagement ON migration.recon_execution_run
  USING (engagement_id IN (
    SELECT engagement_id FROM migration.engagement
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

CREATE TABLE IF NOT EXISTS migration.recon_execution_mismatch (
    mismatch_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id    UUID NOT NULL REFERENCES migration.recon_execution_run(execution_id) ON DELETE CASCADE,
    rule_id         VARCHAR(200) NOT NULL,
    member_id       VARCHAR(100) NOT NULL,
    canonical_entity VARCHAR(100) NOT NULL,
    field_name      VARCHAR(200) NOT NULL,
    legacy_value    TEXT,
    new_value       TEXT,
    variance_amount TEXT,
    comparison_type VARCHAR(30) NOT NULL
                    CHECK (comparison_type IN ('EXACT', 'TOLERANCE_ABS', 'TOLERANCE_PCT', 'ROUND_THEN_COMPARE')),
    tolerance_value TEXT,
    priority        VARCHAR(5) NOT NULL CHECK (priority IN ('P1', 'P2', 'P3')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recon_execution_mismatch_exec_priority
    ON migration.recon_execution_mismatch(execution_id, priority);

-- RLS Tier B: tenant isolation via execution_run → engagement FK.
ALTER TABLE migration.recon_execution_mismatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.recon_execution_mismatch FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_execution ON migration.recon_execution_mismatch
  USING (execution_id IN (
    SELECT execution_id FROM migration.recon_execution_run
    WHERE engagement_id IN (
      SELECT engagement_id FROM migration.engagement
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  ));

COMMIT;
