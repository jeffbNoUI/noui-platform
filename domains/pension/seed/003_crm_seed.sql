-- =============================================================================
-- CRM Seed Data
-- NoUI Platform — Demo data for CRM module
-- =============================================================================
-- Populates CRM tables from 002_crm_schema.sql with realistic demo data
-- tied to the four demo cases from the legacy DERP seed generator.
--
-- All records use tenant_id = '00000000-0000-0000-0000-000000000001'.
-- UUIDs follow a predictable sequential pattern for easy cross-referencing.
-- =============================================================================

BEGIN;

-- ===== Fixed UUID aliases for readability ====================================
-- Contacts
--   Robert Martinez   00000000-0000-0000-1000-000000000001
--   Jennifer Kim      00000000-0000-0000-1000-000000000002
--   David Washington  00000000-0000-0000-1000-000000000003
--   Patricia Martinez 00000000-0000-0000-1000-000000000004
--   Sarah Chen        00000000-0000-0000-1000-000000000005
--
-- Addresses           00000000-0000-0000-2000-000000000001 .. 006
-- Organizations       00000000-0000-0000-3000-000000000001 .. 003
-- Org contacts        00000000-0000-0000-3100-000000000001 .. 002
-- SLA definitions     00000000-0000-0000-4000-000000000001 .. 003
-- Category taxonomy   00000000-0000-0000-5000-000000000001 .. 015
-- Conversations       00000000-0000-0000-6000-000000000001 .. 004
-- Interactions        00000000-0000-0000-7000-000000000001 .. 009
-- Notes               00000000-0000-0000-8000-000000000001 .. 004
-- Commitments         00000000-0000-0000-9000-000000000001 .. 002
-- Outreach            00000000-0000-0000-A000-000000000001 .. 002
-- SLA tracking        00000000-0000-0000-B000-000000000001 .. 004
-- =============================================================================


-- =============================================================================
-- 1. CONTACTS (crm_contact)
-- =============================================================================

