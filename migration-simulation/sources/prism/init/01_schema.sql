-- ============================================================
-- PRISM PENSION RESOURCE INFORMATION SYSTEM MANAGER
-- Legacy Pension Administration System — DDL
-- Vendor: DataCore Systems Inc. (acquired 2009, EOL 2019)
-- Initial deployment: 1991
-- Migration from OPUS system: January 1998
-- Database: SQL Server 2008 (never upgraded)
-- Schema version: 4.2.1 (final release, 2014)
-- ============================================================
-- PORTED TO POSTGRESQL for migration simulation Docker container.
-- Original: SQL Server 2008 syntax.
-- Conversions: DATETIME→TIMESTAMP, DECIMAL→NUMERIC, GO removed,
--              all tables prefixed with src_prism schema.
-- ============================================================
-- KNOWN ISSUES (from internal system notes):
--   - No foreign keys declared; referential integrity enforced in app layer
--   - BIRTH_DT format inconsistency: YYYYMMDD (post-1998), MMDDYYYY (pre-1998 load)
--   - SSN format: dashes pre-2001 batch, no dashes post-2001
--   - STATUS_CD semantics changed 3 times; see PRISM_MISC_CODES for current mapping
--   - Pre-1998 salary and contribution data lives in *_LEGACY tables (annual only)
--   - SVC_CR_BAL is a running balance -- period detail was NOT migrated from OPUS
--   - PRISM_BENEFICIARY overloaded to hold both beneficiary and QDRO data
-- ============================================================

CREATE SCHEMA IF NOT EXISTS src_prism;
SET search_path TO src_prism;

-- ============================================================
-- TABLE 1: PRISM_MEMBER
-- Core member/participant record.
-- One row per member. STATUS_CD overloaded (see notes).
-- MBR_NBR is the system identifier -- referenced inconsistently
-- as MBR_NBR, EMPL_ID, EMP_NBR, or MBR_ID in other tables.
-- ============================================================
CREATE TABLE PRISM_MEMBER (
    MBR_NBR         INT          NOT NULL,   -- Primary key. Called EMPL_ID in JOB_HIST, EMP_NBR in SAL tables
    LAST_NM         VARCHAR(40)  NOT NULL,
    FIRST_NM        VARCHAR(30)  NOT NULL,
    MID_INIT        CHAR(1)      NULL,
    NATL_ID         VARCHAR(11)  NOT NULL,   -- SSN. Format: XXX-XX-XXXX pre-2001, XXXXXXXXX post-2001. NOT encrypted.
    BIRTH_DT        VARCHAR(8)   NOT NULL,   -- VARCHAR, not DATE. YYYYMMDD post-1998 load, MMDDYYYY pre-1998. ~15% wrong.
    GNDR_CD         CHAR(1)      NULL,       -- 'M','F'. NULL for ~3% of legacy records. 'U' added 2019 (never populated).
    MAR_STS_CD      CHAR(1)      NULL,       -- 'S'=single,'M'=married,'D'=divorced,'W'=widowed. Updates rare.
    STATUS_CD       VARCHAR(3)   NOT NULL,   -- OVERLOADED. See PRISM_MISC_CODES TYPE_CD='STAT'.
                                             -- Pre-1998: A=active(incl leave), I=inactive, R=retired
                                             -- 1998-2007: added D=deceased, DI=disability
                                             -- 2008+:     AL=active-on-leave split from A, SU=suspended, DE=deferred
    HIRE_DT         VARCHAR(10)  NOT NULL,   -- ORIGINAL hire date (career start). VARCHAR not DATE. Mixed formats.
                                             -- NOT the same as employment spell start. Never updated after initial load.
    MBR_TIER        CHAR(2)      NULL,       -- 'T1'=pre-2010 hire, 'T2'=2010+. NULL for records migrated from OPUS.
    PLAN_CD         VARCHAR(10)  NOT NULL,   -- References PRISM_MISC_CODES TYPE_CD='PLAN'. No FK declared.
    EMPR_CD         VARCHAR(8)   NOT NULL,   -- References PRISM_EMPR_LIST.EMPR_CD. No FK declared.
    DEPT_CD         VARCHAR(10)  NULL,
    JOB_CLASS_CD    VARCHAR(6)   NULL,       -- References PRISM_MISC_CODES TYPE_CD='JOBCL'. No FK.
    ORIG_SYS        VARCHAR(10)  NULL,       -- 'OPUS' for pre-1998 migrated records, NULL for PRISM-native
    ADDR_LINE1      VARCHAR(60)  NULL,       -- Address embedded in member record (denormalized)
    ADDR_LINE2      VARCHAR(60)  NULL,       -- Also in PRISM_MEMBER_ADDR. Conflict possible.
    CITY            VARCHAR(40)  NULL,
    STATE_CD        CHAR(2)      NULL,
    ZIP_CD          VARCHAR(10)  NULL,
    EMAIL_ADDR      VARCHAR(80)  NULL,       -- Added 2006. NULL for most pre-2006 members.
    PHONE_NBR       VARCHAR(14)  NULL,       -- Embedded, also in PRISM_PHONE. Format chaos: (555)867-5309, 5558675309, 555-867-5309
    RET_DT          VARCHAR(10)  NULL,       -- Retirement date if STATUS_CD='R'. VARCHAR. Format inconsistent.
    DEATH_DT        VARCHAR(10)  NULL,       -- Date of death if STATUS_CD='D'. VARCHAR.
    NOTES_FLG       CHAR(1)      NULL,       -- 'Y' if notes exist in PRISM_NOTES. Not reliably maintained.
    LST_UPD_DT      TIMESTAMP    NULL,       -- Last update timestamp
    LST_UPD_USR     VARCHAR(20)  NULL,
    CONSTRAINT PK_PRISM_MEMBER PRIMARY KEY (MBR_NBR)
);

