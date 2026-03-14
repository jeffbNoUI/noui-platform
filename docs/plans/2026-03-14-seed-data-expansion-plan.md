# Seed Data Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand demo seed data from 3 members / 4 cases to 10 members / 16 cases so dashboards render realistic distributions.

**Architecture:** Three new SQL seed files inserted into the Docker init sequence after existing seeds. Members get full history (employment, salary, contributions, service credit, beneficiaries). Cases use `NOW() - INTERVAL` for SLA freshness.

**Tech Stack:** PostgreSQL seed SQL, Docker Compose volume mounts

---

### Task 1: Create Expanded Members Seed File

**Files:**
- Create: `domains/pension/seed/013_expanded_members.sql`

**Step 1: Write the seed file with 7 new members (10004–10010)**

Each member follows the exact pattern from `002_legacy_seed.sql`: MEMBER_MASTER + EMPLOYMENT_HIST + SALARY_HIST + CONTRIBUTION_HIST + SVC_CREDIT + BENEFICIARY.

```sql
-- =============================================================================
-- Expanded Member Seed Data — 7 additional demo members
-- Runs after 002_legacy_seed.sql (which seeds 10001–10003)
-- =============================================================================

BEGIN;

-- =============================================================================
-- MEMBER 4: Maria Santos (10004)
-- Tier 1, Fire Dept, 28yr service, married
-- =============================================================================
INSERT INTO MEMBER_MASTER (
    MEMBER_ID, SSN, FIRST_NAME, LAST_NAME, MIDDLE_NAME, DOB, GENDER,
    MARITAL_STAT, ADDR_LINE1, CITY, STATE_CD, ZIP_CD, PHONE, EMAIL,
    HIRE_DT, STATUS_CD, TIER_CD, DEPT_CD, POS_CD, MEDICARE_FLAG
) VALUES (
    10004, '555-45-6789', 'Maria', 'Santos', 'R', '1965-07-20', 'F',
    'M', '2315 Federal Blvd', 'Denver', 'CO', '80211', '303-555-0404', 'msantos@denvergov.org',
    '1998-04-01', 'A', 1, 'DFD', 'MGR1', 'N'
);

INSERT INTO EMPLOYMENT_HIST (MEMBER_ID, EVENT_TYPE, EVENT_DT, DEPT_CD, POS_CD, SALARY_ANNUAL, NOTES) VALUES
(10004, 'HIRE', '1998-04-01', 'DFD', 'TECH2', 42000.00, 'Initial hire'),
(10004, 'PROMOTION', '2005-06-01', 'DFD', 'ANLY2', 58000.00, 'Promotion to Analyst II'),
(10004, 'PROMOTION', '2012-01-01', 'DFD', 'MGR1', 74000.00, 'Promotion to Manager I');

INSERT INTO SALARY_HIST (MEMBER_ID, PAY_PERIOD_END, PAY_PERIOD_NUM, ANNUAL_SALARY, GROSS_PAY, PENSIONABLE_PAY, OT_PAY, FY_YEAR) VALUES
(10004, '2025-01-10', 1, 98500.00, 3788.46, 3788.46, 0, 2024),
(10004, '2025-06-27', 13, 98500.00, 3788.46, 3788.46, 0, 2024),
(10004, '2025-07-11', 14, 98500.00, 3788.46, 3788.46, 0, 2025),
(10004, '2025-12-26', 26, 98500.00, 3788.46, 3788.46, 0, 2025),
(10004, '2026-01-09', 1, 101455.00, 3902.12, 3902.12, 0, 2025),
(10004, '2026-01-23', 2, 101455.00, 3902.12, 3902.12, 0, 2025),
(10004, '2026-02-06', 3, 101455.00, 3902.12, 3902.12, 0, 2025),
(10004, '2026-02-20', 4, 101455.00, 3902.12, 3902.12, 0, 2025),
(10004, '2026-03-06', 5, 101455.00, 3902.12, 3902.12, 0, 2025);

INSERT INTO CONTRIBUTION_HIST (MEMBER_ID, PAY_PERIOD_END, EE_CONTRIB, ER_CONTRIB, EE_BALANCE, ER_BALANCE, INTEREST_AMT, FY_YEAR) VALUES
(10004, '2026-01-09', 329.73, 700.27, 168200.00, 357200.00, 0, 2025),
(10004, '2026-01-23', 329.73, 700.27, 168529.73, 357900.27, 0, 2025),
(10004, '2026-02-06', 329.73, 700.27, 168859.46, 358600.54, 0, 2025),
(10004, '2026-02-20', 329.73, 700.27, 169189.19, 359300.81, 0, 2025),
(10004, '2026-03-06', 329.73, 700.27, 169518.92, 360001.08, 0, 2025);

INSERT INTO SVC_CREDIT (MEMBER_ID, CREDIT_TYPE, BEGIN_DT, YEARS_CREDITED, STATUS) VALUES
(10004, 'EARNED', '1998-04-01', 27.96, 'ACTIVE');

INSERT INTO BENEFICIARY (MEMBER_ID, BENE_TYPE, FIRST_NAME, LAST_NAME, RELATIONSHIP, DOB, ALLOC_PCT, EFF_DT) VALUES
(10004, 'PRIMARY', 'Carlos', 'Santos', 'SPOUSE', '1964-02-11', 100.00, '1998-04-01');


-- =============================================================================
-- MEMBER 5: James Wilson (10005)
-- Tier 2, Human Services, 2006 hire, purchased service
-- =============================================================================
INSERT INTO MEMBER_MASTER (
    MEMBER_ID, SSN, FIRST_NAME, LAST_NAME, DOB, GENDER,
    MARITAL_STAT, ADDR_LINE1, CITY, STATE_CD, ZIP_CD, PHONE, EMAIL,
    HIRE_DT, STATUS_CD, TIER_CD, DEPT_CD, POS_CD, MEDICARE_FLAG
) VALUES (
    10005, '555-56-7890', 'James', 'Wilson', '1972-04-03', 'M',
    'S', '950 Broadway', 'Denver', 'CO', '80203', '303-555-0505', 'jwilson@denvergov.org',
    '2006-08-15', 'A', 2, 'DHS', 'BADG2', 'N'
);

INSERT INTO EMPLOYMENT_HIST (MEMBER_ID, EVENT_TYPE, EVENT_DT, DEPT_CD, POS_CD, SALARY_ANNUAL, NOTES) VALUES
(10005, 'HIRE', '2006-08-15', 'DHS', 'BADG1', 46000.00, 'Initial hire'),
(10005, 'PROMOTION', '2014-03-01', 'DHS', 'BADG2', 62000.00, 'Promotion to Budget Analyst II');

INSERT INTO SALARY_HIST (MEMBER_ID, PAY_PERIOD_END, PAY_PERIOD_NUM, ANNUAL_SALARY, GROSS_PAY, PENSIONABLE_PAY, OT_PAY, FY_YEAR) VALUES
(10005, '2025-01-10', 1, 76200.00, 2930.77, 2930.77, 0, 2024),
(10005, '2025-06-27', 13, 76200.00, 2930.77, 2930.77, 0, 2024),
(10005, '2025-07-11', 14, 76200.00, 2930.77, 2930.77, 0, 2025),
(10005, '2025-12-26', 26, 76200.00, 2930.77, 2930.77, 0, 2025),
(10005, '2026-01-09', 1, 78486.00, 3018.69, 3018.69, 0, 2025),
(10005, '2026-01-23', 2, 78486.00, 3018.69, 3018.69, 0, 2025),
(10005, '2026-02-06', 3, 78486.00, 3018.69, 3018.69, 0, 2025),
(10005, '2026-02-20', 4, 78486.00, 3018.69, 3018.69, 0, 2025);

INSERT INTO CONTRIBUTION_HIST (MEMBER_ID, PAY_PERIOD_END, EE_CONTRIB, ER_CONTRIB, EE_BALANCE, ER_BALANCE, INTEREST_AMT, FY_YEAR) VALUES
(10005, '2026-01-09', 255.08, 541.66, 95800.00, 203500.00, 0, 2025),
(10005, '2026-01-23', 255.08, 541.66, 96055.08, 204041.66, 0, 2025),
(10005, '2026-02-06', 255.08, 541.66, 96310.16, 204583.32, 0, 2025),
(10005, '2026-02-20', 255.08, 541.66, 96565.24, 205124.98, 0, 2025);

INSERT INTO SVC_CREDIT (MEMBER_ID, CREDIT_TYPE, BEGIN_DT, YEARS_CREDITED, STATUS) VALUES
(10005, 'EARNED', '2006-08-15', 19.58, 'ACTIVE'),
(10005, 'PURCHASED', '2002-01-01', 2.00, 'ACTIVE');

INSERT INTO BENEFICIARY (MEMBER_ID, BENE_TYPE, FIRST_NAME, LAST_NAME, RELATIONSHIP, ALLOC_PCT, EFF_DT) VALUES
(10005, 'PRIMARY', 'Estate', 'Wilson', 'ESTATE', 100.00, '2006-08-15');


-- =============================================================================
-- MEMBER 6: Lisa Park (10006)
-- Tier 3, Tech Services, 2015 hire, early career
-- =============================================================================
INSERT INTO MEMBER_MASTER (
    MEMBER_ID, SSN, FIRST_NAME, LAST_NAME, DOB, GENDER,
    MARITAL_STAT, ADDR_LINE1, ADDR_LINE2, CITY, STATE_CD, ZIP_CD, PHONE, EMAIL,
    HIRE_DT, STATUS_CD, TIER_CD, DEPT_CD, POS_CD, MEDICARE_FLAG
) VALUES (
    10006, '555-67-8901', 'Lisa', 'Park', '1988-12-05', 'F',
    'S', '1200 Acoma St', 'Unit 305', 'Denver', 'CO', '80204', '720-555-0606', 'lpark@denvergov.org',
    '2015-01-12', 'A', 3, 'DTD', 'ANLY2', 'N'
);

INSERT INTO EMPLOYMENT_HIST (MEMBER_ID, EVENT_TYPE, EVENT_DT, DEPT_CD, POS_CD, SALARY_ANNUAL, NOTES) VALUES
(10006, 'HIRE', '2015-01-12', 'DTD', 'ANLY2', 52000.00, 'Initial hire');

INSERT INTO SALARY_HIST (MEMBER_ID, PAY_PERIOD_END, PAY_PERIOD_NUM, ANNUAL_SALARY, GROSS_PAY, PENSIONABLE_PAY, OT_PAY, FY_YEAR) VALUES
(10006, '2025-01-10', 1, 64800.00, 2492.31, 2492.31, 0, 2024),
(10006, '2025-06-27', 13, 64800.00, 2492.31, 2492.31, 0, 2024),
(10006, '2025-07-11', 14, 64800.00, 2492.31, 2492.31, 0, 2025),
(10006, '2025-12-26', 26, 64800.00, 2492.31, 2492.31, 0, 2025),
(10006, '2026-01-09', 1, 66744.00, 2567.08, 2567.08, 0, 2025),
(10006, '2026-01-23', 2, 66744.00, 2567.08, 2567.08, 0, 2025),
(10006, '2026-02-06', 3, 66744.00, 2567.08, 2567.08, 0, 2025);

INSERT INTO CONTRIBUTION_HIST (MEMBER_ID, PAY_PERIOD_END, EE_CONTRIB, ER_CONTRIB, EE_BALANCE, ER_BALANCE, INTEREST_AMT, FY_YEAR) VALUES
(10006, '2026-01-09', 216.92, 460.75, 48200.00, 102400.00, 0, 2025),
(10006, '2026-01-23', 216.92, 460.75, 48416.92, 102860.75, 0, 2025),
(10006, '2026-02-06', 216.92, 460.75, 48633.84, 103321.50, 0, 2025);

INSERT INTO SVC_CREDIT (MEMBER_ID, CREDIT_TYPE, BEGIN_DT, YEARS_CREDITED, STATUS) VALUES
(10006, 'EARNED', '2015-01-12', 11.17, 'ACTIVE');

INSERT INTO BENEFICIARY (MEMBER_ID, BENE_TYPE, FIRST_NAME, LAST_NAME, RELATIONSHIP, ALLOC_PCT, EFF_DT) VALUES
(10006, 'PRIMARY', 'Estate', 'Park', 'ESTATE', 100.00, '2015-01-12');


-- =============================================================================
-- MEMBER 7: Thomas O'Brien (10007)
-- Tier 1, Police, TERMINATED, deferred vested, 20+ years
-- =============================================================================
INSERT INTO MEMBER_MASTER (
    MEMBER_ID, SSN, FIRST_NAME, LAST_NAME, MIDDLE_NAME, DOB, GENDER,
    MARITAL_STAT, ADDR_LINE1, CITY, STATE_CD, ZIP_CD, PHONE, EMAIL,
    HIRE_DT, TERM_DATE, STATUS_CD, TIER_CD, DEPT_CD, POS_CD, MEDICARE_FLAG
) VALUES (
    10007, '555-78-9012', 'Thomas', 'O''Brien', 'J', '1968-01-15', 'M',
    'D', '7890 W Alameda Ave', 'Lakewood', 'CO', '80226', '303-555-0707', NULL,
    '2000-03-01', '2022-06-30', 'T', 1, 'DPD', 'ENG3', 'N'
);

INSERT INTO EMPLOYMENT_HIST (MEMBER_ID, EVENT_TYPE, EVENT_DT, DEPT_CD, POS_CD, SALARY_ANNUAL, NOTES) VALUES
(10007, 'HIRE', '2000-03-01', 'DPD', 'ENG1', 45000.00, 'Initial hire'),
(10007, 'PROMOTION', '2008-07-01', 'DPD', 'ENG2', 64000.00, 'Promotion to Engineer II'),
(10007, 'PROMOTION', '2015-01-01', 'DPD', 'ENG3', 82000.00, 'Promotion to Senior Engineer'),
(10007, 'SEPARATION', '2022-06-30', 'DPD', 'ENG3', 96000.00, 'Voluntary resignation — deferred vested');

INSERT INTO SALARY_HIST (MEMBER_ID, PAY_PERIOD_END, PAY_PERIOD_NUM, ANNUAL_SALARY, GROSS_PAY, PENSIONABLE_PAY, OT_PAY, FY_YEAR) VALUES
(10007, '2022-01-07', 1, 96000.00, 3692.31, 3692.31, 0, 2021),
(10007, '2022-03-18', 6, 96000.00, 3692.31, 3692.31, 0, 2021),
(10007, '2022-06-24', 13, 96000.00, 3692.31, 3692.31, 280.00, 2021);

INSERT INTO CONTRIBUTION_HIST (MEMBER_ID, PAY_PERIOD_END, EE_CONTRIB, ER_CONTRIB, EE_BALANCE, ER_BALANCE, INTEREST_AMT, FY_YEAR) VALUES
(10007, '2022-01-07', 312.00, 662.72, 142500.00, 302700.00, 0, 2021),
(10007, '2022-03-18', 312.00, 662.72, 144060.00, 306008.60, 0, 2021),
(10007, '2022-06-24', 312.00, 662.72, 145620.00, 309317.20, 0, 2021);

INSERT INTO SVC_CREDIT (MEMBER_ID, CREDIT_TYPE, BEGIN_DT, YEARS_CREDITED, STATUS) VALUES
(10007, 'EARNED', '2000-03-01', 22.33, 'ACTIVE');

INSERT INTO BENEFICIARY (MEMBER_ID, BENE_TYPE, FIRST_NAME, LAST_NAME, RELATIONSHIP, ALLOC_PCT, EFF_DT) VALUES
(10007, 'PRIMARY', 'Estate', 'O''Brien', 'ESTATE', 100.00, '2000-03-01');


-- =============================================================================
-- MEMBER 8: Angela Davis (10008)
-- Tier 2, Aviation (DIA), 2009 hire, near tier boundary
-- =============================================================================
INSERT INTO MEMBER_MASTER (
    MEMBER_ID, SSN, FIRST_NAME, LAST_NAME, DOB, GENDER,
    MARITAL_STAT, ADDR_LINE1, CITY, STATE_CD, ZIP_CD, PHONE, EMAIL,
    HIRE_DT, STATUS_CD, TIER_CD, DEPT_CD, POS_CD, MEDICARE_FLAG
) VALUES (
    10008, '555-89-0123', 'Angela', 'Davis', '1975-05-28', 'F',
    'M', '16300 E 40th Ave', 'Aurora', 'CO', '80011', '720-555-0808', 'adavis@denvergov.org',
    '2009-07-01', 'A', 2, 'DAS', 'PMGR', 'N'
);

INSERT INTO EMPLOYMENT_HIST (MEMBER_ID, EVENT_TYPE, EVENT_DT, DEPT_CD, POS_CD, SALARY_ANNUAL, NOTES) VALUES
(10008, 'HIRE', '2009-07-01', 'DAS', 'BADG1', 48000.00, 'Initial hire'),
(10008, 'PROMOTION', '2016-01-01', 'DAS', 'PMGR', 72000.00, 'Promotion to Program Manager');

INSERT INTO SALARY_HIST (MEMBER_ID, PAY_PERIOD_END, PAY_PERIOD_NUM, ANNUAL_SALARY, GROSS_PAY, PENSIONABLE_PAY, OT_PAY, FY_YEAR) VALUES
(10008, '2025-01-10', 1, 88400.00, 3400.00, 3400.00, 0, 2024),
(10008, '2025-06-27', 13, 88400.00, 3400.00, 3400.00, 0, 2024),
(10008, '2025-07-11', 14, 88400.00, 3400.00, 3400.00, 0, 2025),
(10008, '2025-12-26', 26, 88400.00, 3400.00, 3400.00, 0, 2025),
(10008, '2026-01-09', 1, 91052.00, 3502.00, 3502.00, 0, 2025),
(10008, '2026-01-23', 2, 91052.00, 3502.00, 3502.00, 0, 2025),
(10008, '2026-02-06', 3, 91052.00, 3502.00, 3502.00, 0, 2025),
(10008, '2026-02-20', 4, 91052.00, 3502.00, 3502.00, 0, 2025),
(10008, '2026-03-06', 5, 91052.00, 3502.00, 3502.00, 0, 2025);

INSERT INTO CONTRIBUTION_HIST (MEMBER_ID, PAY_PERIOD_END, EE_CONTRIB, ER_CONTRIB, EE_BALANCE, ER_BALANCE, INTEREST_AMT, FY_YEAR) VALUES
(10008, '2026-01-09', 295.92, 628.63, 105100.00, 223200.00, 0, 2025),
(10008, '2026-01-23', 295.92, 628.63, 105395.92, 223828.63, 0, 2025),
(10008, '2026-02-06', 295.92, 628.63, 105691.84, 224457.26, 0, 2025),
(10008, '2026-02-20', 295.92, 628.63, 105987.76, 225085.89, 0, 2025),
(10008, '2026-03-06', 295.92, 628.63, 106283.68, 225714.52, 0, 2025);

INSERT INTO SVC_CREDIT (MEMBER_ID, CREDIT_TYPE, BEGIN_DT, YEARS_CREDITED, STATUS) VALUES
(10008, 'EARNED', '2009-07-01', 16.71, 'ACTIVE');

INSERT INTO BENEFICIARY (MEMBER_ID, BENE_TYPE, FIRST_NAME, LAST_NAME, RELATIONSHIP, DOB, ALLOC_PCT, EFF_DT) VALUES
(10008, 'PRIMARY', 'Marcus', 'Davis', 'SPOUSE', '1973-11-14', 60.00, '2009-07-01'),
(10008, 'CONTINGENT', 'Sophia', 'Davis', 'CHILD', '2005-03-22', 40.00, '2009-07-01');


-- =============================================================================
-- MEMBER 9: Richard Chen (10009)
-- Tier 3, Water, 2013 hire, married
-- =============================================================================
INSERT INTO MEMBER_MASTER (
    MEMBER_ID, SSN, FIRST_NAME, LAST_NAME, DOB, GENDER,
    MARITAL_STAT, ADDR_LINE1, CITY, STATE_CD, ZIP_CD, PHONE, EMAIL,
    HIRE_DT, STATUS_CD, TIER_CD, DEPT_CD, POS_CD, MEDICARE_FLAG
) VALUES (
    10009, '555-90-1234', 'Richard', 'Chen', '1980-09-12', 'M',
    'M', '3400 S Wadsworth Blvd', 'Lakewood', 'CO', '80227', '720-555-0909', 'rchen@denvergov.org',
    '2013-06-01', 'A', 3, 'DWW', 'ENG2', 'N'
);

INSERT INTO EMPLOYMENT_HIST (MEMBER_ID, EVENT_TYPE, EVENT_DT, DEPT_CD, POS_CD, SALARY_ANNUAL, NOTES) VALUES
(10009, 'HIRE', '2013-06-01', 'DWW', 'ENG1', 50000.00, 'Initial hire'),
(10009, 'PROMOTION', '2019-01-01', 'DWW', 'ENG2', 68000.00, 'Promotion to Engineer II');

INSERT INTO SALARY_HIST (MEMBER_ID, PAY_PERIOD_END, PAY_PERIOD_NUM, ANNUAL_SALARY, GROSS_PAY, PENSIONABLE_PAY, OT_PAY, FY_YEAR) VALUES
(10009, '2025-01-10', 1, 74300.00, 2857.69, 2857.69, 0, 2024),
(10009, '2025-06-27', 13, 74300.00, 2857.69, 2857.69, 0, 2024),
(10009, '2025-07-11', 14, 74300.00, 2857.69, 2857.69, 0, 2025),
(10009, '2025-12-26', 26, 74300.00, 2857.69, 2857.69, 0, 2025),
(10009, '2026-01-09', 1, 76529.00, 2943.42, 2943.42, 0, 2025),
(10009, '2026-01-23', 2, 76529.00, 2943.42, 2943.42, 0, 2025),
(10009, '2026-02-06', 3, 76529.00, 2943.42, 2943.42, 0, 2025),
(10009, '2026-02-20', 4, 76529.00, 2943.42, 2943.42, 0, 2025);

INSERT INTO CONTRIBUTION_HIST (MEMBER_ID, PAY_PERIOD_END, EE_CONTRIB, ER_CONTRIB, EE_BALANCE, ER_BALANCE, INTEREST_AMT, FY_YEAR) VALUES
(10009, '2026-01-09', 248.72, 528.31, 68400.00, 145300.00, 0, 2025),
(10009, '2026-01-23', 248.72, 528.31, 68648.72, 145828.31, 0, 2025),
(10009, '2026-02-06', 248.72, 528.31, 68897.44, 146356.62, 0, 2025),
(10009, '2026-02-20', 248.72, 528.31, 69146.16, 146884.93, 0, 2025);

INSERT INTO SVC_CREDIT (MEMBER_ID, CREDIT_TYPE, BEGIN_DT, YEARS_CREDITED, STATUS) VALUES
(10009, 'EARNED', '2013-06-01', 12.79, 'ACTIVE');

INSERT INTO BENEFICIARY (MEMBER_ID, BENE_TYPE, FIRST_NAME, LAST_NAME, RELATIONSHIP, DOB, ALLOC_PCT, EFF_DT) VALUES
(10009, 'PRIMARY', 'Linda', 'Chen', 'SPOUSE', '1982-03-25', 100.00, '2013-06-01');


-- =============================================================================
-- MEMBER 10: Patricia Moore (10010)
-- Tier 1, City Attorney, 2001 hire, leave-payout eligible
-- =============================================================================
INSERT INTO MEMBER_MASTER (
    MEMBER_ID, SSN, FIRST_NAME, LAST_NAME, MIDDLE_NAME, DOB, GENDER,
    MARITAL_STAT, ADDR_LINE1, CITY, STATE_CD, ZIP_CD, PHONE, EMAIL,
    HIRE_DT, STATUS_CD, TIER_CD, DEPT_CD, POS_CD, MEDICARE_FLAG
) VALUES (
    10010, '555-01-2345', 'Patricia', 'Moore', 'L', '1966-11-30', 'F',
    'S', '1437 Bannock St', 'Denver', 'CO', '80202', '303-555-1010', 'pmoore@denvergov.org',
    '2001-11-01', 'A', 1, 'DCA', 'BADG3', 'N'
);

INSERT INTO EMPLOYMENT_HIST (MEMBER_ID, EVENT_TYPE, EVENT_DT, DEPT_CD, POS_CD, SALARY_ANNUAL, NOTES) VALUES
(10010, 'HIRE', '2001-11-01', 'DCA', 'BADG1', 44000.00, 'Initial hire'),
(10010, 'PROMOTION', '2009-03-01', 'DCA', 'BADG2', 60000.00, 'Promotion to Budget Analyst II'),
(10010, 'PROMOTION', '2016-07-01', 'DCA', 'BADG3', 76000.00, 'Promotion to Budget Analyst III');

INSERT INTO SALARY_HIST (MEMBER_ID, PAY_PERIOD_END, PAY_PERIOD_NUM, ANNUAL_SALARY, GROSS_PAY, PENSIONABLE_PAY, OT_PAY, FY_YEAR) VALUES
(10010, '2025-01-10', 1, 92100.00, 3542.31, 3542.31, 0, 2024),
(10010, '2025-06-27', 13, 92100.00, 3542.31, 3542.31, 0, 2024),
(10010, '2025-07-11', 14, 92100.00, 3542.31, 3542.31, 0, 2025),
(10010, '2025-12-26', 26, 92100.00, 3542.31, 3542.31, 0, 2025),
(10010, '2026-01-09', 1, 94863.00, 3648.58, 3648.58, 0, 2025),
(10010, '2026-01-23', 2, 94863.00, 3648.58, 3648.58, 0, 2025),
(10010, '2026-02-06', 3, 94863.00, 3648.58, 3648.58, 0, 2025),
(10010, '2026-02-20', 4, 94863.00, 3648.58, 3648.58, 0, 2025),
(10010, '2026-03-06', 5, 94863.00, 3648.58, 3648.58, 0, 2025);

INSERT INTO CONTRIBUTION_HIST (MEMBER_ID, PAY_PERIOD_END, EE_CONTRIB, ER_CONTRIB, EE_BALANCE, ER_BALANCE, INTEREST_AMT, FY_YEAR) VALUES
(10010, '2026-01-09', 308.31, 654.88, 155300.00, 329900.00, 0, 2025),
(10010, '2026-01-23', 308.31, 654.88, 155608.31, 330554.88, 0, 2025),
(10010, '2026-02-06', 308.31, 654.88, 155916.62, 331209.76, 0, 2025),
(10010, '2026-02-20', 308.31, 654.88, 156224.93, 331864.64, 0, 2025),
(10010, '2026-03-06', 308.31, 654.88, 156533.24, 332519.52, 0, 2025);

INSERT INTO SVC_CREDIT (MEMBER_ID, CREDIT_TYPE, BEGIN_DT, YEARS_CREDITED, STATUS) VALUES
(10010, 'EARNED', '2001-11-01', 24.37, 'ACTIVE');

INSERT INTO BENEFICIARY (MEMBER_ID, BENE_TYPE, FIRST_NAME, LAST_NAME, RELATIONSHIP, ALLOC_PCT, EFF_DT) VALUES
(10010, 'PRIMARY', 'Estate', 'Moore', 'ESTATE', 100.00, '2001-11-01');

COMMIT;
```

