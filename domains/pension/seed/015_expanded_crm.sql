-- =============================================================================
-- Expanded CRM Seed Data — Members 10006–10012
-- NoUI Platform — CRM contacts, conversations, and interactions
-- =============================================================================
-- Extends 003_crm_seed.sql with 7 new member contacts, 7 conversations,
-- and 18 interactions for expanded demo data.
--
-- All records use tenant_id = '00000000-0000-0000-0000-000000000001'.
-- UUIDs continue the sequential pattern from the base CRM seed:
--   Contacts:      00000000-0000-0000-1000-000000000006 .. 012
--   Conversations: 00000000-0000-0000-6000-000000000007 .. 013
--   Interactions:  00000000-0000-0000-7000-000000000014 .. 031
--
-- Note: Conversation and interaction ranges start past existing base seed
-- (base uses conversations ..001–006, interactions ..001–013) to avoid conflicts.
-- =============================================================================

BEGIN;


-- =============================================================================
-- 1. CONTACTS (crm_contact) — 7 new members
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
-- Maria Santos (10006) — Active Tier 1 member, prefers phone
(
    '00000000-0000-0000-1000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10006',
    'Maria', 'Santos', '1965-07-20', 'F',
    'msantos@example.com', '303-555-0404', 'HOME',
    'en', 'PHONE',
    TRUE, '2026-02-10 10:00:00-07', 'mtorres',
    NULL, NULL,
    TRUE, '2026-02-10 09:55:00-07', '2026-02-10 09:58:00-07',
    '2026-01-01 08:00:00-07', '2026-02-10 10:00:00-07', 'system_import', 'mtorres'
),
-- James Wilson (10007) — Active Tier 2 member, prefers email
(
    '00000000-0000-0000-1000-000000000007',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10007',
    'James', 'Wilson', '1972-04-03', 'M',
    'jwilson@example.com', '303-555-0505', 'CELL',
    'en', 'EMAIL',
    TRUE, '2026-01-15 14:20:00-07', 'lpark',
    NULL, NULL,
    TRUE, '2026-01-15 14:15:00-07', '2026-01-15 14:18:00-07',
    '2026-01-01 08:00:00-07', '2026-01-15 14:20:00-07', 'system_import', 'lpark'
),
-- Lisa Park member (10008) — Active Tier 3 member, prefers secure message
(
    '00000000-0000-0000-1000-000000000008',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10008',
    'Lisa', 'Park', '1988-12-05', 'F',
    'lpark_member@example.com', '720-555-0606', 'CELL',
    'en', 'SECURE_MESSAGE',
    TRUE, '2026-02-01 11:30:00-07', 'jwilson_staff',
    NULL, NULL,
    TRUE, '2026-02-01 11:25:00-07', '2026-02-01 11:28:00-07',
    '2026-01-01 08:00:00-07', '2026-02-01 11:30:00-07', 'system_import', 'jwilson_staff'
),
-- Thomas O'Brien (10009) — Terminated member, no email, prefers mail
(
    '00000000-0000-0000-1000-000000000009',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10009',
    'Thomas', 'O''Brien', '1968-01-15', 'M',
    NULL, '303-555-0707', 'HOME',
    'en', 'MAIL',
    FALSE, NULL, NULL,
    NULL, NULL,
    NULL, NULL, '2026-01-05 10:00:00-07',
    '2026-01-01 08:00:00-07', '2026-01-05 10:00:00-07', 'system_import', 'system_import'
),
-- Angela Davis (10010) — Active Tier 2 member, prefers email
(
    '00000000-0000-0000-1000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10010',
    'Angela', 'Davis', '1975-05-28', 'F',
    'adavis@example.com', '720-555-0808', 'CELL',
    'en', 'EMAIL',
    TRUE, '2026-02-20 09:15:00-07', 'schen',
    NULL, NULL,
    TRUE, '2026-02-20 09:10:00-07', '2026-02-20 09:13:00-07',
    '2026-01-01 08:00:00-07', '2026-02-20 09:15:00-07', 'system_import', 'schen'
),
-- Richard Chen (10011) — Active Tier 3 member, prefers secure message
(
    '00000000-0000-0000-1000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10011',
    'Richard', 'Chen', '1980-09-12', 'M',
    'rchen@example.com', '720-555-0909', 'CELL',
    'en', 'SECURE_MESSAGE',
    TRUE, '2026-01-28 15:45:00-07', 'mtorres',
    NULL, NULL,
    TRUE, '2026-01-28 15:40:00-07', '2026-01-28 15:43:00-07',
    '2026-01-01 08:00:00-07', '2026-01-28 15:45:00-07', 'system_import', 'mtorres'
),
-- Patricia Moore (10012) — Active Tier 1 member, prefers phone
(
    '00000000-0000-0000-1000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10012',
    'Patricia', 'Moore', '1966-11-30', 'F',
    'pmoore@example.com', '303-555-1010', 'HOME',
    'en', 'PHONE',
    TRUE, '2026-02-05 08:30:00-07', 'lpark',
    NULL, NULL,
    TRUE, '2026-02-05 08:25:00-07', '2026-02-05 08:28:00-07',
    '2026-01-01 08:00:00-07', '2026-02-05 08:30:00-07', 'system_import', 'lpark'
)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 2. CONVERSATIONS (crm_conversation) — 1 per member
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
-- Conv 7: Maria Santos — Retirement estimate request
(
    '00000000-0000-0000-6000-000000000007',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10006',
    'Benefits', 'Retirement',
    'Maria Santos — Retirement estimate and payment option inquiry',
    'OPEN', NULL, NULL, NULL,
    '00000000-0000-0000-4000-000000000002',
    '2026-03-20 17:00:00-07', FALSE,
    'member_services', 'mtorres',
    '2026-02-10 10:15:00-07', '2026-02-28 14:00:00-07', 'mtorres', 'mtorres'
),
-- Conv 8: James Wilson — Service credit purchase
(
    '00000000-0000-0000-6000-000000000008',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10007',
    'Benefits', 'Service Credit',
    'James Wilson — Service credit purchase inquiry for prior state employment',
    'OPEN', NULL, NULL, NULL,
    '00000000-0000-0000-4000-000000000001',
    '2026-03-01 14:20:00-07', FALSE,
    'member_services', 'lpark',
    '2026-01-15 14:30:00-07', '2026-02-20 11:00:00-07', 'lpark', 'lpark'
),
-- Conv 9: Lisa Park (member) — Beneficiary update
(
    '00000000-0000-0000-6000-000000000009',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10008',
    'Account', 'Beneficiary Update',
    'Lisa Park — Beneficiary designation update after marriage',
    'OPEN', NULL, NULL, NULL,
    NULL, NULL, FALSE,
    'member_services', 'jwilson_staff',
    '2026-02-01 11:45:00-07', '2026-02-05 09:30:00-07', 'jwilson_staff', 'jwilson_staff'
),
-- Conv 10: Thomas O'Brien — Refund status (terminated member)
(
    '00000000-0000-0000-6000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10009',
    'Benefits', 'Retirement',
    'Thomas O''Brien — Contribution refund status after termination',
    'PENDING', NULL, NULL, NULL,
    '00000000-0000-0000-4000-000000000001',
    '2026-02-15 10:00:00-07', FALSE,
    'member_services', 'schen',
    '2026-01-05 10:15:00-07', '2026-01-20 14:00:00-07', 'schen', 'schen'
),
-- Conv 11: Angela Davis — Early retirement eligibility
(
    '00000000-0000-0000-6000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10010',
    'Benefits', 'Retirement',
    'Angela Davis — Early retirement eligibility and reduction factor inquiry',
    'OPEN', NULL, NULL, NULL,
    '00000000-0000-0000-4000-000000000002',
    '2026-03-25 17:00:00-07', FALSE,
    'member_services', 'schen',
    '2026-02-20 09:30:00-07', '2026-03-05 11:00:00-07', 'schen', 'schen'
),
-- Conv 12: Richard Chen — Contribution history inquiry
(
    '00000000-0000-0000-6000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10011',
    'Contributions', 'Member Inquiry',
    'Richard Chen — Contribution history and account balance inquiry',
    'OPEN', NULL, NULL, NULL,
    NULL, NULL, FALSE,
    'member_services', 'mtorres',
    '2026-01-28 16:00:00-07', '2026-02-10 10:30:00-07', 'mtorres', 'mtorres'
),
-- Conv 13: Patricia Moore — Retirement application
(
    '00000000-0000-0000-6000-000000000013',
    '00000000-0000-0000-0000-000000000001',
    'MEMBER', '10012',
    'Benefits', 'Retirement',
    'Patricia Moore — Retirement application and benefit estimate follow-up',
    'OPEN', NULL, NULL, NULL,
    '00000000-0000-0000-4000-000000000002',
    '2026-03-15 17:00:00-07', FALSE,
    'member_services', 'lpark',
    '2026-02-05 08:45:00-07', '2026-03-01 15:00:00-07', 'lpark', 'lpark'
)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 3. INTERACTIONS (crm_interaction) — 18 total, 2–3 per member
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

