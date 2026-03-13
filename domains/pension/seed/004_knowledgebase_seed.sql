-- Knowledge Base seed data — migrated from frontend/src/lib/helpContent.ts
-- 8 articles (one per workflow stage) + rule references.

BEGIN;

-- ============================================================
-- ARTICLES (from helpContent.ts HELP array)
-- ============================================================

-- 1. Intake
INSERT INTO kb_article (article_id, tenant_id, stage_id, title, context_text, checklist, next_action, sort_order)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'intake',
    'Application Intake',
    'Verify that all required documents are present and properly signed before advancing. Flag any missing or expired items.',
    '["Confirm signed retirement application is on file", "Verify birth certificate and photo ID", "Check spousal consent / notarization if married", "Ensure DRO court order is attached (if applicable)", "Confirm beneficiary designation form is current"]',
    'Verify all required documents are received. Flag any missing items or discrepancies before proceeding.',
    1
);

-- 2. Verify Employment
INSERT INTO kb_article (article_id, tenant_id, stage_id, title, context_text, checklist, next_action, sort_order)
VALUES (
    'a0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'verify-employment',
    'Verify Employment',
    E'Review the member\u2019s employment history for completeness. Verify there are no unexplained gaps, and confirm purchased/military service credit if applicable.',
    E'["Confirm hire date matches HR records", "Verify all employment periods are accounted for", "Check for gaps \u2014 any break >30 days requires explanation", "Validate purchased service credit amounts", "Confirm military service credit documentation"]',
    'Review employment records for completeness. Confirm all periods and purchased service, then advance.',
    2
);

-- 3. Salary & AMS
INSERT INTO kb_article (article_id, tenant_id, stage_id, title, context_text, checklist, next_action, sort_order)
VALUES (
    'a0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'salary-ams',
    'Salary & AMS',
    E'The system has identified the highest consecutive salary window. Verify the salary records are complete and the AMS window is correct for the member\u2019s tier.',
    '["AMS uses highest 36 consecutive months (Tier 1/2) or 60 months (Tier 3)", "Verify salary records are complete for the window period", "Check for leave payout impact on final month salary", "Confirm no salary anomalies (sudden spikes or drops)"]',
    'Review the salary table, confirm AMS window period, and verify leave payout impact if any.',
    3
);

-- 4. Eligibility
INSERT INTO kb_article (article_id, tenant_id, stage_id, title, context_text, checklist, next_action, sort_order)
VALUES (
    'a0000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'eligibility',
    'Eligibility Determination',
    'Confirm the member meets the eligibility requirements for their retirement type. Check tier-specific rules (Rule of 75 for Tier 1/2, Rule of 85 for Tier 3).',
    E'["Verify member meets minimum vesting requirement (5 years)", "Check age + service against tier-specific rule threshold", "If early retirement \u2014 confirm reduction percentage is correct", "Verify the elected retirement date is valid"]',
    'Confirm eligibility type (Normal/Early/Deferred). If early, verify reduction factor before advancing.',
    4
);

-- 5. DRO
INSERT INTO kb_article (article_id, tenant_id, stage_id, title, context_text, checklist, next_action, sort_order)
VALUES (
    'a0000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'dro',
    'DRO Division',
    'A Domestic Relations Order (DRO) applies to this case. Verify the marital fraction calculation and confirm the court-ordered division percentage.',
    '["Verify marriage and divorce dates on the DRO", "Confirm marital fraction numerator (service during marriage)", "Verify court-ordered division percentage (typically 50%)", "Check that DRO award is applied before payment option selection", "Confirm alternate payee contact information is on file"]',
    'Verify marital fraction and DRO award amount. Confirm alternate payee details before advancing.',
    5
);

