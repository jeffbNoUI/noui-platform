-- =============================================================================
-- Employer Reporting Schema
-- NoUI Platform — Employer Domain (Phase 2: Reporting Engine)
-- =============================================================================
-- Tables: contribution_file, contribution_record, contribution_exception,
--         contribution_payment, late_interest_accrual
-- =============================================================================
-- Applied after 020_employer_shared.sql. References employer_division,
-- employer_portal_user, and contribution_rate_table from Phase 1 schema.
-- All monetary columns are NUMERIC — never float.
-- =============================================================================

BEGIN;

-- =============================================================================
-- contribution_file — Payroll file submissions from employers
-- =============================================================================
-- Lifecycle: UPLOADED → VALIDATING → VALIDATED/PARTIAL_POST/EXCEPTION/REJECTED
--          → PAYMENT_SETUP → PAYMENT_PENDING → PROCESSED
--          → REPLACED (if a correction replaces this file)

CREATE TABLE contribution_file (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    org_id              UUID            NOT NULL REFERENCES crm_organization(org_id),
    uploaded_by         UUID            NOT NULL REFERENCES employer_portal_user(id),
    file_name           TEXT            NOT NULL,
    file_type           TEXT            NOT NULL CHECK (file_type IN ('TEXT', 'EXCEL', 'MANUAL_ENTRY')),
    file_status         TEXT            NOT NULL DEFAULT 'UPLOADED' CHECK (file_status IN (
                            'UPLOADED', 'VALIDATING', 'VALIDATED', 'PARTIAL_POST',
                            'EXCEPTION', 'PAYMENT_SETUP', 'PAYMENT_PENDING',
                            'PROCESSED', 'REPLACED', 'REJECTED')),
    period_start        DATE            NOT NULL,
    period_end          DATE            NOT NULL,
    division_code       TEXT            NOT NULL REFERENCES employer_division(division_code),
    total_records       INT             NOT NULL DEFAULT 0,
    valid_records       INT             NOT NULL DEFAULT 0,
    failed_records      INT             NOT NULL DEFAULT 0,
    total_amount        NUMERIC(14,2)   NOT NULL DEFAULT 0,
    validated_amount    NUMERIC(14,2)   NOT NULL DEFAULT 0,
    replaces_file_id    UUID            REFERENCES contribution_file(id),
    validation_started_at  TIMESTAMPTZ,
    validation_completed_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),

    PRIMARY KEY (id),
    CHECK (period_end >= period_start)
);

-- =============================================================================
-- contribution_record — Individual contribution line items within a file
-- =============================================================================
-- Each record represents one member's contribution for the pay period.
-- Rates are compared against contribution_rate_table for validation.

CREATE TABLE contribution_record (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    file_id             UUID            NOT NULL REFERENCES contribution_file(id) ON DELETE CASCADE,
    row_number          INT             NOT NULL,
    ssn_hash            TEXT            NOT NULL,
    member_name         TEXT,
    member_id           UUID,
    division_code       TEXT            NOT NULL REFERENCES employer_division(division_code),
    is_safety_officer   BOOLEAN         NOT NULL DEFAULT false,
    is_orp              BOOLEAN         NOT NULL DEFAULT false,
    gross_salary        NUMERIC(12,2)   NOT NULL,
    member_contribution NUMERIC(10,2)   NOT NULL,
    employer_contribution NUMERIC(10,2) NOT NULL,
    aed_amount          NUMERIC(10,2)   NOT NULL DEFAULT 0,
    saed_amount         NUMERIC(10,2)   NOT NULL DEFAULT 0,
    aap_amount          NUMERIC(10,2)   NOT NULL DEFAULT 0,
    dc_supplement_amount NUMERIC(10,2)  NOT NULL DEFAULT 0,
    total_amount        NUMERIC(12,2)   NOT NULL,
    record_status       TEXT            NOT NULL DEFAULT 'PENDING' CHECK (record_status IN (
                            'PENDING', 'VALID', 'FAILED', 'CORRECTED', 'POSTED')),
    validation_errors   JSONB,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),

    PRIMARY KEY (id),
    UNIQUE (file_id, row_number)
);

-- =============================================================================
-- contribution_exception — Validation failures requiring resolution
-- =============================================================================
-- Categories match business rules: rate mismatch, unknown member, wrong plan,
-- retiree/IC detection, salary spreading, DC team routing.