-- ---- Maria Santos (10006): 3 interactions ----

-- 14. Maria called about retirement estimate
(
    '00000000-0000-0000-7000-000000000014',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000007',
    '00000000-0000-0000-1000-000000000006', NULL, 'mtorres',
    'PHONE_INBOUND', 'INQUIRY', 'Benefits', 'Retirement',
    'INFO_PROVIDED', 'INBOUND',
    '2026-02-10 10:15:00-07', '2026-02-10 10:32:00-07', 1020,
    'CALL-20260210-10150004', 'member_services', 55,
    NULL, NULL,
    'Member called to request a retirement benefit estimate. Confirmed 29.5 years of Tier 1 service credit and eligibility under Rule of 75. Discussed estimated monthly benefit range and SLA payment options. Member requested formal estimate letter.',
    NULL, 'RET_EST_PROVIDED', 75, 'INTERNAL',
    '2026-02-10 10:32:00-07', 'mtorres'
),
-- 15. Maria received estimate via email
(
    '00000000-0000-0000-7000-000000000015',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000007',
    '00000000-0000-0000-1000-000000000006', NULL, 'mtorres',
    'EMAIL_OUTBOUND', 'NOTIFICATION', 'Benefits', 'Retirement',
    NULL, 'OUTBOUND',
    '2026-02-15 14:00:00-07', '2026-02-15 14:00:00-07', NULL,
    NULL, NULL, NULL,
    'Retirement Benefit Estimate — Maria Santos', 'THR-20260215-MS001',
    'Emailed formal retirement benefit estimate to member. Included estimated monthly benefit amount, SLA and Joint & Survivor payment option comparisons, and next steps for application submission.',
    NULL, NULL, NULL, 'PUBLIC',
    '2026-02-15 14:00:00-07', 'mtorres'
),
-- 16. Maria sent portal message with follow-up questions
(
    '00000000-0000-0000-7000-000000000016',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000007',
    '00000000-0000-0000-1000-000000000006', NULL, 'mtorres',
    'SECURE_MESSAGE', 'FOLLOW_UP', 'Benefits', 'Retirement',
    'INFO_PROVIDED', 'INBOUND',
    '2026-02-28 13:45:00-07', '2026-02-28 14:00:00-07', 900,
    NULL, NULL, NULL,
    'RE: Retirement Benefit Estimate — Maria Santos', 'THR-20260215-MS001',
    'Member sent secure message asking about the difference between Joint & Survivor 50% and 100% options. Replied with explanation of survivor benefit reduction factors and how each option affects the monthly benefit amount.',
    NULL, 'RET_PAY_INFO', NULL, 'PUBLIC',
    '2026-02-28 14:00:00-07', 'mtorres'
),

