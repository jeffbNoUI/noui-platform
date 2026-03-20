-- =============================================================================
-- Legacy Seed Data — Demo Members
-- Matches schema from 001_legacy_schema.sql
-- =============================================================================

BEGIN;

-- ===== DEPARTMENT_REF =====
INSERT INTO DEPARTMENT_REF (DEPT_CD, DEPT_NAME, DEPT_SHORT, ACTIVE_FLAG, CREATE_DT) VALUES
('DPW', 'Public Works', 'PubWorks', 'Y', '1995-01-01'),
('DFN', 'Finance', 'Finance', 'Y', '1995-01-01'),
('DPR', 'Parks and Recreation', 'Parks&Rec', 'Y', '1995-01-01'),
('DPD', 'Police Department', 'Police', 'Y', '1995-01-01'),
('DFD', 'Fire Department', 'Fire', 'Y', '1995-01-01'),
('DHS', 'Human Services', 'HumanSvc', 'Y', '1995-01-01'),
('DPH', 'Public Health', 'PubHealth', 'Y', '1995-01-01'),
('DCA', 'City Attorney', 'CityAtty', 'Y', '1995-01-01'),
('DAS', 'Aviation (DIA)', 'Aviation', 'Y', '1995-01-01'),
('DTD', 'Technology Services', 'TechSvc', 'Y', '1995-01-01'),
('DWW', 'Water', 'Water', 'Y', '1995-01-01'),
('DLB', 'Library', 'Library', 'Y', '1995-01-01');

-- ===== POSITION_REF =====
INSERT INTO POSITION_REF (POS_CD, POS_TITLE, PAY_GRADE, EXEMPT_FLG, MIN_SALARY, MAX_SALARY, EFF_DT) VALUES
('ENG1', 'Engineer I', 'G10', 'N', 44000.00, 66000.00, '1995-01-01'),
('ENG2', 'Engineer II', 'G12', 'N', 52000.00, 78000.00, '1995-01-01'),
('ENG3', 'Senior Engineer', 'G14', 'Y', 62000.00, 92000.00, '1995-01-01'),
('BADG1', 'Budget Analyst I', 'G09', 'N', 40000.00, 60000.00, '1995-01-01'),
('BADG2', 'Budget Analyst II', 'G11', 'N', 48000.00, 72000.00, '1995-01-01'),
('BADG3', 'Budget Analyst III', 'G13', 'Y', 56000.00, 84000.00, '1995-01-01'),
('PMGR', 'Program Manager', 'G14', 'Y', 62000.00, 92000.00, '1995-01-01'),
('MGR1', 'Manager I', 'G13', 'Y', 56000.00, 84000.00, '1995-01-01'),
('ANLY2', 'Analyst II', 'G10', 'N', 44000.00, 66000.00, '1995-01-01'),
('TECH2', 'Technician II', 'G08', 'N', 38000.00, 56000.00, '1995-01-01');


-- =============================================================================
-- DEMO MEMBER 1: Robert Martinez (10001)
-- Tier 1, Senior Engineer, 28+ years service, nearing retirement
-- =============================================================================
ALTER SEQUENCE member_master_member_id_seq RESTART WITH 10001;

INSERT INTO MEMBER_MASTER (
    SSN, FIRST_NAME, LAST_NAME, MIDDLE_NAME, DOB, GENDER,
    MARITAL_STAT, ADDR_LINE1, CITY, STATE_CD, ZIP_CD, PHONE, EMAIL,
    HIRE_DT, STATUS_CD, TIER_CD, DEPT_CD, POS_CD, MEDICARE_FLAG
) VALUES (
    '555-12-3456', 'Robert', 'Martinez', 'A', '1963-03-08', 'M',
    'M', '1847 Vine St', 'Denver', 'CO', '80205', '303-555-0101', 'rmartinez@denvergov.org',
    '1997-06-15', 'A', 1, 'DPW', 'ENG3', 'N'
);

-- Employment history
INSERT INTO EMPLOYMENT_HIST (MEMBER_ID, EVENT_TYPE, EVENT_DT, DEPT_CD, POS_CD, SALARY_ANNUAL, NOTES) VALUES
(10001, 'HIRE', '1997-06-15', 'DPW', 'ENG1', 48000.00, 'Initial hire'),
(10001, 'PROMOTION', '2003-01-01', 'DPW', 'ENG2', 68000.00, 'Promotion to Engineer II'),
(10001, 'PROMOTION', '2010-01-01', 'DPW', 'ENG3', 85000.00, 'Promotion to Senior Engineer');

