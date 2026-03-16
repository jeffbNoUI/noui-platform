-- Migration 013: Row-Level Security
-- Resolves F-009: No Row-Level Security (CRITICAL)
--
-- RLS policies enforce tenant and member isolation at the database layer.
-- Session variables are set per-request by platform/dbcontext/:
--   SELECT set_config('app.tenant_id', $1, false),
--          set_config('app.member_id', $2, false),
--          set_config('app.user_role', $3, false)
--
-- FORCE ROW LEVEL SECURITY ensures policies apply to the table owner too
-- (otherwise owner bypasses RLS, making dev/test behave differently from prod).
-- Superusers still bypass RLS for migration/admin operations.

BEGIN;

-- ============================================================
-- 1. Tables with direct tenant_id — tenant isolation
-- ============================================================

-- CRM tables
ALTER TABLE crm_contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contact FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_contact
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_organization FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_organization
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_sla_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sla_definition FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_sla_definition
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_conversation FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_conversation
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_interaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_interaction FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_interaction
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_commitment ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_commitment FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_commitment
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_outreach FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_outreach
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_audit_log
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_category_taxonomy ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_category_taxonomy FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_category_taxonomy
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_note_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_note_template FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_note_template
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- Knowledge Base
ALTER TABLE kb_article ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_article FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON kb_article
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- Data Quality
ALTER TABLE dq_check_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE dq_check_definition FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dq_check_definition
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE dq_check_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE dq_check_result FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dq_check_result
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE dq_issue ENABLE ROW LEVEL SECURITY;
ALTER TABLE dq_issue FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dq_issue
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- Correspondence
ALTER TABLE correspondence_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE correspondence_template FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON correspondence_template
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE correspondence_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE correspondence_history FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON correspondence_history
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- Case Management (retirement_case has direct tenant_id)
ALTER TABLE retirement_case ENABLE ROW LEVEL SECURITY;
ALTER TABLE retirement_case FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON retirement_case
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- ============================================================
-- 2. Child tables — join to parent for tenant isolation
-- ============================================================