-- ---- James Wilson (10007): 3 interactions ----

-- 17. James called about purchased service credit
(
    '00000000-0000-0000-7000-000000000017',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000008',
    '00000000-0000-0000-1000-000000000007', NULL, 'lpark',
    'PHONE_INBOUND', 'INQUIRY', 'Benefits', 'Service Credit',
    'INFO_PROVIDED', 'INBOUND',
    '2026-01-15 14:30:00-07', '2026-01-15 14:48:00-07', 1080,
    'CALL-20260115-14300005', 'member_services', 40,
    NULL, NULL,
    'Member called about purchasing 3 years of service credit from prior Colorado state employment. Explained eligibility requirements, cost calculation methodology, and the distinction between purchased service counting toward benefit calculation but not toward Rule of 75.',
    NULL, 'SVC_PURCH_INFO', 90, 'INTERNAL',
    '2026-01-15 14:48:00-07', 'lpark'
),
-- 18. James submitted prior service documentation via email
(
    '00000000-0000-0000-7000-000000000018',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000008',
    '00000000-0000-0000-1000-000000000007', NULL, 'lpark',
    'EMAIL_INBOUND', 'DOCUMENT_RECEIPT', 'Benefits', 'Service Credit',
    'WORK_ITEM_CREATED', 'INBOUND',
    '2026-02-01 09:00:00-07', '2026-02-01 09:15:00-07', 900,
    NULL, NULL, NULL,
    'Service Credit Documentation — James Wilson', 'THR-20260201-JW001',
    'Member emailed scanned copies of prior employment verification from Colorado Department of Personnel. Documentation covers 3 years (2005-2008) of state service. Forwarded to service credit verification team for processing.',
    NULL, 'SVC_VERIFY_PENDING', NULL, 'INTERNAL',
    '2026-02-01 09:15:00-07', 'lpark'
),
-- 19. James received follow-up call with cost estimate
(
    '00000000-0000-0000-7000-000000000019',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000008',
    '00000000-0000-0000-1000-000000000007', NULL, 'lpark',
    'PHONE_OUTBOUND', 'FOLLOW_UP', 'Benefits', 'Service Credit',
    'INFO_PROVIDED', 'OUTBOUND',
    '2026-02-20 10:30:00-07', '2026-02-20 10:45:00-07', 900,
    'CALL-20260220-10300005', 'member_services', NULL,
    NULL, NULL,
    'Called member to provide service credit purchase cost estimate. Prior service verified at 3 years. Total purchase cost is $21,480. Discussed lump-sum and installment payment options. Member will review and call back to initiate payment.',
    NULL, 'SVC_PURCH_INFO', 60, 'INTERNAL',
    '2026-02-20 10:45:00-07', 'lpark'
),