-- 6. Benefit Calc
INSERT INTO kb_article (article_id, tenant_id, stage_id, title, context_text, checklist, next_action, sort_order)
VALUES (
    'a0000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'benefit-calc',
    'Benefit Calculation',
    E'The system has automatically calculated the benefit using the member\u2019s tier-specific formula. Your job is to verify the inputs are correct.',
    E'["Verify multiplier matches member tier (2.0% T1, 1.5% T2, variable T3)", "Confirm AMS amount matches Salary & AMS stage", "Verify service credit years match employment verification", "If early retirement \u2014 confirm reduction factor is applied", "Cross-check final monthly benefit against formula"]',
    E'Review the salary table, confirm AMS window, then click \u201cConfirm & Continue\u201d to advance to Payment Options.',
    6
);

-- 6b. Scenario Comparison
INSERT INTO kb_article (article_id, tenant_id, stage_id, title, context_text, checklist, next_action, sort_order)
VALUES (
    'a0000000-0000-0000-0000-000000000009',
    '00000000-0000-0000-0000-000000000001',
    'scenario',
    'Scenario Comparison',
    E'This member qualifies for early retirement with a benefit reduction. Review the retire-now vs. wait comparison to ensure the member understands the trade-off between retiring early with a reduced benefit and waiting for a higher unreduced benefit.',
    E'["Compare current reduced benefit against projected unreduced benefit", "Verify the Rule of N threshold and projected date it would be met", "Confirm the member has been informed of both options", "Document the member\u2019s acknowledgment of the reduction impact"]',
    'Review the scenario comparison with the member. Confirm they understand the reduction impact before proceeding to election.',
    9
);

-- 7. Election
INSERT INTO kb_article (article_id, tenant_id, stage_id, title, context_text, checklist, next_action, sort_order)
VALUES (
    'a0000000-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000001',
    'election',
    'Election Recording',
    E'Record the member\u2019s payment option selection, death benefit election, and health insurance (IPR) enrollment. Ensure spousal consent is obtained for non-maximum options.',
    E'["Member must select one payment option (Maximum, 100/75/50% J&S)", "If J&S selected \u2014 verify spousal/beneficiary information", "Record death benefit election (lump sum vs installments)", "Check IPR enrollment and confirm pre/post-Medicare amounts", "Obtain spousal consent signature if required"]',
    'Member must select a payment option and health insurance election. Flag if spousal consents are missing.',
    7
);

-- 8. Submit
INSERT INTO kb_article (article_id, tenant_id, stage_id, title, context_text, checklist, next_action, sort_order)
VALUES (
    'a0000000-0000-0000-0000-000000000008',
    '00000000-0000-0000-0000-000000000001',
    'submit',
    'Final Certification',
    'All stages have been reviewed. Perform a final check of all data before certifying and submitting for supervisor approval.',
    '["All prior stages confirmed and data verified", "No outstanding flags or issues", "Member signature and date confirmed", "Analyst certification statement reviewed", "Case ready for supervisor approval queue"]',
    E'Perform final review of all data, then click \u201cCertify & Submit\u201d to send to supervisor for approval.',
    8
);

-- ============================================================
-- RULE REFERENCES (from helpContent.ts rules arrays)
-- ============================================================

-- Intake rules
INSERT INTO kb_rule_reference (article_id, rule_id, rule_code, rule_description, rule_domain, sort_order)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'RMC-18-201', 'RMC §18-201', 'Filing requirements', 'intake', 1),
    ('a0000000-0000-0000-0000-000000000001', 'RMC-18-203', 'RMC §18-203', 'Spousal consent', 'intake', 2);

-- Verify Employment rules
INSERT INTO kb_rule_reference (article_id, rule_id, rule_code, rule_description, rule_domain, sort_order)
VALUES
    ('a0000000-0000-0000-0000-000000000002', 'RMC-18-301', 'RMC §18-301', 'Service credit definitions', 'employment', 1),
    ('a0000000-0000-0000-0000-000000000002', 'RMC-18-302', 'RMC §18-302', 'Purchased service rules', 'employment', 2),
    ('a0000000-0000-0000-0000-000000000002', 'RMC-18-303', 'RMC §18-303', 'Military service credit', 'employment', 3);

