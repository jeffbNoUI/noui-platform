-- =============================================================================
-- Member Portal Seed Data
-- Links demo Clerk users to pension members, creates preferences, scenarios,
-- notifications, payment history, and tax documents for demo personas.
-- =============================================================================

BEGIN;

-- ===== MEMBER ACCOUNT LINKS =====
-- Map dev auth Clerk user IDs to existing pension members
-- Active members (near retirement, early career, vested inactive)
INSERT INTO member_account_links (clerk_user_id, member_id, linked_by, status) VALUES
  ('dev-member-active-near', 10001, 'auto_match', 'active'),    -- Robert Martinez (T1, 28yr)
  ('dev-member-active-early', 10002, 'auto_match', 'active'),   -- Jennifer Kim (T2, 18yr)
  ('dev-member-inactive-vested', 10003, 'auto_match', 'active'),-- David Washington (T3, 11yr)
  ('dev-member-inactive-novest', 10009, 'auto_match', 'active'),-- Thomas O'Brien (T1, terminated)
  ('dev-member-retiree', 10006, 'auto_match', 'active'),        -- Maria Santos (T1, 28yr, retiree demo)
  ('dev-member-survivor', 10011, 'auto_match', 'active'),       -- Richard Chen (T3, survivor demo)
  ('dev-member-deathben', 10012, 'auto_match', 'active'),       -- Patricia Moore (T1, death benefit demo)
  ('dev-member-dual', 10010, 'auto_match', 'active')            -- Angela Davis (T2, dual role demo)
ON CONFLICT (clerk_user_id) DO NOTHING;

-- ===== MEMBER PREFERENCES =====
INSERT INTO member_preferences (member_id, preferences) VALUES
  (10001, '{"communication": {"application_status_change": {"email": true, "sms": false}, "document_needed": {"email": true, "sms": false}}, "accessibility": {"text_size": "standard", "high_contrast": false, "reduce_motion": false}, "tour_completed": false, "tour_version": 0}'),
  (10002, '{"communication": {"application_status_change": {"email": true, "sms": true}, "document_needed": {"email": true, "sms": true}}, "sms_number": "303-555-0202", "accessibility": {"text_size": "standard", "high_contrast": false, "reduce_motion": false}, "tour_completed": false, "tour_version": 0}'),
  (10003, '{"communication": {"application_status_change": {"email": true, "sms": false}}, "accessibility": {"text_size": "standard", "high_contrast": false, "reduce_motion": false}, "tour_completed": false, "tour_version": 0}'),
  (10006, '{"communication": {"payment_issue": {"email": true, "sms": true}}, "sms_number": "303-555-0601", "accessibility": {"text_size": "larger", "high_contrast": false, "reduce_motion": false}, "tour_completed": true, "tour_version": 1}'),
  (10009, '{"communication": {}, "accessibility": {"text_size": "standard", "high_contrast": false, "reduce_motion": false}, "tour_completed": false, "tour_version": 0}'),
  (10010, '{"communication": {"application_status_change": {"email": true, "sms": false}}, "accessibility": {"text_size": "standard", "high_contrast": false, "reduce_motion": false}, "tour_completed": false, "tour_version": 0}'),
  (10011, '{"communication": {"payment_issue": {"email": true, "sms": false}}, "accessibility": {"text_size": "largest", "high_contrast": true, "reduce_motion": true}, "tour_completed": true, "tour_version": 1}'),
  (10012, '{"communication": {}, "accessibility": {"text_size": "standard", "high_contrast": false, "reduce_motion": false}, "tour_completed": false, "tour_version": 0}')
ON CONFLICT (member_id) DO NOTHING;

-- ===== SAVED SCENARIOS (active members) =====
INSERT INTO saved_scenarios (member_id, label, inputs, results, data_version) VALUES
  -- Robert Martinez: retire at 65 (normal)
  (10001, 'Normal Retirement at 65',
    '{"retirement_date": "2028-03-08", "service_purchase_years": 0, "salary_growth_pct": 2.5, "payment_option": "life_only"}',
    '{"monthly_benefit": 5342.50, "eligibility_type": "NORMAL", "reduction_pct": 0, "ams": 8500.00, "base_benefit": 5342.50, "service_years": 31.0, "payment_options": [{"option_id": "life_only", "member_amount": 5342.50, "survivor_amount": 0}]}',
    '2026-03-01'),
  -- Robert Martinez: early retirement now
  (10001, 'Early Retirement (Rule of 75)',
    '{"retirement_date": "2026-06-15", "service_purchase_years": 0, "salary_growth_pct": 0, "payment_option": "joint_50", "beneficiary_dob": "1965-08-12"}',
    '{"monthly_benefit": 4680.00, "eligibility_type": "EARLY", "reduction_pct": 0, "ams": 8100.00, "base_benefit": 4698.00, "service_years": 29.0, "payment_options": [{"option_id": "joint_50", "member_amount": 4680.00, "survivor_amount": 2340.00}]}',
    '2026-03-01'),
  -- Jennifer Kim: retire at 65
  (10002, 'Normal Retirement at 65',
    '{"retirement_date": "2042-09-15", "service_purchase_years": 0, "salary_growth_pct": 3.0, "payment_option": "life_only"}',
    '{"monthly_benefit": 4125.00, "eligibility_type": "NORMAL", "reduction_pct": 0, "ams": 7500.00, "base_benefit": 4125.00, "service_years": 36.7, "payment_options": [{"option_id": "life_only", "member_amount": 4125.00, "survivor_amount": 0}]}',
    '2026-03-01'),
  -- Jennifer Kim: with purchased service
  (10002, 'With 3yr Purchased Service',
    '{"retirement_date": "2042-09-15", "service_purchase_years": 3, "salary_growth_pct": 3.0, "payment_option": "joint_100", "beneficiary_dob": "1978-02-20"}',
    '{"monthly_benefit": 3850.00, "eligibility_type": "NORMAL", "reduction_pct": 0, "ams": 7500.00, "base_benefit": 4462.50, "service_years": 39.7, "payment_options": [{"option_id": "joint_100", "member_amount": 3850.00, "survivor_amount": 3850.00}]}',
    '2026-03-01');