-- ---- Lisa Park member (10008): 2 interactions ----

-- 20. Lisa sent portal message about beneficiary update
(
    '00000000-0000-0000-7000-000000000020',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000009',
    '00000000-0000-0000-1000-000000000008', NULL, 'jwilson_staff',
    'SECURE_MESSAGE', 'REQUEST', 'Account', 'Beneficiary Update',
    'WORK_ITEM_CREATED', 'INBOUND',
    '2026-02-01 11:45:00-07', '2026-02-01 12:00:00-07', 900,
    NULL, NULL, NULL,
    'Beneficiary Designation Update — Lisa Park', 'THR-20260201-LP001',
    'Member requested update to beneficiary designation following recent marriage. Current beneficiary is mother (Margaret Park). Member wants to add spouse as primary beneficiary. Informed member that Form BEN-1 is required and provided link to downloadable form on member portal.',
    NULL, 'BENE_FORM_NEEDED', NULL, 'PUBLIC',
    '2026-02-01 12:00:00-07', 'jwilson_staff'
),
-- 21. Lisa received reply with form instructions
(
    '00000000-0000-0000-7000-000000000021',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000009',
    '00000000-0000-0000-1000-000000000008', NULL, 'jwilson_staff',
    'SECURE_MESSAGE', 'FOLLOW_UP', 'Account', 'Beneficiary Update',
    'INFO_PROVIDED', 'OUTBOUND',
    '2026-02-05 09:15:00-07', '2026-02-05 09:30:00-07', 900,
    NULL, NULL, NULL,
    'RE: Beneficiary Designation Update — Lisa Park', 'THR-20260201-LP001',
    'Replied to member with detailed instructions for completing Form BEN-1. Explained that the form requires notarized signatures if designating a non-spouse beneficiary, but spouse designation can be submitted without notarization. Member acknowledged and will submit form via portal.',
    NULL, 'BENE_FORM_NEEDED', NULL, 'PUBLIC',
    '2026-02-05 09:30:00-07', 'jwilson_staff'
),

-- ---- Thomas O'Brien (10009): 2 interactions ----