CREATE TABLE contribution_exception (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    file_id             UUID            NOT NULL REFERENCES contribution_file(id) ON DELETE CASCADE,
    record_id           UUID            REFERENCES contribution_record(id) ON DELETE CASCADE,
    org_id              UUID            NOT NULL REFERENCES crm_organization(org_id),
    exception_type      TEXT            NOT NULL CHECK (exception_type IN (
                            'RATE_MISMATCH', 'UNKNOWN_MEMBER', 'WRONG_PLAN',
                            'WRONG_DIVISION', 'RETIREE_DETECTED', 'IC_DETECTED',
                            'SALARY_SPREADING', 'DUPLICATE_SSN', 'MISSING_DATA',
                            'NEGATIVE_AMOUNT', 'OTHER')),
    exception_status    TEXT            NOT NULL DEFAULT 'UNRESOLVED' CHECK (exception_status IN (
                            'UNRESOLVED', 'PENDING_RESPONSE', 'ESCALATED',
                            'RESOLVED', 'DC_ROUTED')),
    description         TEXT            NOT NULL,
    expected_value      TEXT,
    submitted_value     TEXT,
    assigned_to         UUID            REFERENCES employer_portal_user(id),
    resolution_note     TEXT,
    resolved_by         UUID            REFERENCES employer_portal_user(id),
    resolved_at         TIMESTAMPTZ,
    escalated_at        TIMESTAMPTZ,
    dc_routed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),

    PRIMARY KEY (id)
);

-- =============================================================================
-- contribution_payment — Payment records for validated contribution files
-- =============================================================================
-- ACH (COPERA-initiated) or wire (employer-initiated).

CREATE TABLE contribution_payment (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    file_id             UUID            NOT NULL REFERENCES contribution_file(id),
    org_id              UUID            NOT NULL REFERENCES crm_organization(org_id),
    payment_method      TEXT            NOT NULL CHECK (payment_method IN ('ACH', 'WIRE')),
    payment_status      TEXT            NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN (
                            'PENDING', 'SCHEDULED', 'PROCESSING', 'COMPLETED',
                            'FAILED', 'CANCELLED')),
    amount              NUMERIC(14,2)   NOT NULL,
    scheduled_date      DATE,
    processed_date      DATE,
    reference_number    TEXT,
    discrepancy_amount  NUMERIC(12,2),
    created_by          UUID            REFERENCES employer_portal_user(id),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),

    PRIMARY KEY (id)
);

-- =============================================================================
-- late_interest_accrual — Interest charged on late contribution payments
-- =============================================================================
-- Accrual calculated per pay period. Rate comes from late_interest_rate table.
-- Actual rate values are a data gap — schema ready for when rates are confirmed.

CREATE TABLE late_interest_accrual (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    org_id              UUID            NOT NULL REFERENCES crm_organization(org_id),
    file_id             UUID            REFERENCES contribution_file(id),
    period_start        DATE            NOT NULL,
    period_end          DATE            NOT NULL,
    days_late           INT             NOT NULL,
    base_amount         NUMERIC(14,2)   NOT NULL,
    interest_rate       NUMERIC(8,6)    NOT NULL,
    interest_amount     NUMERIC(12,2)   NOT NULL,
    minimum_charge_applied BOOLEAN      NOT NULL DEFAULT false,
    payment_id          UUID            REFERENCES contribution_payment(id),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),

    PRIMARY KEY (id)
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX idx_contribution_file_org ON contribution_file(org_id);
CREATE INDEX idx_contribution_file_status ON contribution_file(file_status);
CREATE INDEX idx_contribution_file_period ON contribution_file(period_start, period_end);

CREATE INDEX idx_contribution_record_file ON contribution_record(file_id);
CREATE INDEX idx_contribution_record_status ON contribution_record(record_status);
CREATE INDEX idx_contribution_record_ssn ON contribution_record(ssn_hash);

CREATE INDEX idx_contribution_exception_file ON contribution_exception(file_id);
CREATE INDEX idx_contribution_exception_org ON contribution_exception(org_id);
CREATE INDEX idx_contribution_exception_status ON contribution_exception(exception_status);
CREATE INDEX idx_contribution_exception_type ON contribution_exception(exception_type);

CREATE INDEX idx_contribution_payment_file ON contribution_payment(file_id);
CREATE INDEX idx_contribution_payment_org ON contribution_payment(org_id);
CREATE INDEX idx_contribution_payment_status ON contribution_payment(payment_status);

CREATE INDEX idx_late_interest_org ON late_interest_accrual(org_id);

COMMIT;