-- ============================================================
-- TABLE 2: PRISM_MEMBER_ADDR
-- Address history. Separate from embedded address in PRISM_MEMBER.
-- One-to-many: multiple addresses per member (history preserved).
-- But PRISM_MEMBER.ADDR_LINE1 etc. is updated in-place (no history).
-- The two sources frequently conflict for current address.
-- ============================================================
CREATE TABLE PRISM_MEMBER_ADDR (
    ADDR_SEQ_NBR    INT          NOT NULL,   -- Surrogate PK
    MBR_NBR         INT          NOT NULL,   -- Joins to PRISM_MEMBER.MBR_NBR. No FK.
    ADDR_TYP_CD     CHAR(3)      NOT NULL,   -- 'RES'=residential, 'MAL'=mailing, 'CHK'=check-mailing
    ADDR_LINE1      VARCHAR(60)  NOT NULL,
    ADDR_LINE2      VARCHAR(60)  NULL,
    CITY            VARCHAR(40)  NOT NULL,
    STATE_CD        CHAR(2)      NOT NULL,
    ZIP_CD          VARCHAR(10)  NOT NULL,
    CNTRY_CD        CHAR(3)      NULL,       -- ISO country. NULL assumed = USA. Not reliable.
    EFF_DT          DATE         NOT NULL,   -- When this address became effective
    END_DT          DATE         NULL,       -- NULL = current. But not always terminated when member moves.
    VRFY_DT         DATE         NULL,       -- Date address was verified (postal). Rarely populated.
    CONSTRAINT PK_PRISM_MEMBER_ADDR PRIMARY KEY (ADDR_SEQ_NBR)
);

-- ============================================================
-- TABLE 3: PRISM_EMP_SPELL
-- Employment history by "spell" (continuous employment period).
-- A new spell is created on rehire, transfer, or leave-return.
-- Joins to PRISM_MEMBER by MBR_NBR (same field name here).
-- No FK. Spells sometimes overlap by 1 day due to entry error.
-- ============================================================
CREATE TABLE PRISM_EMP_SPELL (
    SPELL_ID        INT          NOT NULL,   -- Surrogate PK
    MBR_NBR         INT          NOT NULL,   -- Joins to PRISM_MEMBER.MBR_NBR
    EMPR_CD         VARCHAR(8)   NOT NULL,   -- Employer for this spell. No FK.
    DEPT_CD         VARCHAR(10)  NULL,
    JOB_CLASS_CD    VARCHAR(6)   NULL,
    SPELL_START     DATE         NOT NULL,   -- Start of this employment spell
    SPELL_END       DATE         NULL,       -- NULL = ongoing/current
    SPELL_TYP       VARCHAR(3)   NULL,       -- 'FT'=full-time,'PT'=part-time,'TMP'=temporary,'LV'=leave
    FTE_PCT         NUMERIC(5,2) NULL,       -- Full-time equivalent percentage. NULL for older records.
    TERM_RSN_CD     VARCHAR(4)   NULL,       -- Termination reason. References PRISM_MISC_CODES TYPE_CD='TRSN'.
    REHIRE_FLG      CHAR(1)      NULL,       -- 'Y' if this spell follows a prior termination
    SVC_CR_ELIGIBLE CHAR(1)      NULL,       -- 'Y' if this spell earns service credit. NULL assumed 'Y'.
    CONSTRAINT PK_PRISM_EMP_SPELL PRIMARY KEY (SPELL_ID)
);

-- ============================================================
-- TABLE 4: PRISM_JOB_HIST
-- Job and compensation changes. One row per action.
-- Joins to PRISM_MEMBER via EMPL_ID (different name than MBR_NBR).
-- For pre-1998 records loaded from OPUS: only 1 record per member
-- with ACTION_CD='INIT' and ANNUAL_SAL populated as a lump load.
-- ============================================================
CREATE TABLE PRISM_JOB_HIST (
    JOB_SEQ         INT          NOT NULL,   -- Surrogate PK
    EMPL_ID         INT          NOT NULL,   -- = PRISM_MEMBER.MBR_NBR. Different column name.
    EFF_DATE        DATE         NOT NULL,   -- Effective date of this action
    ACTION_CD       VARCHAR(6)   NOT NULL,   -- 'HIRE','PROMOT','TRANS','DEMOTN','LEAVE','RTRN','TERM','INIT'
                                             -- 'INIT' = bulk load record from OPUS migration (pre-1998)
    ANNUAL_SAL      NUMERIC(12,2) NULL,      -- Annual salary at time of action. NULL for some part-time.
    HRLY_RATE       NUMERIC(8,4)  NULL,      -- Hourly rate. Populated if EXEMPT_FLG='N'. Conflicts with ANNUAL_SAL.
    EXEMPT_FLG      CHAR(1)      NULL,       -- 'Y'=exempt (salaried), 'N'=non-exempt (hourly). NULL for old records.
    STD_HRS_WK      NUMERIC(5,2) NULL,       -- Standard hours per week. 40.0 for most FT.
    PAY_FREQ_CD     CHAR(2)      NULL,       -- 'BW'=biweekly,'SM'=semi-monthly,'MO'=monthly. NULL pre-2000.
    POSITION_CD     VARCHAR(10)  NULL,
    GRADE_CD        VARCHAR(6)   NULL,
    STEP_NBR        SMALLINT     NULL,
    ENTERED_BY      VARCHAR(20)  NULL,
    ENTERED_DT      TIMESTAMP    NULL,
    CONSTRAINT PK_PRISM_JOB_HIST PRIMARY KEY (JOB_SEQ)
);

