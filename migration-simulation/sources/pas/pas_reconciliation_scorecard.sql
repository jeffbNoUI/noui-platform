-- PAS migration reconciliation scorecard query pack
-- Run after loading source CSVs and after your target-side mapping/recalc process.
--
-- These queries are designed to:
-- 1) profile source realism / legacy defects
-- 2) identify reconciliation hot spots
-- 3) isolate likely mapping domains causing variance

-- 1. Table row counts
select 'src_pas.member' as table_name, count(*) as row_count from src_pas.member
union all select 'src_pas.employment_segment', count(*) from src_pas.employment_segment
union all select 'src_pas.payroll_period', count(*) from src_pas.payroll_period
union all select 'src_pas.salary_history', count(*) from src_pas.salary_history
union all select 'src_pas.salary_component', count(*) from src_pas.salary_component
union all select 'src_pas.contribution_history', count(*) from src_pas.contribution_history
union all select 'src_pas.service_credit_history', count(*) from src_pas.service_credit_history
union all select 'src_pas.beneficiary', count(*) from src_pas.beneficiary
union all select 'src_pas.domestic_relations_order', count(*) from src_pas.domestic_relations_order
union all select 'src_pas.case_management', count(*) from src_pas.case_management
union all select 'src_pas.retirement_award', count(*) from src_pas.retirement_award
union all select 'src_pas.benefit_payment', count(*) from src_pas.benefit_payment
union all select 'src_pas.migration_boundary_inference', count(*) from src_pas.migration_boundary_inference
union all select 'src_pas.data_quality_issue', count(*) from src_pas.data_quality_issue
union all select 'recon.legacy_calculation_snapshot', count(*) from recon.legacy_calculation_snapshot
union all select 'recon.reconciliation_result', count(*) from recon.reconciliation_result
union all select 'recon.reconciliation_evidence', count(*) from recon.reconciliation_evidence
order by 1;

-- 2. Legacy defect summary
select
    severity,
    issue_type,
    table_name,
    field_name,
    count(*) as issue_count
from src_pas.data_quality_issue
group by severity, issue_type, table_name, field_name
order by issue_count desc, severity, issue_type;

-- 3. SSN formatting profile
select
    case
        when ssn is null or ssn = '' then 'blank'
        when ssn ~ '^[0-9]{3}-[0-9]{2}-[0-9]{4}$' then 'dashed_valid'
        when ssn ~ '^[0-9]{9}$' then 'plain_valid'
        else 'invalid'
    end as ssn_format,
    count(*) as members
from src_pas.member
group by 1
order by 2 desc;

-- 4. Mixed granularity profile
select
    granularity,
    summarized_flag,
    estimated_flag,
    count(*) as row_count,
    min(earned_start) as min_earned_start,
    max(earned_end) as max_earned_end
from src_pas.salary_history
group by granularity, summarized_flag, estimated_flag
order by granularity, summarized_flag, estimated_flag;

-- 5. Suspected migration boundaries by domain
select
    domain_name,
    boundary_date,
    round(avg(confidence_score)::numeric, 4) as avg_confidence,
    count(*) as affected_members
from src_pas.migration_boundary_inference
group by domain_name, boundary_date
order by domain_name, boundary_date;

-- 6. Contribution running balance mismatches
select
    count(*) as mismatched_rows,
    round(sum(abs(coalesce(running_balance,0) - coalesce(expected_running_balance,0)))::numeric, 2) as total_abs_variance,
    round(avg(abs(coalesce(running_balance,0) - coalesce(expected_running_balance,0)))::numeric, 2) as avg_abs_variance
from src_pas.contribution_history
where coalesce(balance_match_flag, 'Y') <> 'Y';

-- 7. Members with highest contribution balance anomalies
select
    member_id,
    count(*) as mismatched_rows,
    round(sum(abs(coalesce(running_balance,0) - coalesce(expected_running_balance,0)))::numeric, 2) as total_abs_variance
from src_pas.contribution_history
where coalesce(balance_match_flag, 'Y') <> 'Y'
group by member_id
order by total_abs_variance desc, mismatched_rows desc
limit 25;

-- 8. Reconciliation headline metrics
select
    recon_status,
    count(*) as cases,
    round(avg(abs(variance_amount))::numeric, 4) as avg_abs_variance,
    round(max(abs(variance_amount))::numeric, 4) as max_abs_variance
from recon.reconciliation_result
group by recon_status
order by cases desc;

-- 9. Reconciliation by suspected domain
select
    suspected_domain,
    count(*) as cases,
    round(avg(abs(variance_amount))::numeric, 4) as avg_abs_variance,
    round(sum(abs(variance_amount))::numeric, 4) as total_abs_variance,
    round(100.0 * count(*) / nullif((select count(*) from recon.reconciliation_result),0), 2) as pct_of_cases
from recon.reconciliation_result
group by suspected_domain
order by total_abs_variance desc, cases desc;

-- 10. Systematic vs random mismatch split
select
    systematic_flag,
    count(*) as cases,
    round(avg(abs(variance_amount))::numeric, 4) as avg_abs_variance
