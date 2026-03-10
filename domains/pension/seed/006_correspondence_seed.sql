-- Correspondence seed data — 5 letter templates for pension correspondence.

BEGIN;

-- 1. Retirement Benefit Confirmation Letter
INSERT INTO correspondence_template (template_id, tenant_id, template_code, template_name, description, category, body_template, merge_fields)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'RET_CONFIRM',
    'Retirement Benefit Confirmation',
    'Official confirmation of retirement benefit amount and effective date',
    'retirement',
    E'Dear {{member_name}},\n\nThis letter confirms your retirement benefit effective {{retirement_date}}.\n\nBased on your {{service_years}} years of credited service and your Average Monthly Salary of {{ams_amount}}, your monthly retirement benefit has been calculated as follows:\n\nMonthly Benefit: {{benefit_amount}}\nPayment Option: {{payment_option}}\nFirst Payment Date: {{first_payment_date}}\n\nIf you elected a Joint and Survivor option, the survivor benefit for {{beneficiary_name}} will be {{survivor_amount}} per month.\n\nPlease review the enclosed benefit calculation worksheet for complete details. If you have questions, contact our office at (555) 123-4567.\n\nSincerely,\nRetirement Services Division',
    '[{"name":"member_name","type":"string","required":true,"description":"Full name of the retiring member"},{"name":"retirement_date","type":"date","required":true,"description":"Effective retirement date"},{"name":"service_years","type":"number","required":true,"description":"Total credited service years"},{"name":"ams_amount","type":"currency","required":true,"description":"Average Monthly Salary"},{"name":"benefit_amount","type":"currency","required":true,"description":"Monthly benefit amount"},{"name":"payment_option","type":"string","required":true,"description":"Selected payment option"},{"name":"first_payment_date","type":"date","required":true,"description":"Date of first payment"},{"name":"beneficiary_name","type":"string","required":false,"description":"Name of beneficiary (if J&S option)"},{"name":"survivor_amount","type":"currency","required":false,"description":"Monthly survivor benefit amount"}]'
);

-- 2. Benefit Estimate Letter
INSERT INTO correspondence_template (template_id, tenant_id, template_code, template_name, description, category, body_template, merge_fields)
VALUES (
    'c0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'BENEFIT_EST',
    'Benefit Estimate',
    'Unofficial benefit estimate for retirement planning purposes',
    'retirement',
    E'Dear {{member_name}},\n\nThank you for your request for a retirement benefit estimate. Based on the information currently on file, here is your estimated benefit:\n\nEstimated Retirement Date: {{retirement_date}}\nCredited Service: {{service_years}} years\nEstimated AMS: {{ams_amount}}\n\nEstimated Monthly Benefit:\n  Maximum (Single Life): {{max_benefit}}\n  100% Joint & Survivor: {{js100_benefit}}\n  75% Joint & Survivor: {{js75_benefit}}\n  50% Joint & Survivor: {{js50_benefit}}\n\nIMPORTANT: This is an estimate only and is not a guarantee of benefits. Your actual benefit will be calculated at the time of retirement based on verified salary and service records.\n\nSincerely,\nRetirement Services Division',
    '[{"name":"member_name","type":"string","required":true,"description":"Full name of the member"},{"name":"retirement_date","type":"date","required":true,"description":"Projected retirement date"},{"name":"service_years","type":"number","required":true,"description":"Projected credited service years"},{"name":"ams_amount","type":"currency","required":true,"description":"Estimated Average Monthly Salary"},{"name":"max_benefit","type":"currency","required":true,"description":"Maximum (Single Life) benefit"},{"name":"js100_benefit","type":"currency","required":true,"description":"100% Joint & Survivor benefit"},{"name":"js75_benefit","type":"currency","required":true,"description":"75% Joint & Survivor benefit"},{"name":"js50_benefit","type":"currency","required":true,"description":"50% Joint & Survivor benefit"}]'
);