-- ============================================================
-- TABLE 5: PRISM_SAL_ANNUAL
-- Pre-1998 ANNUAL salary summary (migration artifact from OPUS).
-- OPUS did not store per-period detail; only annual totals migrated.
-- This is the ONLY salary data available for members' pre-1998 history.
-- Cannot be broken into monthly/per-period without assumptions.
-- Identified by: LOAD_SRC = 'OPUS_MIGRATION', LOAD_DT = '1998-01-15'
-- ============================================================
CREATE TABLE PRISM_SAL_ANNUAL (
    ANN_SAL_ID      INT          NOT NULL,
    EMP_NBR         INT          NOT NULL,   -- = PRISM_MEMBER.MBR_NBR. Third different column name for same key.
    TAX_YR          SMALLINT     NOT NULL,   -- Calendar/fiscal year (e.g. 1985, 1997)
    GROSS_EARN      NUMERIC(12,2) NOT NULL,  -- Total gross earnings for the year
    PENSION_EARN    NUMERIC(12,2) NULL,      -- Pension-eligible earnings. NULL = assume = GROSS_EARN.
    CONTRIB_AMT     NUMERIC(10,2) NULL,      -- Employee contributions for the year (denormalized here AND in CONTRIB_LEGACY)
    EMPR_CD         VARCHAR(8)   NULL,
    LOAD_SRC        VARCHAR(20)  NULL,       -- 'OPUS_MIGRATION' for all pre-1998 records
    LOAD_DT         DATE         NULL,       -- 1998-01-15 for all migration records
    CONSTRAINT PK_PRISM_SAL_ANNUAL PRIMARY KEY (ANN_SAL_ID)
);

-- ============================================================
-- TABLE 6: PRISM_SAL_PERIOD
-- Per-period (biweekly) salary detail. POST-1998 only.
-- EMP_ID joins to PRISM_MEMBER.MBR_NBR (yet another column name).
-- 26 records per year per member for biweekly pay.
-- Some members on monthly pay: 12 records per year.
-- ============================================================
CREATE TABLE PRISM_SAL_PERIOD (
    SAL_PRD_ID      INT          NOT NULL,
    EMP_ID          INT          NOT NULL,   -- = PRISM_MEMBER.MBR_NBR. Fourth column name for same key.
    PRD_START_DT    DATE         NOT NULL,   -- Pay period start date
    PRD_END_DT      DATE         NOT NULL,   -- Pay period end date
    PAY_DT          DATE         NULL,       -- Actual payment date
    GROSS_PAY       NUMERIC(12,2) NOT NULL,  -- Gross pay for period
    PENSION_PAY     NUMERIC(12,2) NULL,      -- Pension-eligible pay. NULL = use GROSS_PAY.
    OVERTIME_PAY    NUMERIC(10,2) NULL,
    BONUS_PAY       NUMERIC(10,2) NULL,      -- Included in GROSS_PAY, broken out here
    HOURS_WORKED    NUMERIC(6,2) NULL,       -- NULL for exempt/salaried employees
    STD_HRS         NUMERIC(6,2) NULL,
    PAY_FREQ_CD     CHAR(2)      NULL,
    EMPR_CD         VARCHAR(8)   NULL,
    CONSTRAINT PK_PRISM_SAL_PERIOD PRIMARY KEY (SAL_PRD_ID)
);

-- ============================================================
-- TABLE 7: PRISM_SVC_CREDIT
-- Service credit records. CRITICAL LIMITATION:
-- SVC_CR_BAL is a running total balance -- NOT period-by-period.
-- OPUS migrated only the cumulative balance as of 1998-01-01.
-- Period-level history from OPUS was NOT migrated (tape destroyed).
-- SVC_CR_YTD is the annual accrual for the current year only.
-- Historical period detail is UNRECOVERABLE for pre-1998 service.
-- ============================================================
CREATE TABLE PRISM_SVC_CREDIT (
    SVC_CR_ID       INT          NOT NULL,
    MBR_NBR         INT          NOT NULL,   -- Joins to PRISM_MEMBER.MBR_NBR
    AS_OF_DT        DATE         NOT NULL,   -- Date of this balance record
    SVC_CR_BAL      NUMERIC(8,4) NOT NULL,   -- Cumulative credited service (years). Running balance.
    SVC_CR_YTD      NUMERIC(8,4) NULL,       -- Year-to-date accrual. Resets annually.
    SVC_TYP_CD      VARCHAR(5)   NULL,       -- 'ACTV'=active service,'LMIL'=military leave,'PRCH'=purchased,'TRNFR'=transfer
    PRCH_AMT        NUMERIC(10,2) NULL,      -- If SVC_TYP_CD='PRCH': amount paid for service purchase
    NOTES           VARCHAR(200) NULL,
    LST_UPD_DT      TIMESTAMP    NULL,
    CONSTRAINT PK_PRISM_SVC_CREDIT PRIMARY KEY (SVC_CR_ID)
);

-- ============================================================
-- TABLE 8: PRISM_CONTRIB_LEGACY
-- Pre-1998 annual contribution summary (migration artifact).
-- Same structural issue as PRISM_SAL_ANNUAL -- annual only.
-- Some records duplicated from PRISM_SAL_ANNUAL.CONTRIB_AMT.
-- Do NOT sum both tables -- double-counting will result.
-- ============================================================
CREATE TABLE PRISM_CONTRIB_LEGACY (
    CTRIB_LEG_ID    INT          NOT NULL,
    MBR_NBR         INT          NOT NULL,
    TAX_YR          SMALLINT     NOT NULL,
    EE_CONTRIB      NUMERIC(10,2) NOT NULL,  -- Employee contribution for year
    ER_CONTRIB      NUMERIC(10,2) NULL,      -- Employer contribution. NULL for most records (not tracked pre-1998).
    CONTRIB_RATE    NUMERIC(5,4) NULL,       -- Contribution rate (e.g. 0.0850 = 8.5%). NULL for many records.
    INT_CREDITED    NUMERIC(10,2) NULL,      -- Interest credited on account. NULL for DB plans (not tracked).
    CONSTRAINT PK_PRISM_CONTRIB_LEGACY PRIMARY KEY (CTRIB_LEG_ID)
);