**Step 2: Verify SQL syntax**

Run: `cd domains/pension/seed && head -5 013_expanded_members.sql`
Expected: Shows the file header

**Step 3: Commit**

```bash
git add domains/pension/seed/013_expanded_members.sql
git commit -m "[pension/seed] Add 7 expanded demo members (10004-10010)"
```

---

### Task 2: Create Expanded Cases Seed File

**Files:**
- Create: `domains/pension/seed/014_expanded_cases.sql`

**Step 1: Write the cases seed file with 12 new cases**

Uses `NOW() - INTERVAL` for created_at so SLA calculations stay fresh. Distributes across stages, priorities, and assignees.

```sql
-- =============================================================================
-- Expanded Case Seed Data — 12 additional retirement cases
-- Runs after 007_casemanagement_seed.sql (which seeds 4 cases)
-- Uses NOW() - INTERVAL for SLA freshness
-- =============================================================================

-- New cases distributed across stages, priorities, and assignees
INSERT INTO retirement_case (
    case_id, member_id, case_type, retirement_date,
    priority, sla_status, current_stage, current_stage_idx,
    assigned_to, days_open, status, dro_id, created_at, updated_at
) VALUES
-- === ON-TRACK cases (7) ===
-- Case 5: Maria Santos — Stage 0, just received
('RET-2026-0201', 10004, 'RET', '2026-06-01',
 'standard', 'on-track', 'Application Intake', 0,
 'Michael Torres', 2, 'active', NULL,
 NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),

-- Case 6: James Wilson — Stage 1, early in pipeline
('RET-2026-0202', 10005, 'RET', '2026-07-01',
 'standard', 'on-track', 'Document Verification', 1,
 'Lisa Park', 5, 'active', NULL,
 NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days'),

-- Case 7: Lisa Park — Stage 2, eligibility under review
('RET-2026-0203', 10006, 'RET', '2026-08-01',
 'low', 'on-track', 'Eligibility Review', 2,
 'James Wilson', 8, 'active', NULL,
 NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 days'),

-- Case 8: Angela Davis — Stage 4, benefit calc
('RET-2026-0204', 10008, 'RET', '2026-05-01',
 'high', 'on-track', 'Benefit Calculation', 4,
 'Sarah Chen', 15, 'active', NULL,
 NOW() - INTERVAL '15 days', NOW() - INTERVAL '1 day'),

-- Case 9: Richard Chen — Stage 0, second intake
('RET-2026-0205', 10009, 'RET', '2026-09-01',
 'standard', 'on-track', 'Application Intake', 0,
 'Michael Torres', 1, 'active', NULL,
 NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

-- Case 10: Patricia Moore — Stage 5, election recording
('RET-2026-0206', 10010, 'RET', '2026-05-15',
 'standard', 'on-track', 'Election Recording', 5,
 'Lisa Park', 20, 'active', NULL,
 NOW() - INTERVAL '20 days', NOW() - INTERVAL '2 days'),

-- Case 11: Maria Santos DRO — Stage 3, second case for same member
('DRO-2026-0032', 10004, 'DRO', '2026-06-01',
 'high', 'on-track', 'Marital Share Calculation', 3,
 'Sarah Chen', 10, 'active', NULL,
 NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day'),

-- === AT-RISK cases (3) ===
-- Case 12: Thomas O'Brien — Stage 2, deferred member, nearing SLA
('RET-2026-0207', 10007, 'RET', '2026-04-01',
 'high', 'at-risk', 'Eligibility Review', 2,
 'James Wilson', 52, 'active', NULL,
 NOW() - INTERVAL '52 days', NOW() - INTERVAL '5 days'),

-- Case 13: Angela Davis — Stage 6, certification pending (urgent)
('RET-2026-0208', 10008, 'RET', '2026-04-15',
 'urgent', 'at-risk', 'Certification', 6,
 'Michael Torres', 25, 'active', NULL,
 NOW() - INTERVAL '25 days', NOW() - INTERVAL '1 day'),

-- Case 14: Patricia Moore — Stage 6, second at certification
('RET-2026-0209', 10010, 'RET', '2026-04-01',
 'standard', 'at-risk', 'Certification', 6,
 'Lisa Park', 78, 'active', NULL,
 NOW() - INTERVAL '78 days', NOW() - INTERVAL '3 days'),

-- === OVERDUE cases (2) ===
-- Case 15: James Wilson — Stage 1, stuck in doc verification
('RET-2026-0210', 10005, 'RET', '2026-03-15',
 'urgent', 'at-risk', 'Document Verification', 1,
 'Sarah Chen', 35, 'active', NULL,
 NOW() - INTERVAL '35 days', NOW() - INTERVAL '10 days'),

-- Case 16: Richard Chen — Stage 4, overdue benefit calc
('RET-2026-0211', 10009, 'RET', '2026-03-01',
 'low', 'at-risk', 'Benefit Calculation', 4,
 'James Wilson', 95, 'active', NULL,
 NOW() - INTERVAL '95 days', NOW() - INTERVAL '7 days')

ON CONFLICT (case_id) DO NOTHING;

-- Case flags
INSERT INTO case_flag (case_id, flag_code) VALUES
-- Standard retirement flags
('RET-2026-0201', 'leave-payout'),            -- Maria Santos: T1, pre-2010
('RET-2026-0202', 'purchased-service'),        -- James Wilson: purchased 2yr
('RET-2026-0203', 'early-retirement'),          -- Lisa Park: T3 early
('RET-2026-0204', 'early-retirement'),          -- Angela Davis: T2 early
('RET-2026-0206', 'leave-payout'),             -- Patricia Moore: T1, pre-2010
('DRO-2026-0032', 'dro'),                      -- Maria Santos DRO
('DRO-2026-0032', 'leave-payout'),             -- Maria Santos: T1, pre-2010
('RET-2026-0207', 'early-retirement'),          -- Thomas O'Brien: deferred
('RET-2026-0208', 'early-retirement'),          -- Angela Davis: T2 urgent
('RET-2026-0210', 'purchased-service'),        -- James Wilson: stuck case
('RET-2026-0211', 'early-retirement')           -- Richard Chen: overdue
ON CONFLICT (case_id, flag_code) DO NOTHING;

-- Stage transition history for cases that have advanced beyond stage 0
INSERT INTO case_stage_history (case_id, from_stage_idx, to_stage_idx, from_stage, to_stage, transitioned_by, note, transitioned_at) VALUES
-- Case 6 (James Wilson): 0 → 1
('RET-2026-0202', 0, 1, 'Application Intake', 'Document Verification', 'Lisa Park', 'Application complete, proceeding to document verification', NOW() - INTERVAL '3 days'),
-- Case 7 (Lisa Park): 0 → 1 → 2
('RET-2026-0203', 0, 1, 'Application Intake', 'Document Verification', 'James Wilson', NULL, NOW() - INTERVAL '6 days'),
('RET-2026-0203', 1, 2, 'Document Verification', 'Eligibility Review', 'James Wilson', 'Documents verified', NOW() - INTERVAL '4 days'),
-- Case 8 (Angela Davis): 0 → 1 → 2 → 3 → 4
('RET-2026-0204', 0, 1, 'Application Intake', 'Document Verification', 'Sarah Chen', NULL, NOW() - INTERVAL '13 days'),
('RET-2026-0204', 1, 2, 'Document Verification', 'Eligibility Review', 'Sarah Chen', NULL, NOW() - INTERVAL '11 days'),
('RET-2026-0204', 2, 3, 'Eligibility Review', 'Marital Share Calculation', 'Sarah Chen', 'Eligible for early retirement', NOW() - INTERVAL '8 days'),
('RET-2026-0204', 3, 4, 'Marital Share Calculation', 'Benefit Calculation', 'Sarah Chen', 'Stage not applicable for this case', NOW() - INTERVAL '8 days'),
-- Case 10 (Patricia Moore): 0 → 1 → 2 → 3 → 4 → 5
('RET-2026-0206', 0, 1, 'Application Intake', 'Document Verification', 'Lisa Park', NULL, NOW() - INTERVAL '18 days'),
('RET-2026-0206', 1, 2, 'Document Verification', 'Eligibility Review', 'Lisa Park', NULL, NOW() - INTERVAL '15 days'),
('RET-2026-0206', 2, 3, 'Eligibility Review', 'Marital Share Calculation', 'Lisa Park', 'Rule of 75 satisfied', NOW() - INTERVAL '12 days'),
('RET-2026-0206', 3, 4, 'Marital Share Calculation', 'Benefit Calculation', 'Lisa Park', 'Stage not applicable for this case', NOW() - INTERVAL '12 days'),
('RET-2026-0206', 4, 5, 'Benefit Calculation', 'Election Recording', 'Lisa Park', 'Benefit amount confirmed', NOW() - INTERVAL '7 days'),
-- Case 11 (Maria Santos DRO): 0 → 1 → 2 → 3
('DRO-2026-0032', 0, 1, 'Application Intake', 'Document Verification', 'Sarah Chen', NULL, NOW() - INTERVAL '8 days'),
('DRO-2026-0032', 1, 2, 'Document Verification', 'Eligibility Review', 'Sarah Chen', NULL, NOW() - INTERVAL '6 days'),
('DRO-2026-0032', 2, 3, 'Eligibility Review', 'Marital Share Calculation', 'Sarah Chen', 'DRO court order verified', NOW() - INTERVAL '3 days'),
-- Case 12 (Thomas O'Brien): 0 → 1 → 2
('RET-2026-0207', 0, 1, 'Application Intake', 'Document Verification', 'James Wilson', NULL, NOW() - INTERVAL '45 days'),
('RET-2026-0207', 1, 2, 'Document Verification', 'Eligibility Review', 'James Wilson', 'Deferred member — additional verification needed', NOW() - INTERVAL '30 days'),
-- Case 13 (Angela Davis urgent): 0 → ... → 6
('RET-2026-0208', 0, 1, 'Application Intake', 'Document Verification', 'Michael Torres', NULL, NOW() - INTERVAL '23 days'),
('RET-2026-0208', 1, 2, 'Document Verification', 'Eligibility Review', 'Michael Torres', NULL, NOW() - INTERVAL '20 days'),
('RET-2026-0208', 2, 3, 'Eligibility Review', 'Marital Share Calculation', 'Michael Torres', NULL, NOW() - INTERVAL '17 days'),
('RET-2026-0208', 3, 4, 'Marital Share Calculation', 'Benefit Calculation', 'Michael Torres', 'Stage not applicable for this case', NOW() - INTERVAL '17 days'),
('RET-2026-0208', 4, 5, 'Benefit Calculation', 'Election Recording', 'Michael Torres', NULL, NOW() - INTERVAL '12 days'),
('RET-2026-0208', 5, 6, 'Election Recording', 'Certification', 'Michael Torres', 'Election recorded, awaiting certification', NOW() - INTERVAL '5 days'),
-- Case 14 (Patricia Moore at cert): 0 → ... → 6
('RET-2026-0209', 0, 1, 'Application Intake', 'Document Verification', 'Lisa Park', NULL, NOW() - INTERVAL '70 days'),
('RET-2026-0209', 1, 2, 'Document Verification', 'Eligibility Review', 'Lisa Park', NULL, NOW() - INTERVAL '60 days'),
('RET-2026-0209', 2, 3, 'Eligibility Review', 'Marital Share Calculation', 'Lisa Park', NULL, NOW() - INTERVAL '50 days'),
('RET-2026-0209', 3, 4, 'Marital Share Calculation', 'Benefit Calculation', 'Lisa Park', 'Stage not applicable for this case', NOW() - INTERVAL '50 days'),
('RET-2026-0209', 4, 5, 'Benefit Calculation', 'Election Recording', 'Lisa Park', NULL, NOW() - INTERVAL '35 days'),
('RET-2026-0209', 5, 6, 'Election Recording', 'Certification', 'Lisa Park', NULL, NOW() - INTERVAL '20 days'),
-- Case 15 (James Wilson stuck): 0 → 1
('RET-2026-0210', 0, 1, 'Application Intake', 'Document Verification', 'Sarah Chen', NULL, NOW() - INTERVAL '30 days'),
-- Case 16 (Richard Chen overdue): 0 → 1 → 2 → 3 → 4
('RET-2026-0211', 0, 1, 'Application Intake', 'Document Verification', 'James Wilson', NULL, NOW() - INTERVAL '85 days'),
('RET-2026-0211', 1, 2, 'Document Verification', 'Eligibility Review', 'James Wilson', NULL, NOW() - INTERVAL '75 days'),
('RET-2026-0211', 2, 3, 'Eligibility Review', 'Marital Share Calculation', 'James Wilson', NULL, NOW() - INTERVAL '60 days'),
('RET-2026-0211', 3, 4, 'Marital Share Calculation', 'Benefit Calculation', 'James Wilson', 'Stage not applicable for this case', NOW() - INTERVAL '60 days');

-- Update SLA target days for new cases
UPDATE retirement_case SET sla_target_days = 30 WHERE priority = 'urgent' AND sla_target_days IS NULL;
UPDATE retirement_case SET sla_target_days = 60 WHERE priority = 'high' AND sla_target_days IS NULL;
UPDATE retirement_case SET sla_target_days = 90 WHERE priority = 'standard' AND sla_target_days IS NULL;
UPDATE retirement_case SET sla_target_days = 120 WHERE priority = 'low' AND sla_target_days IS NULL;
UPDATE retirement_case SET sla_deadline_at = created_at + (sla_target_days || ' days')::INTERVAL
  WHERE sla_deadline_at IS NULL;

-- Add some case notes for the new cases
INSERT INTO case_note (case_id, author, content, category, created_at) VALUES
('RET-2026-0201', 'Michael Torres', 'Application received from Maria Santos. Tier 1 with leave payout eligibility. All initial documents look complete.', 'general', NOW() - INTERVAL '2 days'),
('RET-2026-0202', 'Lisa Park', 'James Wilson application includes purchased service credit documentation. Verifying with HR.', 'review', NOW() - INTERVAL '4 days'),
('RET-2026-0204', 'Sarah Chen', 'Angela Davis benefit calculation in progress. Early retirement reduction applies (Tier 2, age 50).', 'decision', NOW() - INTERVAL '3 days'),
('RET-2026-0207', 'James Wilson', 'Thomas O''Brien is a deferred vested member (terminated 2022). Need to verify current address for benefit correspondence.', 'external', NOW() - INTERVAL '20 days'),
('RET-2026-0208', 'Michael Torres', 'URGENT: Angela Davis retirement date is April 15. Expediting certification review.', 'general', NOW() - INTERVAL '3 days'),
('RET-2026-0209', 'Lisa Park', 'Patricia Moore case has been at certification for 20 days. Awaiting supervisor sign-off.', 'general', NOW() - INTERVAL '5 days'),
('RET-2026-0210', 'Sarah Chen', 'James Wilson case blocked — missing employment verification from prior employer. HR contacted 2 weeks ago, no response.', 'external', NOW() - INTERVAL '10 days'),
('RET-2026-0211', 'James Wilson', 'Richard Chen case overdue. Benefit calculation delayed due to complexity of early retirement with 60-month AMS window.', 'review', NOW() - INTERVAL '7 days')
ON CONFLICT DO NOTHING;

-- Add some case documents for new cases
INSERT INTO case_document (case_id, document_type, filename, mime_type, size_bytes, uploaded_by, uploaded_at) VALUES
('RET-2026-0201', 'election_form', 'santos_retirement_application.pdf', 'application/pdf', 234500, 'Michael Torres', NOW() - INTERVAL '2 days'),
('RET-2026-0202', 'election_form', 'wilson_retirement_application.pdf', 'application/pdf', 218000, 'Lisa Park', NOW() - INTERVAL '5 days'),
('RET-2026-0202', 'employment_verification', 'wilson_purchased_service_proof.pdf', 'application/pdf', 456000, 'HR System', NOW() - INTERVAL '3 days'),
('RET-2026-0204', 'election_form', 'davis_retirement_application.pdf', 'application/pdf', 245000, 'Sarah Chen', NOW() - INTERVAL '15 days'),
('RET-2026-0207', 'election_form', 'obrien_retirement_application.pdf', 'application/pdf', 198000, 'James Wilson', NOW() - INTERVAL '50 days'),
('RET-2026-0208', 'election_form', 'davis_urgent_retirement_app.pdf', 'application/pdf', 267000, 'Michael Torres', NOW() - INTERVAL '24 days'),
('DRO-2026-0032', 'court_order', 'santos_dro_court_order.pdf', 'application/pdf', 780000, 'Legal Dept', NOW() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;
```

