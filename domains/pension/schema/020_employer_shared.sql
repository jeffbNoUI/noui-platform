-- =============================================================================
-- Employer Shared Schema
-- NoUI Platform — Employer Domain (Phase 1: Portal + Phase 2: Reporting)
-- =============================================================================
-- Tables: employer_division, employer_portal_user, contribution_rate_table,
--         late_interest_rate, employer_alert
-- Seed data: COPERA contribution rates (January 2025 + January 2026)
-- =============================================================================
-- Applied after 002_crm_schema.sql. References crm_organization and crm_contact.
-- Rate data source: COPERA Contribution Rates fact sheet, REV 1-26.
-- =============================================================================

BEGIN;

-- =============================================================================
-- employer_division — COPERA's 5 employer divisions
-- =============================================================================

CREATE TABLE employer_division (
    division_code       TEXT            NOT NULL,
    division_name       TEXT            NOT NULL,
    governing_statute   TEXT,
    effective_date      DATE            NOT NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),

    PRIMARY KEY (division_code)
);

-- =============================================================================
-- employer_portal_user — Portal access and roles
-- =============================================================================

CREATE TABLE employer_portal_user (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    org_id                  UUID            NOT NULL REFERENCES crm_organization(org_id),
    contact_id              UUID            NOT NULL REFERENCES crm_contact(contact_id),
    portal_role             TEXT            NOT NULL CHECK (portal_role IN (
                                'SUPER_USER', 'PAYROLL_CONTACT', 'HR_CONTACT', 'READ_ONLY')),
    is_active               BOOLEAN         NOT NULL DEFAULT true,
    last_login_at           TIMESTAMPTZ,
    onboarding_completed_at TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    PRIMARY KEY (id),
    UNIQUE (org_id, contact_id)
);

-- =============================================================================
-- contribution_rate_table — Versioned, effective-dated contribution rates
-- =============================================================================
-- Key: division × safety_officer_flag × effective_date
-- NOT division × plan_type × tier. Tiers affect benefit formula multipliers,
-- not contribution rates.
-- Health care trust rate (1.02%) is INCLUDED in the base rate, not additional.

CREATE TABLE contribution_rate_table (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    division_code           TEXT            NOT NULL REFERENCES employer_division(division_code),
    is_safety_officer       BOOLEAN         NOT NULL DEFAULT false,
    member_rate             NUMERIC(8,6)    NOT NULL,
    employer_base_rate      NUMERIC(8,6)    NOT NULL,
    aed_rate                NUMERIC(8,6)    NOT NULL,
    saed_rate               NUMERIC(8,6)    NOT NULL,
    aap_rate                NUMERIC(8,6)    NOT NULL,
    dc_supplement_rate      NUMERIC(8,6)    NOT NULL DEFAULT 0,
    employer_total_rate     NUMERIC(8,6)    NOT NULL,
    health_care_trust_rate  NUMERIC(8,6)    NOT NULL DEFAULT 0.010200,
    effective_from          DATE            NOT NULL,
    effective_to            DATE,
    board_resolution_ref    TEXT,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    PRIMARY KEY (id),
    UNIQUE (division_code, is_safety_officer, effective_from)
);

-- =============================================================================
-- late_interest_rate — Late contribution interest
-- =============================================================================
-- Schema ready for when actual rate values are confirmed.

CREATE TABLE late_interest_rate (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    division_code           TEXT            REFERENCES employer_division(division_code),
    rate                    NUMERIC(8,6)    NOT NULL,
    minimum_charge          NUMERIC(10,2)   NOT NULL DEFAULT 0,
    effective_from          DATE            NOT NULL,
    effective_to            DATE,
    statute_ref             TEXT,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    PRIMARY KEY (id)
);

-- =============================================================================
-- employer_alert — System-wide and org-specific alert banners
-- =============================================================================

