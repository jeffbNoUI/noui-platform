-- 023_employer_terminations.sql
-- Employer Terminations & Refund domain — certification, holds, refund applications
-- Phase 4 of employer domain roadmap

-- Termination certifications submitted by employers
CREATE TABLE IF NOT EXISTS termination_certification (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL,
    member_id       UUID,
    ssn_hash        TEXT NOT NULL,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,

    -- Termination details
    last_day_worked         DATE NOT NULL,
    termination_reason      TEXT NOT NULL CHECK (termination_reason IN (
        'RESIGNATION', 'RETIREMENT', 'LAYOFF', 'TERMINATION',
        'DEATH', 'DISABILITY', 'OTHER'
    )),
    final_contribution_date DATE,
    final_salary_amount     NUMERIC(12,2),

    -- Status lifecycle
    certification_status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (certification_status IN (
        'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'CANCELLED'
    )),

    -- Metadata
    submitted_by    TEXT NOT NULL,
    verified_by     TEXT,
    verified_at     TIMESTAMPTZ,
    rejected_by     TEXT,
    rejected_at     TIMESTAMPTZ,
    rejection_reason TEXT,
    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_term_cert_org ON termination_certification(org_id);
CREATE INDEX IF NOT EXISTS idx_term_cert_member ON termination_certification(member_id);
CREATE INDEX IF NOT EXISTS idx_term_cert_ssn ON termination_certification(ssn_hash);
CREATE INDEX IF NOT EXISTS idx_term_cert_status ON termination_certification(certification_status);

-- Certification holds — auto-created when refund form received without termination date
CREATE TABLE IF NOT EXISTS certification_hold (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_application_id UUID NOT NULL,
    org_id              UUID NOT NULL,
    member_id           UUID,
    ssn_hash            TEXT NOT NULL,

    -- Hold lifecycle
    hold_status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (hold_status IN (
        'PENDING', 'REMINDER_SENT', 'ESCALATED', 'RESOLVED', 'CANCELLED', 'EXPIRED'
    )),
    hold_reason         TEXT NOT NULL DEFAULT 'PENDING_EMPLOYER_CERTIFICATION',

    -- Countdown
    countdown_days      INT NOT NULL DEFAULT 45,
    expires_at          TIMESTAMPTZ NOT NULL,
    reminder_sent_at    TIMESTAMPTZ,
    escalated_at        TIMESTAMPTZ,

    -- Resolution
    resolved_by         TEXT,
    resolved_at         TIMESTAMPTZ,
    resolution_note     TEXT,
    certification_id    UUID REFERENCES termination_certification(id),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cert_hold_refund ON certification_hold(refund_application_id);
CREATE INDEX IF NOT EXISTS idx_cert_hold_org ON certification_hold(org_id);
CREATE INDEX IF NOT EXISTS idx_cert_hold_status ON certification_hold(hold_status);
CREATE INDEX IF NOT EXISTS idx_cert_hold_expires ON certification_hold(expires_at);

-- Refund applications — member requests for contribution refund
CREATE TABLE IF NOT EXISTS refund_application (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       UUID,
    ssn_hash        TEXT NOT NULL,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,

    -- Eligibility
    hire_date               DATE NOT NULL,
    termination_date        DATE,
    separation_date         DATE,
    years_of_service        NUMERIC(6,4),
    is_vested               BOOLEAN NOT NULL DEFAULT false,
    has_disability_app      BOOLEAN NOT NULL DEFAULT false,
    disability_app_date     DATE,

    -- Refund calculation — all NUMERIC, never float
    employee_contributions  NUMERIC(14,2) NOT NULL DEFAULT 0,
    interest_rate           NUMERIC(8,6),
    interest_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
    gross_refund            NUMERIC(14,2) NOT NULL DEFAULT 0,
    federal_tax_withholding NUMERIC(14,2) NOT NULL DEFAULT 0,
    dro_deduction           NUMERIC(14,2) NOT NULL DEFAULT 0,
    net_refund              NUMERIC(14,2) NOT NULL DEFAULT 0,

    -- Payment
    payment_method      TEXT CHECK (payment_method IN (
        'DIRECT_DEPOSIT', 'ROLLOVER', 'PARTIAL_ROLLOVER', 'CHECK'
    )),
    rollover_amount     NUMERIC(14,2),
    direct_amount       NUMERIC(14,2),
    ach_routing_number  TEXT,
    ach_account_number  TEXT,
    rollover_institution TEXT,
    rollover_account    TEXT,

    -- Status lifecycle
    application_status  TEXT NOT NULL DEFAULT 'DRAFT' CHECK (application_status IN (
        'DRAFT', 'SUBMITTED', 'HOLD_PENDING_CERTIFICATION',
        'ELIGIBILITY_CHECK', 'CALCULATION_COMPLETE',
        'PAYMENT_SCHEDULED', 'PAYMENT_LOCKED', 'DISBURSED',
        'DENIED', 'CANCELLED', 'FORFEITURE_ACKNOWLEDGED'
    )),

    -- Forfeiture (vested members must acknowledge)
    forfeiture_acknowledged     BOOLEAN NOT NULL DEFAULT false,
    forfeiture_acknowledged_at  TIMESTAMPTZ,

    -- Signatures
    member_signature        BOOLEAN NOT NULL DEFAULT false,
    notarized               BOOLEAN NOT NULL DEFAULT false,
    w9_received             BOOLEAN NOT NULL DEFAULT false,

    -- Processing
    submitted_at        TIMESTAMPTZ,
    eligibility_checked_at TIMESTAMPTZ,
    calculated_at       TIMESTAMPTZ,
    payment_scheduled_at TIMESTAMPTZ,
    payment_locked_at   TIMESTAMPTZ,
    disbursed_at        TIMESTAMPTZ,
    denied_at           TIMESTAMPTZ,
    denial_reason       TEXT,
    processed_by        TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_app_member ON refund_application(member_id);
CREATE INDEX IF NOT EXISTS idx_refund_app_ssn ON refund_application(ssn_hash);
CREATE INDEX IF NOT EXISTS idx_refund_app_status ON refund_application(application_status);

-- Add FK from certification_hold to refund_application
ALTER TABLE certification_hold
    ADD CONSTRAINT fk_cert_hold_refund
    FOREIGN KEY (refund_application_id) REFERENCES refund_application(id);