**Step 2: Commit**

```bash
git add domains/pension/seed/014_expanded_cases.sql
git commit -m "[pension/seed] Add 12 expanded demo cases with SLA variation"
```

---

### Task 3: Create Expanded CRM Seed File

**Files:**
- Create: `domains/pension/seed/015_expanded_crm.sql`

**Step 1: Write CRM seed with contacts and interactions for new members**

New CRM contacts follow the same UUID pattern from `003_crm_seed.sql`. New contacts start at `00000000-0000-0000-1000-000000000006`. New conversations start at `00000000-0000-0000-6000-000000000005`. New interactions start at `00000000-0000-0000-7000-000000000010`.

```sql
-- =============================================================================
-- Expanded CRM Seed Data — Contacts + Interactions for members 10004-10010
-- Runs after 003_crm_seed.sql
-- UUID patterns continue from existing seed:
--   Contacts: 00000000-0000-0000-1000-000000000006..012
--   Conversations: 00000000-0000-0000-6000-000000000005..011
--   Interactions: 00000000-0000-0000-7000-000000000010..027
-- =============================================================================

BEGIN;

-- ===== CONTACTS =====
INSERT INTO crm_contact (
    contact_id, tenant_id, contact_type, legacy_mbr_id,
    first_name, last_name, date_of_birth, gender,
    primary_email, primary_phone, primary_phone_type,
    preferred_language, preferred_channel,
    identity_verified, identity_verified_at, identity_verified_by,
    email_deliverable, email_validated_at, phone_validated_at,
    created_at, updated_at, created_by, updated_by
) VALUES
-- Maria Santos (10004)
(
    '00000000-0000-0000-1000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10004',
    'Maria', 'Santos', '1965-07-20', 'F',
    'msantos@example.com', '303-555-0404', 'HOME',
    'en', 'PHONE',
    TRUE, NOW() - INTERVAL '30 days', 'mtorres',
    TRUE, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days',
    '2026-01-01 08:00:00-07', NOW() - INTERVAL '2 days', 'system_import', 'mtorres'
),
-- James Wilson (10005)
(
    '00000000-0000-0000-1000-000000000007',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10005',
    'James', 'Wilson', '1972-04-03', 'M',
    'jwilson@example.com', '303-555-0505', 'CELL',
    'en', 'EMAIL',
    TRUE, NOW() - INTERVAL '20 days', 'lpark',
    TRUE, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days',
    '2026-01-01 08:00:00-07', NOW() - INTERVAL '5 days', 'system_import', 'lpark'
),
-- Lisa Park (10006) — member, not the staff Lisa Park
(
    '00000000-0000-0000-1000-000000000008',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10006',
    'Lisa', 'Park', '1988-12-05', 'F',
    'lpark_member@example.com', '720-555-0606', 'CELL',
    'en', 'SECURE_MESSAGE',
    TRUE, NOW() - INTERVAL '15 days', 'jwilson_staff',
    TRUE, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days',
    '2026-01-01 08:00:00-07', NOW() - INTERVAL '8 days', 'system_import', 'jwilson_staff'
),
-- Thomas O'Brien (10007) — terminated, no email
(
    '00000000-0000-0000-1000-000000000009',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10007',
    'Thomas', 'O''Brien', '1968-01-15', 'M',
    NULL, '303-555-0707', 'HOME',
    'en', 'MAIL',
    FALSE, NULL, NULL,
    NULL, NULL, NULL,
    '2026-01-01 08:00:00-07', NOW() - INTERVAL '50 days', 'system_import', 'jwilson_staff'
),
-- Angela Davis (10008)
(
    '00000000-0000-0000-1000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10008',
    'Angela', 'Davis', '1975-05-28', 'F',
    'adavis@example.com', '720-555-0808', 'CELL',
    'en', 'EMAIL',
    TRUE, NOW() - INTERVAL '25 days', 'mtorres',
    TRUE, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days',
    '2026-01-01 08:00:00-07', NOW() - INTERVAL '1 day', 'system_import', 'mtorres'
),
-- Richard Chen (10009)
(
    '00000000-0000-0000-1000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10009',
    'Richard', 'Chen', '1980-09-12', 'M',
    'rchen@example.com', '720-555-0909', 'CELL',
    'en', 'SECURE_MESSAGE',
    TRUE, NOW() - INTERVAL '90 days', 'schen',
    TRUE, NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days',
    '2026-01-01 08:00:00-07', NOW() - INTERVAL '7 days', 'system_import', 'schen'
),
-- Patricia Moore (10010)
(
    '00000000-0000-0000-1000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10010',
    'Patricia', 'Moore', '1966-11-30', 'F',
    'pmoore@example.com', '303-555-1010', 'HOME',
    'en', 'PHONE',
    TRUE, NOW() - INTERVAL '80 days', 'lpark',
    TRUE, NOW() - INTERVAL '80 days', NOW() - INTERVAL '80 days',
    '2026-01-01 08:00:00-07', NOW() - INTERVAL '3 days', 'system_import', 'lpark'
)
ON CONFLICT (contact_id) DO NOTHING;

-- ===== CONVERSATIONS (1 per new member) =====
INSERT INTO crm_conversation (
    conversation_id, tenant_id, anchor_type, anchor_id,
    topic_category, subject, status,
    assigned_team, assigned_agent,
    created_at, updated_at, created_by, updated_by
) VALUES
('00000000-0000-0000-6000-000000000005', '00000000-0000-0000-0000-000000000001',
 'MEMBER', '10004', 'retirement', 'Maria Santos — Retirement Application', 'OPEN',
 'retirement_services', 'mtorres',
 NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 'mtorres', 'mtorres'),

('00000000-0000-0000-6000-000000000006', '00000000-0000-0000-0000-000000000001',
 'MEMBER', '10005', 'retirement', 'James Wilson — Purchased Service Inquiry', 'OPEN',
 'retirement_services', 'lpark',
 NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 days', 'lpark', 'lpark'),

('00000000-0000-0000-6000-000000000007', '00000000-0000-0000-0000-000000000001',
 'MEMBER', '10006', 'retirement', 'Lisa Park — Early Retirement Questions', 'OPEN',
 'retirement_services', 'jwilson_staff',
 NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 days', 'jwilson_staff', 'jwilson_staff'),

('00000000-0000-0000-6000-000000000008', '00000000-0000-0000-0000-000000000001',
 'MEMBER', '10007', 'deferred', 'Thomas O''Brien — Deferred Benefit Inquiry', 'PENDING',
 'retirement_services', 'jwilson_staff',
 NOW() - INTERVAL '50 days', NOW() - INTERVAL '20 days', 'jwilson_staff', 'jwilson_staff'),

('00000000-0000-0000-6000-000000000009', '00000000-0000-0000-0000-000000000001',
 'MEMBER', '10008', 'retirement', 'Angela Davis — Urgent Retirement Processing', 'OPEN',
 'retirement_services', 'mtorres',
 NOW() - INTERVAL '25 days', NOW() - INTERVAL '1 day', 'mtorres', 'mtorres'),

('00000000-0000-0000-6000-000000000010', '00000000-0000-0000-0000-000000000001',
 'MEMBER', '10009', 'retirement', 'Richard Chen — Benefit Calculation Delay', 'OPEN',
 'retirement_services', 'jwilson_staff',
 NOW() - INTERVAL '90 days', NOW() - INTERVAL '7 days', 'system', 'jwilson_staff'),

('00000000-0000-0000-6000-000000000011', '00000000-0000-0000-0000-000000000001',
 'MEMBER', '10010', 'retirement', 'Patricia Moore — Certification Follow-Up', 'OPEN',
 'retirement_services', 'lpark',
 NOW() - INTERVAL '20 days', NOW() - INTERVAL '3 days', 'lpark', 'lpark')
ON CONFLICT (conversation_id) DO NOTHING;

-- ===== INTERACTIONS (2-3 per new member, ~18 total) =====
INSERT INTO crm_interaction (
    interaction_id, tenant_id, conversation_id,
    contact_id, agent_id, channel, interaction_type,
    category, direction, started_at, ended_at, duration_seconds,
    summary, visibility, created_at, created_by
) VALUES
-- Maria Santos (3 interactions)
('00000000-0000-0000-7000-000000000010', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000005',
 '00000000-0000-0000-1000-000000000006', 'mtorres',
 'PHONE_INBOUND', 'INQUIRY', 'retirement', 'INBOUND',
 NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '12 minutes', 720,
 'Maria Santos called to inquire about retirement timeline. Explained document requirements and leave payout eligibility.', 'INTERNAL',
 NOW() - INTERVAL '3 days', 'mtorres'),

('00000000-0000-0000-7000-000000000011', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000005',
 '00000000-0000-0000-1000-000000000006', 'mtorres',
 'EMAIL_OUTBOUND', 'FOLLOW_UP', 'retirement', 'OUTBOUND',
 NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '5 minutes', 300,
 'Sent document checklist and retirement application form to Maria Santos.', 'PUBLIC',
 NOW() - INTERVAL '2 days', 'mtorres'),

('00000000-0000-0000-7000-000000000012', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000005',
 '00000000-0000-0000-1000-000000000006', 'mtorres',
 'SECURE_MESSAGE', 'REQUEST', 'retirement', 'INBOUND',
 NOW() - INTERVAL '1 day', NULL, NULL,
 'Maria Santos submitted retirement application via portal. Documents attached.', 'PUBLIC',
 NOW() - INTERVAL '1 day', 'system'),

-- James Wilson (3 interactions)
('00000000-0000-0000-7000-000000000013', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000006',
 '00000000-0000-0000-1000-000000000007', 'lpark',
 'PHONE_INBOUND', 'INQUIRY', 'service_credit', 'INBOUND',
 NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '18 minutes', 1080,
 'James Wilson asked about purchased service credit counting toward benefit calculation. Confirmed it counts for benefit but NOT for Rule of 75.', 'INTERNAL',
 NOW() - INTERVAL '10 days', 'lpark'),

('00000000-0000-0000-7000-000000000014', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000006',
 '00000000-0000-0000-1000-000000000007', 'lpark',
 'EMAIL_INBOUND', 'DOCUMENT_RECEIPT', 'retirement', 'INBOUND',
 NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' + INTERVAL '2 minutes', 120,
 'Received purchased service credit documentation from James Wilson via email.', 'INTERNAL',
 NOW() - INTERVAL '7 days', 'lpark'),

('00000000-0000-0000-7000-000000000015', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000006',
 '00000000-0000-0000-1000-000000000007', 'lpark',
 'PHONE_OUTBOUND', 'FOLLOW_UP', 'retirement', 'OUTBOUND',
 NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '8 minutes', 480,
 'Called James Wilson to confirm application received and outline next steps.', 'INTERNAL',
 NOW() - INTERVAL '5 days', 'lpark'),

-- Lisa Park member (2 interactions)
('00000000-0000-0000-7000-000000000016', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000007',
 '00000000-0000-0000-1000-000000000008', 'jwilson_staff',
 'SECURE_MESSAGE', 'INQUIRY', 'retirement', 'INBOUND',
 NOW() - INTERVAL '8 days', NULL, NULL,
 'Lisa Park submitted question via portal about early retirement eligibility under Tier 3 rules.', 'PUBLIC',
 NOW() - INTERVAL '8 days', 'system'),

('00000000-0000-0000-7000-000000000017', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000007',
 '00000000-0000-0000-1000-000000000008', 'jwilson_staff',
 'SECURE_MESSAGE', 'FOLLOW_UP', 'retirement', 'OUTBOUND',
 NOW() - INTERVAL '6 days', NULL, NULL,
 'Responded to Lisa Park: Tier 3 early retirement available at age 60 with Rule of 85. Current age 37, 11yr service — not yet eligible.', 'PUBLIC',
 NOW() - INTERVAL '6 days', 'jwilson_staff'),

-- Thomas O'Brien (2 interactions)
('00000000-0000-0000-7000-000000000018', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000008',
 '00000000-0000-0000-1000-000000000009', 'jwilson_staff',
 'MAIL_OUTBOUND', 'OUTREACH', 'deferred_benefit', 'OUTBOUND',
 NOW() - INTERVAL '50 days', NULL, NULL,
 'Sent deferred benefit information packet to Thomas O''Brien at Lakewood address on file.', 'INTERNAL',
 NOW() - INTERVAL '50 days', 'jwilson_staff'),

('00000000-0000-0000-7000-000000000019', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000008',
 '00000000-0000-0000-1000-000000000009', 'jwilson_staff',
 'PHONE_INBOUND', 'REQUEST', 'retirement', 'INBOUND',
 NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days' + INTERVAL '22 minutes', 1320,
 'Thomas O''Brien called to request retirement benefit estimate. Explained deferred vested status and options.', 'INTERNAL',
 NOW() - INTERVAL '45 days', 'jwilson_staff'),

-- Angela Davis (3 interactions)
('00000000-0000-0000-7000-000000000020', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000009',
 '00000000-0000-0000-1000-000000000010', 'mtorres',
 'WALK_IN', 'REQUEST', 'retirement', 'INBOUND',
 NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days' + INTERVAL '35 minutes', 2100,
 'Angela Davis walked in to submit retirement application. Explained early retirement reduction for Tier 2 (3%/yr). Urgent priority due to retirement date.', 'INTERNAL',
 NOW() - INTERVAL '25 days', 'mtorres'),

('00000000-0000-0000-7000-000000000021', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000009',
 '00000000-0000-0000-1000-000000000010', 'mtorres',
 'EMAIL_OUTBOUND', 'STATUS_UPDATE', 'retirement', 'OUTBOUND',
 NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '3 minutes', 180,
 'Sent status update to Angela Davis: application is at benefit calculation stage, on track for April retirement date.', 'PUBLIC',
 NOW() - INTERVAL '10 days', 'mtorres'),

('00000000-0000-0000-7000-000000000022', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000009',
 '00000000-0000-0000-1000-000000000010', 'mtorres',
 'PHONE_INBOUND', 'FOLLOW_UP', 'retirement', 'INBOUND',
 NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '10 minutes', 600,
 'Angela Davis called to check certification status. Informed her it is at-risk and being expedited.', 'INTERNAL',
 NOW() - INTERVAL '3 days', 'mtorres'),

-- Richard Chen (2 interactions)
('00000000-0000-0000-7000-000000000023', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000010',
 '00000000-0000-0000-1000-000000000011', 'jwilson_staff',
 'SECURE_MESSAGE', 'INQUIRY', 'retirement', 'INBOUND',
 NOW() - INTERVAL '90 days', NULL, NULL,
 'Richard Chen asked about retirement eligibility. Tier 3, age 45, 12yr service — explained 60-month AMS window and Rule of 85 requirement.', 'PUBLIC',
 NOW() - INTERVAL '90 days', 'system'),

('00000000-0000-0000-7000-000000000024', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000010',
 '00000000-0000-0000-1000-000000000011', 'jwilson_staff',
 'PHONE_OUTBOUND', 'FOLLOW_UP', 'retirement', 'OUTBOUND',
 NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' + INTERVAL '15 minutes', 900,
 'Called Richard Chen regarding delay in benefit calculation. Explained AMS complexity and estimated 2 more weeks.', 'INTERNAL',
 NOW() - INTERVAL '7 days', 'jwilson_staff'),

-- Patricia Moore (3 interactions)
('00000000-0000-0000-7000-000000000025', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000011',
 '00000000-0000-0000-1000-000000000012', 'lpark',
 'PHONE_INBOUND', 'INQUIRY', 'retirement', 'INBOUND',
 NOW() - INTERVAL '80 days', NOW() - INTERVAL '80 days' + INTERVAL '20 minutes', 1200,
 'Patricia Moore inquired about leave payout and retirement timing. Confirmed Tier 1, pre-2010 hire = leave payout eligible.', 'INTERNAL',
 NOW() - INTERVAL '80 days', 'lpark'),

('00000000-0000-0000-7000-000000000026', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000011',
 '00000000-0000-0000-1000-000000000012', 'lpark',
 'EMAIL_OUTBOUND', 'NOTIFICATION', 'retirement', 'OUTBOUND',
 NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days' + INTERVAL '3 minutes', 180,
 'Sent certification-stage notification to Patricia Moore. Awaiting final supervisor approval.', 'PUBLIC',
 NOW() - INTERVAL '20 days', 'lpark'),

('00000000-0000-0000-7000-000000000027', '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-6000-000000000011',
 '00000000-0000-0000-1000-000000000012', 'lpark',
 'PHONE_INBOUND', 'FOLLOW_UP', 'retirement', 'INBOUND',
 NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '8 minutes', 480,
 'Patricia Moore called about certification delay. Explained that case is at-risk and supervisor review is being prioritized.', 'INTERNAL',
 NOW() - INTERVAL '3 days', 'lpark')

ON CONFLICT (interaction_id) DO NOTHING;

COMMIT;
```

