-- =============================================================================
-- Additional Seed Data — More members, stage history, and richer work queue
-- Builds on 002_legacy_seed.sql and 007_casemanagement_seed.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- DEMO MEMBER 4: Maria Gonzalez (10004)
-- Tier 1, Manager, 24+ years service, normal retirement eligible
-- =============================================================================
INSERT INTO MEMBER_MASTER (
    MEMBER_ID, SSN, FIRST_NAME, LAST_NAME, DOB, GENDER,
    MARITAL_STAT, ADDR_LINE1, CITY, STATE_CD, ZIP_CD, PHONE, EMAIL,
    HIRE_DT, STATUS_CD, TIER_CD, DEPT_CD, POS_CD, MEDICARE_FLAG
) VALUES (
    10004, '555-45-6789', 'Maria', 'Gonzalez', '1965-07-22', 'F',
    'M', '2301 S Colorado Blvd', 'Denver', 'CO', '80222', '303-555-0404', 'mgonzalez@denvergov.org',
    '2001-11-01', 'A', 1, 'DHS', 'MGR1', 'N'
);

INSERT INTO EMPLOYMENT_HIST (MEMBER_ID, EVENT_TYPE, EVENT_DT, DEPT_CD, POS_CD, SALARY_ANNUAL, NOTES) VALUES
(10004, 'HIRE', '2001-11-01', 'DHS', 'ANLY2', 46000.00, 'Initial hire'),
(10004, 'PROMOTION', '2008-04-01', 'DHS', 'BADG2', 62000.00, 'Promotion to Analyst III'),
(10004, 'PROMOTION', '2015-01-01', 'DHS', 'MGR1', 76000.00, 'Promoted to Manager');

INSERT INTO SALARY_HIST (MEMBER_ID, PAY_PERIOD_END, PAY_PERIOD_NUM, ANNUAL_SALARY, GROSS_PAY, PENSIONABLE_PAY, OT_PAY, FY_YEAR) VALUES
(10004, '2025-01-10', 1, 98450.00, 3786.54, 3786.54, 0, 2024),
(10004, '2025-06-27', 13, 98450.00, 3786.54, 3786.54, 0, 2024),
(10004, '2025-07-11', 14, 98450.00, 3786.54, 3786.54, 0, 2025),
(10004, '2025-12-26', 26, 98450.00, 3786.54, 3786.54, 0, 2025),
(10004, '2026-01-09', 1, 101404.00, 3900.15, 3900.15, 0, 2025),
(10004, '2026-01-23', 2, 101404.00, 3900.15, 3900.15, 0, 2025),
(10004, '2026-02-06', 3, 101404.00, 3900.15, 3900.15, 0, 2025),
(10004, '2026-02-20', 4, 101404.00, 3900.15, 3900.15, 0, 2025),
(10004, '2026-03-06', 5, 101404.00, 3900.15, 3900.15, 0, 2025);

INSERT INTO CONTRIBUTION_HIST (MEMBER_ID, PAY_PERIOD_END, EE_CONTRIB, ER_CONTRIB, EE_BALANCE, ER_BALANCE, INTEREST_AMT, FY_YEAR) VALUES
(10004, '2026-01-09', 329.47, 699.73, 152200.00, 323200.00, 0, 2025),
(10004, '2026-01-23', 329.47, 699.73, 152529.47, 323899.73, 0, 2025),
(10004, '2026-02-06', 329.47, 699.73, 152858.94, 324599.46, 0, 2025);

INSERT INTO SVC_CREDIT (MEMBER_ID, CREDIT_TYPE, BEGIN_DT, YEARS_CREDITED, STATUS) VALUES
(10004, 'EARNED', '2001-11-01', 24.42, 'ACTIVE');

INSERT INTO BENEFICIARY (MEMBER_ID, BENE_TYPE, FIRST_NAME, LAST_NAME, RELATIONSHIP, DOB, ALLOC_PCT, EFF_DT) VALUES
(10004, 'PRIMARY', 'Carlos', 'Gonzalez', 'SPOUSE', '1964-02-11', 100.00, '2001-11-01');


-- =============================================================================
-- DEMO MEMBER 5: James Thompson (10005)
-- Tier 2, Technician, 16 years service, recently submitted retirement app
-- =============================================================================
INSERT INTO MEMBER_MASTER (
    MEMBER_ID, SSN, FIRST_NAME, LAST_NAME, MIDDLE_NAME, DOB, GENDER,
    MARITAL_STAT, ADDR_LINE1, CITY, STATE_CD, ZIP_CD, PHONE, EMAIL,
    HIRE_DT, STATUS_CD, TIER_CD, DEPT_CD, POS_CD, MEDICARE_FLAG
) VALUES (
    10005, '555-56-7890', 'James', 'Thompson', 'R', '1970-12-03', 'M',
    'S', '890 Downing St', 'Denver', 'CO', '80218', '303-555-0505', 'jthompson@denvergov.org',
    '2009-08-15', 'A', 2, 'DAS', 'TECH2', 'N'
);