-- ============================================================
-- TABLE 9: PRISM_CONTRIB_HIST
-- Post-1998 monthly contribution detail.
-- MBR_ID joins to PRISM_MEMBER.MBR_NBR (yet another alias).
-- ============================================================
CREATE TABLE PRISM_CONTRIB_HIST (
    CTRIB_SEQ       INT          NOT NULL,
    MBR_ID          INT          NOT NULL,   -- = PRISM_MEMBER.MBR_NBR. Fifth column name for same key.
    CONTRIB_PRD     DATE         NOT NULL,   -- First day of contribution period (month)
    EE_CONTRIB_AMT  NUMERIC(10,2) NOT NULL,  -- Employee contribution
    ER_CONTRIB_AMT  NUMERIC(10,2) NULL,      -- Employer matching/contribution
    CONTRIB_RATE    NUMERIC(5,4) NULL,
    PENSION_SAL_BS  NUMERIC(12,2) NULL,      -- Pensionable salary basis for this period
    INT_AMT         NUMERIC(8,2) NULL,       -- Interest for DC plans. NULL for pure DB plans.
    CONTRIB_SRC_CD  CHAR(4)      NULL,       -- 'PAYRL'=from payroll,'MANUAL'=manual entry,'ADJST'=adjustment
    POSTED_DT       DATE         NULL,
    CONSTRAINT PK_PRISM_CONTRIB_HIST PRIMARY KEY (CTRIB_SEQ)
);

-- ============================================================
-- TABLE 10: PRISM_BENEFIT_CALC
-- Stored benefit calculations. The source-of-truth for
-- reconciliation: NoUI's rules engine output should match
-- CALC_RESULT for each member.
-- CALC_TYPE overloaded: R=retirement, E=estimate, D=disability,
-- S=survivor, Q=QDRO offset, A=actuarial valuation.
-- ============================================================
CREATE TABLE PRISM_BENEFIT_CALC (
    CALC_ID         INT          NOT NULL,
    MBR_NBR         INT          NOT NULL,   -- Joins to PRISM_MEMBER.MBR_NBR
    CALC_DT         TIMESTAMP    NOT NULL,   -- When calculation was run
    CALC_TYPE       CHAR(1)      NOT NULL,   -- OVERLOADED: R=retirement,E=estimate,D=disability,S=survivor,Q=QDRO,A=actuarial
    AS_OF_DT        DATE         NOT NULL,   -- Calculation as-of date (e.g. retirement date)
    CALC_STATUS     CHAR(1)      NULL,       -- 'C'=current/active,'S'=superseded,'V'=voided
    -- Inputs (snapshot at time of calculation)
    YOS_USED        NUMERIC(8,4) NULL,       -- Years of service used
    FAS_USED        NUMERIC(12,2) NULL,      -- Final average salary used
    FAS_PERIOD_MO   SMALLINT     NULL,       -- FAS averaging period in months (36 or 60)
    AGE_AT_CALC     NUMERIC(6,3) NULL,       -- Member age at as-of date
    RET_TYPE_CD     CHAR(3)      NULL,       -- 'NRM'=normal,'ERY'=early,'DSB'=disability,'SRV'=survivor
    -- Outputs
    GROSS_BENEFIT   NUMERIC(12,2) NULL,      -- Monthly gross benefit before deductions
    CALC_RESULT     NUMERIC(12,2) NULL,      -- Final monthly benefit amount (after all adjustments)
    ERY_REDUCTION   NUMERIC(6,4) NULL,       -- Early retirement reduction factor applied
    OPT_FORM_CD     VARCHAR(6)   NULL,       -- Payment form selected (life-only, J&S 50%, etc.)
    OPT_FORM_FACTOR NUMERIC(8,6) NULL,       -- Actuarial factor for payment form
    -- Audit
    CALC_BY_USR     VARCHAR(20)  NULL,
    APPROVED_BY     VARCHAR(20)  NULL,
    APPROVED_DT     DATE         NULL,
    OVERRIDE_FLG    CHAR(1)      NULL,       -- 'Y' if manual override applied. 'Y' cases need human review.
    OVERRIDE_NOTE   VARCHAR(300) NULL,
    CONSTRAINT PK_PRISM_BENEFIT_CALC PRIMARY KEY (CALC_ID)
);

