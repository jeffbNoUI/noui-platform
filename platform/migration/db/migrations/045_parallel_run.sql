-- Migration 045: Parallel Run schema for dual-version execution tracking
-- Supports side-by-side comparison of legacy and new system outputs.
--
-- parallel_run: Tracks a parallel run session (one per engagement scope).
-- parallel_run_result: Individual field-level comparison results.
--
-- RLS: parallel_run uses Tier B (engagement_id → engagement → tenant_id).
--       parallel_run_result uses two-hop (run_id → parallel_run → engagement → tenant_id).

BEGIN;

-- ============================================================
-- Table: migration.parallel_run
-- ============================================================
CREATE TABLE IF NOT EXISTS migration.parallel_run (
    run_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id     UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    name              TEXT NOT NULL,
    description       TEXT,
    status            TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED')),
    legacy_source     TEXT NOT NULL,
    canonical_source  TEXT NOT NULL,
    -- comparison_mode: CONTINUOUS requires CDC integration, not yet built.
    -- When CDC is available, CONTINUOUS mode will stream changes in real time.
    comparison_mode   TEXT NOT NULL DEFAULT 'SAMPLE'
                      CHECK (comparison_mode IN ('SAMPLE', 'FULL', 'CONTINUOUS')),
    sample_rate       NUMERIC(5,4) DEFAULT 0.1000,
    started_by        TEXT NOT NULL,
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on engagement_id for RLS subquery performance and listing
CREATE INDEX IF NOT EXISTS idx_parallel_run_engagement ON migration.parallel_run(engagement_id);

-- ============================================================
-- Table: migration.parallel_run_result
-- ============================================================
CREATE TABLE IF NOT EXISTS migration.parallel_run_result (
    result_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id            UUID NOT NULL REFERENCES migration.parallel_run(run_id),
    member_id         VARCHAR(200) NOT NULL,
    canonical_entity  TEXT NOT NULL,
    field_name        TEXT NOT NULL,
    legacy_value      TEXT,
    new_value         TEXT,
    match             BOOLEAN NOT NULL,
    variance_amount   NUMERIC(15,2),
    variance_pct      NUMERIC(8,4),
    checked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Idempotent inserts: ON CONFLICT DO NOTHING uses this constraint
    CONSTRAINT uq_parallel_run_result_key UNIQUE (run_id, member_id, canonical_entity, field_name)
);

-- Index for mismatch filtering (e.g., WHERE run_id = ? AND match = false)
CREATE INDEX IF NOT EXISTS idx_parallel_run_result_match ON migration.parallel_run_result(run_id, match);

-- Index for entity-level summaries (GROUP BY canonical_entity WHERE run_id = ?)
CREATE INDEX IF NOT EXISTS idx_parallel_run_result_entity ON migration.parallel_run_result(run_id, canonical_entity);

-- ============================================================
-- RLS: Tier B for parallel_run (engagement_id → engagement → tenant)
-- ============================================================
ALTER TABLE migration.parallel_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.parallel_run FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_engagement ON migration.parallel_run
  USING (engagement_id IN (
    SELECT engagement_id FROM migration.engagement
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

-- ============================================================
-- RLS: Two-hop for parallel_run_result (run_id → parallel_run → engagement → tenant)
-- ============================================================
ALTER TABLE migration.parallel_run_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.parallel_run_result FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_run ON migration.parallel_run_result
  USING (run_id IN (
    SELECT run_id FROM migration.parallel_run
    WHERE engagement_id IN (
      SELECT engagement_id FROM migration.engagement
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  ));

COMMIT;