INSERT INTO EMPLOYMENT_HIST (MEMBER_ID, EVENT_TYPE, EVENT_DT, DEPT_CD, POS_CD, SALARY_ANNUAL, NOTES) VALUES
(10005, 'HIRE', '2009-08-15', 'DAS', 'TECH2', 42000.00, 'Initial hire — Aviation maintenance');

INSERT INTO SALARY_HIST (MEMBER_ID, PAY_PERIOD_END, PAY_PERIOD_NUM, ANNUAL_SALARY, GROSS_PAY, PENSIONABLE_PAY, OT_PAY, FY_YEAR) VALUES
(10005, '2025-01-10', 1, 64200.00, 2469.23, 2469.23, 0, 2024),
(10005, '2025-06-27', 13, 64200.00, 2469.23, 2469.23, 0, 2024),
(10005, '2025-07-11', 14, 64200.00, 2469.23, 2469.23, 0, 2025),
(10005, '2025-12-26', 26, 64200.00, 2469.23, 2469.23, 0, 2025),
(10005, '2026-01-09', 1, 66126.00, 2543.31, 2543.31, 0, 2025),
(10005, '2026-01-23', 2, 66126.00, 2543.31, 2543.31, 0, 2025),
(10005, '2026-02-06', 3, 66126.00, 2543.31, 2543.31, 0, 2025),
(10005, '2026-02-20', 4, 66126.00, 2543.31, 2543.31, 0, 2025),
(10005, '2026-03-06', 5, 66126.00, 2543.31, 2543.31, 0, 2025);

INSERT INTO CONTRIBUTION_HIST (MEMBER_ID, PAY_PERIOD_END, EE_CONTRIB, ER_CONTRIB, EE_BALANCE, ER_BALANCE, INTEREST_AMT, FY_YEAR) VALUES
(10005, '2026-01-09', 214.91, 456.44, 76400.00, 162200.00, 0, 2025),
(10005, '2026-01-23', 214.91, 456.44, 76614.91, 162656.44, 0, 2025),
(10005, '2026-02-06', 214.91, 456.44, 76829.82, 163112.88, 0, 2025);

INSERT INTO SVC_CREDIT (MEMBER_ID, CREDIT_TYPE, BEGIN_DT, YEARS_CREDITED, STATUS) VALUES
(10005, 'EARNED', '2009-08-15', 16.58, 'ACTIVE');

INSERT INTO BENEFICIARY (MEMBER_ID, BENE_TYPE, FIRST_NAME, LAST_NAME, RELATIONSHIP, ALLOC_PCT, EFF_DT) VALUES
(10005, 'PRIMARY', 'Estate', 'Thompson', 'ESTATE', 100.00, '2009-08-15');


-- =============================================================================
-- New retirement cases for members 10004 and 10005
-- =============================================================================
INSERT INTO retirement_case (
    case_id, member_id, case_type, retirement_date,
    priority, sla_status, current_stage, current_stage_idx,
    assigned_to, days_open, status, dro_id, created_at, updated_at
) VALUES
-- Case 5: Maria Gonzalez — Tier 1, normal retirement, nearly complete
(
    'RET-2026-0163', 10004, 'RET', '2026-06-01',
    'standard', 'on-track', 'Election Recording', 5,
    'Sarah Chen', 22, 'active', NULL,
    '2026-02-17 08:00:00-07', '2026-03-11 09:00:00-07'
),
-- Case 6: James Thompson — Tier 2, early retirement, just started
(
    'RET-2026-0171', 10005, 'RET', '2026-07-01',
    'low', 'on-track', 'Application Intake', 0,
    'Sarah Chen', 1, 'active', NULL,
    '2026-03-10 08:00:00-07', '2026-03-11 09:00:00-07'
)
ON CONFLICT (case_id) DO NOTHING;

-- Case flags for new cases
INSERT INTO case_flag (case_id, flag_code) VALUES
('RET-2026-0171', 'early-retirement')
ON CONFLICT (case_id, flag_code) DO NOTHING;


-- =============================================================================
-- Stage transition history — audit trail for all 6 cases
-- Shows how each case progressed through stages with timestamps and notes
-- =============================================================================

-- Case 1: Robert Martinez (RET-2026-0147) — currently at stage 4 (Benefit Calc)
INSERT INTO case_stage_history (case_id, from_stage_idx, to_stage_idx, from_stage, to_stage, transitioned_by, note, transitioned_at) VALUES
('RET-2026-0147', NULL, 0, NULL, 'Application Intake', 'system', 'Case created from retirement application', '2026-03-05 08:00:00-07'),
('RET-2026-0147', 0, 1, 'Application Intake', 'Document Verification', 'Sarah Chen', 'Application complete, all required documents received', '2026-03-05 14:30:00-07'),
('RET-2026-0147', 1, 2, 'Document Verification', 'Eligibility Review', 'Sarah Chen', 'Employment verified, 28.75 years earned service credit confirmed', '2026-03-06 10:15:00-07'),
('RET-2026-0147', 2, 3, 'Eligibility Review', 'Marital Share Calculation', 'Sarah Chen', 'Rule of 75 satisfied (age 62.97 + 28.75 = 91.72). DRO on file — routing to marital share', '2026-03-07 09:00:00-07'),
('RET-2026-0147', 3, 4, 'Marital Share Calculation', 'Benefit Calculation', 'Sarah Chen', 'DRO handled separately under DRO-2026-0031. Proceeding with member benefit calc', '2026-03-08 11:00:00-07');