-- ============================================================
-- TABLE 11: PRISM_PMT_SCHEDULE
-- Payment schedule header. One per active payment stream.
-- A member can have multiple schedules (e.g. pension + QDRO offset).
-- ============================================================
CREATE TABLE PRISM_PMT_SCHEDULE (
    PMT_SCHED_ID    INT          NOT NULL,
    MBR_NBR         INT          NOT NULL,   -- Joins to PRISM_MEMBER.MBR_NBR
    SCHED_TYP       CHAR(4)      NULL,       -- 'REGR'=regular pension,'QDRO'=QDRO offset,'DISB'=disability,'SURV'=survivor
    EFF_DT          DATE         NOT NULL,   -- First payment date
    END_DT          DATE         NULL,       -- NULL = ongoing
    MONTHLY_AMT     NUMERIC(12,2) NOT NULL,  -- Base monthly amount (before COLA etc.)
    PAY_FREQ_CD     CHAR(2)      NULL,       -- 'MO'=monthly (default),'BW'=biweekly (rare legacy)
    PMT_METHOD      CHAR(3)      NULL,       -- 'ACH'=direct deposit,'CHK'=paper check,'WIR'=wire
    BANK_ABA        CHAR(9)      NULL,       -- Routing number. In clear text. Not encrypted.
    BANK_ACCT       VARCHAR(17)  NULL,       -- Account number. In clear text. Not encrypted.
    ACCT_TYP        CHAR(1)      NULL,       -- 'C'=checking,'S'=savings
    TAX_ELECT_FED   NUMERIC(5,2) NULL,       -- Federal withholding amount or rate
    TAX_ELECT_STE   NUMERIC(5,2) NULL,       -- State withholding
    COLA_ELIGIBLE   CHAR(1)      NULL,       -- 'Y'/'N'. NULL assumed 'Y'.
    LINKED_CALC_ID  INT          NULL,       -- References PRISM_BENEFIT_CALC.CALC_ID. No FK.
    CONSTRAINT PK_PRISM_PMT_SCHEDULE PRIMARY KEY (PMT_SCHED_ID)
);

-- ============================================================
-- TABLE 12: PRISM_PMT_HIST
-- Actual payment history. One row per payment issued.
-- PMT_STATUS overloaded pre/post 2005:
--   Pre-2005: 'C' = cleared by bank (paid successfully)
--   Post-2005: 'C' = cancelled (not paid)
--   'I'=issued always means sent; 'P'=pending always means not yet sent
-- ============================================================
CREATE TABLE PRISM_PMT_HIST (
    PMT_HIST_ID     INT          NOT NULL,
    PMT_SCHED_ID    INT          NOT NULL,   -- References PRISM_PMT_SCHEDULE.PMT_SCHED_ID. No FK.
    MBR_NBR         INT          NOT NULL,   -- Denormalized from schedule. Inconsistencies exist.
    PAY_PRD_DT      DATE         NOT NULL,   -- Period this payment covers (first of month typically)
    PMT_DT          DATE         NULL,       -- Date payment was issued/sent
    GROSS_AMT       NUMERIC(12,2) NOT NULL,  -- Gross amount before taxes
    FED_TAX_WH      NUMERIC(10,2) NULL,
    STE_TAX_WH      NUMERIC(10,2) NULL,
    NET_AMT         NUMERIC(12,2) NOT NULL,  -- Net amount paid
    PMT_STATUS      CHAR(1)      NOT NULL,   -- OVERLOADED pre/post 2005. 'P','I','C','R','V'
                                             -- Pre-2005: C=cleared(success). Post-2005: C=cancelled.
    PMT_METHOD      CHAR(3)      NULL,
    CHECK_NBR       VARCHAR(10)  NULL,       -- Check number if CHK method
    ACH_TRACE       VARCHAR(15)  NULL,       -- ACH trace number if ACH method
    COLA_AMT        NUMERIC(10,2) NULL,      -- COLA component included in GROSS_AMT
    RETURN_RSN_CD   VARCHAR(4)   NULL,       -- If PMT_STATUS='R': return reason code
    CONSTRAINT PK_PRISM_PMT_HIST PRIMARY KEY (PMT_HIST_ID)
);

-- ============================================================
-- TABLE 13: PRISM_BENEFICIARY
-- Beneficiary designations AND QDRO alternate payees.
-- Overloaded: BENE_TYP_CD includes both beneficiary types
-- and QDRO payee type. QDRO details also in PRISM_QDRO.
-- Duplicate/inconsistent data between the two tables is common.
-- ============================================================
CREATE TABLE PRISM_BENEFICIARY (
    BENE_ID         INT          NOT NULL,
    MBR_NBR         INT          NOT NULL,   -- Member this designation is for
    BENE_TYP_CD     VARCHAR(4)   NOT NULL,   -- 'PRIM'=primary bene,'CONT'=contingent,'SP'=spouse,
                                             -- 'CHLD'=child,'OTHR'=other person,'TRST'=trust,
                                             -- 'QDRO'=QDRO alternate payee (OVERLOADED -- not a beneficiary)
    LAST_NM         VARCHAR(40)  NULL,       -- NULL if TRST type
    FIRST_NM        VARCHAR(30)  NULL,
    TRUST_NM        VARCHAR(80)  NULL,       -- NULL if not TRST type
    NATL_ID         VARCHAR(11)  NULL,       -- Beneficiary SSN. Often blank.
    BIRTH_DT        VARCHAR(8)   NULL,       -- Same format chaos as PRISM_MEMBER.BIRTH_DT
    RELATIONSHIP    VARCHAR(20)  NULL,       -- Free text. Not coded. Values: 'spouse','wife','husband','child','son','daughter','partner'...
    SHARE_PCT       NUMERIC(5,2) NULL,       -- Percentage share (should sum to 100 per member per type)
    EFF_DT          DATE         NULL,
    REVOC_FLG       CHAR(1)      NULL,       -- 'Y'=irrevocable (QDRO-related usually). 'N' or NULL = revocable.
    QDRO_ORD_NBR    VARCHAR(20)  NULL,       -- If BENE_TYP_CD='QDRO': court order number
    QDRO_SHARE_TYP  CHAR(4)      NULL,       -- If QDRO: 'PCTG'=percentage,'DLRM'=dollar,'OFST'=offset
    CONSTRAINT PK_PRISM_BENEFICIARY PRIMARY KEY (BENE_ID)
);

