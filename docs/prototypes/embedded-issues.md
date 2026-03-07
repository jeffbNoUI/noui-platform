# Deliberate Data Quality Issues — Embedded in Seed Data

## Purpose
These issues are intentionally embedded in the generated data to demonstrate
the NoUI Data Quality Engine's ability to detect real-world database problems.

## Issue Catalog

### DQ-001: Active Members with Termination Date (12 members)
- **Pattern:** STATUS_CD = 'A' but TERM_DT is populated
- **Real-world cause:** Status not updated after separation, or separation reversed but date not cleared
- **Severity:** High — could affect benefit eligibility calculations
- **Detection:** `SELECT * FROM MEMBER_MASTER WHERE STATUS_CD = 'A' AND TERM_DT IS NOT NULL`

### DQ-002: Salary History Gaps (8 members)
- **Pattern:** Missing 2-4 consecutive pay periods in SALARY_HIST
- **Real-world cause:** Payroll errors, LOA not recorded, migration data loss
- **Severity:** High — could affect AMS calculation if gap falls within the AMS window
- **Detection:** Compare expected pay period count vs actual for each member's employment span

### DQ-003: Contribution Balance Mismatches (3 members)
- **Pattern:** Cumulative EMPL_BAL doesn't match sum of individual EMPL_CONTRIB records
- **Real-world cause:** Rounding errors accumulated over decades, manual corrections without balance update
- **Severity:** Medium — affects refund calculations for non-vested members
- **Detection:** `SUM(EMPL_CONTRIB) != MAX(EMPL_BAL)` for last record per member

### DQ-004: Beneficiary Allocation Errors (5 members)
- **Pattern:** ALLOC_PCT for active beneficiaries totals more than 100%
- **Real-world cause:** New beneficiary added without adjusting existing, data entry error
- **Severity:** Medium — ambiguous benefit distribution
- **Detection:** `SUM(ALLOC_PCT) WHERE STATUS_CD = 'A' GROUP BY MBR_ID HAVING SUM != 100`

### DQ-005: Incorrect Benefit Payment Amounts (2 retired members)
- **Pattern:** GROSS_BENEFIT is 5-15% higher than formula should produce
- **Real-world cause:** Manual override, formula error, COLA applied incorrectly
- **Severity:** High — financial overpayment or underpayment
- **Detection:** Re-run benefit calculation from source data, compare to stored payment

### DQ-006: Tier Boundary Misclassification (15 members)
- **Pattern:** TIER_CD doesn't match what HIRE_DT determines
- **Real-world cause:** Manual tier assignment errors near boundary dates
- **Severity:** Critical — wrong formula, wrong eligibility, wrong benefit amount
- **Detection:** Compare TIER_CD to computed tier from HIRE_DT

## Expected Data Quality Engine Behavior

For each issue, the engine should:
1. Identify the specific member(s) affected
2. Describe the discrepancy with evidence
3. Propose a correction with confidence level
4. Reference the applicable business rule
5. Present for human review (Phase 1 — no auto-resolve)