CREATE TABLE employer_alert (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    org_id                  UUID            REFERENCES crm_organization(org_id),
    alert_type              TEXT            NOT NULL CHECK (alert_type IN (
                                'DEADLINE', 'TASK', 'CRITICAL', 'POLICY_CHANGE')),
    title                   TEXT            NOT NULL,
    body                    TEXT,
    effective_from          TIMESTAMPTZ     NOT NULL,
    effective_to            TIMESTAMPTZ,
    created_by              UUID,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    PRIMARY KEY (id)
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX idx_contribution_rate_lookup ON contribution_rate_table(division_code, is_safety_officer, effective_from);
CREATE INDEX idx_employer_portal_user_org ON employer_portal_user(org_id);
CREATE INDEX idx_employer_alert_org ON employer_alert(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX idx_employer_alert_active ON employer_alert(effective_from, effective_to);

-- =============================================================================
-- Seed data: Employer divisions
-- =============================================================================

INSERT INTO employer_division (division_code, division_name, governing_statute, effective_date) VALUES
    ('STATE',       'State Division',               'C.R.S. Title 24, Article 51, Part 4',  '1931-01-01'),
    ('SCHOOL',      'School Division',              'C.R.S. Title 24, Article 51, Part 5',  '1931-01-01'),
    ('LOCAL_GOV',   'Local Government Division',    'C.R.S. Title 24, Article 51, Part 6',  '1931-01-01'),
    ('JUDICIAL',    'Judicial Division',            'C.R.S. Title 24, Article 51, Part 7',  '1931-01-01'),
    ('DPS',         'DPS Division',                 'C.R.S. Title 24, Article 51, Part 8',  '2010-01-01');

-- =============================================================================
-- Seed data: Contribution rates — January 2025 and January 2026
-- =============================================================================
-- Source: COPERA Contribution Rates fact sheet, document 5/123 (REV 1-26)
-- All rates expressed as decimal fractions (e.g., 0.110000 = 11.00%).
-- Health care trust rate 1.02% is included within employer base rate.
-- Safety Officers exist only in State and Local Government divisions.

-- ---- State Division, non-safety ----

INSERT INTO contribution_rate_table
    (division_code, is_safety_officer, member_rate, employer_base_rate, aed_rate, saed_rate, aap_rate, dc_supplement_rate, employer_total_rate, effective_from, effective_to)
VALUES
    ('STATE', false, 0.110000, 0.104000, 0.050000, 0.050000, 0.010000, 0.002300, 0.216300, '2025-01-01', '2025-12-31'),
    ('STATE', false, 0.110000, 0.104000, 0.050000, 0.050000, 0.010000, 0.002500, 0.216500, '2026-01-01', NULL);

-- ---- State Division, Safety Officers ----

INSERT INTO contribution_rate_table
    (division_code, is_safety_officer, member_rate, employer_base_rate, aed_rate, saed_rate, aap_rate, dc_supplement_rate, employer_total_rate, effective_from, effective_to)
VALUES
    ('STATE', true, 0.130000, 0.131000, 0.050000, 0.050000, 0.010000, 0.002300, 0.243300, '2025-01-01', '2025-12-31'),
    ('STATE', true, 0.130000, 0.131000, 0.050000, 0.050000, 0.010000, 0.002500, 0.243500, '2026-01-01', NULL);

-- ---- School Division (no safety officers, no DC supplement) ----

INSERT INTO contribution_rate_table
    (division_code, is_safety_officer, member_rate, employer_base_rate, aed_rate, saed_rate, aap_rate, dc_supplement_rate, employer_total_rate, effective_from, effective_to)
VALUES
    ('SCHOOL', false, 0.110000, 0.104000, 0.045000, 0.055000, 0.010000, 0, 0.214000, '2025-01-01', '2025-12-31'),
    ('SCHOOL', false, 0.110000, 0.104000, 0.045000, 0.055000, 0.010000, 0, 0.214000, '2026-01-01', NULL);

-- ---- DPS Division (no safety officers, no DC supplement) ----
-- Note: DPS 2025 effective date is July 2025, not January 2025.

INSERT INTO contribution_rate_table
    (division_code, is_safety_officer, member_rate, employer_base_rate, aed_rate, saed_rate, aap_rate, dc_supplement_rate, employer_total_rate, effective_from, effective_to)
VALUES
    ('DPS', false, 0.110000, 0.074000, 0.045000, 0.055000, 0.010000, 0, 0.184000, '2025-07-01', '2025-12-31'),
    ('DPS', false, 0.110000, 0.074000, 0.045000, 0.055000, 0.010000, 0, 0.184000, '2026-01-01', NULL);

-- ---- Local Government Division, non-safety ----
-- Note: AED changed 2.20%→2.70% and SAED changed 1.50%→2.00% in January 2026.

INSERT INTO contribution_rate_table
    (division_code, is_safety_officer, member_rate, employer_base_rate, aed_rate, saed_rate, aap_rate, dc_supplement_rate, employer_total_rate, effective_from, effective_to)
VALUES
    ('LOCAL_GOV', false, 0.090000, 0.100000, 0.022000, 0.015000, 0.010000, 0.001100, 0.148100, '2025-01-01', '2025-12-31'),
    ('LOCAL_GOV', false, 0.090000, 0.100000, 0.027000, 0.020000, 0.010000, 0.001000, 0.158000, '2026-01-01', NULL);

-- ---- Local Government Division, Safety Officers ----

INSERT INTO contribution_rate_table
    (division_code, is_safety_officer, member_rate, employer_base_rate, aed_rate, saed_rate, aap_rate, dc_supplement_rate, employer_total_rate, effective_from, effective_to)
VALUES
    ('LOCAL_GOV', true, 0.130000, 0.131000, 0.022000, 0.015000, 0.010000, 0.001100, 0.179100, '2025-01-01', '2025-12-31'),
    ('LOCAL_GOV', true, 0.130000, 0.131000, 0.027000, 0.020000, 0.010000, 0.001000, 0.189000, '2026-01-01', NULL);

-- ---- Judicial Division (no safety officers, no DC supplement) ----

INSERT INTO contribution_rate_table
    (division_code, is_safety_officer, member_rate, employer_base_rate, aed_rate, saed_rate, aap_rate, dc_supplement_rate, employer_total_rate, effective_from, effective_to)
VALUES
    ('JUDICIAL', false, 0.110000, 0.139100, 0.050000, 0.050000, 0.010000, 0, 0.249100, '2025-01-01', '2025-12-31'),
    ('JUDICIAL', false, 0.110000, 0.139100, 0.050000, 0.050000, 0.010000, 0, 0.249100, '2026-01-01', NULL);

COMMIT;
