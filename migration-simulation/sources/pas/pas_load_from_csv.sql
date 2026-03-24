-- PostgreSQL load script for PAS scenario CSVs
-- Usage example from psql:
--   \set data_dir '/absolute/path/to/pas_seed_output'
--   \i pas_load_from_csv.sql
--
-- Assumes your source schema from pas_simulation_source_model.sql already exists.
-- Adjust schema/table names below if needed.

\echo 'Starting PAS CSV load'
\if :{?data_dir}
\else
  \echo 'ERROR: set data_dir before running this script.'
  \quit
\endif

BEGIN;

TRUNCATE TABLE
    recon.reconciliation_evidence,
    recon.reconciliation_result,
    recon.legacy_calculation_snapshot,
    src_pas.data_quality_issue,
    src_pas.migration_boundary_inference,
    src_pas.benefit_payment,
    src_pas.retirement_award,
    src_pas.case_management,
    src_pas.domestic_relations_order,
    src_pas.beneficiary,
    src_pas.service_credit_history,
    src_pas.contribution_history,
    src_pas.salary_component,
    src_pas.salary_history,
    src_pas.payroll_period,
    src_pas.employment_segment,
    src_pas.member
RESTART IDENTITY CASCADE;

\copy src_pas.member (
    member_id, legacy_member_no, ssn, first_name, last_name, middle_name,
    birth_date, gender_code, status_code, member_tier, email, phone,
    address_line_1, city, state, postal_code, original_hire_date,
    termination_date, deceased_flag, source_system
) FROM :'data_dir'/member.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy src_pas.employment_segment (
    employment_segment_id, member_id, employer_id, employer_name, segment_start,
    segment_end, job_class_code, job_title, employment_status_code, fte,
    annualized_salary, union_code, location_code, is_estimated, source_record_ref
) FROM :'data_dir'/employment_segment.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy src_pas.payroll_period (
    payroll_period_id, employer_id, period_start, period_end, check_date,
    pay_frequency, tax_year, period_seq
) FROM :'data_dir'/payroll_period.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy src_pas.salary_history (
    salary_id, member_id, employment_segment_id, payroll_period_id, earned_start,
    earned_end, salary_amount, base_hours, salary_type_code, summarized_flag,
    estimated_flag, source_record_ref, granularity
) FROM :'data_dir'/salary_history.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy src_pas.salary_component (
    salary_component_id, salary_id, component_code, component_amount, taxable_flag
) FROM :'data_dir'/salary_component.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy src_pas.contribution_history (
    contribution_id, member_id, salary_id, employee_contribution, employer_contribution,
    contribution_rate, running_balance, expected_running_balance, balance_match_flag,
    source_record_ref
) FROM :'data_dir'/contribution_history.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy src_pas.service_credit_history (
    service_credit_id, member_id, salary_id, service_units, service_unit_type,
    credited_service_years, summarized_flag, estimated_flag, source_record_ref
) FROM :'data_dir'/service_credit_history.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy src_pas.beneficiary (
    beneficiary_id, member_id, beneficiary_name, relationship_code, allocation_pct,
    primary_flag, ssn, birth_date, status_code
) FROM :'data_dir'/beneficiary.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy src_pas.domestic_relations_order (
    dro_id, member_id, alternate_payee_name, order_type, effective_date,
    allocation_method, allocation_value, status_code, case_no
) FROM :'data_dir'/domestic_relations_order.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy src_pas.case_management (
    case_id, member_id, case_type, opened_date, closed_date, status_code,
    priority_code, assigned_team, notes
) FROM :'data_dir'/case_management.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy src_pas.retirement_award (
    award_id, member_id, retirement_type, retirement_date, final_avg_salary,
    service_years, benefit_amount, option_code, cola_flag, legacy_status
) FROM :'data_dir'/retirement_award.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy src_pas.benefit_payment (
    payment_id, award_id, member_id, payment_date, gross_amount, net_amount,
    tax_withholding, payment_status, source_record_ref
) FROM :'data_dir'/benefit_payment.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy src_pas.migration_boundary_inference (
    boundary_id, member_id, domain_name, boundary_date, confidence_score,
    detection_signal, notes
) FROM :'data_dir'/migration_boundary_inference.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy recon.legacy_calculation_snapshot (
    snapshot_id, member_id, calc_name, as_of_date, legacy_value, recomputed_value,
    variance_amount, variance_pct, legacy_formula_version, target_formula_version
) FROM :'data_dir'/legacy_calculation_snapshot.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy recon.reconciliation_result (
    recon_id, member_id, calc_name, recon_status, variance_amount, suspected_domain,
    systematic_flag, notes
) FROM :'data_dir'/reconciliation_result.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy recon.reconciliation_evidence (
    evidence_id, recon_id, signal_type, signal_strength, evidence_text
) FROM :'data_dir'/reconciliation_evidence.csv WITH (FORMAT csv, HEADER true, NULL '');

\copy src_pas.data_quality_issue (
    issue_id, table_name, record_key, field_name, issue_type, severity,
    issue_value, expected_pattern, notes
) FROM :'data_dir'/data_quality_issue.csv WITH (FORMAT csv, HEADER true, NULL '');

COMMIT;

\echo 'PAS CSV load complete'
