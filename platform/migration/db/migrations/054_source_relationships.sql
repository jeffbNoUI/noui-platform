-- Migration 054: Source Relationships — L3 Profiling (M10a)
-- Cross-column referential integrity discovery and orphan detection.

CREATE TABLE IF NOT EXISTS migration.source_relationship (
    relationship_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profiling_run_id  UUID NOT NULL REFERENCES migration.profiling_run(id),
    parent_table      TEXT NOT NULL,   -- schema.table format
    parent_column     TEXT NOT NULL,
    child_table       TEXT NOT NULL,   -- schema.table format
    child_column      TEXT NOT NULL,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('FK_DECLARED', 'FK_INFERRED')),
    confidence        NUMERIC(4,3) NOT NULL DEFAULT 1.0,
    orphan_count      INT NOT NULL DEFAULT 0,
    orphan_pct        NUMERIC(7,4) NOT NULL DEFAULT 0.0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(profiling_run_id, parent_table, parent_column, child_table, child_column)
);

CREATE INDEX IF NOT EXISTS idx_source_relationship_run ON migration.source_relationship(profiling_run_id);

-- RLS Tier D: source_relationship → profiling_run → engagement → tenant
ALTER TABLE migration.source_relationship ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.source_relationship FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_via_profiling ON migration.source_relationship
    USING (profiling_run_id IN (
        SELECT id FROM migration.profiling_run
        WHERE engagement_id IN (
            SELECT engagement_id FROM migration.engagement
            WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
        )
    ));
