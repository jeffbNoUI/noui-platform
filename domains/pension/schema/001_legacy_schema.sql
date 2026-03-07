-- NoUI DERP POC — Legacy Database Schema
-- Simulates a real-world legacy pension administration system
-- Deliberately messy: inconsistent naming, missing FKs, nullable fields that shouldn't be
-- Source: BUILD_PLAN Day 1 Step 1.1

-- ============================================================
-- DEPARTMENT_REF — Denver city departments (~30)
-- ============================================================
CREATE TABLE DEPARTMENT_REF (
    DEPT_CD         VARCHAR(10) PRIMARY KEY,
    DEPT_NAME       VARCHAR(100) NOT NULL,
    DEPT_SHORT      VARCHAR(20),
    ACTIVE_FLAG     CHAR(1) DEFAULT 'Y',
    CREATE_DT       TIMESTAMP,
    -- Legacy: no updated_at column added until 2015
    MODIFY_DT       TIMESTAMP
);

-- ============================================================
-- POSITION_REF — Position/classification reference (~50)
-- ============================================================
CREATE TABLE POSITION_REF (
    POS_CD          VARCHAR(10) PRIMARY KEY,
    POS_TITLE       VARCHAR(100) NOT NULL,
    PAY_GRADE       VARCHAR(5),
    EXEMPT_FLG      CHAR(1),           -- Y/N but nullable (legacy oversight)
    MIN_SALARY      NUMERIC(12,2),
    MAX_SALARY      NUMERIC(12,2),
    DEPT_CD         VARCHAR(10),        -- Missing FK constraint (legacy)
    EFF_DT          DATE,
    END_DT          DATE
);

-- ============================================================
-- MEMBER_MASTER — Core member table with demographics
-- Deliberately: some abbreviated fields, some not; nullable fields
-- that shouldn't be nullable; STATUS_CD overloaded
-- ============================================================
CREATE TABLE MEMBER_MASTER (
    MEMBER_ID       SERIAL PRIMARY KEY,
    SSN             VARCHAR(11),        -- Stored with dashes in some records, without in others
    FIRST_NAME      VARCHAR(50) NOT NULL,
    LAST_NAME       VARCHAR(50) NOT NULL,
    MIDDLE_NAME     VARCHAR(50),
    SUFFIX          VARCHAR(10),
    DOB             DATE,               -- Should NOT be nullable but legacy allows it
    GENDER          CHAR(1),            -- M/F but some records have NULL
    MARITAL_STAT    CHAR(1),            -- S/M/D/W — abbreviated unlike other fields
    ADDR_LINE1      VARCHAR(100),
    ADDR_LINE2      VARCHAR(100),
    CITY            VARCHAR(50),
    STATE_CD        CHAR(2),
    ZIP_CD          VARCHAR(10),
    PHONE           VARCHAR(20),        -- Format varies: (303)555-1234, 303-555-1234, 3035551234
    EMAIL           VARCHAR(100),       -- Added 2010, NULL for older records
    HIRE_DT         DATE NOT NULL,
    TERM_DATE       DATE,               -- Named differently from HIRE_DT (legacy inconsistency)
    REHIRE_DT       DATE,
    STATUS_CD       VARCHAR(5) NOT NULL, -- A=Active, R=Retired, T=Terminated, D=Deferred, X=Deceased
                                         -- Overloaded: 'A' sometimes used for 'Active-on-leave'
    TIER_CD         SMALLINT,           -- 1, 2, or 3 — but computed from hire date, sometimes wrong
    DEPT_CD         VARCHAR(10),        -- No FK constraint
    POS_CD          VARCHAR(10),        -- No FK constraint
    UNION_CD        VARCHAR(10),
    MEDICARE_FLAG   CHAR(1),            -- Y/N — added 2018, NULL for older records
    NOTES           TEXT,               -- Free-text catch-all added over the years
    CREATE_DT       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    LAST_UPD_DT     TIMESTAMP,          -- Named differently from CREATE_DT
    UPD_USER        VARCHAR(30)
);

