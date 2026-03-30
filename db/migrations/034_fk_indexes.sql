-- Migration 034: Add missing indexes on foreign key columns in CRM and employer schemas.
-- These indexes prevent sequential scans on JOIN/WHERE clauses involving FK columns.
-- All indexes use CREATE INDEX IF NOT EXISTS to be idempotent.

BEGIN;

-- ============================================================
-- CRM schema — 5 missing FK indexes
-- ============================================================

-- crm_conversation.sla_definition_id → crm_sla_definition
CREATE INDEX IF NOT EXISTS idx_crm_conversation_sla_definition
    ON crm_conversation (sla_definition_id) WHERE sla_definition_id IS NOT NULL;

-- crm_commitment.conversation_id → crm_conversation
CREATE INDEX IF NOT EXISTS idx_crm_commitment_conversation
    ON crm_commitment (conversation_id) WHERE conversation_id IS NOT NULL;

-- crm_outreach.contact_id → crm_contact
CREATE INDEX IF NOT EXISTS idx_crm_outreach_contact
    ON crm_outreach (contact_id) WHERE contact_id IS NOT NULL;

-- crm_outreach.org_id → crm_organization
CREATE INDEX IF NOT EXISTS idx_crm_outreach_org
    ON crm_outreach (org_id) WHERE org_id IS NOT NULL;

-- crm_outreach.result_interaction_id → crm_interaction
CREATE INDEX IF NOT EXISTS idx_crm_outreach_result_interaction
    ON crm_outreach (result_interaction_id) WHERE result_interaction_id IS NOT NULL;

-- crm_sla_tracking.sla_id → crm_sla_definition (NOT NULL column)
CREATE INDEX IF NOT EXISTS idx_crm_sla_tracking_sla
    ON crm_sla_tracking (sla_id);

-- ============================================================
-- Employer shared schema — 3 missing FK indexes
-- ============================================================

-- employer_portal_user.contact_id → crm_contact (NOT NULL)
CREATE INDEX IF NOT EXISTS idx_employer_portal_user_contact
    ON employer_portal_user (contact_id);

-- late_interest_rate.division_code → employer_division
CREATE INDEX IF NOT EXISTS idx_late_interest_rate_division
    ON late_interest_rate (division_code) WHERE division_code IS NOT NULL;

-- employer_alert.org_id → crm_organization
CREATE INDEX IF NOT EXISTS idx_employer_alert_org
    ON employer_alert (org_id) WHERE org_id IS NOT NULL;

-- ============================================================
-- Employer reporting schema — 9 missing FK indexes
-- ============================================================

-- contribution_file.uploaded_by → employer_portal_user (NOT NULL)
CREATE INDEX IF NOT EXISTS idx_contribution_file_uploaded_by
    ON contribution_file (uploaded_by);

-- contribution_file.division_code → employer_division (NOT NULL)
CREATE INDEX IF NOT EXISTS idx_contribution_file_division
    ON contribution_file (division_code);

-- contribution_file.replaces_file_id → contribution_file (self-ref, nullable)
CREATE INDEX IF NOT EXISTS idx_contribution_file_replaces
    ON contribution_file (replaces_file_id) WHERE replaces_file_id IS NOT NULL;

-- contribution_record.division_code → employer_division (NOT NULL)
CREATE INDEX IF NOT EXISTS idx_contribution_record_division
    ON contribution_record (division_code);

-- contribution_exception.record_id → contribution_record (nullable)
CREATE INDEX IF NOT EXISTS idx_contribution_exception_record
    ON contribution_exception (record_id) WHERE record_id IS NOT NULL;

-- contribution_exception.assigned_to → employer_portal_user (nullable)
CREATE INDEX IF NOT EXISTS idx_contribution_exception_assigned
    ON contribution_exception (assigned_to) WHERE assigned_to IS NOT NULL;

-- contribution_exception.resolved_by → employer_portal_user (nullable)
CREATE INDEX IF NOT EXISTS idx_contribution_exception_resolved
    ON contribution_exception (resolved_by) WHERE resolved_by IS NOT NULL;

-- contribution_payment.created_by → employer_portal_user (nullable)
CREATE INDEX IF NOT EXISTS idx_contribution_payment_created_by
    ON contribution_payment (created_by) WHERE created_by IS NOT NULL;

-- late_interest_accrual.file_id → contribution_file (nullable)
CREATE INDEX IF NOT EXISTS idx_late_interest_accrual_file
    ON late_interest_accrual (file_id) WHERE file_id IS NOT NULL;

-- late_interest_accrual.payment_id → contribution_payment (nullable)
CREATE INDEX IF NOT EXISTS idx_late_interest_accrual_payment
    ON late_interest_accrual (payment_id) WHERE payment_id IS NOT NULL;

-- ============================================================
-- Employer enrollment schema — 3 missing FK indexes
-- ============================================================

-- enrollment_duplicate_flag.matched_member_id (nullable)
CREATE INDEX IF NOT EXISTS idx_enrollment_dup_matched_member
    ON enrollment_duplicate_flag (matched_member_id) WHERE matched_member_id IS NOT NULL;

-- enrollment_duplicate_flag.matched_submission_id → enrollment_submission (nullable)
CREATE INDEX IF NOT EXISTS idx_enrollment_dup_matched_submission
    ON enrollment_duplicate_flag (matched_submission_id) WHERE matched_submission_id IS NOT NULL;

-- perachoice_election.member_id (nullable)
CREATE INDEX IF NOT EXISTS idx_perachoice_election_member
    ON perachoice_election (member_id) WHERE member_id IS NOT NULL;

COMMIT;