-- ===== PAYMENT HISTORY (retiree member 10006 — Maria Santos) =====
-- 12 months of payments for retiree demo
INSERT INTO payment_history (member_id, payment_date, gross_amount, federal_tax, state_tax, other_deductions, net_amount, bank_last_four) VALUES
  (10006, '2025-04-01', 3450.00, 517.50, 155.25, 25.00, 2752.25, '4567'),
  (10006, '2025-05-01', 3450.00, 517.50, 155.25, 25.00, 2752.25, '4567'),
  (10006, '2025-06-01', 3450.00, 517.50, 155.25, 25.00, 2752.25, '4567'),
  (10006, '2025-07-01', 3450.00, 517.50, 155.25, 25.00, 2752.25, '4567'),
  (10006, '2025-08-01', 3450.00, 517.50, 155.25, 25.00, 2752.25, '4567'),
  (10006, '2025-09-01', 3450.00, 517.50, 155.25, 25.00, 2752.25, '4567'),
  (10006, '2025-10-01', 3450.00, 517.50, 155.25, 25.00, 2752.25, '4567'),
  (10006, '2025-11-01', 3450.00, 517.50, 155.25, 25.00, 2752.25, '4567'),
  (10006, '2025-12-01', 3450.00, 517.50, 155.25, 25.00, 2752.25, '4567'),
  (10006, '2026-01-01', 3553.50, 533.03, 159.91, 25.00, 2835.56, '4567'),  -- COLA adjustment
  (10006, '2026-02-01', 3553.50, 533.03, 159.91, 25.00, 2835.56, '4567'),
  (10006, '2026-03-01', 3553.50, 533.03, 159.91, 25.00, 2835.56, '4567');

-- Payment history for survivor beneficiary (10011 — Richard Chen)
INSERT INTO payment_history (member_id, payment_date, gross_amount, federal_tax, state_tax, other_deductions, net_amount, bank_last_four) VALUES
  (10011, '2025-10-01', 1725.00, 258.75, 77.63, 0, 1388.62, '8901'),
  (10011, '2025-11-01', 1725.00, 258.75, 77.63, 0, 1388.62, '8901'),
  (10011, '2025-12-01', 1725.00, 258.75, 77.63, 0, 1388.62, '8901'),
  (10011, '2026-01-01', 1776.75, 266.51, 79.95, 0, 1430.29, '8901'),
  (10011, '2026-02-01', 1776.75, 266.51, 79.95, 0, 1430.29, '8901'),
  (10011, '2026-03-01', 1776.75, 266.51, 79.95, 0, 1430.29, '8901');

-- ===== TAX DOCUMENTS =====
INSERT INTO tax_documents (member_id, tax_year, document_type, available) VALUES
  (10006, 2023, '1099-R', true),
  (10006, 2024, '1099-R', true),
  (10006, 2025, '1099-R', false),  -- not yet available
  (10011, 2024, '1099-R', true),
  (10011, 2025, '1099-R', false);

-- ===== NOTIFICATIONS =====
INSERT INTO notifications (member_id, type, title, body, entity_type, entity_id, read) VALUES
  -- Robert Martinez — active, nearing retirement
  (10001, 'eligibility_milestone', 'Rule of 75 Eligible', 'You now meet the Rule of 75 eligibility requirement. You may apply for retirement at any time.', NULL, NULL, false),
  (10001, 'document_needed', 'Updated Beneficiary Form Needed', 'Your beneficiary designation is more than 5 years old. Please review and update if needed.', NULL, NULL, false),
  (10001, 'system', 'Welcome to the Member Portal', 'Your member portal account has been activated. Explore your dashboard to see your benefit estimate and retirement timeline.', NULL, NULL, true),
  -- Jennifer Kim — active, early career
  (10002, 'system', 'Welcome to the Member Portal', 'Your member portal account has been activated.', NULL, NULL, true),
  (10002, 'service_credit', 'Service Purchase Confirmation', 'Your purchased service credit of 3.00 years has been processed and is reflected in your account.', NULL, NULL, true),
  -- David Washington — inactive
  (10003, 'system', 'Account Status Update', 'Your employment status has changed to inactive. You may be eligible for a deferred benefit or refund.', NULL, NULL, false),
  -- Maria Santos — retiree
  (10006, 'payment', 'January Payment Processed', 'Your January 2026 pension payment of $2,835.56 has been deposited.', 'payment', NULL, true),
  (10006, 'tax_document', '2024 1099-R Available', 'Your 2024 1099-R tax document is now available for download.', 'tax_document', NULL, false);

COMMIT;
