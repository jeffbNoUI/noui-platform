# Pension Concepts + Cross-Domain Signal Broadening

**Date:** 2026-03-06
**Session:** Session 11

## Goal

Add 6 pension-specific concept definitions to the tagger and broaden 3 existing HR concepts so they cross-tag pension equivalents. Proves cross-domain generalization of the signal-based approach.

## Part 1: Broaden 3 Existing HR Concepts

### employee-master

The existing signals are ERPNext-specific. MEMBER_MASTER (pension equivalent) has abbreviated column names (DOB, HIRE_DT, STATUS_CD, DEPT_CD) and uses "member" instead of "employee".

Changes:
- `table_name:employee_core` — add "member" to include list; add "beneficiary", "payment", "credit", "case", "transaction", "dro", "contrib", "svc" to exclude list
- `columns:identity` — add "dob" pattern
- `columns:employment_status` — add "hire_dt", "status_cd", "term_date" patterns
- `columns:org_structure` — add "dept_cd", "pos_cd" patterns

### salary-history

SALARY_HIST has GROSS_PAY but not net_pay/total_deduction. Uses ANNUAL_SALARY, PENSIONABLE_PAY, OT_PAY.

Changes:
- `columns:compensation` — add "annual_salary", "pensionable_pay", "ot_pay"
- `columns:monetary_pair` — add "deduct" to deduction side (catches FURLOUGH_DEDUCT)
- `link:employee` — add "member" to link patterns
- `table_name:salary` — already matches "salary" in SALARY_HIST

### employment-timeline

EMPLOYMENT_HIST has EVENT_TYPE, EVENT_DT, SEPARATION_CD but not promotion_date/transfer_date style columns.

Changes:
- `table_name:lifecycle` — add "employment_hist"
- `columns:lifecycle_date` — add "event_dt", "event_type", "separation_cd"
- `link:employee` — add "member" to link patterns

## Part 2: 6 New Pension Concepts

### beneficiary-designation (threshold 3.0)

Target: BENEFICIARY table. Signals:
- table_name: "beneficiary", "bene" (weight 1.5)
- columns: relationship, alloc_pct/percentage/share/allocation (weight 1.5)
- columns: eff_dt + end_dt/superseded_by pattern (weight 0.5)
- link: member/employee (weight 0.5)

### service-credit (threshold 3.0)

Target: SVC_CREDIT table. Signals:
- table_name: "svc_credit", "service_credit", "service" (weight 1.5)
- columns: years_credited/credit_years/service_years/months_credited (weight 1.5)
- columns: credit_type (weight 1.0)
- date range pattern (weight 0.5)
- link: member/employee (weight 0.5)

### domestic-relations-order (threshold 3.0)

Target: DRO_MASTER table. Signals:
- table_name: "dro" (weight 1.5)
- columns: court_order + alt_payee/alternate_payee pair (weight 1.5)
- columns: divorce/marriage dates (weight 1.0)
- columns: division_method/division_value (weight 0.5)
- link: member/employee (weight 0.5)

### benefit-payment (threshold 3.0)

Target: BENEFIT_PAYMENT table. Signals:
- table_name: "benefit_payment" (exclude "benefit_claim", "benefit_application") (weight 1.5)
- columns: payment_type, gross_monthly/net_payment (weight 1.5)
- high decimal ratio (weight 1.0)
- columns: last_paid_dt/payment_date (weight 0.5)
- link: member/employee (weight 0.5)

### case-management (threshold 3.0)

Target: CASE_HIST table. Signals:
- table_name: "case" (weight 1.5)
- columns: case_type + case_status pair (weight 1.5)
- columns: assigned_to, resolution (weight 1.0)
- columns: priority, open_dt/close_dt (weight 0.5)
- link: member/employee (weight 0.5)

### audit-trail (threshold 3.0)

Target: TRANSACTION_LOG table. Signals:
- table_name: "transaction_log", "audit_log", "audit_trail" (weight 1.5)
- columns: action + old_value/new_value pair (weight 1.5)
- columns: changed_by/performed_by (weight 1.0)
- columns: table_name/record_id (referencing what was changed) (weight 0.5)

## Part 3: Signal Helpers

No new signal functions needed. All concepts composed from existing helpers:
- columnsMatching, hasColumnPair, tableNameContains, tableNameContainsButNot
- decimalColumnRatio, fkReferencesTableLike, hasColumnLinkToTableLike, hasDateRangePattern

## Part 4: Testing

- Unit test per new concept (synthetic table matching DERP schema structure)
- Cross-domain tests (MEMBER_MASTER -> employee-master, SALARY_HIST -> salary-history, EMPLOYMENT_HIST -> employment-timeline)
- Regression: all 16 existing tests pass unchanged
- E2E: service against DERP DB (port 5432) and PostgreSQL HR target (port 5433)

## Expected Results

After changes, total concepts: 18 (12 existing + 6 new).
Expected tagging against DERP schema (12 tables):
- MEMBER_MASTER -> employee-master
- SALARY_HIST -> salary-history
- EMPLOYMENT_HIST -> employment-timeline
- BENEFICIARY -> beneficiary-designation
- SVC_CREDIT -> service-credit
- DRO_MASTER -> domestic-relations-order
- BENEFIT_PAYMENT -> benefit-payment
- CASE_HIST -> case-management
- TRANSACTION_LOG -> audit-trail
- CONTRIBUTION_HIST -> (possibly salary-history if signals overlap)
- DEPARTMENT_REF, POSITION_REF -> no tags (reference tables)