-- ============================================================
-- TABLE 14: PRISM_QDRO
-- Qualified Domestic Relations Orders.
-- Some QDROs also appear as BENE_TYP_CD='QDRO' in PRISM_BENEFICIARY.
-- Join logic: PRISM_QDRO.ORD_NBR = PRISM_BENEFICIARY.QDRO_ORD_NBR
-- BUT not all QDROs have a PRISM_BENEFICIARY record (data gap).
-- ============================================================
CREATE TABLE PRISM_QDRO (
    QDRO_ID         INT          NOT NULL,
    MBR_NBR         INT          NOT NULL,   -- Member (participant) this QDRO applies to
    ORD_NBR         VARCHAR(20)  NOT NULL,   -- Court order number
    ORD_DT          DATE         NULL,       -- Date of court order
    ORD_STATUS      CHAR(1)      NULL,       -- 'P'=pending review,'Q'=qualified,'R'=rejected,'W'=withdrawn
    AP_LAST_NM      VARCHAR(40)  NULL,       -- Alternate payee last name
    AP_FIRST_NM     VARCHAR(30)  NULL,
    AP_NATL_ID      VARCHAR(11)  NULL,
    AP_BIRTH_DT     VARCHAR(8)   NULL,
    SHARE_TYP       CHAR(4)      NULL,       -- 'PCTG','DLRM','OFST'
    SHARE_AMT       NUMERIC(10,4) NULL,      -- Percentage (0-100) or dollar amount depending on SHARE_TYP
    SHARE_EFF_DT    DATE         NULL,
    PMT_START_DT    DATE         NULL,       -- When alternate payee payments begin
    PMT_END_DT      DATE         NULL,       -- NULL = until member death or remarriage (varies by order)
    LINKED_PMT_SCHED INT         NULL,       -- References PRISM_PMT_SCHEDULE.PMT_SCHED_ID. No FK.
    CONSTRAINT PK_PRISM_QDRO PRIMARY KEY (QDRO_ID)
);

-- ============================================================
-- TABLE 15: PRISM_DISABILITY
-- Disability pension records. Members on disability status
-- have STATUS_CD='DI' in PRISM_MEMBER (post-1998 only).
-- ============================================================
CREATE TABLE PRISM_DISABILITY (
    DISB_ID         INT          NOT NULL,
    MBR_NBR         INT          NOT NULL,
    DISB_EFF_DT     DATE         NULL,       -- Disability effective date
    DISB_TYP_CD     CHAR(4)      NULL,       -- 'OCCUP'=occupational,'NON_O'=non-occupational,'PART'=partial
    DISB_STATUS     CHAR(1)      NULL,       -- 'A'=active,'R'=recovery,'T'=terminated
    DISB_BENEFIT    NUMERIC(12,2) NULL,      -- Monthly disability benefit amount
    DISB_PCT        NUMERIC(5,2) NULL,       -- Disability percentage (if PART type)
    RTW_DT          DATE         NULL,       -- Return to work date (if recovered)
    CERT_EXP_DT     DATE         NULL,       -- Medical certification expiration date
    INS_CARRIER     VARCHAR(40)  NULL,       -- If covered by external disability insurance carrier
    CONSTRAINT PK_PRISM_DISABILITY PRIMARY KEY (DISB_ID)
);

-- ============================================================
-- TABLE 16: PRISM_PLAN_PARAMS
-- Plan parameters/rules. Effective-dated but with GAPS.
-- Gaps between effective date ranges are common -- meaning
-- the prior record's rules applied until the next takes effect,
-- but this is not explicitly recorded.
-- ============================================================
CREATE TABLE PRISM_PLAN_PARAMS (
    PARAM_ID        INT          NOT NULL,
    PLAN_CD         VARCHAR(10)  NOT NULL,   -- References PRISM_MISC_CODES TYPE_CD='PLAN'. No FK.
    EFF_DT          DATE         NOT NULL,
    END_DT          DATE         NULL,       -- NULL = current. But see note about gaps.
    BENEFIT_MULT    NUMERIC(6,4) NULL,       -- Benefit multiplier (e.g. 0.0200 = 2.0%)
    NRM_RET_AGE     NUMERIC(4,1) NULL,       -- Normal retirement age (e.g. 65.0)
    ERY_RET_AGE     NUMERIC(4,1) NULL,       -- Earliest early retirement age (e.g. 55.0)
    ERY_PENALTY_RT  NUMERIC(6,4) NULL,       -- Early retirement reduction per year (e.g. 0.06 = 6%)
    ERY_MAX_PEN     NUMERIC(6,4) NULL,       -- Maximum early retirement penalty (e.g. 0.30 = 30%)
    FAS_PERIOD_MO   SMALLINT     NULL,       -- FAS averaging period in months (36 or 60)
    MAX_BENEFIT_PCT NUMERIC(5,4) NULL,       -- Max benefit as % of FAS (e.g. 0.75 = 75%)
    MIN_BENEFIT_AMT NUMERIC(10,2) NULL,      -- Minimum monthly benefit floor ($)
    VESTING_YRS     NUMERIC(4,1) NULL,       -- Years to full vesting
    CONTRIB_RATE_EE NUMERIC(6,4) NULL,       -- Employee contribution rate
    CONTRIB_RATE_ER NUMERIC(6,4) NULL,       -- Employer contribution rate
    COLA_CAP_PCT    NUMERIC(5,4) NULL,       -- COLA cap (e.g. 0.03 = 3%)
    CONSTRAINT PK_PRISM_PLAN_PARAMS PRIMARY KEY (PARAM_ID)
);

