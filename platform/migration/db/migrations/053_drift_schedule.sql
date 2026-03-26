-- Migration 053: Drift Monitoring Schedule (M05b)
-- Scheduled drift detection runs, engagement-level summaries, and notification triggers.

BEGIN;

-- Drift schedule — one per engagement, configures recurring drift detection.
CREATE TABLE IF NOT EXISTS migration.drift_schedule (
    schedule_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id       UUID NOT NULL REFERENCES migration.engagement(engagement_id) ON DELETE CASCADE,
    interval_hours      INT NOT NULL DEFAULT 24 CHECK (interval_hours >= 1 AND interval_hours <= 168),
    enabled             BOOLEAN NOT NULL DEFAULT false,
    last_triggered_at   TIMESTAMPTZ,
    next_trigger_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (engagement_id)
);

CREATE INDEX IF NOT EXISTS idx_drift_schedule_enabled_next
    ON migration.drift_schedule (enabled, next_trigger_at)
    WHERE enabled = true;

-- RLS Tier B: tenant isolation via engagement → tenant_id.
ALTER TABLE migration.drift_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.drift_schedule FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drift_schedule_tenant_isolation ON migration.drift_schedule;
CREATE POLICY drift_schedule_tenant_isolation ON migration.drift_schedule
    USING (
        engagement_id IN (
            SELECT engagement_id FROM migration.engagement
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::TEXT
        )
    );

COMMIT;
