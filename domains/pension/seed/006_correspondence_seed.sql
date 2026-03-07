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

COMMIT;