-- 22. Refund status letter mailed to Thomas
(
    '00000000-0000-0000-7000-000000000022',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000010',
    '00000000-0000-0000-1000-000000000009', NULL, 'schen',
    'MAIL_OUTBOUND', 'NOTIFICATION', 'Benefits', 'Retirement',
    NULL, 'OUTBOUND',
    '2026-01-05 10:15:00-07', '2026-01-05 10:15:00-07', NULL,
    NULL, NULL, NULL,
    NULL, NULL,
    'Mailed contribution refund status letter to terminated member. Letter includes total employee contributions ($48,720.35), estimated refund amount, and instructions for requesting a distribution. Refund application form (Form REF-1) enclosed.',
    NULL, NULL, NULL, 'PUBLIC',
    '2026-01-05 10:15:00-07', 'schen'
),
-- 23. Thomas called about refund status
(
    '00000000-0000-0000-7000-000000000023',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000010',
    '00000000-0000-0000-1000-000000000009', NULL, 'schen',
    'PHONE_INBOUND', 'INQUIRY', 'Benefits', 'Retirement',
    'INFO_PROVIDED', 'INBOUND',
    '2026-01-20 13:45:00-07', '2026-01-20 13:58:00-07', 780,
    'CALL-20260120-13450007', 'member_services', 120,
    NULL, NULL,
    'Terminated member called to ask about contribution refund timeline. Identity could not be fully verified — member does not have email on file and security questions were partially answered. Provided general refund processing timeline (6-8 weeks) but could not discuss account-specific details. Advised member to visit office with photo ID for identity verification.',
    NULL, NULL, 60, 'INTERNAL',
    '2026-01-20 13:58:00-07', 'schen'
),

-- ---- Angela Davis (10010): 3 interactions ----

-- 24. Angela walked in to office for early retirement consultation
(
    '00000000-0000-0000-7000-000000000024',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000011',
    '00000000-0000-0000-1000-000000000010', NULL, 'schen',
    'WALK_IN', 'INQUIRY', 'Benefits', 'Retirement',
    'INFO_PROVIDED', 'INBOUND',
    '2026-02-20 09:30:00-07', '2026-02-20 10:15:00-07', 2700,
    NULL, NULL, NULL,
    NULL, NULL,
    'Member visited office for in-person early retirement consultation. Reviewed Tier 2 eligibility: 25 years of service, age 50. Discussed Rule of 75 requirement (current score: 50 + 25 = 75, meets threshold). Explained 3% annual reduction factor for Tier 2 if retiring before age 65. Provided comparison scenarios for age 50 vs. 55 vs. 65 retirement.',
    NULL, 'RET_EST_PROVIDED', 120, 'INTERNAL',
    '2026-02-20 10:15:00-07', 'schen'
),
-- 25. Angela received status update email with comparison scenarios
(
    '00000000-0000-0000-7000-000000000025',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000011',
    '00000000-0000-0000-1000-000000000010', NULL, 'schen',
    'EMAIL_OUTBOUND', 'STATUS_UPDATE', 'Benefits', 'Retirement',
    NULL, 'OUTBOUND',
    '2026-02-25 15:00:00-07', '2026-02-25 15:00:00-07', NULL,
    NULL, NULL, NULL,
    'Early Retirement Comparison — Angela Davis', 'THR-20260225-AD001',
    'Emailed detailed comparison of retirement scenarios as discussed during office visit. Included three scenarios: (1) immediate retirement at age 50 with 45% reduction, (2) retirement at age 55 with 30% reduction, (3) full retirement at age 65 with no reduction. Attached projected monthly benefit amounts for each scenario.',
    NULL, NULL, NULL, 'PUBLIC',
    '2026-02-25 15:00:00-07', 'schen'
),
-- 26. Angela called with follow-up questions about reduction factors
(
    '00000000-0000-0000-7000-000000000026',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000011',
    '00000000-0000-0000-1000-000000000010', NULL, 'schen',
    'PHONE_INBOUND', 'FOLLOW_UP', 'Benefits', 'Retirement',
    'INFO_PROVIDED', 'INBOUND',
    '2026-03-05 10:45:00-07', '2026-03-05 10:58:00-07', 780,
    'CALL-20260305-10450008', 'member_services', 35,
    NULL, NULL,
    'Member called with questions about the comparison scenarios. Clarified that Tier 2 reduction is 3% per year under age 65, not 6%. Confirmed that Rule of 75 eligibility does not eliminate the early retirement reduction. Member considering retirement at age 55 to minimize reduction while not waiting until 65.',
    NULL, 'RET_EST_PROVIDED', 45, 'INTERNAL',
    '2026-03-05 10:58:00-07', 'schen'
),

-- ---- Richard Chen (10011): 2 interactions ----

