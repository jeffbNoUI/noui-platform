-- Migration engine schema
-- Supports: engagement management, field mapping, batch processing,
-- row-level lineage, exception quarantine, three-tier reconciliation,
-- correction suggestions, and analyst decision tracking.
-- Design doc: docs/plans/2026-03-20-migration-engine-design.md

CREATE SCHEMA IF NOT EXISTS migration;

-- ============================================================
-- 1. Engagement
-- ============================================================
CREATE TABLE migration.engagement (
    engagement_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL,
    source_system_name          VARCHAR(100) NOT NULL,
    canonical_schema_version    VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    status                      VARCHAR(20) NOT NULL DEFAULT 'PROFILING'
                                CHECK (status IN ('PROFILING','MAPPING','TRANSFORMING','RECONCILING','PARALLEL_RUN','COMPLETE')),
    quality_baseline_approved_at TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Quality Profile
-- ============================================================
CREATE TABLE migration.quality_profile (
    profile_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id       UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    source_table        VARCHAR(100) NOT NULL,
    accuracy_score      DECIMAL(5,4) NOT NULL,
    completeness_score  DECIMAL(5,4) NOT NULL,
    consistency_score   DECIMAL(5,4) NOT NULL,
    timeliness_score    DECIMAL(5,4) NOT NULL,
    validity_score      DECIMAL(5,4) NOT NULL,
    uniqueness_score    DECIMAL(5,4) NOT NULL,
    row_count           INTEGER NOT NULL,
    profiled_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. Field Mapping
-- ============================================================
CREATE TABLE migration.field_mapping (
    mapping_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id       UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    mapping_version     VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    source_table        VARCHAR(100) NOT NULL,
    source_column       VARCHAR(100) NOT NULL,
    canonical_table     VARCHAR(100) NOT NULL,
    canonical_column    VARCHAR(100) NOT NULL,
    template_confidence DECIMAL(5,4),
    signal_confidence   DECIMAL(5,4),
    agreement_status    VARCHAR(20) NOT NULL
                        CHECK (agreement_status IN ('AGREED','DISAGREED','TEMPLATE_ONLY','SIGNAL_ONLY')),
    approval_status     VARCHAR(20) NOT NULL DEFAULT 'PROPOSED'
                        CHECK (approval_status IN ('PROPOSED','APPROVED','REJECTED','SUPERSEDED')),
    approved_by         VARCHAR(100),
    approved_at         TIMESTAMPTZ
);

-- ============================================================
-- 4. Code Mapping
-- ============================================================
CREATE TABLE migration.code_mapping (
    code_mapping_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id       UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    source_table        VARCHAR(100) NOT NULL,
    source_column       VARCHAR(100) NOT NULL,
    source_value        VARCHAR(100) NOT NULL,
    canonical_value     VARCHAR(100) NOT NULL,
    approved_by         VARCHAR(100),
    approved_at         TIMESTAMPTZ
);

-- ============================================================
-- 5. Batch
-- ============================================================
CREATE TABLE migration.batch (
    batch_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id       UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    batch_scope         VARCHAR(200) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','RUNNING','LOADED','RECONCILED','APPROVED','FAILED')),
    mapping_version     VARCHAR(20) NOT NULL,
    row_count_source    INTEGER,
    row_count_loaded    INTEGER,
    row_count_exception INTEGER,
    error_rate          DECIMAL(5,4),
    halted_reason       TEXT,
    checkpoint_key      VARCHAR(200),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ
);

-- ============================================================
-- 6. Lineage
-- ============================================================
CREATE TABLE migration.lineage (
    lineage_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id            UUID NOT NULL REFERENCES migration.batch(batch_id),
    source_table        VARCHAR(100) NOT NULL,
    source_id           VARCHAR(100) NOT NULL,
    canonical_table     VARCHAR(100) NOT NULL,
    canonical_id        UUID NOT NULL,
    mapping_version     VARCHAR(20) NOT NULL,
    confidence_level    VARCHAR(20) NOT NULL
                        CHECK (confidence_level IN ('ACTUAL','DERIVED','ESTIMATED','ROLLED_UP')),
    transformations     JSONB,
    superseded_by       UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. Exception
-- ============================================================
CREATE TABLE migration.exception (
    exception_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id            UUID NOT NULL REFERENCES migration.batch(batch_id),
    source_table        VARCHAR(100) NOT NULL,
    source_id           VARCHAR(100) NOT NULL,
    canonical_table     VARCHAR(100),
    field_name          VARCHAR(100) NOT NULL,
    exception_type      VARCHAR(30) NOT NULL
                        CHECK (exception_type IN ('MISSING_REQUIRED','INVALID_FORMAT','REFERENTIAL_INTEGRITY',
                                                  'BUSINESS_RULE','CROSS_TABLE_MISMATCH','THRESHOLD_BREACH')),
    attempted_value     TEXT,
    constraint_violated VARCHAR(200) NOT NULL,
    disposition         VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (disposition IN ('PENDING','AUTO_FIXED','MANUAL_FIXED','EXCLUDED','DEFERRED')),
    resolution_note     TEXT,
    resolved_by         VARCHAR(100),
    resolved_at         TIMESTAMPTZ
);

-- ============================================================
-- 8. Reconciliation
-- ============================================================
CREATE TABLE migration.reconciliation (
    recon_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id            UUID NOT NULL REFERENCES migration.batch(batch_id),
    member_id           UUID NOT NULL,
    tier                INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
    calc_name           VARCHAR(50) NOT NULL,
    legacy_value        DECIMAL(12,2),
    recomputed_value    DECIMAL(12,2),
    variance_amount     DECIMAL(12,4),
    category            VARCHAR(10) NOT NULL
                        CHECK (category IN ('MATCH','MINOR','MAJOR','ERROR')),
    is_retiree          BOOLEAN NOT NULL DEFAULT FALSE,
    priority            VARCHAR(5) NOT NULL CHECK (priority IN ('P1','P2','P3')),
    suspected_domain    VARCHAR(50),
    systematic_flag     BOOLEAN NOT NULL DEFAULT FALSE,
    resolved            BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by         VARCHAR(100),
    resolution_note     TEXT
);

-- ============================================================
-- 9. Correction
-- ============================================================
CREATE TABLE migration.correction (
    correction_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id           UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    correction_type         VARCHAR(50) NOT NULL,
    affected_mapping_id     UUID REFERENCES migration.field_mapping(mapping_id),
    current_mapping         JSONB NOT NULL,
    proposed_mapping        JSONB NOT NULL,
    confidence              DECIMAL(5,4) NOT NULL,
    evidence                TEXT NOT NULL,
    affected_member_count   INTEGER NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'PROPOSED'
                            CHECK (status IN ('PROPOSED','APPROVED','REJECTED')),
    decided_by              VARCHAR(100),
    decided_at              TIMESTAMPTZ
);

-- ============================================================
-- 10. Analyst Decision
-- ============================================================
CREATE TABLE migration.analyst_decision (
    decision_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    engagement_id       UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    decision_type       VARCHAR(30) NOT NULL
                        CHECK (decision_type IN ('MAPPING_APPROVED','MAPPING_REJECTED',
                                                 'CORRECTION_APPROVED','CORRECTION_REJECTED',
                                                 'EXCEPTION_RESOLVED')),
    context             JSONB NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes for common query patterns
-- ============================================================
CREATE INDEX idx_lineage_batch_source ON migration.lineage(batch_id, source_table, source_id);
CREATE INDEX idx_lineage_canonical ON migration.lineage(canonical_table, canonical_id);
CREATE INDEX idx_exception_batch_disposition ON migration.exception(batch_id, disposition);
CREATE INDEX idx_reconciliation_batch_priority ON migration.reconciliation(batch_id, priority);
CREATE INDEX idx_field_mapping_engagement_status ON migration.field_mapping(engagement_id, approval_status);
CREATE INDEX idx_analyst_decision_tenant_engagement ON migration.analyst_decision(tenant_id, engagement_id);