-- Salary history (recent 3 years for demo — biweekly summary by year)
INSERT INTO SALARY_HIST (MEMBER_ID, PAY_PERIOD_END, PAY_PERIOD_NUM, ANNUAL_SALARY, GROSS_PAY, PENSIONABLE_PAY, OT_PAY, LEAVE_PAYOUT_AMT, FY_YEAR) VALUES
-- 2024 (select periods)
(10001, '2024-01-12', 1, 109734.00, 4220.54, 4220.54, 0, 0, 2023),
(10001, '2024-06-28', 13, 109734.00, 4220.54, 4220.54, 0, 0, 2023),
(10001, '2024-07-12', 14, 109734.00, 4220.54, 4220.54, 0, 0, 2024),
(10001, '2024-12-27', 26, 109734.00, 4220.54, 4220.54, 0, 0, 2024),
-- 2025
(10001, '2025-01-10', 1, 113043.00, 4347.81, 4347.81, 0, 0, 2024),
(10001, '2025-06-27', 13, 113043.00, 4347.81, 4347.81, 0, 0, 2024),
(10001, '2025-07-11', 14, 113043.00, 4347.81, 4347.81, 0, 0, 2025),
(10001, '2025-12-26', 26, 113043.00, 4347.81, 4347.81, 0, 0, 2025),
-- 2026
(10001, '2026-01-09', 1, 116434.00, 4478.23, 4478.23, 0, 0, 2025),
(10001, '2026-01-23', 2, 116434.00, 4478.23, 4478.23, 0, 0, 2025),
(10001, '2026-02-06', 3, 116434.00, 4478.23, 4478.23, 0, 0, 2025),
(10001, '2026-02-20', 4, 116434.00, 4478.23, 4478.23, 0, 0, 2025),
(10001, '2026-03-06', 5, 116434.00, 4478.23, 4478.23, 0, 0, 2025);

-- Contribution history
INSERT INTO CONTRIBUTION_HIST (MEMBER_ID, PAY_PERIOD_END, EE_CONTRIB, ER_CONTRIB, EE_BALANCE, ER_BALANCE, INTEREST_AMT, FY_YEAR) VALUES
(10001, '2026-01-09', 378.41, 803.84, 185420.00, 394000.00, 0, 2025),
(10001, '2026-01-23', 378.41, 803.84, 185798.41, 394803.84, 0, 2025),
(10001, '2026-02-06', 378.41, 803.84, 186176.82, 395607.68, 0, 2025),
(10001, '2026-02-20', 378.41, 803.84, 186555.23, 396411.52, 0, 2025),
(10001, '2026-03-06', 378.41, 803.84, 186933.64, 397215.36, 0, 2025);

-- Service credit: 28.75 years earned
INSERT INTO SVC_CREDIT (MEMBER_ID, CREDIT_TYPE, BEGIN_DT, YEARS_CREDITED, STATUS) VALUES
(10001, 'EARNED', '1997-06-15', 28.75, 'ACTIVE');

-- Beneficiary
INSERT INTO BENEFICIARY (MEMBER_ID, BENE_TYPE, FIRST_NAME, LAST_NAME, RELATIONSHIP, DOB, ALLOC_PCT, EFF_DT) VALUES
(10001, 'PRIMARY', 'Elena', 'Martinez', 'SPOUSE', '1966-09-15', 100.00, '1999-08-15');

-- DRO
INSERT INTO DRO_MASTER (MEMBER_ID, COURT_ORDER_NUM, MARRIAGE_DT, DIVORCE_DT, ALT_PAYEE_FIRST, ALT_PAYEE_LAST, ALT_PAYEE_DOB, DIVISION_METHOD, DIVISION_VALUE, STATUS, RECEIVED_DT, APPROVED_DT) VALUES
(10001, '2017-DR-4521', '1999-08-15', '2017-11-03', 'Patricia', 'Martinez', '1964-04-22', 'PERCENTAGE', 40.0000, 'ACTIVE', '2017-12-01', '2018-02-15');


