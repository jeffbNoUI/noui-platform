-- Synthetic PostgreSQL source-side pension administration model
-- Purpose: simulate legacy-source-to-target mapping and reconciliation
-- Basis: synthesized from public pension employer reporting/interface layouts
--        and PAS-adjacent artifacts; not an official vendor schema.

create extension if not exists pgcrypto;

create schema if not exists src_pas;
create schema if not exists recon;

-- =========================================================
-- Reference / code tables
-- =========================================================

create table if not exists src_pas.ref_plan (
    plan_code               text primary key,
    plan_name               text not null,
    plan_type               text not null, -- DB, DC, Hybrid, Health, Life
    tier_code               text,
    closed_to_new_members   boolean not null default false,
    effective_start_date    date,
    effective_end_date      date
);

create table if not exists src_pas.ref_employer (
    employer_id             text primary key,
    employer_name           text not null,
    employer_type           text,
    payroll_frequency_code  text,          -- M, BW, SM, W, etc.
    reporting_group_code    text,
    active_flag             boolean not null default true
);

create table if not exists src_pas.ref_status_code (
    domain_name             text not null,
    status_code             text not null,
    status_description      text not null,
    ambiguous_flag          boolean not null default false,
    primary key (domain_name, status_code)
);

create table if not exists src_pas.ref_transaction_type (
    transaction_type_code   text primary key,
    transaction_description text not null,
    affects_contributions   boolean not null default false,
    affects_service         boolean not null default false,
    retro_adjustment_flag   boolean not null default false
);

create table if not exists src_pas.ref_compensation_type (
    comp_type_code          text primary key,
    comp_type_description   text not null,
    pensionable_flag        boolean not null default true,
    compensation_group      text,          -- base, overtime, special_comp, leave_cashout
    default_proration_rule  text
);

create table if not exists src_pas.ref_service_type (
    service_type_code       text primary key,
    service_type_description text not null,
    purchase_eligible_flag  boolean not null default false,
    credit_multiplier       numeric(12,6) not null default 1.0
);

create table if not exists src_pas.ref_relationship_type (
    relationship_type_code  text primary key,
    relationship_description text not null
);

create table if not exists src_pas.ref_payment_option (
    payment_option_code     text primary key,
    payment_option_description text not null,
    survivor_percentage     numeric(7,4),
    pop_up_flag             boolean not null default false
);

-- =========================================================
-- Member / party / identity
-- =========================================================