CREATE INDEX idx_member_ssn ON MEMBER_MASTER(SSN);
CREATE INDEX idx_member_name ON MEMBER_MASTER(LAST_NAME, FIRST_NAME);
CREATE INDEX idx_member_status ON MEMBER_MASTER(STATUS_CD);
CREATE INDEX idx_member_tier ON MEMBER_MASTER(TIER_CD);
CREATE INDEX idx_member_dept ON MEMBER_MASTER(DEPT_CD);

-- ============================================================
-- EMPLOYMENT_HIST — Employment events
-- ============================================================
CREATE TABLE EMPLOYMENT_HIST (
    EMPL_HIST_ID    SERIAL PRIMARY KEY,
    MEMBER_ID       INTEGER NOT NULL REFERENCES MEMBER_MASTER(MEMBER_ID),
    EVENT_TYPE      VARCHAR(20) NOT NULL, -- HIRE, REHIRE, TRANSFER, PROMOTION, SEPARATION, LOA
    EVENT_DT        DATE NOT NULL,
    DEPT_CD         VARCHAR(10),
    POS_CD          VARCHAR(10),
    SALARY_ANNUAL   NUMERIC(12,2),       -- Redundant with SALARY_HIST (legacy)
    SEPARATION_CD   VARCHAR(10),         -- Only for SEPARATION events
    SEPARATION_RSN  VARCHAR(200),
    NOTES           TEXT,
    CREATE_DT       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CREATE_USER     VARCHAR(30)
);

CREATE INDEX idx_empl_member ON EMPLOYMENT_HIST(MEMBER_ID);
CREATE INDEX idx_empl_event_dt ON EMPLOYMENT_HIST(EVENT_DT);

