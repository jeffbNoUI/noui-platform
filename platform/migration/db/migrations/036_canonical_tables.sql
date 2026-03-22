-- Migration 036: Canonical tables for reconciliation
--
-- Fixes lineage/exception schema drift (DDL was row-level, code writes
-- column-level entries) and adds canonical output tables + source reference
-- tables required by the three-tier reconciler.

-- ============================================================
-- 1. Fix lineage table — code writes per-column entries, not per-row
-- ============================================================
DROP TABLE IF EXISTS migration.lineage CASCADE;
CREATE TABLE migration.lineage (
    lineage_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id        UUID NOT NULL REFERENCES migration.batch(batch_id),
    row_key         VARCHAR(200) NOT NULL,
    handler_name    VARCHAR(100) NOT NULL,
    column_name     VARCHAR(100) NOT NULL,
    source_value    TEXT,
    result_value    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lineage_batch_row ON migration.lineage(batch_id, row_key);

-- ============================================================
-- 2. Fix exception table — code writes per-column entries
-- ============================================================
DROP TABLE IF EXISTS migration.exception CASCADE;
CREATE TABLE migration.exception (
    exception_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id        UUID NOT NULL REFERENCES migration.batch(batch_id),
    row_key         VARCHAR(200) NOT NULL,
    handler_name    VARCHAR(100) NOT NULL,
    column_name     VARCHAR(100) NOT NULL,
    source_value    TEXT,
    exception_type  VARCHAR(30) NOT NULL
                    CHECK (exception_type IN ('MISSING_REQUIRED','INVALID_FORMAT','REFERENTIAL_INTEGRITY',
                                              'BUSINESS_RULE','CROSS_TABLE_MISMATCH','THRESHOLD_BREACH')),
    message         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_exception_batch ON migration.exception(batch_id);

-- ============================================================
-- 3. Canonical row — lightweight per-row batch output
-- ============================================================
CREATE TABLE migration.canonical_row (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id        UUID NOT NULL REFERENCES migration.batch(batch_id),
    row_key         VARCHAR(200) NOT NULL,
    confidence      VARCHAR(20) NOT NULL
                    CHECK (confidence IN ('ACTUAL','DERIVED','ESTIMATED','ROLLED_UP')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (batch_id, row_key)
);

-- ============================================================
-- 4. Canonical members — transformation output for reconciliation
--    Populated by batch executor from TransformResult.CanonicalRow
-- ============================================================
CREATE TABLE migration.canonical_members (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id                UUID NOT NULL REFERENCES migration.batch(batch_id),
    member_id               VARCHAR(200) NOT NULL,
    member_status           VARCHAR(20),
    canonical_benefit       TEXT,
    service_credit_years    DOUBLE PRECISION,
    employment_start        TIMESTAMPTZ,
    employment_end          TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_canonical_members_batch ON migration.canonical_members(batch_id);

-- ============================================================
-- 5. Canonical salaries — transformation output (tier 3 check 3a)
-- ============================================================
CREATE TABLE migration.canonical_salaries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id        UUID NOT NULL REFERENCES migration.batch(batch_id),
    member_id       VARCHAR(200) NOT NULL,
    salary_year     INTEGER NOT NULL,
    salary_amount   DOUBLE PRECISION NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_canonical_salaries_batch ON migration.canonical_salaries(batch_id);

-- ============================================================
-- 6. Canonical contributions — transformation output (tier 3 check 3b)
-- ============================================================
CREATE TABLE migration.canonical_contributions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id        UUID NOT NULL REFERENCES migration.batch(batch_id),
    member_id       VARCHAR(200) NOT NULL,
    contribution_amount NUMERIC(18,2) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_canonical_contributions_batch ON migration.canonical_contributions(batch_id);

-- ============================================================
-- 7. Stored calculations — loaded from source DB for tier 1
--    PRISM: from PRISM_BENEFIT_CALC
--    PAS:   from retirement_award
-- ============================================================
CREATE TABLE migration.stored_calculations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id        UUID NOT NULL REFERENCES migration.batch(batch_id),
    member_id       VARCHAR(200) NOT NULL,
    yos_used        TEXT,
    fas_used        TEXT,
    age_at_calc     INTEGER,
    plan_code       VARCHAR(20),
    stored_benefit  TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stored_calculations_batch ON migration.stored_calculations(batch_id);

-- ============================================================
-- 8. Payment history — loaded from source DB for tier 2
--    PRISM: from PRISM_PMT_HIST
--    PAS:   from benefit_payment
-- ============================================================
CREATE TABLE migration.payment_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id        UUID NOT NULL REFERENCES migration.batch(batch_id),
    member_id       VARCHAR(200) NOT NULL,
    payment_type    VARCHAR(20) NOT NULL,
    payment_date    DATE NOT NULL,
    gross_amount    TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_history_batch ON migration.payment_history(batch_id);
