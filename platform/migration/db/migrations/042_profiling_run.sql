-- Migration 042: 5-Level Progressive Profiling — Run + Source Inventory
-- Supports Level 1 (table/column discovery) and Level 2 (column statistics + pension patterns).

-- Profiling run record: tracks a complete profiling session for an engagement.
CREATE TABLE IF NOT EXISTS migration.profiling_run (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id          UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    source_platform        TEXT NOT NULL,
    initiated_by           TEXT NOT NULL,
    status                 TEXT NOT NULL DEFAULT 'INITIATED',
    level_reached          INT,
    total_source_columns   INT,
    total_canonical_fields INT,
    auto_mapped_count      INT,
    review_required_count  INT,
    unmapped_count         INT,
    overall_coverage_pct   NUMERIC(5,2),
    rule_signals_found     INT,
    readiness_assessment   TEXT,
    error_message          TEXT,
    initiated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_profiling_run_engagement ON migration.profiling_run(engagement_id);

-- Level 1: Source table inventory.
CREATE TABLE IF NOT EXISTS migration.source_table (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profiling_run_id  UUID NOT NULL REFERENCES migration.profiling_run(id),
    schema_name       TEXT,
    table_name        TEXT NOT NULL,
    row_count         BIGINT,
    row_count_exact   BOOLEAN DEFAULT false,
    entity_class      TEXT,
    class_confidence  NUMERIC(4,3),
    is_likely_lookup  BOOLEAN DEFAULT false,
    is_likely_archive BOOLEAN DEFAULT false,
    profile_status    TEXT NOT NULL DEFAULT 'PENDING',
    notes             TEXT,
    UNIQUE(profiling_run_id, schema_name, table_name)
);

-- Level 1+2: Source column inventory with statistics.
CREATE TABLE IF NOT EXISTS migration.source_column (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table_id   UUID NOT NULL REFERENCES migration.source_table(id),
    column_name       TEXT NOT NULL,
    ordinal_position  INT,
    data_type         TEXT NOT NULL,
    max_length        INT,
    is_nullable       BOOLEAN NOT NULL,
    is_primary_key    BOOLEAN DEFAULT false,
    is_unique         BOOLEAN DEFAULT false,
    -- Level 2 stats
    row_count         BIGINT,
    null_count        BIGINT,
    null_pct          NUMERIC(5,2),
    distinct_count    BIGINT,
    distinct_pct      NUMERIC(5,2),
    min_value         TEXT,
    max_value         TEXT,
    mean_value        NUMERIC,
    stddev_value      NUMERIC,
    top_values        JSONB,
    pattern_frequencies JSONB,
    sample_values     JSONB,
    sample_size       BIGINT,
    is_sampled        BOOLEAN DEFAULT false,
    UNIQUE(source_table_id, column_name)
);
CREATE INDEX IF NOT EXISTS idx_src_col_table ON migration.source_column(source_table_id);
