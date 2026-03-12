-- 009: Enrich existing templates with stage_category + add stage-mapped templates.
-- Depends on schema 008_correspondence_enrich.sql.

BEGIN;

-- ─── Update existing templates with stage_category ──────────────────────────

UPDATE correspondence_template SET stage_category = 'submit'
WHERE template_code = 'RET_CONFIRM';

UPDATE correspondence_template SET stage_category = 'benefit-calc'
WHERE template_code = 'BENEFIT_EST';

UPDATE correspondence_template SET stage_category = 'dro'
WHERE template_code = 'DRO_NOTICE';

UPDATE correspondence_template SET stage_category = 'intake'
WHERE template_code = 'GENERAL_ACK';

-- MISSING_DOC is stage-agnostic (usable at any stage) — leave stage_category NULL.

-- ─── New stage-mapped templates ─────────────────────────────────────────────

-- 6. Intake Acknowledgment (stage: intake)
INSERT INTO correspondence_template (template_id, tenant_id, template_code, template_name, description, category, stage_category, on_send_effects, body_template, merge_fields)
VALUES (
    'c0000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'INTAKE_ACK',
    'Application Receipt Acknowledgment',
    'Acknowledges receipt of a retirement application and provides next steps',
    'retirement',
    'intake',
    '[]'::jsonb,
    E'Dear {{member_name}},\n\nWe have received your retirement application submitted on {{application_date}}. Your case has been assigned reference number {{case_number}}.\n\nYour application will be reviewed by our retirement specialists. The next step is verification of your employment records. You can expect to hear from us within 10 business days.\n\nIf you have questions, please contact our office at (555) 123-4567 or log in to the member portal to check your application status.\n\nSincerely,\nRetirement Services Division',
    '[{"name":"member_name","type":"string","required":true,"description":"Full name of the member"},{"name":"application_date","type":"date","required":true,"description":"Date the application was submitted"},{"name":"case_number","type":"string","required":true,"description":"Case reference number (e.g., RET-2026-0147)"}]'
);

-- 7. Employment Verification Complete (stage: verify-employment)
INSERT INTO correspondence_template (template_id, tenant_id, template_code, template_name, description, category, stage_category, on_send_effects, body_template, merge_fields)
VALUES (
    'c0000000-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000001',
    'VERIFY_COMPLETE',
    'Employment Verification Confirmation',
    'Confirms that employment records have been verified and eligibility review is next',
    'retirement',
    'verify-employment',
    '[]'::jsonb,
    E'Dear {{member_name}},\n\nWe have completed the verification of your employment records for your retirement application ({{case_number}}).\n\nVerified Details:\n  Hire Date: {{hire_date}}\n  Department: {{department}}\n  Credited Service: {{service_years}} years\n  Tier: {{tier}}\n\nThe next step is a review of your retirement eligibility. We will contact you if any additional information is needed.\n\nSincerely,\nRetirement Services Division',
    '[{"name":"member_name","type":"string","required":true,"description":"Full name of the member"},{"name":"case_number","type":"string","required":true,"description":"Case reference number"},{"name":"hire_date","type":"date","required":true,"description":"Verified hire date"},{"name":"department","type":"string","required":true,"description":"Department name"},{"name":"service_years","type":"number","required":true,"description":"Verified credited service years"},{"name":"tier","type":"string","required":true,"description":"Benefit tier (Tier 1, 2, or 3)"}]'
);

-- 8. Eligibility Determination Notice (stage: eligibility)
INSERT INTO correspondence_template (template_id, tenant_id, template_code, template_name, description, category, stage_category, on_send_effects, body_template, merge_fields)
VALUES (
    'c0000000-0000-0000-0000-000000000008',
    '00000000-0000-0000-0000-000000000001',
    'ELIG_NOTICE',
    'Eligibility Determination Notice',
    'Notifies the member of their retirement eligibility determination',
    'retirement',
    'eligibility',
    '[]'::jsonb,
    E'Dear {{member_name}},\n\nWe have completed the eligibility review for your retirement application ({{case_number}}).\n\nEligibility Determination: {{eligibility_type}}\nAge at Retirement: {{age_at_retirement}}\nCredited Service: {{service_years}} years\n{{rule_of_n_label}}: {{rule_of_n_sum}} (threshold: {{rule_of_n_threshold}})\n\n{{eligibility_notes}}\n\nThe next step is calculation of your retirement benefit. We will provide a detailed benefit calculation for your review.\n\nSincerely,\nRetirement Services Division',
    '[{"name":"member_name","type":"string","required":true,"description":"Full name of the member"},{"name":"case_number","type":"string","required":true,"description":"Case reference number"},{"name":"eligibility_type","type":"string","required":true,"description":"Eligibility type (Normal, Rule of 75, Early, etc.)"},{"name":"age_at_retirement","type":"number","required":true,"description":"Age at retirement date"},{"name":"service_years","type":"number","required":true,"description":"Credited service years"},{"name":"rule_of_n_label","type":"string","required":true,"description":"Rule of 75 or Rule of 85"},{"name":"rule_of_n_sum","type":"number","required":true,"description":"Sum of age + service"},{"name":"rule_of_n_threshold","type":"number","required":true,"description":"75 or 85"},{"name":"eligibility_notes","type":"string","required":false,"description":"Additional eligibility notes (e.g., early retirement reduction)"}]'
);