INSERT INTO crm_contact (
    contact_id, tenant_id, contact_type, legacy_mbr_id,
    first_name, last_name, date_of_birth, gender,
    primary_email, primary_phone, primary_phone_type,
    preferred_language, preferred_channel,
    identity_verified, identity_verified_at, identity_verified_by,
    security_flag, security_flag_note,
    email_deliverable, email_validated_at, phone_validated_at,
    created_at, updated_at, created_by, updated_by
) VALUES
-- Robert Martinez — Demo Cases 1 & 4
(
    '00000000-0000-0000-1000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10001',
    'Robert', 'Martinez', '1963-03-08', 'M',
    'rmartinez@example.com', '303-555-0101', 'HOME',
    'en', 'PHONE',
    TRUE, '2026-02-15 09:05:00-07', 'jsmith',
    NULL, NULL,
    TRUE, '2026-02-15 09:00:00-07', '2026-02-15 09:01:00-07',
    '2026-01-01 08:00:00-07', '2026-02-15 09:05:00-07', 'system_import', 'jsmith'
),
-- Jennifer Kim — Demo Case 2
(
    '00000000-0000-0000-1000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10002',
    'Jennifer', 'Kim', '1969-11-22', 'F',
    'jkim@example.com', '303-555-0202', 'CELL',
    'en', 'EMAIL',
    TRUE, '2026-01-20 10:15:00-07', 'agarcia',
    NULL, NULL,
    TRUE, '2026-01-20 10:10:00-07', '2026-01-20 10:12:00-07',
    '2026-01-01 08:00:00-07', '2026-02-01 14:30:00-07', 'system_import', 'agarcia'
),
-- David Washington — Demo Case 3
(
    '00000000-0000-0000-1000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10003',
    'David', 'Washington', '1974-08-14', 'M',
    'dwashington@example.com', '303-555-0303', 'CELL',
    'en', 'SECURE_MESSAGE',
    FALSE, NULL, NULL,
    NULL, NULL,
    TRUE, '2026-02-20 08:00:00-07', NULL,
    '2026-01-01 08:00:00-07', '2026-02-25 11:00:00-07', 'system_import', 'mwilson'
),
-- Patricia Martinez — Alternate payee (Robert's ex-wife, DRO)
(
    '00000000-0000-0000-1000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'ALTERNATE_PAYEE', NULL,
    'Patricia', 'Martinez', '1965-07-20', 'F',
    'pmartinez@example.com', '303-555-0401', 'HOME',
    'en', 'MAIL',
    TRUE, '2026-01-10 14:00:00-07', 'jsmith',
    'PENDING_DIVORCE', 'DRO case DR-2010-30214 — Robert Martinez alternate payee',
    TRUE, '2026-01-10 13:55:00-07', '2026-01-10 13:58:00-07',
    '2026-01-10 14:00:00-07', '2026-02-05 10:30:00-07', 'jsmith', 'jsmith'
),
-- Sarah Chen — External (attorney for Patricia)
(
    '00000000-0000-0000-1000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'EXTERNAL', NULL,
    'Sarah', 'Chen', NULL, 'F',
    'schen@denverlaw.example.com', '303-555-0501', 'WORK',
    'en', 'EMAIL',
    FALSE, NULL, NULL,
    NULL, NULL,
    TRUE, '2026-01-10 14:05:00-07', '2026-01-10 14:06:00-07',
    '2026-01-10 14:10:00-07', '2026-01-10 14:10:00-07', 'jsmith', 'jsmith'
);


-- =============================================================================
-- 2. ADDRESSES (crm_contact_address)
-- =============================================================================

INSERT INTO crm_contact_address (
    address_id, contact_id, address_type, is_primary,
    line1, line2, city, state_code, zip_code, country_code,
    validated, validated_at, standardized_line1,
    effective_from, created_at, created_by
) VALUES
-- Robert Martinez — Home (primary)
(
    '00000000-0000-0000-2000-000000000001',
    '00000000-0000-0000-1000-000000000001',
    'HOME', TRUE,
    '4521 Elm Street', NULL, 'Denver', 'CO', '80220', 'US',
    TRUE, '2026-01-01 08:00:00-07', '4521 ELM ST',
    '2020-06-15', '2026-01-01 08:00:00-07', 'system_import'
),
-- Robert Martinez — Mailing
(
    '00000000-0000-0000-2000-000000000002',
    '00000000-0000-0000-1000-000000000001',
    'MAILING', FALSE,
    'PO Box 1234', NULL, 'Denver', 'CO', '80201', 'US',
    TRUE, '2026-01-01 08:00:00-07', 'PO BOX 1234',
    '2020-06-15', '2026-01-01 08:00:00-07', 'system_import'
),
-- Jennifer Kim — Home (primary)
(
    '00000000-0000-0000-2000-000000000003',
    '00000000-0000-0000-1000-000000000002',
    'HOME', TRUE,
    '782 Maple Avenue', 'Apt 4B', 'Lakewood', 'CO', '80226', 'US',
    TRUE, '2026-01-01 08:00:00-07', '782 MAPLE AVE APT 4B',
    '2015-09-01', '2026-01-01 08:00:00-07', 'system_import'
),
-- David Washington — Home (primary)
(
    '00000000-0000-0000-2000-000000000004',
    '00000000-0000-0000-1000-000000000003',
    'HOME', TRUE,
    '1950 S Colorado Blvd', 'Unit 310', 'Denver', 'CO', '80222', 'US',
    TRUE, '2026-01-01 08:00:00-07', '1950 S COLORADO BLVD UNIT 310',
    '2018-03-20', '2026-01-01 08:00:00-07', 'system_import'
),
-- Patricia Martinez — Home (primary)
(
    '00000000-0000-0000-2000-000000000005',
    '00000000-0000-0000-1000-000000000004',
    'HOME', TRUE,
    '3100 Pearl Street', NULL, 'Aurora', 'CO', '80014', 'US',
    TRUE, '2026-01-10 14:00:00-07', '3100 PEARL ST',
    '2011-01-15', '2026-01-10 14:00:00-07', 'jsmith'
),
-- Sarah Chen — Work (primary)
(
    '00000000-0000-0000-2000-000000000006',
    '00000000-0000-0000-1000-000000000005',
    'WORK', TRUE,
    '1700 Broadway', 'Suite 1200', 'Denver', 'CO', '80290', 'US',
    TRUE, '2026-01-10 14:10:00-07', '1700 BROADWAY STE 1200',
    '2026-01-10', '2026-01-10 14:10:00-07', 'jsmith'
);


-- =============================================================================
-- 3. ORGANIZATIONS (crm_organization)
-- =============================================================================

INSERT INTO crm_organization (
    org_id, tenant_id, org_type, org_name, org_short_name,
    legacy_employer_id, ein,
    address_line1, address_line2, city, state_code, zip_code,
    main_phone, main_email, website_url,
    employer_status, member_count, last_contribution_date, reporting_frequency,
    created_at, updated_at, created_by, updated_by
) VALUES
-- City and County of Denver
(
    '00000000-0000-0000-3000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'EMPLOYER', 'City and County of Denver', 'CCD',
    'EMP001', '84-6000571',
    '201 W Colfax Avenue', 'Dept 1010', 'Denver', 'CO', '80202',
    '720-913-1311', 'hr@denvergov.example.com', 'https://www.denvergov.example.com',
    'ACTIVE', 11500, '2026-02-28', 'BIWEEKLY',
    '2026-01-01 08:00:00-07', '2026-02-28 17:00:00-07', 'system_import', 'system_import'
),
-- Denver Water
(
    '00000000-0000-0000-3000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'EMPLOYER', 'Denver Water', 'DW',
    'EMP002', '84-6000580',
    '1600 W 12th Avenue', NULL, 'Denver', 'CO', '80204',
    '303-893-2444', 'benefits@denverwater.example.com', 'https://www.denverwater.example.com',
    'ACTIVE', 1200, '2026-02-28', 'BIWEEKLY',
    '2026-01-01 08:00:00-07', '2026-02-28 17:00:00-07', 'system_import', 'system_import'
),
-- Chen & Associates LLC (legal firm)
(
    '00000000-0000-0000-3000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'LEGAL', 'Chen & Associates LLC', 'Chen Law',
    NULL, '84-3456789',
    '1700 Broadway', 'Suite 1200', 'Denver', 'CO', '80290',
    '303-555-0500', 'office@denverlaw.example.com', 'https://www.denverlaw.example.com',
    NULL, NULL, NULL, NULL,
    '2026-01-10 14:10:00-07', '2026-01-10 14:10:00-07', 'jsmith', 'jsmith'
);


-- =============================================================================
-- 4. ORGANIZATION-CONTACT LINKS (crm_org_contact)
-- =============================================================================

INSERT INTO crm_org_contact (
    org_contact_id, org_id, contact_id, role,
    is_primary_for_role, title, direct_phone, direct_email,
    effective_from, created_at, created_by
) VALUES
-- Sarah Chen is primary contact at Chen & Associates for this DRO
(
    '00000000-0000-0000-3100-000000000001',
    '00000000-0000-0000-3000-000000000003',
    '00000000-0000-0000-1000-000000000005',
    'PRIMARY_CONTACT', TRUE,
    'Senior Associate', '303-555-0501', 'schen@denverlaw.example.com',
    '2026-01-10', '2026-01-10 14:10:00-07', 'jsmith'
);


-- =============================================================================
-- 5. SLA DEFINITIONS (crm_sla_definition)
-- =============================================================================

INSERT INTO crm_sla_definition (
    sla_id, tenant_id, sla_name, description,
    match_channel, match_category, match_priority,
    response_target_min, resolution_target_min,
    warn_at_percent, escalate_to_team, escalate_to_role,
    is_active, effective_from,
    created_at, created_by
) VALUES
-- Phone Inquiry SLA
(
    '00000000-0000-0000-4000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Phone Inquiry', 'Standard SLA for inbound phone inquiries',
    'PHONE_INBOUND', NULL, NULL,
    240, 2880,
    80, 'member_services', 'SUPERVISOR',
    TRUE, '2026-01-01',
    '2026-01-01 08:00:00-07', 'admin'
),
-- Retirement Application SLA
(
    '00000000-0000-0000-4000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Retirement Application', 'SLA for retirement application processing',
    NULL, 'Benefits > Retirement', NULL,
    480, 10080,
    80, 'retirement_processing', 'MANAGER',
    TRUE, '2026-01-01',
    '2026-01-01 08:00:00-07', 'admin'
),
-- DRO Processing SLA
(
    '00000000-0000-0000-4000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'DRO Processing', 'SLA for domestic relations order review and processing',
    NULL, 'Benefits > DRO', NULL,
    480, 20160,
    80, 'legal_compliance', 'MANAGER',
    TRUE, '2026-01-01',
    '2026-01-01 08:00:00-07', 'admin'
);


-- =============================================================================
-- 6. CATEGORY TAXONOMY (crm_category_taxonomy)
-- =============================================================================

INSERT INTO crm_category_taxonomy (
    category_id, tenant_id, parent_id, category_code, display_name,
    description, sort_order, is_active, wrap_up_codes,
    created_at, created_by
) VALUES
-- Root: Benefits
(
    '00000000-0000-0000-5000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    NULL, 'BENEFITS', 'Benefits',
    'All benefit-related inquiries and requests', 1, TRUE, NULL,
    '2026-01-01 08:00:00-07', 'admin'
),
-- Benefits > Retirement
(
    '00000000-0000-0000-5000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-5000-000000000001',
    'RETIREMENT', 'Retirement',
    'Retirement eligibility, estimates, and applications', 1, TRUE, NULL,
    '2026-01-01 08:00:00-07', 'admin'
),
-- Benefits > Retirement > Estimate
(
    '00000000-0000-0000-5000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-5000-000000000002',
    'ESTIMATE', 'Estimate',
    'Benefit estimate requests and questions', 1, TRUE,
    ARRAY['RET_EST_PROVIDED', 'RET_EST_PENDING'],
    '2026-01-01 08:00:00-07', 'admin'
),
-- Benefits > Retirement > Application
(
    '00000000-0000-0000-5000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-5000-000000000002',
    'APPLICATION', 'Application',
    'Retirement application processing', 2, TRUE,
    ARRAY['RET_APP_RECEIVED', 'RET_APP_COMPLETE', 'RET_APP_INCOMPLETE'],
    '2026-01-01 08:00:00-07', 'admin'
),
-- Benefits > Retirement > Payment Options
(
    '00000000-0000-0000-5000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-5000-000000000002',
    'PAYMENT_OPTIONS', 'Payment Options',
    'Benefit payment option inquiries (SLA, Joint & Survivor, etc.)', 3, TRUE,
    ARRAY['RET_PAY_INFO'],
    '2026-01-01 08:00:00-07', 'admin'
),
-- Benefits > Service Credit
(
    '00000000-0000-0000-5000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-5000-000000000001',
    'SERVICE_CREDIT', 'Service Credit',
    'Service credit purchases and verification', 2, TRUE, NULL,
    '2026-01-01 08:00:00-07', 'admin'
),
-- Benefits > Service Credit > Purchase
(
    '00000000-0000-0000-5000-000000000007',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-5000-000000000006',
    'PURCHASE', 'Purchase',
    'Service credit purchase inquiries and processing', 1, TRUE,
    ARRAY['SVC_PURCH_INFO', 'SVC_PURCH_STARTED'],
    '2026-01-01 08:00:00-07', 'admin'
),
-- Benefits > Service Credit > Verification
(
    '00000000-0000-0000-5000-000000000008',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-5000-000000000006',
    'VERIFICATION', 'Verification',
    'Service credit verification requests', 2, TRUE,
    ARRAY['SVC_VERIFY_COMPLETE', 'SVC_VERIFY_PENDING'],
    '2026-01-01 08:00:00-07', 'admin'
),
-- Benefits > DRO
(
    '00000000-0000-0000-5000-000000000009',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-5000-000000000001',
    'DRO', 'DRO',
    'Domestic relations order processing', 3, TRUE, NULL,
    '2026-01-01 08:00:00-07', 'admin'
),
-- Benefits > DRO > New Order
(
    '00000000-0000-0000-5000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-5000-000000000009',
    'NEW_ORDER', 'New Order',
    'New domestic relations order received for review', 1, TRUE,
    ARRAY['DRO_RECEIVED', 'DRO_UNDER_REVIEW'],
    '2026-01-01 08:00:00-07', 'admin'
),
-- Benefits > DRO > Modification
(
    '00000000-0000-0000-5000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-5000-000000000009',
    'MODIFICATION', 'Modification',
    'Modification to existing domestic relations order', 2, TRUE,
    ARRAY['DRO_MOD_RECEIVED', 'DRO_MOD_COMPLETE'],
    '2026-01-01 08:00:00-07', 'admin'
),
-- Root: Account
(
    '00000000-0000-0000-5000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    NULL, 'ACCOUNT', 'Account',
    'Account maintenance and updates', 2, TRUE, NULL,
    '2026-01-01 08:00:00-07', 'admin'
),
-- Account > Address Change
(
    '00000000-0000-0000-5000-000000000013',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-5000-000000000012',
    'ADDRESS_CHANGE', 'Address Change',
    'Address change requests', 1, TRUE,
    ARRAY['ADDR_UPDATED', 'ADDR_VERIFY_NEEDED'],
    '2026-01-01 08:00:00-07', 'admin'
),
-- Account > Name Change
(
    '00000000-0000-0000-5000-000000000014',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-5000-000000000012',
    'NAME_CHANGE', 'Name Change',
    'Legal name change requests', 2, TRUE,
    ARRAY['NAME_UPDATED', 'NAME_DOC_NEEDED'],
    '2026-01-01 08:00:00-07', 'admin'
),
-- Account > Beneficiary Update
(
    '00000000-0000-0000-5000-000000000015',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-5000-000000000012',
    'BENEFICIARY_UPDATE', 'Beneficiary Update',
    'Beneficiary designation changes', 3, TRUE,
    ARRAY['BENE_UPDATED', 'BENE_FORM_NEEDED'],
    '2026-01-01 08:00:00-07', 'admin'
),
-- Root: Contributions
(
    '00000000-0000-0000-5000-000000000016',
    '00000000-0000-0000-0000-000000000001',
    NULL, 'CONTRIBUTIONS', 'Contributions',
    'Contribution-related inquiries', 3, TRUE, NULL,
    '2026-01-01 08:00:00-07', 'admin'
),
-- Contributions > Employer Reporting
(
    '00000000-0000-0000-5000-000000000017',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-5000-000000000016',
    'EMPLOYER_REPORTING', 'Employer Reporting',
    'Employer contribution reporting issues', 1, TRUE,
    ARRAY['RPT_RECEIVED', 'RPT_CORRECTION_NEEDED'],
    '2026-01-01 08:00:00-07', 'admin'
),
-- Contributions > Member Inquiry
(
    '00000000-0000-0000-5000-000000000018',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-5000-000000000016',
    'MEMBER_INQUIRY', 'Member Inquiry',
    'Member questions about contributions', 2, TRUE,
    ARRAY['CONTRIB_INFO_PROVIDED'],
    '2026-01-01 08:00:00-07', 'admin'
);


-- =============================================================================
-- 7. CONVERSATIONS (crm_conversation)
-- =============================================================================

INSERT INTO crm_conversation (
    conversation_id, tenant_id,
    anchor_type, anchor_id,
    topic_category, topic_subcategory, subject,
    status, resolved_at, resolved_by, resolution_summary,
    sla_definition_id, sla_due_at, sla_breached,
    assigned_team, assigned_agent,
    created_at, updated_at, created_by, updated_by
) VALUES
-- Conv 1: Robert's retirement inquiry (Demo Case 1)
(
    '00000000-0000-0000-6000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10001',
    'Benefits', 'Retirement',
    'Robert Martinez — Retirement eligibility and benefit estimate',
    'OPEN', NULL, NULL, NULL,
    '00000000-0000-0000-4000-000000000002',
    '2026-03-15 17:00:00-07', FALSE,
    'member_services', 'jsmith',
    '2026-02-15 09:10:00-07', '2026-02-18 10:00:00-07', 'jsmith', 'jsmith'
),
-- Conv 2: Jennifer's service purchase inquiry (Demo Case 2)
(
    '00000000-0000-0000-6000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10002',
    'Benefits', 'Service Credit',
    'Jennifer Kim — Service credit purchase from prior government employment',
    'RESOLVED', '2026-02-01 14:45:00-07', 'agarcia',
    'Member received service purchase cost estimate and elected to proceed. Purchase payment plan established.',
    '00000000-0000-0000-4000-000000000001',
    '2026-02-05 10:15:00-07', FALSE,
    'member_services', 'agarcia',
    '2026-01-20 10:20:00-07', '2026-02-01 14:45:00-07', 'agarcia', 'agarcia'
),
-- Conv 3: David's early retirement question (Demo Case 3)
(
    '00000000-0000-0000-6000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10003',
    'Benefits', 'Retirement',
    'David Washington — Early retirement eligibility and reduction factors',
    'OPEN', NULL, NULL, NULL,
    '00000000-0000-0000-4000-000000000002',
    '2026-03-10 08:00:00-07', FALSE,
    'member_services', 'mwilson',
    '2026-02-20 08:30:00-07', '2026-02-25 11:00:00-07', 'mwilson', 'mwilson'
),
-- Conv 4: Robert's DRO case (Demo Case 4)
(
    '00000000-0000-0000-6000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10001',
    'Benefits', 'DRO',
    'Robert Martinez — DRO DR-2010-30214 (Patricia Martinez, alternate payee)',
    'PENDING', NULL, NULL, NULL,
    '00000000-0000-0000-4000-000000000003',
    '2026-03-10 17:00:00-07', FALSE,
    'legal_compliance', 'jsmith',
    '2026-01-10 14:30:00-07', '2026-02-05 10:30:00-07', 'jsmith', 'jsmith'
),
-- Conv 5: CCD contribution reporting question (Employer Portal)
(
    '00000000-0000-0000-6000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'EMPLOYER', '00000000-0000-0000-3000-000000000001',
    'Contributions', 'Reporting',
    'February 2026 contribution file — format change question',
    'OPEN', NULL, NULL, NULL,
    NULL, NULL, FALSE,
    'employer_services', 'jsmith',
    '2026-02-10 11:00:00-07', '2026-02-12 09:30:00-07', 'hr@ccd', 'jsmith'
),
-- Conv 6: CCD new hire enrollment inquiry (Employer Portal)
(
    '00000000-0000-0000-6000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'EMPLOYER', '00000000-0000-0000-3000-000000000001',
    'Enrollment', 'New Hire',
    'New hire batch — 3 employees starting March 2026',
    'RESOLVED', '2026-02-20 16:00:00-07', 'jsmith',
    'Enrollment forms received and processed for all 3 new hires. Benefits effective April 1, 2026.',
    NULL, NULL, FALSE,
    'employer_services', 'jsmith',
    '2026-02-05 14:00:00-07', '2026-02-20 16:00:00-07', 'hr@ccd', 'jsmith'
);


-- =============================================================================
-- 8. INTERACTIONS (crm_interaction)
-- =============================================================================

INSERT INTO crm_interaction (
    interaction_id, tenant_id, conversation_id,
    contact_id, org_id, agent_id,
    channel, interaction_type, category, subcategory,
    outcome, direction,
    started_at, ended_at, duration_seconds,
    external_call_id, queue_name, wait_time_seconds,
    message_subject, message_thread_id,
    summary, linked_case_id,
    wrap_up_code, wrap_up_seconds, visibility,
    created_at, created_by
) VALUES
-- 1. Robert called about retirement estimate (2026-02-15)
(
    '00000000-0000-0000-7000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000001',
    '00000000-0000-0000-1000-000000000001', NULL, 'jsmith',
    'PHONE_INBOUND', 'INQUIRY', 'Benefits', 'Retirement',
    'RESOLVED', 'INBOUND',
    '2026-02-15 09:10:00-07', '2026-02-15 09:22:00-07', 720,
    'CALL-20260215-09100001', 'member_services', 45,
    NULL, NULL,
    'Member called to inquire about retirement eligibility under Rule of 75. Verified 28.75 years of service credit. Discussed estimated benefit amount and timeline for formal estimate.',
    NULL, 'RET_EST_PROVIDED', 90, 'INTERNAL',
    '2026-02-15 09:22:00-07', 'jsmith'
),
-- 2. Robert received benefit estimate letter (2026-02-18)
(
    '00000000-0000-0000-7000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000001',
    '00000000-0000-0000-1000-000000000001', NULL, 'jsmith',
    'MAIL_OUTBOUND', 'NOTIFICATION', 'Benefits', 'Retirement',
    NULL, 'OUTBOUND',
    '2026-02-18 10:00:00-07', '2026-02-18 10:00:00-07', NULL,
    NULL, NULL, NULL,
    NULL, NULL,
    'Preliminary benefit estimate letter mailed to member. Includes Rule of 75 eligibility confirmation and estimated monthly benefit range.',
    NULL, NULL, NULL, 'PUBLIC',
    '2026-02-18 10:00:00-07', 'jsmith'
),
-- 3. Jennifer emailed about service purchase (2026-01-20)
(
    '00000000-0000-0000-7000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000002',
    '00000000-0000-0000-1000-000000000002', NULL, 'agarcia',
    'EMAIL_INBOUND', 'INQUIRY', 'Benefits', 'Service Credit',
    'INFO_PROVIDED', 'INBOUND',
    '2026-01-20 10:15:00-07', '2026-01-20 10:45:00-07', 1800,
    NULL, NULL, NULL,
    'Service Credit Purchase — Prior Government Employment', 'THR-20260120-JK001',
    'Member emailed asking about purchasing 2 years of service credit from prior government employment with Jefferson County. Replied with eligibility requirements and cost estimate process.',
    NULL, 'SVC_PURCH_INFO', NULL, 'PUBLIC',
    '2026-01-20 10:45:00-07', 'agarcia'
),
-- 4. Jennifer portal self-service estimate (2026-01-25)
(
    '00000000-0000-0000-7000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000002',
    '00000000-0000-0000-1000-000000000002', NULL, NULL,
    'PORTAL_ACTIVITY', 'REQUEST', 'Benefits', 'Service Credit',
    NULL, 'INBOUND',
    '2026-01-25 19:30:00-07', '2026-01-25 19:35:00-07', 300,
    NULL, NULL, NULL,
    NULL, NULL,
    'Member used self-service portal to generate a service credit purchase cost estimate for 2 years of prior Jefferson County service.',
    NULL, NULL, NULL, 'PUBLIC',
    '2026-01-25 19:35:00-07', 'system'
),
-- 5. Jennifer follow-up call (2026-02-01)
(
    '00000000-0000-0000-7000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000002',
    '00000000-0000-0000-1000-000000000002', NULL, 'agarcia',
    'PHONE_INBOUND', 'FOLLOW_UP', 'Benefits', 'Service Credit',
    'RESOLVED', 'INBOUND',
    '2026-02-01 14:30:00-07', '2026-02-01 14:38:00-07', 480,
    'CALL-20260201-14300002', 'member_services', 30,
    NULL, NULL,
    'Member called to follow up on service credit purchase estimate. Confirmed cost of $14,320. Member elected to proceed with lump-sum payment. Initiated purchase workflow.',
    NULL, 'SVC_PURCH_STARTED', 60, 'INTERNAL',
    '2026-02-01 14:38:00-07', 'agarcia'
),
-- 6. David secure message about early retirement (2026-02-20)
(
    '00000000-0000-0000-7000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000003',
    '00000000-0000-0000-1000-000000000003', NULL, 'mwilson',
    'SECURE_MESSAGE', 'INQUIRY', 'Benefits', 'Retirement',
    'INFO_PROVIDED', 'INBOUND',
    '2026-02-20 08:30:00-07', '2026-02-20 09:15:00-07', 2700,
    NULL, NULL, NULL,
    'Early Retirement — Reduction Factor Question', 'THR-20260220-DW001',
    'Member sent secure message asking about early retirement reduction under Tier 3. Replied with explanation of 6% annual reduction factor, Rule of 85 details, and comparison of early vs. deferred retirement.',
    NULL, 'RET_EST_PROVIDED', NULL, 'PUBLIC',
    '2026-02-20 09:15:00-07', 'mwilson'
),
-- 7. David system event — retirement application started (2026-02-25)
(
    '00000000-0000-0000-7000-000000000007',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000003',
    '00000000-0000-0000-1000-000000000003', NULL, NULL,
    'SYSTEM_EVENT', 'PROCESS_EVENT', 'Benefits', 'Retirement',
    'IN_PROGRESS', 'INTERNAL',
    '2026-02-25 11:00:00-07', '2026-02-25 11:00:00-07', NULL,
    NULL, NULL, NULL,
    NULL, NULL,
    'System event: Retirement application initiated via member portal. Application status set to PENDING. Awaiting beneficiary designation form and final salary verification.',
    NULL, 'RET_APP_RECEIVED', NULL, 'PUBLIC',
    '2026-02-25 11:00:00-07', 'system'
),
-- 8. Robert DRO document received (2026-01-10)
(
    '00000000-0000-0000-7000-000000000008',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000004',
    '00000000-0000-0000-1000-000000000001', NULL, 'jsmith',
    'MAIL_INBOUND', 'DOCUMENT_RECEIPT', 'Benefits', 'DRO',
    'IN_PROGRESS', 'INBOUND',
    '2026-01-10 14:00:00-07', '2026-01-10 14:30:00-07', 1800,
    NULL, NULL, NULL,
    NULL, NULL,
    'Court order DR-2010-30214 received via certified mail from Chen & Associates LLC. Order directs 40% of marital share to alternate payee Patricia Martinez. Document scanned and logged. Forwarded to legal compliance for review.',
    'DRO-2026-0001', 'DRO_RECEIVED', 120, 'INTERNAL',
    '2026-01-10 14:30:00-07', 'jsmith'
),
-- 9. Patricia called about DRO status (2026-02-05)
(
    '00000000-0000-0000-7000-000000000009',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000004',
    '00000000-0000-0000-1000-000000000004', NULL, 'jsmith',
    'PHONE_INBOUND', 'INQUIRY', 'Benefits', 'DRO',
    'INFO_PROVIDED', 'INBOUND',
    '2026-02-05 10:15:00-07', '2026-02-05 10:25:00-07', 600,
    'CALL-20260205-10150004', 'member_services', 60,
    NULL, NULL,
    'Alternate payee Patricia Martinez called to inquire about status of DRO DR-2010-30214. Informed that order is under legal review, estimated 4-6 weeks for determination. Verified identity and mailing address on file.',
    'DRO-2026-0001', 'DRO_UNDER_REVIEW', 45, 'INTERNAL',
    '2026-02-05 10:25:00-07', 'jsmith'
),
-- 10. CCD employer: contribution file format question (Conv 5, employer portal)
(
    '00000000-0000-0000-7000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000005',
    NULL, '00000000-0000-0000-3000-000000000001', NULL,
    'SECURE_MESSAGE', 'INQUIRY', 'Contributions', 'Reporting',
    NULL, 'INBOUND',
    '2026-02-10 11:00:00-07', '2026-02-10 11:00:00-07', NULL,
    NULL, NULL, NULL,
    NULL, NULL,
    'We noticed the contribution file template was updated for 2026. Can you confirm whether the new column for employee tier classification is required or optional? We want to make sure our February submission is accepted.',
    NULL, NULL, NULL, 'PUBLIC',
    '2026-02-10 11:00:00-07', 'hr@ccd'
),
-- 11. DERP staff reply to CCD contribution question (Conv 5)
(
    '00000000-0000-0000-7000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000005',
    NULL, '00000000-0000-0000-3000-000000000001', 'jsmith',
    'SECURE_MESSAGE', 'FOLLOW_UP', 'Contributions', 'Reporting',
    'INFO_PROVIDED', 'OUTBOUND',
    '2026-02-12 09:30:00-07', '2026-02-12 09:30:00-07', NULL,
    NULL, NULL, NULL,
    NULL, NULL,
    'The tier classification column is optional for the February 2026 submission. It will become required starting with the April 2026 reporting period. We will send updated documentation next week.',
    NULL, NULL, NULL, 'PUBLIC',
    '2026-02-12 09:30:00-07', 'jsmith'
),
-- 12. CCD employer: new hire enrollment request (Conv 6, employer portal)
(
    '00000000-0000-0000-7000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000006',
    NULL, '00000000-0000-0000-3000-000000000001', NULL,
    'SECURE_MESSAGE', 'REQUEST', 'Enrollment', 'New Hire',
    NULL, 'INBOUND',
    '2026-02-05 14:00:00-07', '2026-02-05 14:00:00-07', NULL,
    NULL, NULL, NULL,
    NULL, NULL,
    'We have 3 new employees starting March 3, 2026 in the Parks & Recreation department. Enrollment forms are attached. Please confirm receipt and expected benefits effective date.',
    NULL, NULL, NULL, 'PUBLIC',
    '2026-02-05 14:00:00-07', 'hr@ccd'
),
-- 13. DERP staff reply confirming enrollment processing (Conv 6)
(
    '00000000-0000-0000-7000-000000000013',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000006',
    NULL, '00000000-0000-0000-3000-000000000001', 'jsmith',
    'SECURE_MESSAGE', 'FOLLOW_UP', 'Enrollment', 'New Hire',
    'RESOLVED', 'OUTBOUND',
    '2026-02-20 16:00:00-07', '2026-02-20 16:00:00-07', NULL,
    NULL, NULL, NULL,
    NULL, NULL,
    'All 3 enrollment forms have been processed. Benefits will be effective April 1, 2026, per the standard first-of-month-following-30-days rule. Welcome packets will be mailed to the employees directly.',
    NULL, NULL, NULL, 'PUBLIC',
    '2026-02-20 16:00:00-07', 'jsmith'
);


-- =============================================================================
-- 9. INTERACTION LINKS (crm_interaction_link)
-- =============================================================================

INSERT INTO crm_interaction_link (
    link_id, from_interaction_id, to_interaction_id, link_type,
    created_at, created_by
) VALUES
-- Robert's estimate letter follows his phone call
(
    '00000000-0000-0000-7100-000000000001',
    '00000000-0000-0000-7000-000000000001',
    '00000000-0000-0000-7000-000000000002',
    'FOLLOW_UP',
    '2026-02-18 10:00:00-07', 'jsmith'
),
-- Jennifer's follow-up call relates to her initial email
(
    '00000000-0000-0000-7100-000000000002',
    '00000000-0000-0000-7000-000000000003',
    '00000000-0000-0000-7000-000000000005',
    'FOLLOW_UP',
    '2026-02-01 14:38:00-07', 'agarcia'
),
-- David's system event follows his secure message
(
    '00000000-0000-0000-7100-000000000003',
    '00000000-0000-0000-7000-000000000006',
    '00000000-0000-0000-7000-000000000007',
    'RELATED',
    '2026-02-25 11:00:00-07', 'system'
),
-- Patricia's status call relates to the DRO document receipt
(
    '00000000-0000-0000-7100-000000000004',
    '00000000-0000-0000-7000-000000000008',
    '00000000-0000-0000-7000-000000000009',
    'FOLLOW_UP',
    '2026-02-05 10:25:00-07', 'jsmith'
);


-- =============================================================================
-- 10. NOTES (crm_note)
-- =============================================================================

INSERT INTO crm_note (
    note_id, interaction_id,
    template_id, category, subcategory, summary, outcome, next_step,
    narrative, sentiment, urgent_flag,
    ai_suggested, ai_confidence,
    created_at, created_by, updated_at, updated_by
) VALUES
-- Note on Robert's retirement call
(
    '00000000-0000-0000-8000-000000000001',
    '00000000-0000-0000-7000-000000000001',
    NULL, 'Benefits', 'Retirement',
    'Retirement eligibility inquiry — Rule of 75',
    'RESOLVED',
    'Generate formal benefit estimate and mail to member within 30 days.',
    'Member inquired about retirement eligibility under Rule of 75. Confirmed 28.75 years of service. Discussed estimated benefit timeline.',
    'POSITIVE', FALSE,
    FALSE, NULL,
    '2026-02-15 09:22:00-07', 'jsmith', '2026-02-15 09:22:00-07', 'jsmith'
),
-- Note on Jennifer's email
(
    '00000000-0000-0000-8000-000000000002',
    '00000000-0000-0000-7000-000000000003',
    NULL, 'Benefits', 'Service Credit',
    'Service credit purchase inquiry — prior government employment',
    'INFO_PROVIDED',
    'Member to review cost estimate from portal and call back to initiate purchase.',
    'Member asked about purchasing 2 years of service credit from prior government employment. Explained impact on benefit calculation.',
    'NEUTRAL', FALSE,
    FALSE, NULL,
    '2026-01-20 10:45:00-07', 'agarcia', '2026-01-20 10:45:00-07', 'agarcia'
),
-- Note on David's secure message
(
    '00000000-0000-0000-8000-000000000003',
    '00000000-0000-0000-7000-000000000006',
    NULL, 'Benefits', 'Retirement',
    'Early retirement reduction inquiry — Tier 3',
    'INFO_PROVIDED',
    'Prepare comparison scenarios: early retirement at age 52 vs. deferred retirement at 55 vs. Rule of 85.',
    'Member concerned about early retirement reduction. Explained Tier 3 6% annual reduction factor and Rule of 85 requirement.',
    'NEUTRAL', FALSE,
    FALSE, NULL,
    '2026-02-20 09:15:00-07', 'mwilson', '2026-02-20 09:15:00-07', 'mwilson'
),
-- Note on DRO document receipt
(
    '00000000-0000-0000-8000-000000000004',
    '00000000-0000-0000-7000-000000000008',
    NULL, 'Benefits', 'DRO',
    'DRO received — DR-2010-30214',
    'IN_PROGRESS',
    'Legal compliance to review order for compliance with plan rules. Target determination within 6 weeks.',
    'Court order DR-2010-30214 received for review. 40% of marital share to alternate payee Patricia Martinez.',
    'NEUTRAL', FALSE,
    FALSE, NULL,
    '2026-01-10 14:30:00-07', 'jsmith', '2026-01-10 14:30:00-07', 'jsmith'
);


-- =============================================================================
-- 11. COMMITMENTS (crm_commitment)
-- =============================================================================

INSERT INTO crm_commitment (
    commitment_id, tenant_id, interaction_id, contact_id, conversation_id,
    description, target_date, owner_agent, owner_team,
    status, fulfilled_at, fulfilled_by, fulfillment_note,
    alert_days_before, alert_sent,
    created_at, created_by, updated_at, updated_by
) VALUES
-- Send Robert formal benefit estimate
(
    '00000000-0000-0000-9000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-7000-000000000001',
    '00000000-0000-0000-1000-000000000001',
    '00000000-0000-0000-6000-000000000001',
    'Send formal benefit estimate letter to Robert Martinez with Rule of 75 eligibility confirmation, estimated monthly benefit amount, and payment option summary.',
    '2026-03-15', 'jsmith', 'member_services',
    'PENDING', NULL, NULL, NULL,
    3, FALSE,
    '2026-02-15 09:22:00-07', 'jsmith', '2026-02-15 09:22:00-07', 'jsmith'
),
-- Send David early retirement comparison scenarios
(
    '00000000-0000-0000-9000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-7000-000000000006',
    '00000000-0000-0000-1000-000000000003',
    '00000000-0000-0000-6000-000000000003',
    'Prepare and send early retirement comparison scenarios to David Washington: (1) early retirement at age 52, (2) deferred retirement at 55, (3) Rule of 85 full eligibility.',
    '2026-03-10', 'mwilson', 'member_services',
    'IN_PROGRESS', NULL, NULL, NULL,
    2, FALSE,
    '2026-02-20 09:15:00-07', 'mwilson', '2026-02-25 11:00:00-07', 'mwilson'
);


-- =============================================================================
-- 12. OUTREACH (crm_outreach)
-- =============================================================================

INSERT INTO crm_outreach (
    outreach_id, tenant_id,
    contact_id, org_id,
    trigger_type, trigger_detail,
    outreach_type, subject, talking_points, priority,
    assigned_agent, assigned_team,
    status, attempt_count, max_attempts,
    last_attempt_at, completed_at,
    result_interaction_id, result_outcome,
    scheduled_for, due_by,
    created_at, created_by, updated_at, updated_by
) VALUES
-- Contact Robert about retirement application deadline
(
    '00000000-0000-0000-a000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-1000-000000000001', NULL,
    'milestone_approaching',
    'Member reaches Rule of 75 eligibility. Age 63 + 28.75 years service = 91.75. Currently eligible. Application deadline for preferred effective date approaching.',
    'PHONE',
    'Retirement application deadline — Robert Martinez',
    'Confirm member is aware of upcoming retirement eligibility window. Discuss application timeline and required documents. Remind about beneficiary designation form requirement. Offer to schedule appointment with retirement counselor.',
    'HIGH',
    'jsmith', 'member_services',
    'ASSIGNED', 0, 3,
    NULL, NULL,
    NULL, NULL,
    '2026-03-05 09:00:00-07', '2026-03-15 17:00:00-07',
    '2026-02-18 10:00:00-07', 'system', '2026-02-18 10:00:00-07', 'system'
),
-- Contact David about missing beneficiary designation form
(
    '00000000-0000-0000-a000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-1000-000000000003', NULL,
    'missing_form',
    'Retirement application initiated 2026-02-25 but beneficiary designation form (Form BEN-1) not yet on file.',
    'SECURE_MESSAGE',
    'Missing beneficiary designation form — David Washington',
    'Inform member that beneficiary designation form (Form BEN-1) is required to complete retirement application. Provide link to downloadable form on member portal. Explain that application cannot be finalized without this form.',
    'NORMAL',
    'mwilson', 'member_services',
    'PENDING', 0, 3,
    NULL, NULL,
    NULL, NULL,
    '2026-03-03 09:00:00-07', '2026-03-10 17:00:00-07',
    '2026-02-25 11:00:00-07', 'system', '2026-02-25 11:00:00-07', 'system'
);


-- =============================================================================
-- 13. SLA TRACKING (crm_sla_tracking)
-- =============================================================================

INSERT INTO crm_sla_tracking (
    tracking_id, conversation_id, sla_id,
    started_at, response_due_at, resolution_due_at,
    first_response_at, resolved_at,
    response_breached, resolution_breached, warn_sent, escalation_sent
) VALUES
-- Conv 1: Robert retirement inquiry — Retirement Application SLA
(
    '00000000-0000-0000-b000-000000000001',
    '00000000-0000-0000-6000-000000000001',
    '00000000-0000-0000-4000-000000000002',
    '2026-02-15 09:10:00-07',
    '2026-02-15 17:10:00-07',
    '2026-02-22 09:10:00-07',
    '2026-02-15 09:22:00-07', NULL,
    FALSE, FALSE, FALSE, FALSE
),
-- Conv 2: Jennifer service credit — Phone Inquiry SLA
(
    '00000000-0000-0000-b000-000000000002',
    '00000000-0000-0000-6000-000000000002',
    '00000000-0000-0000-4000-000000000001',
    '2026-01-20 10:15:00-07',
    '2026-01-20 14:15:00-07',
    '2026-01-22 10:15:00-07',
    '2026-01-20 10:45:00-07', '2026-02-01 14:45:00-07',
    FALSE, FALSE, FALSE, FALSE
),
-- Conv 3: David early retirement — Retirement Application SLA
(
    '00000000-0000-0000-b000-000000000003',
    '00000000-0000-0000-6000-000000000003',
    '00000000-0000-0000-4000-000000000002',
    '2026-02-20 08:30:00-07',
    '2026-02-20 16:30:00-07',
    '2026-02-27 08:30:00-07',
    '2026-02-20 09:15:00-07', NULL,
    FALSE, FALSE, FALSE, FALSE
),
-- Conv 4: Robert DRO — DRO Processing SLA
(
    '00000000-0000-0000-b000-000000000004',
    '00000000-0000-0000-6000-000000000004',
    '00000000-0000-0000-4000-000000000003',
    '2026-01-10 14:00:00-07',
    '2026-01-10 22:00:00-07',
    '2026-01-24 14:00:00-07',
    '2026-01-10 14:30:00-07', NULL,
    FALSE, FALSE, FALSE, FALSE
);


COMMIT;
