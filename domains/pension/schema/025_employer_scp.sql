-- 025_employer_scp.sql
-- Employer SCP (Service Credit Purchase) domain — cost factors, purchase requests
-- Phase 6 of employer domain roadmap
--
-- CRITICAL: Purchased service credit contributes to BENEFIT CALCULATION but
-- does NOT count toward eligibility tests (Rule of 75/85, IPR, vesting).
-- The exclusion flags on scp_request are immutable after creation.

-- SCP cost factors — actuarial cost factor lookup table
-- Versioned by effective date. Lookup by tier, hire date window, and age at purchase.
CREATE TABLE IF NOT EXISTS scp_cost_factor (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Lookup key
    tier            TEXT NOT NULL CHECK (tier IN ('TIER_1', 'TIER_2', 'TIER_3')),
    hire_date_from  DATE NOT NULL,         -- inclusive lower bound of hire date window
    hire_date_to    DATE NOT NULL,          -- inclusive upper bound of hire date window
    age_at_purchase INT NOT NULL,           -- member's age (whole years) at purchase date
    effective_date  DATE NOT NULL,          -- when this factor version takes effect
    expiry_date     DATE,                   -- NULL = current/no expiry

    -- Actuarial factor
    cost_factor     NUMERIC(8,6) NOT NULL,  -- e.g. 0.125000 = 12.5%

    -- Metadata
    source_document TEXT,                   -- BPI reference or board resolution
    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scp_factor_tier ON scp_cost_factor(tier);
CREATE INDEX IF NOT EXISTS idx_scp_factor_effective ON scp_cost_factor(effective_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scp_factor_lookup
    ON scp_cost_factor(tier, age_at_purchase, effective_date)
    WHERE expiry_date IS NULL;

-- SCP requests — member purchase requests with immutable exclusion flags
CREATE TABLE IF NOT EXISTS scp_request (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL,
    member_id       UUID,
    ssn_hash        TEXT NOT NULL,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,

    -- Service type being purchased
    service_type    TEXT NOT NULL CHECK (service_type IN (
        'REFUNDED_PRIOR_PERA',     -- refunded prior PERA service
        'MILITARY_USERRA',          -- military service under USERRA
        'PRIOR_PUBLIC_EMPLOYMENT',  -- prior public employment
        'LEAVE_OF_ABSENCE',         -- approved leave of absence
        'PERACHOICE_TRANSFER'       -- PERAChoice to defined benefit transfer
    )),

    -- Purchase details
    tier            TEXT NOT NULL CHECK (tier IN ('TIER_1', 'TIER_2', 'TIER_3')),
    years_requested NUMERIC(5,2) NOT NULL CHECK (years_requested > 0),
    cost_factor_id  UUID REFERENCES scp_cost_factor(id),
    cost_factor     NUMERIC(8,6),           -- snapshot of factor at quote time

    -- Cost calculation — all NUMERIC, never float
    annual_salary_at_purchase NUMERIC(14,2),
    total_cost      NUMERIC(14,2),          -- years_requested × annual_salary × cost_factor

    -- Payment
    payment_method  TEXT CHECK (payment_method IN (
        'LUMP_SUM', 'DIRECT_ROLLOVER', 'INSTALLMENT'
    )),
    amount_paid     NUMERIC(14,2) NOT NULL DEFAULT 0,
    amount_remaining NUMERIC(14,2) NOT NULL DEFAULT 0,

    -- Quote lifecycle
    quote_date      DATE,
    quote_expires   DATE,                   -- typically 60 days from quote
    quote_recalculated BOOLEAN NOT NULL DEFAULT false,

    -- Documentation
    documentation_received BOOLEAN NOT NULL DEFAULT false,
    documentation_verified BOOLEAN NOT NULL DEFAULT false,
    verified_by     TEXT,
    verified_at     TIMESTAMPTZ,

    -- ================================================================
    -- CRITICAL EXCLUSION FLAGS — fiduciary requirement
    -- These flags are set at creation and MUST NEVER be changed.
    -- Purchased service contributes to benefit calculation ONLY.
    -- It does NOT count toward any eligibility tests.
    -- ================================================================
    excludes_from_rule_of_75_85 BOOLEAN NOT NULL DEFAULT true,
    excludes_from_ipr           BOOLEAN NOT NULL DEFAULT true,
    excludes_from_vesting       BOOLEAN NOT NULL DEFAULT true,

    -- Status lifecycle
    request_status  TEXT NOT NULL DEFAULT 'DRAFT' CHECK (request_status IN (
        'DRAFT',        -- initial creation
        'QUOTED',       -- cost quote generated
        'PENDING_DOCS', -- awaiting documentation
        'UNDER_REVIEW', -- documentation submitted, under review
        'APPROVED',     -- approved for payment
        'PAYING',       -- payment in progress
        'COMPLETED',    -- fully paid, service credit applied
        'EXPIRED',      -- quote expired without action
        'DENIED',       -- request denied
        'CANCELLED'     -- cancelled by member
    )),

    -- Approval
    submitted_by    TEXT,
    submitted_at    TIMESTAMPTZ,
    reviewed_by     TEXT,
    reviewed_at     TIMESTAMPTZ,
    review_note     TEXT,
    approved_by     TEXT,
    approved_at     TIMESTAMPTZ,
    denied_by       TEXT,
    denied_at       TIMESTAMPTZ,
    denial_reason   TEXT,

    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scp_request_org ON scp_request(org_id);
CREATE INDEX IF NOT EXISTS idx_scp_request_member ON scp_request(member_id);
CREATE INDEX IF NOT EXISTS idx_scp_request_ssn ON scp_request(ssn_hash);
CREATE INDEX IF NOT EXISTS idx_scp_request_status ON scp_request(request_status);
CREATE INDEX IF NOT EXISTS idx_scp_request_type ON scp_request(service_type);

-- ================================================================
-- IMMUTABILITY TRIGGER — exclusion flags can never be changed
-- This is a database-level enforcement of the fiduciary requirement.
-- Even if application code has a bug, the database will reject the change.
-- ================================================================
CREATE OR REPLACE FUNCTION prevent_exclusion_flag_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.excludes_from_rule_of_75_85 IS DISTINCT FROM NEW.excludes_from_rule_of_75_85 THEN
        RAISE EXCEPTION 'Cannot modify excludes_from_rule_of_75_85 — exclusion flags are immutable after creation';
    END IF;
    IF OLD.excludes_from_ipr IS DISTINCT FROM NEW.excludes_from_ipr THEN
        RAISE EXCEPTION 'Cannot modify excludes_from_ipr — exclusion flags are immutable after creation';
    END IF;
    IF OLD.excludes_from_vesting IS DISTINCT FROM NEW.excludes_from_vesting THEN
        RAISE EXCEPTION 'Cannot modify excludes_from_vesting — exclusion flags are immutable after creation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_scp_exclusion_immutable
    BEFORE UPDATE ON scp_request
    FOR EACH ROW
    EXECUTE FUNCTION prevent_exclusion_flag_change();
