-- Performance indexes for 250K+ member scale
-- Targets composite query patterns used by platform services
-- Complements single-column indexes from 001_legacy_schema.sql

-- SALARY_HIST: covers WHERE member_id = $1 ORDER BY pay_period_end
-- Used by: dataaccess GetSalaryHistory, GetAMS
CREATE INDEX IF NOT EXISTS idx_salary_member_period_desc
    ON SALARY_HIST(MEMBER_ID, PAY_PERIOD_END DESC);

-- SALARY_HIST: covers fiscal year filtering
CREATE INDEX IF NOT EXISTS idx_salary_member_fy
    ON SALARY_HIST(MEMBER_ID, FY_YEAR);

-- EMPLOYMENT_HIST: covers WHERE member_id = $1 ORDER BY event_dt ASC
-- Used by: dataaccess GetEmploymentHistory
CREATE INDEX IF NOT EXISTS idx_empl_member_event_dt
    ON EMPLOYMENT_HIST(MEMBER_ID, EVENT_DT ASC);

-- CONTRIBUTION_HIST: covers latest-balance lookup (ORDER BY pay_period_end DESC LIMIT 1)
-- Used by: dataaccess GetContributions
CREATE INDEX IF NOT EXISTS idx_contrib_member_period_desc
    ON CONTRIBUTION_HIST(MEMBER_ID, PAY_PERIOD_END DESC);

-- BENEFIT_PAYMENT: covers payment history sorted by effective date
CREATE INDEX IF NOT EXISTS idx_payment_member_date_desc
    ON BENEFIT_PAYMENT(MEMBER_ID, EFF_DT DESC);

-- CASE_HIST: covers case lookups by member + status
CREATE INDEX IF NOT EXISTS idx_case_hist_member_status
    ON CASE_HIST(MEMBER_ID, CASE_STATUS);

-- retirement_case: covers work queue queries (ListCases with status + assignment filters)
-- Used by: casemanagement ListCases
CREATE INDEX IF NOT EXISTS idx_retirement_case_queue
    ON retirement_case(tenant_id, status, assigned_to);

-- crm_audit_log: covers entity-scoped audit queries
-- Used by: crm GetAuditLog
CREATE INDEX IF NOT EXISTS idx_crm_audit_entity_tenant
    ON crm_audit_log(tenant_id, entity_type, entity_id, event_time DESC);