-- ============================================================
-- TABLE 17: PRISM_EMPR_LIST
-- Employer registry. Relatively clean table.
-- ============================================================
CREATE TABLE PRISM_EMPR_LIST (
    EMPR_CD         VARCHAR(8)   NOT NULL,
    EMPR_NM         VARCHAR(80)  NOT NULL,
    EMPR_TYP_CD     VARCHAR(4)   NULL,       -- 'MUNI'=municipal,'CNTY'=county,'SCHL'=school,'SPEC'=special district
    EMPR_STATUS     CHAR(1)      NULL,       -- 'A'=active,'I'=inactive,'M'=merged
    MERGED_INTO     VARCHAR(8)   NULL,       -- If STATUS='M': the EMPR_CD merged into
    JOIN_DT         DATE         NULL,       -- Date employer joined the plan
    LEAVE_DT        DATE         NULL,
    CONTRIB_RATE    NUMERIC(6,4) NULL,       -- Employer contribution rate (may differ from plan default)
    EIN             VARCHAR(11)  NULL,       -- Employer Identification Number
    CONTACT_NM      VARCHAR(60)  NULL,
    CONTACT_EMAIL   VARCHAR(80)  NULL,
    CONSTRAINT PK_PRISM_EMPR_LIST PRIMARY KEY (EMPR_CD)
);

-- ============================================================
-- TABLE 18: PRISM_MISC_CODES
-- Master code/lookup table. Single table for ALL code types.
-- TYPE_CD determines the domain. A single application join
-- requires knowing TYPE_CD -- no separate lookup tables exist.
-- TYPE_CD values: STAT, PLAN, JOBCL, TRSN, EVNT, DOCTP, PMTM,
--                 OPTF (payment option forms), BNET (bene types),
--                 DISBT, COLAT, TAXST, HLTH (health plan -- wrong table)
-- ============================================================
CREATE TABLE PRISM_MISC_CODES (
    CODE_TYPE       VARCHAR(8)   NOT NULL,
    CODE_VAL        VARCHAR(10)  NOT NULL,
    CODE_DESC       VARCHAR(80)  NOT NULL,
    SHORT_DESC      VARCHAR(20)  NULL,
    EFF_DT          DATE         NULL,
    END_DT          DATE         NULL,       -- NULL = current (but old codes rarely end-dated)
    SORT_SEQ        SMALLINT     NULL,
    NOTES           VARCHAR(200) NULL,
    CONSTRAINT PK_PRISM_MISC_CODES PRIMARY KEY (CODE_TYPE, CODE_VAL)
);

-- ============================================================
-- TABLE 19: PRISM_NOTES
-- Free-text notes attached to member records.
-- Contains significant institutional knowledge in unstructured form.
-- NOTE_TYP_CD: 'GENRL','MIGRT'=migration note,'CALC'=calculation note,
--              'EXCP'=exception,'CORR'=correction,'LGCY'=legacy system note
-- ============================================================
CREATE TABLE PRISM_NOTES (
    NOTE_ID         INT          NOT NULL,
    MBR_NBR         INT          NOT NULL,
    NOTE_DT         TIMESTAMP    NOT NULL,
    NOTE_TYP_CD     VARCHAR(5)   NULL,
    NOTE_TEXT       VARCHAR(2000) NOT NULL,  -- Free text. Contains embedded field names, dollar amounts, dates.
    ENTERED_BY      VARCHAR(20)  NULL,
    CONSTRAINT PK_PRISM_NOTES PRIMARY KEY (NOTE_ID)
);

-- ============================================================
-- TABLE 20: PRISM_LIFE_EVENTS
-- Life events that trigger plan changes.
-- EVENT_TYP_CD references PRISM_MISC_CODES TYPE_CD='EVNT'
-- but the values have evolved and some are unmapped.
-- ============================================================
CREATE TABLE PRISM_LIFE_EVENTS (
    EVENT_ID        INT          NOT NULL,
    MBR_NBR         INT          NOT NULL,
    EVENT_DT        DATE         NOT NULL,
    EVENT_TYP_CD    VARCHAR(6)   NOT NULL,   -- 'HIRE','TERM','REHIR','RETIR','DEATH','MARR','DIVORC',
                                             -- 'DISB_ON','DISB_OFF','QDRO_IN','QDRO_OUT','BENE_CHG',
                                             -- 'ADDR_CHG','NAME_CHG','PLAN_CHG','SVC_ADJ','COLA_ADJ'
    EVENT_STATUS    CHAR(1)      NULL,       -- 'P'=pending,'C'=complete,'V'=voided
    EFF_DT          DATE         NULL,       -- When event takes effect (may differ from EVENT_DT)
    RELATED_ID      INT          NULL,       -- Related record ID (context-dependent -- could be CALC_ID, QDRO_ID, etc.)
    RELATED_TBL     VARCHAR(20)  NULL,       -- Table for RELATED_ID (e.g. 'PRISM_QDRO'). Unreliable.
    NOTES           VARCHAR(400) NULL,
    PROC_BY         VARCHAR(20)  NULL,
    PROC_DT         TIMESTAMP    NULL,
    CONSTRAINT PK_PRISM_LIFE_EVENTS PRIMARY KEY (EVENT_ID)
);

-- ============================================================
-- TABLE 21: PRISM_COLA_HIST
-- COLA adjustment history. One row per COLA event per member.
-- Separate from PMT_HIST but should reconcile with it.
-- ============================================================
CREATE TABLE PRISM_COLA_HIST (
    COLA_ID         INT          NOT NULL,
    MBR_NBR         INT          NOT NULL,
    COLA_EFF_DT     DATE         NOT NULL,   -- Effective date (always Jan 1)
    PRE_COLA_AMT    NUMERIC(12,2) NOT NULL,  -- Monthly amount before COLA
    COLA_RATE_APPL  NUMERIC(6,4) NULL,       -- Rate actually applied (may be less than CPI due to cap)
    CPI_RATE        NUMERIC(6,4) NULL,       -- CPI rate for the period
    BANKED_RATE     NUMERIC(6,4) NULL,       -- Rate banked for future (if CPI > cap)
    POST_COLA_AMT   NUMERIC(12,2) NOT NULL,  -- Monthly amount after COLA
    CONSTRAINT PK_PRISM_COLA_HIST PRIMARY KEY (COLA_ID)
);

