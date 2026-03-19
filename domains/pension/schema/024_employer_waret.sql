-- 024_employer_waret.sql
-- Employer WARET (Working After Retirement) domain — designations, tracking, penalties, IC disclosure
-- Phase 5 of employer domain roadmap

-- WARET designations — employer request to employ a retiree
CREATE TABLE IF NOT EXISTS waret_designation (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL,
    retiree_id      UUID,
    ssn_hash        TEXT NOT NULL,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,

    -- Designation type determines limits
    designation_type TEXT NOT NULL CHECK (designation_type IN (
        'STANDARD', '140_DAY', 'CRITICAL_SHORTAGE'
    )),

    -- Calendar year the designation covers
    calendar_year   INT NOT NULL,

    -- Limits (derived from designation_type, stored for audit)
    day_limit       INT,     -- NULL = unlimited (Critical Shortage)
    hour_limit      INT,     -- NULL = unlimited (Critical Shortage)

    -- Consecutive year tracking
    consecutive_years INT NOT NULL DEFAULT 1,

    -- 140-day: district capacity (max 10 per district)
    district_id     TEXT,

    -- ORP exemption — members who elected ORP in 1990s with continuous employment
    orp_exempt      BOOLEAN NOT NULL DEFAULT false,

    -- Status lifecycle
    designation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (designation_status IN (
        'PENDING', 'APPROVED', 'ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED'
    )),

    -- PERACare conflict (Critical Shortage only)
    peracare_conflict       BOOLEAN NOT NULL DEFAULT false,
    peracare_letter_sent_at TIMESTAMPTZ,
    peracare_response_due   TIMESTAMPTZ,
    peracare_resolved       BOOLEAN NOT NULL DEFAULT false,

    -- Approval
    approved_by     TEXT,
    approved_at     TIMESTAMPTZ,
    revoked_by      TEXT,
    revoked_at      TIMESTAMPTZ,
    revocation_reason TEXT,
    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waret_desig_org ON waret_designation(org_id);
CREATE INDEX IF NOT EXISTS idx_waret_desig_retiree ON waret_designation(retiree_id);
CREATE INDEX IF NOT EXISTS idx_waret_desig_ssn ON waret_designation(ssn_hash);
CREATE INDEX IF NOT EXISTS idx_waret_desig_year ON waret_designation(calendar_year);
CREATE INDEX IF NOT EXISTS idx_waret_desig_status ON waret_designation(designation_status);
CREATE INDEX IF NOT EXISTS idx_waret_desig_district ON waret_designation(district_id, calendar_year);

-- WARET tracking — daily work records for a retiree under a designation
CREATE TABLE IF NOT EXISTS waret_tracking (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designation_id  UUID NOT NULL REFERENCES waret_designation(id),
    org_id          UUID NOT NULL,
    retiree_id      UUID,

    -- Work record
    work_date       DATE NOT NULL,
    hours_worked    NUMERIC(5,2) NOT NULL CHECK (hours_worked > 0),
    counts_as_day   BOOLEAN NOT NULL DEFAULT false,  -- true if hours_worked > 4

    -- Running totals (denormalized for performance, kept in sync by app)
    ytd_days        INT NOT NULL DEFAULT 0,
    ytd_hours       NUMERIC(8,2) NOT NULL DEFAULT 0,

    -- Status
    entry_status    TEXT NOT NULL DEFAULT 'RECORDED' CHECK (entry_status IN (
        'RECORDED', 'VERIFIED', 'DISPUTED', 'VOIDED'
    )),

    submitted_by    TEXT NOT NULL,
    verified_by     TEXT,
    verified_at     TIMESTAMPTZ,
    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waret_track_desig ON waret_tracking(designation_id);
CREATE INDEX IF NOT EXISTS idx_waret_track_org ON waret_tracking(org_id);
CREATE INDEX IF NOT EXISTS idx_waret_track_retiree ON waret_tracking(retiree_id);
CREATE INDEX IF NOT EXISTS idx_waret_track_date ON waret_tracking(work_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_waret_track_unique ON waret_tracking(designation_id, work_date);

-- WARET YTD summary — materialized view of tracking data per designation
CREATE OR REPLACE VIEW waret_ytd_summary AS
SELECT
    d.id AS designation_id,
    d.org_id,
    d.retiree_id,
    d.ssn_hash,
    d.calendar_year,
    d.designation_type,
    d.day_limit,
    d.hour_limit,
    d.orp_exempt,
    COALESCE(SUM(CASE WHEN t.counts_as_day THEN 1 ELSE 0 END), 0) AS total_days,
    COALESCE(SUM(t.hours_worked), 0) AS total_hours,
    d.day_limit - COALESCE(SUM(CASE WHEN t.counts_as_day THEN 1 ELSE 0 END), 0) AS days_remaining,
    d.hour_limit - COALESCE(SUM(t.hours_worked), 0) AS hours_remaining,
    CASE
        WHEN d.orp_exempt THEN false
        WHEN d.day_limit IS NULL THEN false  -- Critical Shortage: unlimited
        WHEN COALESCE(SUM(CASE WHEN t.counts_as_day THEN 1 ELSE 0 END), 0) > d.day_limit THEN true
        WHEN COALESCE(SUM(t.hours_worked), 0) > d.hour_limit THEN true
        ELSE false
    END AS over_limit
FROM waret_designation d
LEFT JOIN waret_tracking t ON t.designation_id = d.id
    AND t.entry_status IN ('RECORDED', 'VERIFIED')
GROUP BY d.id, d.org_id, d.retiree_id, d.ssn_hash, d.calendar_year,
         d.designation_type, d.day_limit, d.hour_limit, d.orp_exempt;

-- WARET penalties — assessed when retiree exceeds limits
CREATE TABLE IF NOT EXISTS waret_penalty (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designation_id  UUID NOT NULL REFERENCES waret_designation(id),
    retiree_id      UUID,
    ssn_hash        TEXT NOT NULL,

    -- Penalty calculation — all NUMERIC, never float
    penalty_type    TEXT NOT NULL CHECK (penalty_type IN (
        'OVER_LIMIT', 'FIRST_BUSINESS_DAY', 'NON_DISCLOSURE'
    )),
    penalty_month       DATE NOT NULL,        -- first of the month the penalty applies to
    monthly_benefit     NUMERIC(14,2) NOT NULL,
    days_over_limit     INT NOT NULL DEFAULT 0,
    penalty_rate        NUMERIC(6,4) NOT NULL, -- 0.0500 = 5% per day, or 1.0000 = full month
    penalty_amount      NUMERIC(14,2) NOT NULL,

    -- For NON_DISCLOSURE: recover both retiree + employer contributions
    employer_recovery   NUMERIC(14,2) NOT NULL DEFAULT 0,
    retiree_recovery    NUMERIC(14,2) NOT NULL DEFAULT 0,

    -- Deduction spreading
    spread_months       INT NOT NULL DEFAULT 1,
    monthly_deduction   NUMERIC(14,2) NOT NULL,

    -- Status
    penalty_status  TEXT NOT NULL DEFAULT 'ASSESSED' CHECK (penalty_status IN (
        'ASSESSED', 'APPEALED', 'CONFIRMED', 'WAIVED', 'COLLECTING', 'COLLECTED'
    )),

    assessed_by     TEXT,
    assessed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    appealed_at     TIMESTAMPTZ,
    appeal_note     TEXT,
    waived_by       TEXT,
    waived_at       TIMESTAMPTZ,
    waiver_reason   TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waret_penalty_desig ON waret_penalty(designation_id);
CREATE INDEX IF NOT EXISTS idx_waret_penalty_retiree ON waret_penalty(retiree_id);
CREATE INDEX IF NOT EXISTS idx_waret_penalty_ssn ON waret_penalty(ssn_hash);
CREATE INDEX IF NOT EXISTS idx_waret_penalty_status ON waret_penalty(penalty_status);

-- WARET IC (Independent Contractor) disclosure — retirees must disclose IC work
CREATE TABLE IF NOT EXISTS waret_ic_disclosure (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retiree_id      UUID,
    ssn_hash        TEXT NOT NULL,
    org_id          UUID NOT NULL,

    -- Disclosure details
    calendar_year   INT NOT NULL,
    ic_start_date   DATE NOT NULL,
    ic_end_date     DATE,
    ic_description  TEXT NOT NULL,
    estimated_hours NUMERIC(8,2),
    estimated_compensation NUMERIC(14,2),

    -- Status
    disclosure_status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (disclosure_status IN (
        'SUBMITTED', 'REVIEWED', 'FLAGGED', 'CLEARED'
    )),

    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by     TEXT,
    reviewed_at     TIMESTAMPTZ,
    review_note     TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waret_ic_retiree ON waret_ic_disclosure(retiree_id);
CREATE INDEX IF NOT EXISTS idx_waret_ic_ssn ON waret_ic_disclosure(ssn_hash);
CREATE INDEX IF NOT EXISTS idx_waret_ic_org ON waret_ic_disclosure(org_id);
CREATE INDEX IF NOT EXISTS idx_waret_ic_year ON waret_ic_disclosure(calendar_year);