-- 3. DRO Division Notice
INSERT INTO correspondence_template (template_id, tenant_id, template_code, template_name, description, category, body_template, merge_fields)
VALUES (
    'c0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'DRO_NOTICE',
    'DRO Division Notice',
    'Notice of Domestic Relations Order benefit division',
    'dro',
    E'Dear {{member_name}},\n\nThis letter confirms that a Domestic Relations Order (DRO) has been applied to your retirement benefit account.\n\nDRO Details:\n  Court Order Date: {{court_order_date}}\n  Alternate Payee: {{alternate_payee_name}}\n  Division Percentage: {{division_pct}}%\n  Marital Fraction: {{marital_fraction}}\n\nThe DRO division will be applied to your benefit at the time of retirement. Your net benefit after the DRO division will be reduced by the applicable percentage.\n\nIf you have questions about this order, please contact our office.\n\nSincerely,\nRetirement Services Division',
    '[{"name":"member_name","type":"string","required":true,"description":"Full name of the member"},{"name":"court_order_date","type":"date","required":true,"description":"Date of the court order"},{"name":"alternate_payee_name","type":"string","required":true,"description":"Name of the alternate payee"},{"name":"division_pct","type":"number","required":true,"description":"Division percentage"},{"name":"marital_fraction","type":"string","required":true,"description":"Marital fraction (e.g., 15/25)"}]'
);

-- 4. General Acknowledgment
INSERT INTO correspondence_template (template_id, tenant_id, template_code, template_name, description, category, body_template, merge_fields)
VALUES (
    'c0000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'GENERAL_ACK',
    'General Acknowledgment',
    'Acknowledgment of received documents or requests',
    'general',
    E'Dear {{member_name}},\n\nThis letter acknowledges receipt of your {{document_type}} on {{received_date}}.\n\n{{additional_notes}}\n\nIf you have any questions, please contact our office at (555) 123-4567 or visit our member portal.\n\nSincerely,\nRetirement Services Division',
    '[{"name":"member_name","type":"string","required":true,"description":"Full name of the member"},{"name":"document_type","type":"string","required":true,"description":"Type of document received"},{"name":"received_date","type":"date","required":true,"description":"Date document was received"},{"name":"additional_notes","type":"string","required":false,"description":"Any additional notes or instructions"}]'
);

-- 5. Missing Document Request
INSERT INTO correspondence_template (template_id, tenant_id, template_code, template_name, description, category, body_template, merge_fields)
VALUES (
    'c0000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'MISSING_DOC',
    'Missing Document Request',
    'Request for missing documents needed to process retirement application',
    'general',
    E'Dear {{member_name}},\n\nWe are processing your retirement application and have identified the following missing document(s):\n\n{{missing_documents}}\n\nPlease submit the above document(s) by {{due_date}} to avoid delays in processing your retirement benefit.\n\nYou may submit documents by:\n  - Uploading through the member portal\n  - Mailing to our office\n  - Delivering in person during business hours\n\nIf you have questions or need assistance obtaining these documents, please contact us at (555) 123-4567.\n\nSincerely,\nRetirement Services Division',
    '[{"name":"member_name","type":"string","required":true,"description":"Full name of the member"},{"name":"missing_documents","type":"string","required":true,"description":"List of missing documents"},{"name":"due_date","type":"date","required":true,"description":"Deadline for submitting documents"}]'
);

-- ─── Correspondence history records for demo members ─────────────────────────

-- Member 10001 (Robert Martinez) — 2 letters
INSERT INTO correspondence_history (correspondence_id, tenant_id, template_id, member_id, subject, body_rendered, merge_data, status, generated_by, sent_at, sent_via, delivery_address, created_at, updated_at)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000004',
    10001,
    'General Acknowledgment - Robert Martinez',
    E'Dear Robert Martinez,\n\nThis letter acknowledges receipt of your Retirement Application on 2026-02-28.\n\nYour application has been assigned to a retirement specialist and is currently under review.\n\nIf you have any questions, please contact our office at (555) 123-4567 or visit our member portal.\n\nSincerely,\nRetirement Services Division',
    '{"member_name":"Robert Martinez","document_type":"Retirement Application","received_date":"2026-02-28","additional_notes":"Your application has been assigned to a retirement specialist and is currently under review."}',
    'sent',
    'Sarah Chen',
    '2026-02-28 14:30:00+00',
    'email',
    'robert.martinez@example.com',
    '2026-02-28 10:00:00+00',
    '2026-02-28 14:30:00+00'
);