from recon.reconciliation_result
where recon_status <> 'MATCH'
group by systematic_flag
order by systematic_flag desc;

-- 11. Snapshot comparison detail
select
    s.member_id,
    s.calc_name,
    s.as_of_date,
    s.legacy_value,
    s.recomputed_value,
    s.variance_amount,
    s.variance_pct,
    r.recon_status,
    r.suspected_domain,
    r.systematic_flag
from recon.legacy_calculation_snapshot s
left join recon.reconciliation_result r
  on r.member_id = s.member_id
 and r.calc_name = s.calc_name
order by abs(s.variance_amount) desc, s.member_id
limit 100;

-- 12. High-risk retirees for manual review
select
    a.member_id,
    a.retirement_date,
    a.final_avg_salary,
    a.service_years,
    a.benefit_amount,
    s.legacy_value,
    s.recomputed_value,
    s.variance_amount,
    r.suspected_domain
from src_pas.retirement_award a
join recon.legacy_calculation_snapshot s
  on s.member_id = a.member_id
join recon.reconciliation_result r
  on r.member_id = s.member_id
 and r.calc_name = s.calc_name
where abs(coalesce(s.variance_amount,0)) >= 25
order by abs(s.variance_amount) desc, a.member_id;

-- 13. Correlate mismatches to salary-domain signals
with salary_flags as (
    select
        member_id,
        max(case when summarized_flag = 'Y' then 1 else 0 end) as has_summarized_salary,
        max(case when estimated_flag = 'Y' then 1 else 0 end) as has_estimated_salary,
        count(*) filter (where granularity = 'ANNUAL') as annual_rows,
        count(*) filter (where granularity in ('BIWEEKLY','MONTHLY')) as detailed_rows
    from src_pas.salary_history
    group by member_id
)
select
    r.suspected_domain,
    sf.has_summarized_salary,
    sf.has_estimated_salary,
    count(*) as members,
    round(avg(abs(r.variance_amount))::numeric, 4) as avg_abs_variance
from recon.reconciliation_result r
join salary_flags sf
  on sf.member_id = r.member_id
group by r.suspected_domain, sf.has_summarized_salary, sf.has_estimated_salary
order by avg_abs_variance desc, members desc;

-- 14. Correlate mismatches to missing payroll detail
with expected_periods as (
    select employer_id, tax_year, count(*) as expected_period_count
    from src_pas.payroll_period
    group by employer_id, tax_year
),
member_periods as (
    select
        e.member_id,
        e.employer_id,
        extract(year from sh.earned_start)::int as tax_year,
        count(distinct sh.payroll_period_id) filter (where sh.payroll_period_id is not null) as actual_period_count
    from src_pas.employment_segment e
    join src_pas.salary_history sh
      on sh.employment_segment_id = e.employment_segment_id
    where sh.summarized_flag = 'N'
    group by e.member_id, e.employer_id, extract(year from sh.earned_start)::int
)
select
    r.suspected_domain,
    case when mp.actual_period_count < ep.expected_period_count then 'missing_detail' else 'complete_detail' end as detail_completeness,
    count(distinct r.member_id) as affected_members,
    round(avg(abs(r.variance_amount))::numeric, 4) as avg_abs_variance
from recon.reconciliation_result r
join member_periods mp
  on mp.member_id = r.member_id
join expected_periods ep
  on ep.employer_id = mp.employer_id
 and ep.tax_year = mp.tax_year
group by r.suspected_domain,
         case when mp.actual_period_count < ep.expected_period_count then 'missing_detail' else 'complete_detail' end
order by avg_abs_variance desc, affected_members desc;

-- 15. Evidence summary for triage UI / analyst queue
select
    r.recon_id,
    r.member_id,
    r.calc_name,
    r.recon_status,
    r.variance_amount,
    r.suspected_domain,
    e.signal_type,
    e.signal_strength,
    e.evidence_text
from recon.reconciliation_result r
left join recon.reconciliation_evidence e
  on e.recon_id = r.recon_id
order by abs(r.variance_amount) desc, e.signal_strength desc nulls last, r.member_id;

-- 16. Suggested analyst work queue
select
    r.member_id,
    r.calc_name,
    r.suspected_domain,
    r.variance_amount,
    count(dq.issue_id) as linked_dq_issues,
    max(mbi.confidence_score) as max_boundary_confidence,
    case
        when abs(r.variance_amount) >= 100 then 'P1'
        when abs(r.variance_amount) >= 25 then 'P2'
        else 'P3'
    end as review_priority
from recon.reconciliation_result r
left join src_pas.data_quality_issue dq
  on dq.record_key = 'member_id=' || r.member_id::text
left join src_pas.migration_boundary_inference mbi
  on mbi.member_id = r.member_id
where r.recon_status <> 'MATCH'
group by r.member_id, r.calc_name, r.suspected_domain, r.variance_amount
order by review_priority, abs(r.variance_amount) desc, linked_dq_issues desc;