-- =============================================================================
-- DEMO MEMBER 2: Jennifer Kim (10002)
-- Tier 2, Budget Analyst III, 18 years service + 3 years purchased
-- =============================================================================
INSERT INTO MEMBER_MASTER (
    SSN, FIRST_NAME, LAST_NAME, DOB, GENDER,
    MARITAL_STAT, ADDR_LINE1, ADDR_LINE2, CITY, STATE_CD, ZIP_CD, PHONE, EMAIL,
    HIRE_DT, STATUS_CD, TIER_CD, DEPT_CD, POS_CD, MEDICARE_FLAG
) VALUES (
    '555-23-4567', 'Jennifer', 'Kim', '1969-11-22', 'F',
    'S', '782 Maple Avenue', 'Apt 4B', 'Lakewood', 'CO', '80226', '303-555-0202', 'jkim@denvergov.org',
    '2008-03-01', 'A', 2, 'DFN', 'BADG3', 'N'
);

-- Employment history
INSERT INTO EMPLOYMENT_HIST (MEMBER_ID, EVENT_TYPE, EVENT_DT, DEPT_CD, POS_CD, SALARY_ANNUAL, NOTES) VALUES
(10002, 'HIRE', '2008-03-01', 'DFN', 'BADG1', 52000.00, 'Initial hire'),
(10002, 'PROMOTION', '2013-07-01', 'DFN', 'BADG2', 68000.00, 'Promotion to Budget Analyst II'),
(10002, 'PROMOTION', '2018-01-01', 'DFN', 'BADG3', 78500.00, 'Promotion to Budget Analyst III');

-- Salary history (recent)
INSERT INTO SALARY_HIST (MEMBER_ID, PAY_PERIOD_END, PAY_PERIOD_NUM, ANNUAL_SALARY, GROSS_PAY, PENSIONABLE_PAY, OT_PAY, FY_YEAR) VALUES
(10002, '2025-01-10', 1, 90935.00, 3497.50, 3497.50, 0, 2024),
(10002, '2025-06-27', 13, 90935.00, 3497.50, 3497.50, 0, 2024),
(10002, '2025-07-11', 14, 90935.00, 3497.50, 3497.50, 0, 2024),
(10002, '2025-12-26', 26, 90935.00, 3497.50, 3497.50, 0, 2025),
(10002, '2026-01-09', 1, 93663.00, 3602.42, 3602.42, 0, 2025),
(10002, '2026-01-23', 2, 93663.00, 3602.42, 3602.42, 0, 2025),
(10002, '2026-02-06', 3, 93663.00, 3602.42, 3602.42, 0, 2025),
(10002, '2026-02-20', 4, 93663.00, 3602.42, 3602.42, 0, 2025),
(10002, '2026-03-06', 5, 93663.00, 3602.42, 3602.42, 0, 2025);

-- Contribution history
INSERT INTO CONTRIBUTION_HIST (MEMBER_ID, PAY_PERIOD_END, EE_CONTRIB, ER_CONTRIB, EE_BALANCE, ER_BALANCE, INTEREST_AMT, FY_YEAR) VALUES
(10002, '2026-01-09', 304.40, 646.63, 108500.00, 230400.00, 0, 2025),
(10002, '2026-01-23', 304.40, 646.63, 108804.40, 231046.63, 0, 2025),
(10002, '2026-02-06', 304.40, 646.63, 109108.80, 231693.26, 0, 2025),
(10002, '2026-02-20', 304.40, 646.63, 109413.20, 232339.89, 0, 2025),
(10002, '2026-03-06', 304.40, 646.63, 109717.60, 232986.52, 0, 2025);

-- Service credit: 18.17 earned + 3.00 purchased
INSERT INTO SVC_CREDIT (MEMBER_ID, CREDIT_TYPE, BEGIN_DT, YEARS_CREDITED, STATUS) VALUES
(10002, 'EARNED', '2008-03-01', 18.17, 'ACTIVE'),
(10002, 'PURCHASED', '2004-01-01', 3.00, 'ACTIVE');

-- Beneficiary
INSERT INTO BENEFICIARY (MEMBER_ID, BENE_TYPE, FIRST_NAME, LAST_NAME, RELATIONSHIP, ALLOC_PCT, EFF_DT) VALUES
(10002, 'PRIMARY', 'Estate', 'Kim', 'ESTATE', 100.00, '2008-03-01');


-- =============================================================================
-- DEMO MEMBER 3: David Washington (10003)
-- Tier 3, Program Manager, 13+ years service, early retirement candidate
-- =============================================================================
INSERT INTO MEMBER_MASTER (
    SSN, FIRST_NAME, LAST_NAME, MIDDLE_NAME, DOB, GENDER,
    MARITAL_STAT, ADDR_LINE1, CITY, STATE_CD, ZIP_CD, PHONE, EMAIL,
    HIRE_DT, STATUS_CD, TIER_CD, DEPT_CD, POS_CD, MEDICARE_FLAG
) VALUES (
    '555-34-5678', 'David', 'Washington', 'L', '1974-08-14', 'M',
    'M', '4520 E Colfax Ave', 'Denver', 'CO', '80220', '303-555-0303', 'dwashington@denvergov.org',
    '2012-09-01', 'A', 3, 'DPR', 'PMGR', 'N'
);

