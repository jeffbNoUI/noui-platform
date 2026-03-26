-- Migration 051: Drift Detection Engine (M05a)
-- Post-go-live drift detection for schema and data changes in source system.

BEGIN;

-- Drift detection run — one per detection invocation.
CREATE TABLE IF NOT EXISTS migration.drift_detection_run (
    run_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id       UUID NOT NULL REFERENCES migration.engagement(engagement_id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    drift_type          TEXT NOT NULL DEFAULT 'BOTH'
                        CHECK (drift_type IN ('SCHEMA', 'DATA', 'BOTH')),
    baseline_snapshot_id UUID,
    detected_changes    INT NOT NULL DEFAULT 0,
    critical_changes    INT NOT NULL DEFAULT 0,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drift_run_engagement_status
    ON migration.drift_detection_run (engagement_id, status);

-- Drift record — individual detected changes.
CREATE TABLE IF NOT EXISTS migration.drift_record (
    record_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL REFERENCES migration.drift_detection_run(run_id) ON DELETE CASCADE,
    change_type     TEXT NOT NULL
                    CHECK (change_type IN ('COLUMN_ADDED', 'COLUMN_REMOVED', 'COLUMN_TYPE_CHANGED',
                                           'TABLE_ADDED', 'TABLE_REMOVED', 'ROW_COUNT_DRIFT')),
    entity          TEXT NOT NULL,
    detail          JSONB NOT NULL DEFAULT '{}',
    severity        TEXT NOT NULL DEFAULT 'MEDIUM'
                    CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    affects_mapping BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drift_record_run_severity
    ON migration.drift_record (run_id, severity);

-- RLS Tier B: tenant isolation via engagement → tenant_id.
-- drift_detection_run
ALTER TABLE migration.drift_detection_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.drift_detection_run FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drift_run_tenant_isolation ON migration.drift_detection_run;
CREATE POLICY drift_run_tenant_isolation ON migration.drift_detection_run
    USING (
        engagement_id IN (
            SELECT engagement_id FROM migration.engagement
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::TEXT
        )
    );

-- drift_record (via run_id → drift_detection_run → engagement → tenant_id)
ALTER TABLE migration.drift_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.drift_record FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drift_record_tenant_isolation ON migration.drift_record;
CREATE POLICY drift_record_tenant_isolation ON migration.drift_record
    USING (
        run_id IN (
            SELECT run_id FROM migration.drift_detection_run
            WHERE engagement_id IN (
                SELECT engagement_id FROM migration.engagement
                WHERE tenant_id = current_setting('app.current_tenant_id', true)::TEXT
            )
        )
    );

COMMIT;
