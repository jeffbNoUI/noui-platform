-- Migration 055: Coverage Report — L4 canonical coverage assessment
--
-- coverage_report: stores the result of an L4 profiling pass that maps
-- source columns to schema version fields with gap analysis.
--
-- RLS: Tier B via profiling_run → engagement → tenant_id.
-- UNIQUE(profiling_run_id, schema_version_id) — one report per run per schema version.
-- Re-running L4 against the same version overwrites the previous report.

BEGIN;

CREATE TABLE IF NOT EXISTS migration.coverage_report (
    report_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profiling_run_id      UUID NOT NULL REFERENCES migration.profiling_run(id) ON DELETE CASCADE,
    schema_version_id     UUID NOT NULL REFERENCES migration.schema_version(version_id),
    total_canonical_fields INT NOT NULL,
    mapped_fields         INT NOT NULL,
    unmapped_fields       INT NOT NULL,
    coverage_pct          NUMERIC(5,2) NOT NULL,
    auto_mapped_count     INT NOT NULL DEFAULT 0,
    review_required_count INT NOT NULL DEFAULT 0,
    no_match_count        INT NOT NULL DEFAULT 0,
    field_details         JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(profiling_run_id, schema_version_id)
);

CREATE INDEX IF NOT EXISTS idx_coverage_report_run ON migration.coverage_report(profiling_run_id);
CREATE INDEX IF NOT EXISTS idx_coverage_report_version ON migration.coverage_report(schema_version_id);

-- ============================================================
-- RLS: Tier B via profiling_run → engagement → tenant
-- ============================================================

ALTER TABLE migration.coverage_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.coverage_report FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_profiling_run ON migration.coverage_report
  USING (profiling_run_id IN (
    SELECT pr.id FROM migration.profiling_run pr
    JOIN migration.engagement e ON e.engagement_id = pr.engagement_id
    WHERE e.tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

COMMIT;