-- 27. Richard sent portal message about contribution history
(
    '00000000-0000-0000-7000-000000000027',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000012',
    '00000000-0000-0000-1000-000000000011', NULL, 'mtorres',
    'SECURE_MESSAGE', 'INQUIRY', 'Contributions', 'Member Inquiry',
    'INFO_PROVIDED', 'INBOUND',
    '2026-01-28 16:00:00-07', '2026-01-28 16:30:00-07', 1800,
    NULL, NULL, NULL,
    'Contribution History Request — Richard Chen', 'THR-20260128-RC001',
    'Member requested detailed contribution history for the past 5 years. Concerned about a gap in contributions during a leave of absence in 2023. Replied with contribution statement and explained that unpaid leave periods do not accrue service credit but the member can purchase the missing service credit.',
    NULL, 'CONTRIB_INFO_PROVIDED', NULL, 'PUBLIC',
    '2026-01-28 16:30:00-07', 'mtorres'
),
-- 28. Richard received follow-up call about leave purchase option
(
    '00000000-0000-0000-7000-000000000028',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000012',
    '00000000-0000-0000-1000-000000000011', NULL, 'mtorres',
    'PHONE_OUTBOUND', 'OUTREACH', 'Contributions', 'Member Inquiry',
    'INFO_PROVIDED', 'OUTBOUND',
    '2026-02-10 10:00:00-07', '2026-02-10 10:18:00-07', 1080,
    'CALL-20260210-10000009', 'member_services', NULL,
    NULL, NULL,
    'Called member to follow up on contribution gap from 2023 leave of absence. Explained service credit purchase option for the 4-month unpaid leave period. Member interested but wants to wait until closer to retirement to decide. Noted in file for future outreach.',
    NULL, 'CONTRIB_INFO_PROVIDED', 60, 'INTERNAL',
    '2026-02-10 10:18:00-07', 'mtorres'
),

-- ---- Patricia Moore (10012): 3 interactions ----

-- 29. Patricia called about retirement application
(
    '00000000-0000-0000-7000-000000000029',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000013',
    '00000000-0000-0000-1000-000000000012', NULL, 'lpark',
    'PHONE_INBOUND', 'INQUIRY', 'Benefits', 'Retirement',
    'INFO_PROVIDED', 'INBOUND',
    '2026-02-05 08:45:00-07', '2026-02-05 09:05:00-07', 1200,
    'CALL-20260205-08450010', 'member_services', 30,
    NULL, NULL,
    'Member called to inquire about retirement application process. Confirmed Tier 1 eligibility: age 59, 30.25 years of service, Rule of 75 score of 89.25. Explained application timeline, required documents (beneficiary form, direct deposit authorization), and estimated 60-day processing time.',
    NULL, 'RET_APP_RECEIVED', 90, 'INTERNAL',
    '2026-02-05 09:05:00-07', 'lpark'
),
-- 30. Patricia received application packet notification email
(
    '00000000-0000-0000-7000-000000000030',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000013',
    '00000000-0000-0000-1000-000000000012', NULL, 'lpark',
    'EMAIL_OUTBOUND', 'NOTIFICATION', 'Benefits', 'Retirement',
    NULL, 'OUTBOUND',
    '2026-02-10 11:00:00-07', '2026-02-10 11:00:00-07', NULL,
    NULL, NULL, NULL,
    'Retirement Application Packet — Patricia Moore', 'THR-20260210-PM001',
    'Emailed retirement application packet to member. Packet includes: retirement application form, beneficiary designation form (BEN-1), direct deposit authorization, COBRA continuation election form, and checklist of required supporting documents. Application deadline for July 1 effective date is April 30.',
    NULL, NULL, NULL, 'PUBLIC',
    '2026-02-10 11:00:00-07', 'lpark'
),
-- 31. Patricia called with follow-up on application status
(
    '00000000-0000-0000-7000-000000000031',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-6000-000000000013',
    '00000000-0000-0000-1000-000000000012', NULL, 'lpark',
    'PHONE_INBOUND', 'FOLLOW_UP', 'Benefits', 'Retirement',
    'INFO_PROVIDED', 'INBOUND',
    '2026-03-01 14:30:00-07', '2026-03-01 14:42:00-07', 720,
    'CALL-20260301-14300010', 'member_services', 25,
    NULL, NULL,
    'Member called to confirm receipt of completed application forms. Verified that all required documents were received except direct deposit authorization. Advised member to submit Form DD-1 via portal or mail within 2 weeks to stay on track for July 1 effective date.',
    NULL, 'RET_APP_INCOMPLETE', 60, 'INTERNAL',
    '2026-03-01 14:42:00-07', 'lpark'
)
ON CONFLICT DO NOTHING;


COMMIT;