-- ============================================================
-- SALARY_HIST — Per-pay-period salary records (biweekly)
-- ============================================================
CREATE TABLE SALARY_HIST (
    SALARY_ID       SERIAL PRIMARY KEY,
    MEMBER_ID       INTEGER NOT NULL REFERENCES MEMBER_MASTER(MEMBER_ID),
    PAY_PERIOD_END  DATE NOT NULL,
    PAY_PERIOD_NUM  INTEGER,             -- 1-26 within the year
    ANNUAL_SALARY   NUMERIC(12,2),       -- Annual rate at time of payment
    GROSS_PAY       NUMERIC(12,2) NOT NULL, -- Actual gross for this period
    PENSIONABLE_PAY NUMERIC(12,2),       -- Should NOT be nullable but is
    OT_PAY          NUMERIC(12,2) DEFAULT 0,
    LEAVE_PAYOUT_AMT NUMERIC(12,2) DEFAULT 0, -- Sick/vacation leave payout (separate per SESSION_BRIEF)
    FURLOUGH_DEDUCT NUMERIC(12,2) DEFAULT 0,  -- Furlough day deduction
    FY_YEAR         INTEGER,
    CREATE_DT       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_salary_member ON SALARY_HIST(MEMBER_ID);
CREATE INDEX idx_salary_period ON SALARY_HIST(PAY_PERIOD_END);
CREATE INDEX idx_salary_member_period ON SALARY_HIST(MEMBER_ID, PAY_PERIOD_END);

-- ============================================================
-- CONTRIBUTION_HIST — Member/employer contributions
-- Deliberately: running balance sometimes mismatches sum of records
-- ============================================================
CREATE TABLE CONTRIBUTION_HIST (
    CONTRIB_ID      SERIAL PRIMARY KEY,
    MEMBER_ID       INTEGER NOT NULL REFERENCES MEMBER_MASTER(MEMBER_ID),
    PAY_PERIOD_END  DATE NOT NULL,
    EE_CONTRIB      NUMERIC(12,2) NOT NULL, -- Employee contribution (8.45%)
    ER_CONTRIB      NUMERIC(12,2) NOT NULL, -- Employer contribution (era-dependent)
    EE_BALANCE      NUMERIC(14,2),          -- Running employee balance (sometimes wrong)
    ER_BALANCE      NUMERIC(14,2),          -- Running employer balance
    INTEREST_AMT    NUMERIC(12,2) DEFAULT 0,
    FY_YEAR         INTEGER,
    CREATE_DT       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contrib_member ON CONTRIBUTION_HIST(MEMBER_ID);
CREATE INDEX idx_contrib_period ON CONTRIBUTION_HIST(PAY_PERIOD_END);

-- ============================================================
-- BENEFICIARY — Beneficiary designations with superseding logic
-- ============================================================
CREATE TABLE BENEFICIARY (
    BENE_ID         SERIAL PRIMARY KEY,
    MEMBER_ID       INTEGER NOT NULL REFERENCES MEMBER_MASTER(MEMBER_ID),
    BENE_TYPE       VARCHAR(20) NOT NULL,  -- PRIMARY, CONTINGENT, DEATH_BENEFIT
    FIRST_NAME      VARCHAR(50) NOT NULL,
    LAST_NAME       VARCHAR(50) NOT NULL,
    RELATIONSHIP    VARCHAR(30),
    DOB             DATE,
    SSN             VARCHAR(11),
    ALLOC_PCT       NUMERIC(5,2),          -- Should total 100% per type, sometimes doesn't
    EFF_DT          DATE NOT NULL,
    END_DT          DATE,                  -- NULL = current; populated = superseded
    SUPERSEDED_BY   INTEGER,               -- BENE_ID of replacement
    CREATE_DT       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CREATE_USER     VARCHAR(30)
);

CREATE INDEX idx_bene_member ON BENEFICIARY(MEMBER_ID);

-- ============================================================
-- SVC_CREDIT — Service credit records by type
-- credit_type is first-class field per SESSION_BRIEF
-- ============================================================
CREATE TABLE SVC_CREDIT (
    SVC_CREDIT_ID   SERIAL PRIMARY KEY,
    MEMBER_ID       INTEGER NOT NULL REFERENCES MEMBER_MASTER(MEMBER_ID),
    CREDIT_TYPE     VARCHAR(20) NOT NULL, -- EARNED, PURCHASED, MILITARY, LEAVE
    BEGIN_DT        DATE,
    END_DT          DATE,
    YEARS_CREDITED  NUMERIC(6,2) NOT NULL,
    MONTHS_CREDITED INTEGER,              -- Redundant with YEARS_CREDITED (legacy)
    COST            NUMERIC(12,2),        -- Purchase cost (PURCHASED/MILITARY only)
    PURCHASE_DT     DATE,                 -- Date of purchase transaction
    STATUS          VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, PENDING, VOIDED
    NOTES           TEXT,
    CREATE_DT       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CREATE_USER     VARCHAR(30)
);

CREATE INDEX idx_svc_member ON SVC_CREDIT(MEMBER_ID);
CREATE INDEX idx_svc_type ON SVC_CREDIT(CREDIT_TYPE);

-- ============================================================
-- DRO_MASTER — Domestic relations orders
-- Stores marriage/divorce dates and division method per SESSION_BRIEF
-- ============================================================
CREATE TABLE DRO_MASTER (
    DRO_ID          SERIAL PRIMARY KEY,
    MEMBER_ID       INTEGER NOT NULL REFERENCES MEMBER_MASTER(MEMBER_ID),
    COURT_ORDER_NUM VARCHAR(50),
    MARRIAGE_DT     DATE,
    DIVORCE_DT      DATE,
    ALT_PAYEE_FIRST VARCHAR(50),
    ALT_PAYEE_LAST  VARCHAR(50),
    ALT_PAYEE_SSN   VARCHAR(11),
    ALT_PAYEE_DOB   DATE,
    DIVISION_METHOD VARCHAR(20),          -- PERCENTAGE, FIXED_AMOUNT
    DIVISION_VALUE  NUMERIC(8,4),         -- Percentage (0-100) or dollar amount
    STATUS          VARCHAR(20) NOT NULL, -- PENDING, APPROVED, ACTIVE, EXPIRED
    RECEIVED_DT     DATE,
    APPROVED_DT     DATE,
    NOTES           TEXT,
    CREATE_DT       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CREATE_USER     VARCHAR(30)
);

CREATE INDEX idx_dro_member ON DRO_MASTER(MEMBER_ID);

-- ============================================================
-- BENEFIT_PAYMENT — Active benefit payments for retirees
-- ============================================================
CREATE TABLE BENEFIT_PAYMENT (
    PAYMENT_ID      SERIAL PRIMARY KEY,
    MEMBER_ID       INTEGER NOT NULL REFERENCES MEMBER_MASTER(MEMBER_ID),
    EFF_DT          DATE NOT NULL,
    PAYMENT_TYPE    VARCHAR(20) NOT NULL,  -- MAXIMUM, JS_100, JS_75, JS_50
    GROSS_MONTHLY   NUMERIC(12,2) NOT NULL,
    REDUCTION_PCT   NUMERIC(5,2) DEFAULT 0,
    NET_AFTER_DRO   NUMERIC(12,2),         -- After DRO split if applicable
    DRO_DEDUCT      NUMERIC(12,2) DEFAULT 0,
    JS_FACTOR       NUMERIC(6,4),
    IPR_AMT         NUMERIC(8,2) DEFAULT 0,
    FED_TAX_WHLD    NUMERIC(10,2) DEFAULT 0,
    STATE_TAX_WHLD  NUMERIC(10,2) DEFAULT 0,
    NET_PAYMENT     NUMERIC(12,2),
    DEATH_BENEFIT_INST NUMERIC(8,2) DEFAULT 0, -- Monthly installment amount
    STATUS          VARCHAR(10) DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, TERMINATED
    LAST_PAID_DT    DATE,
    CREATE_DT       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    MODIFY_DT       TIMESTAMP
);

CREATE INDEX idx_payment_member ON BENEFIT_PAYMENT(MEMBER_ID);
CREATE INDEX idx_payment_status ON BENEFIT_PAYMENT(STATUS);

-- ============================================================
-- CASE_HIST — Work item / case tracking
-- ============================================================
CREATE TABLE CASE_HIST (
    CASE_ID         SERIAL PRIMARY KEY,
    MEMBER_ID       INTEGER NOT NULL REFERENCES MEMBER_MASTER(MEMBER_ID),
    CASE_TYPE       VARCHAR(30) NOT NULL,  -- SVC_RETIREMENT, EARLY_RETIREMENT, DISABILITY,
                                            -- REFUND, DRO, BENEFICIARY_CHANGE, ESTIMATE,
                                            -- GENERAL_INQUIRY, DEATH_CLAIM
    CASE_STATUS     VARCHAR(20) NOT NULL,  -- OPEN, IN_PROGRESS, PENDING_REVIEW, APPROVED,
                                            -- DENIED, CLOSED, CANCELLED
    PRIORITY        SMALLINT DEFAULT 3,     -- 1=Urgent, 2=High, 3=Normal, 4=Low
    ASSIGNED_TO     VARCHAR(50),
    OPEN_DT         DATE NOT NULL,
    TARGET_DT       DATE,
    CLOSE_DT        DATE,
    RESOLUTION      TEXT,
    NOTES           TEXT,
    CREATE_DT       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    MODIFY_DT       TIMESTAMP,
    MODIFY_USER     VARCHAR(30)
);

CREATE INDEX idx_case_member ON CASE_HIST(MEMBER_ID);
CREATE INDEX idx_case_status ON CASE_HIST(CASE_STATUS);
CREATE INDEX idx_case_type ON CASE_HIST(CASE_TYPE);

-- ============================================================
-- TRANSACTION_LOG — Audit log
-- Deliberately inconsistent formats across eras
-- ============================================================
CREATE TABLE TRANSACTION_LOG (
    LOG_ID          SERIAL PRIMARY KEY,
    TABLE_NAME      VARCHAR(50) NOT NULL,
    RECORD_ID       INTEGER,
    MEMBER_ID       INTEGER,               -- Sometimes populated, sometimes not
    ACTION          VARCHAR(20) NOT NULL,   -- INSERT, UPDATE, DELETE
    OLD_VALUES      TEXT,                   -- Pre-2015: pipe-delimited; post-2015: JSON
    NEW_VALUES      TEXT,                   -- Same inconsistency
    CHANGED_BY      VARCHAR(50),
    CHANGED_DT      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    APP_MODULE      VARCHAR(50),            -- Which module made the change
    SESSION_ID      VARCHAR(100)            -- Added 2018, NULL for older records
);

CREATE INDEX idx_log_member ON TRANSACTION_LOG(MEMBER_ID);
CREATE INDEX idx_log_table ON TRANSACTION_LOG(TABLE_NAME);
CREATE INDEX idx_log_dt ON TRANSACTION_LOG(CHANGED_DT);