-- 9. Election Confirmation (stage: election)
INSERT INTO correspondence_template (template_id, tenant_id, template_code, template_name, description, category, stage_category, on_send_effects, body_template, merge_fields)
VALUES (
    'c0000000-0000-0000-0000-000000000009',
    '00000000-0000-0000-0000-000000000001',
    'ELECTION_CONFIRM',
    'Benefit Election Confirmation',
    'Confirms the member''s benefit payment option election',
    'retirement',
    'election',
    '[{"type":"create_commitment","description":"Verify election form signatures received","targetDays":7}]'::jsonb,
    E'Dear {{member_name}},\n\nThis letter confirms your benefit election for retirement application ({{case_number}}).\n\nElection Details:\n  Payment Option: {{payment_option}}\n  Monthly Benefit Amount: {{benefit_amount}}\n  Effective Date: {{retirement_date}}\n  Beneficiary: {{beneficiary_name}}\n\nIMPORTANT: You have 30 days from the effective date to change your payment option. After that period, your election is irrevocable.\n\nIf you need to make changes, please contact our office immediately.\n\nSincerely,\nRetirement Services Division',
    '[{"name":"member_name","type":"string","required":true,"description":"Full name of the member"},{"name":"case_number","type":"string","required":true,"description":"Case reference number"},{"name":"payment_option","type":"string","required":true,"description":"Selected payment option"},{"name":"benefit_amount","type":"currency","required":true,"description":"Monthly benefit amount"},{"name":"retirement_date","type":"date","required":true,"description":"Effective retirement date"},{"name":"beneficiary_name","type":"string","required":false,"description":"Designated beneficiary name"}]'
);

-- 10. Certification & Activation Notice (stage: submit)
INSERT INTO correspondence_template (template_id, tenant_id, template_code, template_name, description, category, stage_category, on_send_effects, body_template, merge_fields)
VALUES (
    'c0000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'CERT_NOTICE',
    'Certification & Activation Notice',
    'Final certification that the retirement benefit has been activated',
    'retirement',
    'submit',
    '[]'::jsonb,
    E'Dear {{member_name}},\n\nCongratulations! Your retirement benefit has been certified and activated.\n\nFinal Benefit Summary:\n  Case Number: {{case_number}}\n  Effective Date: {{retirement_date}}\n  Monthly Benefit: {{benefit_amount}}\n  Payment Option: {{payment_option}}\n  First Payment: {{first_payment_date}}\n\nYour first payment will be deposited on the date shown above. Subsequent payments will be deposited on the last business day of each month.\n\nWelcome to retirement! If you have any questions about your benefits, please contact us at (555) 123-4567.\n\nSincerely,\nRetirement Services Division',
    '[{"name":"member_name","type":"string","required":true,"description":"Full name of the member"},{"name":"case_number","type":"string","required":true,"description":"Case reference number"},{"name":"retirement_date","type":"date","required":true,"description":"Effective retirement date"},{"name":"benefit_amount","type":"currency","required":true,"description":"Monthly benefit amount"},{"name":"payment_option","type":"string","required":true,"description":"Selected payment option"},{"name":"first_payment_date","type":"date","required":true,"description":"Date of first payment"}]'
);

-- 11. Employer Notification (no stage — general employer correspondence)
INSERT INTO correspondence_template (template_id, tenant_id, template_code, template_name, description, category, stage_category, on_send_effects, body_template, merge_fields)
VALUES (
    'c0000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'EMPLOYER_NOTIFY',
    'Employer Retirement Notification',
    'Notifies employer of a member''s pending retirement',
    'employer',
    NULL,
    '[]'::jsonb,
    E'Dear {{employer_contact_name}},\n\nThis letter is to notify you that {{member_name}}, an employee of {{department}}, has submitted a retirement application with an effective date of {{retirement_date}}.\n\nPlease ensure that:\n  1. Final salary records are submitted by the last day of employment\n  2. Leave balances are reported to our office\n  3. The employee''s last day of work is confirmed\n\nIf you have questions, please contact our Employer Services team at (555) 123-4568.\n\nSincerely,\nEmployer Services Division',
    '[{"name":"employer_contact_name","type":"string","required":true,"description":"Name of the employer contact"},{"name":"member_name","type":"string","required":true,"description":"Name of the retiring employee"},{"name":"department","type":"string","required":true,"description":"Department name"},{"name":"retirement_date","type":"date","required":true,"description":"Effective retirement date"}]'
);

COMMIT;