-- Salary & AMS rules
INSERT INTO kb_rule_reference (article_id, rule_id, rule_code, rule_description, rule_domain, sort_order)
VALUES
    ('a0000000-0000-0000-0000-000000000003', 'RMC-18-401d', 'RMC §18-401(d)', 'AMS definition', 'salary', 1),
    ('a0000000-0000-0000-0000-000000000003', 'RMC-18-401e', 'RMC §18-401(e)', 'Salary inclusions/exclusions', 'salary', 2);

-- Eligibility rules
INSERT INTO kb_rule_reference (article_id, rule_id, rule_code, rule_description, rule_domain, sort_order)
VALUES
    ('a0000000-0000-0000-0000-000000000004', 'RMC-18-401a', 'RMC §18-401(a)', 'Eligibility requirements', 'eligibility', 1),
    ('a0000000-0000-0000-0000-000000000004', 'RMC-18-401b', 'RMC §18-401(b)', 'Rule of 75 / Rule of 85', 'eligibility', 2),
    ('a0000000-0000-0000-0000-000000000004', 'RMC-18-401c', 'RMC §18-401(c)', 'Early retirement reduction', 'eligibility', 3);

-- DRO rules
INSERT INTO kb_rule_reference (article_id, rule_id, rule_code, rule_description, rule_domain, sort_order)
VALUES
    ('a0000000-0000-0000-0000-000000000005', 'RMC-18-501', 'RMC §18-501', 'DRO requirements', 'dro', 1),
    ('a0000000-0000-0000-0000-000000000005', 'RMC-18-502', 'RMC §18-502', 'Marital fraction calculation', 'dro', 2),
    ('a0000000-0000-0000-0000-000000000005', 'RMC-18-503', 'RMC §18-503', 'Alternate payee rights', 'dro', 3);

-- Scenario Comparison rules
INSERT INTO kb_rule_reference (article_id, rule_id, rule_code, rule_description, rule_domain, sort_order)
VALUES
    ('a0000000-0000-0000-0000-000000000009', 'RMC-18-401b-scen', 'RMC §18-401(b)', 'Rule of 75 / Rule of 85', 'scenario', 1),
    ('a0000000-0000-0000-0000-000000000009', 'RMC-18-401c-scen', 'RMC §18-401(c)', 'Early retirement reduction', 'scenario', 2);

-- Benefit Calc rules
INSERT INTO kb_rule_reference (article_id, rule_id, rule_code, rule_description, rule_domain, sort_order)
VALUES
    ('a0000000-0000-0000-0000-000000000006', 'RMC-18-401a-calc', 'RMC §18-401(a)', 'Benefit formula', 'calculation', 1),
    ('a0000000-0000-0000-0000-000000000006', 'RMC-18-401d-calc', 'RMC §18-401(d)', 'AMS definition', 'calculation', 2),
    ('a0000000-0000-0000-0000-000000000006', 'RMC-18-401c-calc', 'RMC §18-401(c)', 'Early retirement reduction', 'calculation', 3);

-- Election rules
INSERT INTO kb_rule_reference (article_id, rule_id, rule_code, rule_description, rule_domain, sort_order)
VALUES
    ('a0000000-0000-0000-0000-000000000007', 'RMC-18-601', 'RMC §18-601', 'Payment option definitions', 'election', 1),
    ('a0000000-0000-0000-0000-000000000007', 'RMC-18-602', 'RMC §18-602', 'Spousal consent requirements', 'election', 2),
    ('a0000000-0000-0000-0000-000000000007', 'RMC-18-701', 'RMC §18-701', 'IPR enrollment', 'election', 3);

-- Submit rules
INSERT INTO kb_rule_reference (article_id, rule_id, rule_code, rule_description, rule_domain, sort_order)
VALUES
    ('a0000000-0000-0000-0000-000000000008', 'RMC-18-801', 'RMC §18-801', 'Certification requirements', 'certification', 1),
    ('a0000000-0000-0000-0000-000000000008', 'RMC-18-802', 'RMC §18-802', 'Supervisor review process', 'certification', 2);

COMMIT;
