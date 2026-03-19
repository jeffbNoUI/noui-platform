-- 022_employer_enrollment.sql
-- Employer Enrollment: new member submissions, duplicate detection, PERAChoice elections
-- Depends on: 020_employer_shared.sql (employer_division, employer_portal_user)

-- ---------------------------------------------------------------------------
-- 1. enrollment_submission — new member enrollment records
-- ---------------------------------------------------------------------------
-- Tracks employer-initiated and member-initiated enrollments through their
-- lifecycle: DRAFT → SUBMITTED → VALIDATING → VALIDATED → DUPLICATE_REVIEW
-- → APPROVED → REJECTED
CREATE TABLE IF NOT EXISTS enrollment_submission (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL,
    submitted_by    UUID NOT NULL,         -- portal_user or member id
    enrollment_type TEXT NOT NULL CHECK (enrollment_type IN (
        'EMPLOYER_INITIATED', 'MEMBER_INITIATED', 'REHIRE'
    )),
    submission_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (submission_status IN (
        'DRAFT', 'SUBMITTED', 'VALIDATING', 'VALIDATED',
        'DUPLICATE_REVIEW', 'APPROVED', 'REJECTED'
    )),

    -- Member identity (mandatory fields per spec)
    ssn_hash        TEXT NOT NULL,          -- SHA-256 hash of SSN
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    date_of_birth   DATE NOT NULL,
    hire_date       DATE NOT NULL,

    -- Plan assignment
    plan_code       TEXT NOT NULL CHECK (plan_code IN ('DB', 'DC', 'ORP')),
    division_code   TEXT NOT NULL,
    tier            TEXT CHECK (tier IN ('T1', 'T2', 'T3')),  -- auto-assigned from hire_date

    -- Optional fields (added as COPERA confirms)
    middle_name     TEXT,
    suffix          TEXT,
    gender          TEXT CHECK (gender IN ('M', 'F', 'X') OR gender IS NULL),
    address_line1   TEXT,
    address_line2   TEXT,
    city            TEXT,
    state           TEXT,
    zip_code        TEXT,
    email           TEXT,
    phone           TEXT,
    is_safety_officer BOOLEAN NOT NULL DEFAULT FALSE,
    job_title       TEXT,
    annual_salary   NUMERIC,               -- for initial contribution setup

    -- Rehire fields
    is_rehire           BOOLEAN NOT NULL DEFAULT FALSE,
    prior_member_id     UUID,              -- link to existing member record
    prior_refund_taken  BOOLEAN,           -- if true, check redeposit eligibility

    -- Conflict resolution
    conflict_status TEXT CHECK (conflict_status IN (
        'NONE', 'EMPLOYER_MEMBER_MISMATCH', 'RESOLVED_EMPLOYER',
        'RESOLVED_MEMBER', 'RESOLVED_MANUAL'
    ) OR conflict_status IS NULL),
    conflict_fields JSONB,                 -- which fields disagree
    conflict_resolved_by UUID,
    conflict_resolved_at TIMESTAMPTZ,

    -- Validation
    validation_errors   JSONB,             -- array of {field, message} objects
    validated_at        TIMESTAMPTZ,
    approved_by         UUID,
    approved_at         TIMESTAMPTZ,
    rejected_by         UUID,
    rejected_at         TIMESTAMPTZ,
    rejection_reason    TEXT,

    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for enrollment_submission
CREATE INDEX IF NOT EXISTS idx_enrollment_sub_org
    ON enrollment_submission (org_id, submission_status);
CREATE INDEX IF NOT EXISTS idx_enrollment_sub_ssn
    ON enrollment_submission (ssn_hash);
CREATE INDEX IF NOT EXISTS idx_enrollment_sub_status
    ON enrollment_submission (submission_status);
CREATE INDEX IF NOT EXISTS idx_enrollment_sub_hire
    ON enrollment_submission (hire_date);
CREATE INDEX IF NOT EXISTS idx_enrollment_sub_created
    ON enrollment_submission (created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. enrollment_duplicate_flag — potential duplicate detection results
-- ---------------------------------------------------------------------------
-- Each row links a submission to a potential duplicate match. Admin must
-- review and resolve before the submission can be approved.
CREATE TABLE IF NOT EXISTS enrollment_duplicate_flag (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES enrollment_submission(id) ON DELETE CASCADE,
    match_type      TEXT NOT NULL CHECK (match_type IN (
        'SSN_EXACT',           -- same SSN hash already exists
        'NAME_DOB_FUZZY'       -- name + DOB close match (different SSN)
    )),
    matched_member_id UUID,                -- existing member record if found
    matched_submission_id UUID,            -- another pending submission if found
    confidence_score NUMERIC NOT NULL DEFAULT 1.0 CHECK (
        confidence_score >= 0 AND confidence_score <= 1
    ),
    match_details   JSONB,                 -- which fields matched and how

    -- Resolution
    resolution_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (resolution_status IN (
        'PENDING',             -- awaiting admin review
        'CONFIRMED_DUPLICATE', -- admin confirmed: merge or reject
        'FALSE_POSITIVE',      -- admin confirmed: not a duplicate
        'AUTO_RESOLVED'        -- system resolved (e.g., rehire path)
    )),
    resolved_by     UUID,
    resolved_at     TIMESTAMPTZ,
    resolution_note TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for enrollment_duplicate_flag
CREATE INDEX IF NOT EXISTS idx_dup_flag_submission
    ON enrollment_duplicate_flag (submission_id);
CREATE INDEX IF NOT EXISTS idx_dup_flag_status
    ON enrollment_duplicate_flag (resolution_status);
CREATE INDEX IF NOT EXISTS idx_dup_flag_matched_member
    ON enrollment_duplicate_flag (matched_member_id)
    WHERE matched_member_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. perachoice_election — DC election tracking within 60-day window
-- ---------------------------------------------------------------------------
-- When a new hire is eligible for PERAChoice (DC plan option), this table
-- tracks the 60-day election window and the member's choice.
CREATE TABLE IF NOT EXISTS perachoice_election (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES enrollment_submission(id) ON DELETE CASCADE,
    member_id       UUID,                  -- linked after enrollment approved

    -- Window tracking
    hire_date       DATE NOT NULL,
    window_opens    DATE NOT NULL,          -- = hire_date
    window_closes   DATE NOT NULL,          -- = hire_date + 60 days
    election_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (election_status IN (
        'PENDING',             -- within window, no choice made
        'ELECTED_DC',          -- member chose DC plan
        'DEFAULTED_DB',        -- window expired, defaults to DB
        'WAIVED',              -- member explicitly chose DB
        'INELIGIBLE'           -- not eligible for PERAChoice
    )),

    -- Election details
    elected_at      TIMESTAMPTZ,
    elected_plan    TEXT CHECK (elected_plan IN ('DB', 'DC') OR elected_plan IS NULL),
    notification_sent_at TIMESTAMPTZ,      -- when DC team was notified
    dc_team_notified BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_sent_at TIMESTAMPTZ,          -- reminder before window closes
    member_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for perachoice_election
CREATE INDEX IF NOT EXISTS idx_perachoice_submission
    ON perachoice_election (submission_id);
CREATE INDEX IF NOT EXISTS idx_perachoice_status
    ON perachoice_election (election_status);
CREATE INDEX IF NOT EXISTS idx_perachoice_window
    ON perachoice_election (window_closes)
    WHERE election_status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_perachoice_member
    ON perachoice_election (member_id)
    WHERE member_id IS NOT NULL;