INSERT INTO correspondence_history (correspondence_id, tenant_id, template_id, member_id, subject, body_rendered, merge_data, status, generated_by, sent_at, sent_via, delivery_address, created_at, updated_at)
VALUES (
    'd0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002',
    10001,
    'Benefit Estimate - Robert Martinez',
    E'Dear Robert Martinez,\n\nThank you for your request for a retirement benefit estimate. Based on the information currently on file, here is your estimated benefit:\n\nEstimated Retirement Date: 2026-04-01\nCredited Service: 25 years\nEstimated AMS: $7,125.00\n\nEstimated Monthly Benefit:\n  Maximum (Single Life): $4,453.13\n  100% Joint & Survivor: $3,784.16\n  75% Joint & Survivor: $3,951.28\n  50% Joint & Survivor: $4,118.39\n\nIMPORTANT: This is an estimate only and is not a guarantee of benefits.\n\nSincerely,\nRetirement Services Division',
    '{"member_name":"Robert Martinez","retirement_date":"2026-04-01","service_years":"25","ams_amount":"$7,125.00","max_benefit":"$4,453.13","js100_benefit":"$3,784.16","js75_benefit":"$3,951.28","js50_benefit":"$4,118.39"}',
    'sent',
    'Sarah Chen',
    '2026-03-01 11:00:00+00',
    'mail',
    '1234 Oak Street, Denver, CO 80202',
    '2026-03-01 09:00:00+00',
    '2026-03-01 11:00:00+00'
);

-- Member 10002 (Jennifer Kim) — 1 letter
INSERT INTO correspondence_history (correspondence_id, tenant_id, template_id, member_id, subject, body_rendered, merge_data, status, generated_by, sent_at, sent_via, delivery_address, created_at, updated_at)
VALUES (
    'd0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002',
    10002,
    'Benefit Estimate - Jennifer Kim',
    E'Dear Jennifer Kim,\n\nThank you for your request for a retirement benefit estimate. Based on the information currently on file, here is your estimated benefit:\n\nEstimated Retirement Date: 2026-05-01\nCredited Service: 18 years\nEstimated AMS: $6,250.00\n\nEstimated Monthly Benefit:\n  Maximum (Single Life): $2,812.50\n  100% Joint & Survivor: $2,390.63\n  75% Joint & Survivor: $2,496.09\n  50% Joint & Survivor: $2,601.56\n\nIMPORTANT: This is an estimate only and is not a guarantee of benefits.\n\nSincerely,\nRetirement Services Division',
    '{"member_name":"Jennifer Kim","retirement_date":"2026-05-01","service_years":"18","ams_amount":"$6,250.00","max_benefit":"$2,812.50","js100_benefit":"$2,390.63","js75_benefit":"$2,496.09","js50_benefit":"$2,601.56"}',
    'sent',
    'Sarah Chen',
    '2026-02-25 15:00:00+00',
    'email',
    'jennifer.kim@example.com',
    '2026-02-25 13:00:00+00',
    '2026-02-25 15:00:00+00'
);

-- Member 10003 (David Washington) — 1 letter (draft, not yet sent)
INSERT INTO correspondence_history (correspondence_id, tenant_id, template_id, member_id, subject, body_rendered, merge_data, status, generated_by, created_at, updated_at)
VALUES (
    'd0000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000005',
    10003,
    'Missing Document Request - David Washington',
    E'Dear David Washington,\n\nWe are processing your retirement application and have identified the following missing document(s):\n\n- Certified marriage certificate\n- Beneficiary designation form (Form RET-7)\n\nPlease submit the above document(s) by 2026-03-20 to avoid delays in processing your retirement benefit.\n\nYou may submit documents by:\n  - Uploading through the member portal\n  - Mailing to our office\n  - Delivering in person during business hours\n\nIf you have questions or need assistance obtaining these documents, please contact us at (555) 123-4567.\n\nSincerely,\nRetirement Services Division',
    '{"member_name":"David Washington","missing_documents":"- Certified marriage certificate\n- Beneficiary designation form (Form RET-7)","due_date":"2026-03-20"}',
    'draft',
    'Sarah Chen',
    '2026-03-05 08:00:00+00',
    '2026-03-05 08:00:00+00'
);

COMMIT;