-- CRM child tables (no direct tenant_id, inherit via parent FK)
ALTER TABLE crm_contact_address ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contact_address FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_contact ON crm_contact_address
  USING (contact_id IN (
    SELECT contact_id FROM crm_contact
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE crm_contact_preference ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contact_preference FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_contact ON crm_contact_preference
  USING (contact_id IN (
    SELECT contact_id FROM crm_contact
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE crm_org_contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_org_contact FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_org ON crm_org_contact
  USING (org_id IN (
    SELECT org_id FROM crm_organization
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE crm_interaction_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_interaction_link FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_interaction ON crm_interaction_link
  USING (from_interaction_id IN (
    SELECT interaction_id FROM crm_interaction
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE crm_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_note FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_interaction ON crm_note
  USING (interaction_id IN (
    SELECT interaction_id FROM crm_interaction
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE crm_sla_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sla_tracking FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_conversation ON crm_sla_tracking
  USING (conversation_id IN (
    SELECT conversation_id FROM crm_conversation
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

-- KB child table
ALTER TABLE kb_rule_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_rule_reference FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_article ON kb_rule_reference
  USING (article_id IN (
    SELECT article_id FROM kb_article
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

-- Case Management child tables (join via case_id → retirement_case)
ALTER TABLE case_flag ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_flag FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_case ON case_flag
  USING (case_id IN (
    SELECT case_id FROM retirement_case
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE case_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_stage_history FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_case ON case_stage_history
  USING (case_id IN (
    SELECT case_id FROM retirement_case
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE case_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_note FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_case ON case_note
  USING (case_id IN (
    SELECT case_id FROM retirement_case
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE case_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_document FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_case ON case_document
  USING (case_id IN (
    SELECT case_id FROM retirement_case
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

-- ============================================================
-- 3. Legacy tables — tenant via retirement_case + member isolation
-- ============================================================
-- Legacy tables have member_id but no tenant_id. Tenant isolation joins
-- through retirement_case. Staff see all members in their tenant;
-- members see only their own data.
--
-- OR logic: staff path checks tenant via retirement_case subquery,
-- member path checks member_id directly.
--
-- Performance note: the retirement_case subquery will benefit from
-- an index on (tenant_id, member_id). Session 6 (Query Audit) will
-- add missing indexes if EXPLAIN ANALYZE shows problems at 250K scale.

ALTER TABLE member_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_master FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON member_master
  USING (
    (current_setting('app.user_role', true) = 'staff'
     AND member_id IN (
       SELECT member_id FROM retirement_case
       WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
     ))
    OR
    (current_setting('app.user_role', true) = 'member'
     AND member_id = current_setting('app.member_id', true)::INTEGER)
  );

ALTER TABLE salary_hist ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_hist FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON salary_hist
  USING (
    (current_setting('app.user_role', true) = 'staff'
     AND member_id IN (
       SELECT member_id FROM retirement_case
       WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
     ))
    OR
    (current_setting('app.user_role', true) = 'member'
     AND member_id = current_setting('app.member_id', true)::INTEGER)
  );

ALTER TABLE contribution_hist ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_hist FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON contribution_hist
  USING (
    (current_setting('app.user_role', true) = 'staff'
     AND member_id IN (
       SELECT member_id FROM retirement_case
       WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
     ))
    OR
    (current_setting('app.user_role', true) = 'member'
     AND member_id = current_setting('app.member_id', true)::INTEGER)
  );

ALTER TABLE beneficiary ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiary FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON beneficiary
  USING (
    (current_setting('app.user_role', true) = 'staff'
     AND member_id IN (
       SELECT member_id FROM retirement_case
       WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
     ))
    OR
    (current_setting('app.user_role', true) = 'member'
     AND member_id = current_setting('app.member_id', true)::INTEGER)
  );

ALTER TABLE svc_credit ENABLE ROW LEVEL SECURITY;
ALTER TABLE svc_credit FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON svc_credit
  USING (
    (current_setting('app.user_role', true) = 'staff'
     AND member_id IN (
       SELECT member_id FROM retirement_case
       WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
     ))
    OR
    (current_setting('app.user_role', true) = 'member'
     AND member_id = current_setting('app.member_id', true)::INTEGER)
  );

ALTER TABLE employment_hist ENABLE ROW LEVEL SECURITY;
ALTER TABLE employment_hist FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON employment_hist
  USING (
    (current_setting('app.user_role', true) = 'staff'
     AND member_id IN (
       SELECT member_id FROM retirement_case
       WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
     ))
    OR
    (current_setting('app.user_role', true) = 'member'
     AND member_id = current_setting('app.member_id', true)::INTEGER)
  );

ALTER TABLE dro_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE dro_master FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON dro_master
  USING (
    (current_setting('app.user_role', true) = 'staff'
     AND member_id IN (
       SELECT member_id FROM retirement_case
       WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
     ))
    OR
    (current_setting('app.user_role', true) = 'member'
     AND member_id = current_setting('app.member_id', true)::INTEGER)
  );

ALTER TABLE benefit_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_payment FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON benefit_payment
  USING (
    (current_setting('app.user_role', true) = 'staff'
     AND member_id IN (
       SELECT member_id FROM retirement_case
       WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
     ))
    OR
    (current_setting('app.user_role', true) = 'member'
     AND member_id = current_setting('app.member_id', true)::INTEGER)
  );

ALTER TABLE case_hist ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_hist FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON case_hist
  USING (
    (current_setting('app.user_role', true) = 'staff'
     AND member_id IN (
       SELECT member_id FROM retirement_case
       WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
     ))
    OR
    (current_setting('app.user_role', true) = 'member'
     AND member_id = current_setting('app.member_id', true)::INTEGER)
  );

ALTER TABLE transaction_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON transaction_log
  USING (
    (current_setting('app.user_role', true) = 'staff'
     AND member_id IN (
       SELECT member_id FROM retirement_case
       WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
     ))
    OR
    (current_setting('app.user_role', true) = 'member'
     AND member_id = current_setting('app.member_id', true)::INTEGER)
  );

-- member_summary_log — tenant via member_id → retirement_case
ALTER TABLE member_summary_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_summary_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON member_summary_log
  USING (
    (current_setting('app.user_role', true) = 'staff'
     AND member_id IN (
       SELECT member_id FROM retirement_case
       WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
     ))
    OR
    (current_setting('app.user_role', true) = 'member'
     AND member_id = current_setting('app.member_id', true)::INTEGER)
  );

-- ============================================================
-- 4. Supporting index for RLS subquery performance
-- ============================================================
-- The legacy table policies join to retirement_case by tenant_id.
-- This composite index accelerates the subquery at scale.
CREATE INDEX IF NOT EXISTS idx_case_tenant_member
  ON retirement_case(tenant_id, member_id);

-- ============================================================
-- 5. Tables NOT receiving RLS (global/shared reference data)
-- ============================================================
-- department_ref        — shared department codes
-- position_ref          — shared position/classification codes
-- case_stage_definition — shared workflow stage definitions
-- These are read-only lookup tables with no tenant-specific data.

COMMIT;