create table if not exists src_pas.member (
    member_id               uuid primary key default gen_random_uuid(),
    legacy_member_number    text unique,
    ssn_raw                 text,
    ssn_normalized          text,
    tin_last4               text,
    first_name              text,
    middle_name             text,
    last_name               text,
    suffix                  text,
    date_of_birth           date,
    date_of_death           date,
    gender_code             text,
    marital_status_code     text,
    preferred_language_code text,
    member_status_code      text,
    member_status_as_of     date,
    original_membership_date date,
    retirement_system_entry_date date,
    data_quality_score      numeric(5,2),
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

create table if not exists src_pas.member_address (
    member_address_id       uuid primary key default gen_random_uuid(),
    member_id               uuid not null references src_pas.member(member_id),
    address_type_code       text not null, -- home, mailing, temporary
    line1                   text,
    line2                   text,
    city                    text,
    state_code              text,
    postal_code             text,
    country_code            text,
    effective_start_date    date,
    effective_end_date      date,
    current_flag            boolean not null default false
);

create table if not exists src_pas.member_contact (
    member_contact_id       uuid primary key default gen_random_uuid(),
    member_id               uuid not null references src_pas.member(member_id),
    contact_type_code       text not null, -- email, mobile, home_phone
    contact_value           text not null,
    preferred_flag          boolean not null default false,
    effective_start_date    date,
    effective_end_date      date
);

-- =========================================================
-- Employment and payroll history
-- =========================================================

create table if not exists src_pas.employment_segment (
    employment_segment_id   uuid primary key default gen_random_uuid(),
    member_id               uuid not null references src_pas.member(member_id),
    employer_id             text not null references src_pas.ref_employer(employer_id),
    plan_code               text references src_pas.ref_plan(plan_code),
    tier_code               text,
    employee_class_code     text,
    job_class_code          text,
    bargaining_unit_code    text,
    department_code         text,
    location_code           text,
    employment_status_code  text,
    pay_status_code         text,
    full_time_equivalent    numeric(8,4),
    original_hire_date      date,
    adjusted_service_date   date,
    segment_start_date      date not null,
    segment_end_date        date,
    change_effective_date   date,
    source_migration_era    text, -- pre_1995_rollup / post_1995_detail etc.
    estimated_flag          boolean not null default false,
    provenance_note         text
);

create table if not exists src_pas.payroll_period (
    payroll_period_id       uuid primary key default gen_random_uuid(),
    employer_id             text not null references src_pas.ref_employer(employer_id),
    payroll_year            integer,
    payroll_number          integer,
    pay_period_begin_date   date not null,
    pay_period_end_date     date not null,
    payroll_check_date      date,
    payroll_frequency_code  text,
    batch_id                text,
    unique (employer_id, pay_period_begin_date, pay_period_end_date, coalesce(payroll_check_date, date '1900-01-01'))
);

create table if not exists src_pas.salary_history (
    salary_history_id       uuid primary key default gen_random_uuid(),
    member_id               uuid not null references src_pas.member(member_id),
    employment_segment_id   uuid references src_pas.employment_segment(employment_segment_id),
    payroll_period_id       uuid references src_pas.payroll_period(payroll_period_id),
    salary_granularity      text not null, -- pay_period, monthly, annual, lifetime_summary
    period_begin_date       date not null,
    period_end_date         date not null,
    pay_date                date,
    base_rate               numeric(18,6),
    pay_rate_type_code      text,
    standard_hours          numeric(14,4),
    actual_hours            numeric(14,4),
    reportable_earnings     numeric(18,2),
    non_reportable_earnings numeric(18,2) not null default 0,
    pensionable_earnings    numeric(18,2),
    overtime_earnings       numeric(18,2) not null default 0,
    special_comp_earnings   numeric(18,2) not null default 0,
    summarized_flag         boolean not null default false,
    estimated_flag          boolean not null default false,
    reconstruction_method   text,
    provenance_confidence   numeric(5,2)
);

create table if not exists src_pas.salary_component (
    salary_component_id     uuid primary key default gen_random_uuid(),
    salary_history_id       uuid not null references src_pas.salary_history(salary_history_id) on delete cascade,
    comp_type_code          text not null references src_pas.ref_compensation_type(comp_type_code),
    quantity                numeric(18,4),
    rate                    numeric(18,6),
    amount                  numeric(18,2) not null,
    pensionable_flag        boolean,
    source_column_name      text
);

create table if not exists src_pas.contribution_history (
    contribution_history_id uuid primary key default gen_random_uuid(),
    member_id               uuid not null references src_pas.member(member_id),
    employment_segment_id   uuid references src_pas.employment_segment(employment_segment_id),
    payroll_period_id       uuid references src_pas.payroll_period(payroll_period_id),
    transaction_type_code   text references src_pas.ref_transaction_type(transaction_type_code),
    contribution_granularity text not null, -- pay_period, monthly, annual, lifetime_summary
    contribution_begin_date date not null,
    contribution_end_date   date not null,
    member_contribution_amount numeric(18,2) not null default 0,
    employer_contribution_amount numeric(18,2) not null default 0,
    picked_up_amount        numeric(18,2) not null default 0,
    voluntary_amount        numeric(18,2) not null default 0,
    purchase_amount         numeric(18,2) not null default 0,
    interest_amount         numeric(18,2) not null default 0,
    tax_treatment_code      text,
    summarized_flag         boolean not null default false,
    estimated_flag          boolean not null default false,
    running_balance_amount  numeric(18,2),
    row_balance_check_amount numeric(18,2),
    provenance_confidence   numeric(5,2)
);

create table if not exists src_pas.service_credit_history (
    service_credit_history_id uuid primary key default gen_random_uuid(),
    member_id               uuid not null references src_pas.member(member_id),
    employment_segment_id   uuid references src_pas.employment_segment(employment_segment_id),
    service_type_code       text references src_pas.ref_service_type(service_type_code),
    granularity             text not null, -- pay_period, monthly, annual, summary
    service_begin_date      date not null,
    service_end_date        date not null,
    service_units           numeric(18,6) not null,
    service_unit_type       text not null default 'years', -- years, months, hours, days
    credited_service_years  numeric(18,6),
    purchased_flag          boolean not null default false,
    vesting_service_flag    boolean not null default true,
    summarized_flag         boolean not null default false,
    estimated_flag          boolean not null default false,
    reconstruction_method   text,
    provenance_confidence   numeric(5,2)
);

create table if not exists src_pas.leave_of_absence (
    leave_id                uuid primary key default gen_random_uuid(),
    member_id               uuid not null references src_pas.member(member_id),
    employment_segment_id   uuid references src_pas.employment_segment(employment_segment_id),
    leave_type_code         text,
    leave_start_date        date not null,
    leave_end_date          date,
    paid_flag               boolean,
    service_impact_code     text,
    notes                   text
);

-- =========================================================
-- Beneficiaries / QDRO-DRO / cases
-- =========================================================

create table if not exists src_pas.beneficiary (
    beneficiary_id          uuid primary key default gen_random_uuid(),
    member_id               uuid not null references src_pas.member(member_id),
    beneficiary_type_code   text not null,
    relationship_type_code  text references src_pas.ref_relationship_type(relationship_type_code),
    first_name              text,
    last_name               text,
    date_of_birth           date,
    ssn_raw                 text,
    percentage_allocation   numeric(9,4),
    contingent_flag         boolean not null default false,
    effective_start_date    date,
    effective_end_date      date,
    revoked_flag            boolean not null default false
);

create table if not exists src_pas.domestic_relations_order (
    dro_id                  uuid primary key default gen_random_uuid(),
    member_id               uuid not null references src_pas.member(member_id),
    alternate_payee_name    text,
    order_type_code         text,
    order_status_code       text,
    order_received_date     date,
    order_effective_date    date,
    court_name              text,
    case_number             text,
    segregated_percentage   numeric(9,4),
    segregated_amount       numeric(18,2),
    notes                   text
);

create table if not exists src_pas.case_management (
    case_id                 uuid primary key default gen_random_uuid(),
    member_id               uuid references src_pas.member(member_id),
    case_type_code          text not null,
    case_status_code        text not null,
    opened_date             date not null,
    closed_date             date,
    assigned_team           text,
    assigned_worker         text,
    priority_code           text,
    source_system_case_id   text,
    notes                   text
);

-- =========================================================
-- Benefit setup and payments
-- =========================================================

create table if not exists src_pas.retirement_award (
    award_id                uuid primary key default gen_random_uuid(),
    member_id               uuid not null references src_pas.member(member_id),
    plan_code               text references src_pas.ref_plan(plan_code),
    retirement_type_code    text,
    commencement_date       date,
    retirement_date         date,
    final_average_salary    numeric(18,2),
    credited_service_years  numeric(18,6),
    accrual_factor          numeric(18,8),
    early_reduction_factor  numeric(18,8),
    payment_option_code     text references src_pas.ref_payment_option(payment_option_code),
    optional_form_factor    numeric(18,8),
    gross_monthly_benefit   numeric(18,2),
    cola_eligibility_flag   boolean,
    legacy_calc_version     text,
    calculation_as_of_date  date
);

create table if not exists src_pas.benefit_payment (
    benefit_payment_id      uuid primary key default gen_random_uuid(),
    award_id                uuid references src_pas.retirement_award(award_id),
    member_id               uuid not null references src_pas.member(member_id),
    payment_date            date not null,
    pay_period_begin_date   date,
    pay_period_end_date     date,
    gross_amount            numeric(18,2) not null,
    tax_withholding_amount  numeric(18,2) not null default 0,
    deduction_amount        numeric(18,2) not null default 0,
    net_amount              numeric(18,2) not null,
    payment_status_code     text,
    payment_method_code     text,
    void_reissue_indicator  text,
    check_or_trace_number   text
);

-- =========================================================
-- Provenance / ingestion / lineage-friendly source metadata
-- =========================================================

create table if not exists src_pas.source_batch (
    source_batch_id         uuid primary key default gen_random_uuid(),
    source_system_name      text not null,
    source_extract_name     text,
    source_file_name        text,
    extract_started_at      timestamptz,
    extract_completed_at    timestamptz,
    source_row_count        bigint,
    load_status_code        text,
    control_total_amount    numeric(18,2),
    record_count_declared   bigint,
    record_count_actual     bigint,
    checksum_value          text,
    notes                   text
);

create table if not exists src_pas.source_record_audit (
    source_record_audit_id  uuid primary key default gen_random_uuid(),
    source_batch_id         uuid references src_pas.source_batch(source_batch_id),
    source_table_name       text not null,
    source_primary_key_text text,
    source_line_number      bigint,
    raw_record_text         text,
    parse_status_code       text,
    parse_warning_text      text,
    target_table_name       text,
    target_primary_key_text text,
    loaded_at               timestamptz not null default now()
);

create table if not exists src_pas.source_field_audit (
    source_field_audit_id   uuid primary key default gen_random_uuid(),
    source_record_audit_id  uuid not null references src_pas.source_record_audit(source_record_audit_id) on delete cascade,
    source_field_name       text not null,
    source_field_position_start integer,
    source_field_position_end   integer,
    source_raw_value        text,
    normalized_value        text,
    inferred_semantic_tag   text,
    mapping_confidence      numeric(5,2),
    approved_flag           boolean,
    target_table_name       text,
    target_column_name      text,
    transformation_rule_name text
);

create table if not exists src_pas.data_quality_issue (
    dq_issue_id             uuid primary key default gen_random_uuid(),
    member_id               uuid references src_pas.member(member_id),
    source_record_audit_id  uuid references src_pas.source_record_audit(source_record_audit_id),
    severity_code           text not null,
    rule_name               text not null,
    issue_category          text not null,
    issue_description       text not null,
    detected_at             timestamptz not null default now(),
    resolved_flag           boolean not null default false,
    resolution_note         text
);

create table if not exists src_pas.migration_boundary_inference (
    boundary_id             uuid primary key default gen_random_uuid(),
    employer_id             text references src_pas.ref_employer(employer_id),
    member_id               uuid references src_pas.member(member_id),
    domain_name             text not null, -- salary, contributions, employment
    inferred_boundary_date  date not null,
    evidence_type           text not null, -- granularity_shift, null_spike, code_change, schema_change
    evidence_score          numeric(8,4) not null,
    evidence_detail         jsonb,
    analyst_approved_flag   boolean,
    approved_boundary_date  date
);

-- =========================================================
-- Reconciliation / legacy snapshot / expected values
-- =========================================================

create table if not exists recon.legacy_calculation_snapshot (
    legacy_snapshot_id      uuid primary key default gen_random_uuid(),
    member_id               uuid not null references src_pas.member(member_id),
    valuation_date          date not null,
    source_system_name      text not null,
    calc_context_code       text not null, -- eligibility, fas36, service_total, monthly_benefit
    expected_value_numeric  numeric(18,6),
    expected_value_text     text,
    expected_value_date     date,
    tolerance_amount        numeric(18,6),
    calc_version            text,
    notes                   text,
    unique (member_id, valuation_date, source_system_name, calc_context_code)
);

create table if not exists recon.reconciliation_result (
    reconciliation_result_id uuid primary key default gen_random_uuid(),
    member_id               uuid not null references src_pas.member(member_id),
    valuation_date          date not null,
    calc_context_code       text not null,
    expected_value_numeric  numeric(18,6),
    actual_value_numeric    numeric(18,6),
    variance_numeric        numeric(18,6),
    variance_classification text, -- exact, within_tolerance, systematic, unexplained
    suspected_domain        text, -- salary, dates, service, contributions, demographics
    suspected_field_list    text[],
    systematic_error_score  numeric(8,4),
    legacy_bug_suspected_flag boolean not null default false,
    triage_status_code      text not null default 'new',
    created_at              timestamptz not null default now()
);

create table if not exists recon.reconciliation_evidence (
    reconciliation_evidence_id uuid primary key default gen_random_uuid(),
    reconciliation_result_id uuid not null references recon.reconciliation_result(reconciliation_result_id) on delete cascade,
    evidence_rank            integer not null,
    evidence_type            text not null, -- input_trace, rule_path, source_field, anomaly
    evidence_reference       text,
    evidence_detail          jsonb
);

-- =========================================================
-- Helpful indexes
-- =========================================================

create index if not exists ix_member_ssn_norm on src_pas.member(ssn_normalized);
create index if not exists ix_employment_member_dates on src_pas.employment_segment(member_id, segment_start_date, segment_end_date);
create index if not exists ix_salary_member_period on src_pas.salary_history(member_id, period_begin_date, period_end_date);
create index if not exists ix_contrib_member_period on src_pas.contribution_history(member_id, contribution_begin_date, contribution_end_date);
create index if not exists ix_service_member_period on src_pas.service_credit_history(member_id, service_begin_date, service_end_date);
create index if not exists ix_payment_member_date on src_pas.benefit_payment(member_id, payment_date);
create index if not exists ix_recon_member_context on recon.reconciliation_result(member_id, valuation_date, calc_context_code);

-- =========================================================
-- Minimal comments for simulation usage
-- =========================================================
comment on schema src_pas is 'Synthetic legacy-source PAS schema for source-to-target mapping and reconciliation testing.';
comment on schema recon is 'Reconciliation artifacts for expected vs actual calculation comparisons.';
comment on table src_pas.salary_history is 'Supports mixed granularity: pay-period, monthly, annual, and summarized legacy rows.';
comment on table src_pas.contribution_history is 'Stores both detailed and summarized contribution records, including running balance anomalies.';
comment on table src_pas.migration_boundary_inference is 'Captures inferred prior-migration boundary dates from data discontinuities.';
comment on table recon.legacy_calculation_snapshot is 'Legacy system snapshots used as expected outputs during reconciliation-driven mapping refinement.';
comment on table recon.reconciliation_result is 'Comparison results between expected legacy outputs and recalculated target outputs.';