-- ============================================================
-- REPRESENTATIVE DATA FOR PRISM_MISC_CODES (STATUS codes)
-- Shows the evolution problem: same CODE_TYPE, same CODE_VAL,
-- different meanings over time. No temporal tracking in this table.
-- ============================================================
INSERT INTO PRISM_MISC_CODES VALUES ('STAT','A','Active',             'Active',    '1991-01-01',NULL,1,'Pre-2008: also includes active-on-leave');
INSERT INTO PRISM_MISC_CODES VALUES ('STAT','I','Inactive/Terminated','Inactive',  '1991-01-01',NULL,2,NULL);
INSERT INTO PRISM_MISC_CODES VALUES ('STAT','R','Retired',            'Retired',   '1991-01-01',NULL,3,NULL);
INSERT INTO PRISM_MISC_CODES VALUES ('STAT','D','Deceased',           'Deceased',  '1998-01-01',NULL,4,'Added at OPUS migration');
INSERT INTO PRISM_MISC_CODES VALUES ('STAT','DI','Disability Retired','Disability','1998-01-01',NULL,5,'Added at OPUS migration');
INSERT INTO PRISM_MISC_CODES VALUES ('STAT','AL','Active - On Leave', 'On Leave',  '2008-07-01',NULL,6,'Split from A in Plan Amendment #31');
INSERT INTO PRISM_MISC_CODES VALUES ('STAT','SU','Suspended',         'Suspended', '2008-07-01',NULL,7,NULL);
INSERT INTO PRISM_MISC_CODES VALUES ('STAT','DE','Deferred Vested',   'Deferred',  '2008-07-01',NULL,8,NULL);

-- ============================================================
-- END OF PRISM SCHEMA DDL
-- ============================================================
-- SUMMARY OF EMBEDDED PROBLEMS FOR MAPPING SIMULATION:
--
-- [P-01] MEMBER KEY ALIASES: MBR_NBR / EMPL_ID / EMP_NBR / EMP_ID / MBR_ID
--        Five different column names for the same logical identifier.
--        Signal: cardinality ~5000, integer, non-null.
--
-- [P-02] BIRTH_DT FORMAT CHAOS: YYYYMMDD (post-1998) vs MMDDYYYY (pre-1998)
--        VARCHAR(8), ~15% have wrong format. Detection: century-boundary test.
--
-- [P-03] NATL_ID FORMAT CHAOS: XXX-XX-XXXX (pre-2001) vs XXXXXXXXX (post-2001)
--        Regex: ^[0-9]{3}-[0-9]{2}-[0-9]{4}$ catches dashes; length=11 vs 9.
--
-- [P-04] STATUS_CD OVERLOAD: 3 semantic epochs. Pre-1998 'A' includes leave.
--        Detection: value set shift in records before/after 1998-01-01.
--
-- [P-05] PMT_STATUS OVERLOAD: 'C' means opposite things pre/post 2005-01-01.
--        Detection: temporal distribution of 'C' values around 2005 boundary.
--
-- [P-06] 1998 MIGRATION BOUNDARY: salary and contrib data split across tables.
--        PRISM_SAL_ANNUAL (annual, pre-1998) + PRISM_SAL_PERIOD (per-period, post-1998).
--        PRISM_CONTRIB_LEGACY (annual, pre-1998) + PRISM_CONTRIB_HIST (monthly, post-1998).
--        Detection: LOAD_DT='1998-01-15' and LOAD_SRC='OPUS_MIGRATION' on legacy tables.
--        Also: PRISM_MEMBER.ORIG_SYS='OPUS' for affected members.
--
-- [P-07] SVC_CREDIT BALANCE NOT DETAIL: SVC_CR_BAL is a running total.
--        Period-level service credit history UNRECOVERABLE for pre-1998.
--        Detection: AS_OF_DT clustering around 1998-01-01.
--
-- [P-08] BENEFICIARY/QDRO OVERLAP: PRISM_BENEFICIARY BENE_TYP_CD='QDRO' + PRISM_QDRO.
--        Both tables may have records for same order. ORD_NBR is the join key.
--        Some PRISM_QDRO records have no PRISM_BENEFICIARY record and vice versa.
--
-- [P-09] CONTRIB DOUBLE-COUNTING: PRISM_SAL_ANNUAL.CONTRIB_AMT AND PRISM_CONTRIB_LEGACY.EE_CONTRIB
--        may both contain pre-1998 contribution data. DO NOT SUM BOTH.
--
-- [P-10] ADDRESS CONFLICT: Embedded address in PRISM_MEMBER vs PRISM_MEMBER_ADDR history.
--        Current address may differ between sources. PRISM_MEMBER updated in-place.
--
-- [P-11] HIRE_DT vs SPELL_START: PRISM_MEMBER.HIRE_DT = career original hire.
--        PRISM_EMP_SPELL.SPELL_START = start of this employment spell.
--        These differ for rehired members. Both are VARCHAR with mixed formats.
--
-- [P-12] PRISM_MISC_CODES overload: 13+ different TYPE_CD domains in one table.
--        Every lookup requires TYPE_CD filter. Many join paths are not obvious.
--        Also contains 'HLTH' (health plan) codes -- wrong table, legacy accident.
-- ============================================================