**Step 2: Commit**

```bash
git add domains/pension/seed/015_expanded_crm.sql
git commit -m "[pension/seed] Add CRM contacts + 18 interactions for expanded members"
```

---

### Task 4: Update Docker Compose Volume Mounts

**Files:**
- Modify: `docker-compose.yml` (lines 35-36, after the last volume mount `022_member_search_index.sql`)

**Step 1: Add 3 new volume mounts**

After line 35 (`022_member_search_index.sql`), add:
```yaml
      - ./domains/pension/seed/013_expanded_members.sql:/docker-entrypoint-initdb.d/023_expanded_members.sql
      - ./domains/pension/seed/014_expanded_cases.sql:/docker-entrypoint-initdb.d/024_expanded_cases.sql
      - ./domains/pension/seed/015_expanded_crm.sql:/docker-entrypoint-initdb.d/025_expanded_crm.sql
```

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "[infrastructure] Add expanded seed files to Docker init sequence"
```

---

### Task 5: Run Frontend Tests (Regression Check)

**Step 1: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean (0 errors) — seed-only changes should not affect TypeScript

**Step 2: Run test suite**

Run: `cd frontend && npm test -- --run`
Expected: 355 tests passing, 0 failures

**Step 3: Verify no regressions**

If any test fails, investigate — seed data changes should be backend-only.

---

### Task 6: Docker Rebuild + E2E Verification

**Step 1: Rebuild Docker stack**

Run:
```bash
docker compose down -v
docker compose up --build -d
```
Wait for all services to start. Check logs for SQL errors:
```bash
docker compose logs postgres 2>&1 | grep -i error
```
Expected: No SQL errors. All 25 init scripts run successfully.

**Step 2: Verify member search**

Run: `curl -s http://localhost:8081/api/v1/members/search?q=&limit=20 | python -m json.tool | head -30`
Expected: 10 members returned (10001–10010)

**Step 3: Verify case stats**

Run: `curl -s http://localhost:8088/api/v1/cases/stats | python -m json.tool`
Expected: Cases distributed across multiple stages, multiple assignees, at-risk count > 0

**Step 4: Verify SLA stats**

Run: `curl -s http://localhost:8088/api/v1/cases/stats/sla | python -m json.tool`
Expected: `atRisk` > 0, `overdue` > 0 (not all on-track)

**Step 5: Commit and push**

```bash
git add -A
git commit -m "[pension/seed] Session 9: Expanded seed data for realistic dashboards"
```

---

### Task 7: Update BUILD_HISTORY.md

**Files:**
- Modify: `BUILD_HISTORY.md` (add entry at top, below existing Session 8 entry)

Add session summary with:
- What was built (7 members, 12 cases, 18 CRM interactions)
- New files created
- E2E verification results
- Test counts

**Commit:**

```bash
git add BUILD_HISTORY.md
git commit -m "[docs] Add Session 9 seed data expansion summary"
```
