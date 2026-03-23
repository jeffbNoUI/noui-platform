-- 039_reconciliation_patterns.sql
-- Stores systematic mismatch patterns detected by the Python intelligence service
-- after reconciliation. Each row is a detected pattern with an optional correction suggestion.

CREATE TABLE IF NOT EXISTS migration.reconciliation_pattern (
    pattern_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id            UUID NOT NULL REFERENCES migration.batch(batch_id),
    suspected_domain    VARCHAR(30) NOT NULL,
    plan_code           VARCHAR(20) NOT NULL,
    direction           VARCHAR(10) NOT NULL,
    member_count        INTEGER NOT NULL,
    mean_variance       TEXT NOT NULL,
    coefficient_of_var  NUMERIC(6,4) NOT NULL,
    affected_members    JSONB NOT NULL DEFAULT '[]',
    correction_type     VARCHAR(20),
    affected_field      VARCHAR(100),
    confidence          NUMERIC(5,4),
    evidence            TEXT,
    resolved            BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at         TIMESTAMPTZ,
    resolved_by         VARCHAR(200),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recon_pattern_batch
    ON migration.reconciliation_pattern(batch_id);