-- Case 2: Jennifer Kim (RET-2026-0152) — currently at stage 2 (Eligibility Review)
INSERT INTO case_stage_history (case_id, from_stage_idx, to_stage_idx, from_stage, to_stage, transitioned_by, note, transitioned_at) VALUES
('RET-2026-0152', NULL, 0, NULL, 'Application Intake', 'system', 'Case created from retirement application', '2026-02-26 08:00:00-07'),
('RET-2026-0152', 0, 1, 'Application Intake', 'Document Verification', 'Sarah Chen', 'Application and supporting documents received', '2026-02-27 15:00:00-07'),
('RET-2026-0152', 1, 2, 'Document Verification', 'Eligibility Review', 'Sarah Chen', 'Purchased service credit documentation verified (3.00 years from prior municipal employment)', '2026-03-03 10:30:00-07');

-- Case 3: David Washington (RET-2026-0159) — currently at stage 1 (Doc Verification)
INSERT INTO case_stage_history (case_id, from_stage_idx, to_stage_idx, from_stage, to_stage, transitioned_by, note, transitioned_at) VALUES
('RET-2026-0159', NULL, 0, NULL, 'Application Intake', 'system', 'Case created from retirement application', '2026-03-07 08:00:00-07'),
('RET-2026-0159', 0, 1, 'Application Intake', 'Document Verification', 'Sarah Chen', 'Intake complete. Awaiting employment verification from Parks and Recreation HR', '2026-03-08 09:45:00-07');

-- Case 4: Robert Martinez DRO (DRO-2026-0031) — currently at stage 3 (Marital Share)
INSERT INTO case_stage_history (case_id, from_stage_idx, to_stage_idx, from_stage, to_stage, transitioned_by, note, transitioned_at) VALUES
('DRO-2026-0031', NULL, 0, NULL, 'Application Intake', 'system', 'DRO case created — court order 2017-DR-4521', '2026-02-20 08:00:00-07'),
('DRO-2026-0031', 0, 1, 'Application Intake', 'Document Verification', 'Sarah Chen', 'Court order and QDRO verified by legal team', '2026-02-21 14:00:00-07'),
('DRO-2026-0031', 1, 2, 'Document Verification', 'Eligibility Review', 'Sarah Chen', 'Member eligibility confirmed. Patricia Martinez qualifies as alternate payee', '2026-02-24 10:00:00-07'),
('DRO-2026-0031', 2, 3, 'Eligibility Review', 'Marital Share Calculation', 'Sarah Chen', 'Calculating marital share: 40% of benefit accrued during marriage (1999-2017)', '2026-02-28 09:30:00-07');

-- Case 5: Maria Gonzalez (RET-2026-0163) — currently at stage 5 (Election Recording)
INSERT INTO case_stage_history (case_id, from_stage_idx, to_stage_idx, from_stage, to_stage, transitioned_by, note, transitioned_at) VALUES
('RET-2026-0163', NULL, 0, NULL, 'Application Intake', 'system', 'Case created from retirement application', '2026-02-17 08:00:00-07'),
('RET-2026-0163', 0, 1, 'Application Intake', 'Document Verification', 'Sarah Chen', 'Application received, verifying employment records', '2026-02-18 10:00:00-07'),
('RET-2026-0163', 1, 2, 'Document Verification', 'Eligibility Review', 'Sarah Chen', '24.42 years service confirmed. All documents verified', '2026-02-20 14:30:00-07'),
('RET-2026-0163', 2, 3, 'Eligibility Review', 'Marital Share Calculation', 'Sarah Chen', 'Rule of 75 met (age 60.89 + 24.42 = 85.31). No DRO — skipping marital share', '2026-02-24 09:00:00-07'),
('RET-2026-0163', 3, 4, 'Marital Share Calculation', 'Benefit Calculation', 'Sarah Chen', 'No DRO applies. Proceeding to benefit calculation', '2026-02-24 09:05:00-07'),
('RET-2026-0163', 4, 5, 'Benefit Calculation', 'Election Recording', 'Sarah Chen', 'Benefit calculated: Tier 1, 2.0% multiplier, 24.42 years. Awaiting member election', '2026-03-03 11:00:00-07');

-- Case 6: James Thompson (RET-2026-0171) — just created, at stage 0
INSERT INTO case_stage_history (case_id, from_stage_idx, to_stage_idx, from_stage, to_stage, transitioned_by, note, transitioned_at) VALUES
('RET-2026-0171', NULL, 0, NULL, 'Application Intake', 'system', 'Case created from online retirement application submission', '2026-03-10 08:00:00-07');

COMMIT;