-- Employment history
INSERT INTO EMPLOYMENT_HIST (MEMBER_ID, EVENT_TYPE, EVENT_DT, DEPT_CD, POS_CD, SALARY_ANNUAL, NOTES) VALUES
(10003, 'HIRE', '2012-09-01', 'DPR', 'PMGR', 62000.00, 'Initial hire');

-- Salary history (recent)
INSERT INTO SALARY_HIST (MEMBER_ID, PAY_PERIOD_END, PAY_PERIOD_NUM, ANNUAL_SALARY, GROSS_PAY, PENSIONABLE_PAY, OT_PAY, FY_YEAR) VALUES
(10003, '2025-01-10', 1, 83184.00, 3199.38, 3199.38, 0, 2024),
(10003, '2025-06-27', 13, 83184.00, 3199.38, 3199.38, 0, 2024),
(10003, '2025-07-11', 14, 83184.00, 3199.38, 3199.38, 0, 2025),
(10003, '2025-12-26', 26, 83184.00, 3199.38, 3199.38, 0, 2025),
(10003, '2026-01-09', 1, 85680.00, 3295.38, 3295.38, 0, 2025),
(10003, '2026-01-23', 2, 85680.00, 3295.38, 3295.38, 0, 2025),
(10003, '2026-02-06', 3, 85680.00, 3295.38, 3295.38, 0, 2025),
(10003, '2026-02-20', 4, 85680.00, 3295.38, 3295.38, 0, 2025),
(10003, '2026-03-06', 5, 85680.00, 3295.38, 3295.38, 0, 2025);

-- Contribution history
INSERT INTO CONTRIBUTION_HIST (MEMBER_ID, PAY_PERIOD_END, EE_CONTRIB, ER_CONTRIB, EE_BALANCE, ER_BALANCE, INTEREST_AMT, FY_YEAR) VALUES
(10003, '2026-01-09', 278.46, 591.52, 72800.00, 154600.00, 0, 2025),
(10003, '2026-01-23', 278.46, 591.52, 73078.46, 155191.52, 0, 2025),
(10003, '2026-02-06', 278.46, 591.52, 73356.92, 155783.04, 0, 2025),
(10003, '2026-02-20', 278.46, 591.52, 73635.38, 156374.56, 0, 2025),
(10003, '2026-03-06', 278.46, 591.52, 73913.84, 156966.08, 0, 2025);

-- Service credit: 13.58 years earned
INSERT INTO SVC_CREDIT (MEMBER_ID, CREDIT_TYPE, BEGIN_DT, YEARS_CREDITED, STATUS) VALUES
(10003, 'EARNED', '2012-09-01', 13.58, 'ACTIVE');

-- Beneficiary
INSERT INTO BENEFICIARY (MEMBER_ID, BENE_TYPE, FIRST_NAME, LAST_NAME, RELATIONSHIP, DOB, ALLOC_PCT, EFF_DT) VALUES
(10003, 'PRIMARY', 'Michelle', 'Washington', 'SPOUSE', '1976-08-03', 100.00, '2012-09-01');


-- =============================================================================
-- CASE_HIST — Demo work queue cases
-- =============================================================================
INSERT INTO CASE_HIST (MEMBER_ID, CASE_TYPE, CASE_STATUS, PRIORITY, ASSIGNED_TO, OPEN_DT, TARGET_DT, NOTES) VALUES
(10001, 'SVC_RETIREMENT', 'IN_PROGRESS', 2, 'jsmith', '2026-02-15', '2026-03-15', 'Robert Martinez — Rule of 75 retirement application'),
(10002, 'ESTIMATE', 'OPEN', 3, 'agarcia', '2026-01-20', '2026-04-01', 'Jennifer Kim — Service credit purchase and benefit estimate'),
(10003, 'EARLY_RETIREMENT', 'IN_PROGRESS', 3, 'mwilson', '2026-02-20', '2026-03-20', 'David Washington — Early retirement eligibility review'),
(10001, 'DRO', 'PENDING_REVIEW', 1, 'jsmith', '2026-01-10', '2026-03-10', 'Robert Martinez — DRO DR-2017-DR-4521 (Patricia Martinez)');

COMMIT;
