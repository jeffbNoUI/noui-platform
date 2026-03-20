-- Case Enrichment Seed Data: Notes + Document Metadata
-- Runs after 007_casemanagement_seed.sql and 011_case_enrichment.sql migration

-- Update SLA target days for existing cases based on priority
UPDATE retirement_case SET sla_target_days = 30 WHERE priority = 'urgent';
UPDATE retirement_case SET sla_target_days = 60 WHERE priority = 'high';
UPDATE retirement_case SET sla_target_days = 90 WHERE priority = 'standard';
-- Recompute deadline from created_at + target days
UPDATE retirement_case SET sla_deadline_at = created_at + (sla_target_days || ' days')::INTERVAL;

-- 1. Case notes for all 4 demo cases
INSERT INTO case_note (case_id, author, content, category, created_at) VALUES
-- Case 1: Robert Martinez — Benefit Calculation stage
('RET-2026-0147', 'Sarah Chen', 'Application received with all required documents. Member qualifies for Tier 1 benefits with leave payout.', 'general', '2026-03-05 09:15:00-07'),
('RET-2026-0147', 'Sarah Chen', 'Employment verification complete. 32 years of service confirmed via HR records.', 'review', '2026-03-06 14:30:00-07'),
('RET-2026-0147', 'Mike Torres', 'Eligibility confirmed: Rule of 75 satisfied (age 62 + 32 years service = 94). Leave payout applies (hired before 2010).', 'decision', '2026-03-08 10:00:00-07'),

-- Case 2: Jennifer Kim — Eligibility Review stage
('RET-2026-0152', 'Sarah Chen', 'Application received. Member requesting early retirement with purchased service credit.', 'general', '2026-02-26 09:00:00-07'),
('RET-2026-0152', 'Sarah Chen', 'Documents verified. Birth certificate and employment records on file.', 'review', '2026-02-28 11:45:00-07'),
('RET-2026-0152', 'Mike Torres', 'Note: purchased service credit counts toward benefit calculation but NOT toward Rule of 75/85. Verifying eligibility without purchased service.', 'decision', '2026-03-04 16:00:00-07'),

-- Case 3: David Washington — Document Verification stage
('RET-2026-0159', 'Sarah Chen', 'Application received for early retirement. Member is Tier 3.', 'general', '2026-03-07 08:30:00-07'),
('RET-2026-0159', 'Sarah Chen', 'Requested additional employment verification from HR. Awaiting response.', 'external', '2026-03-08 09:00:00-07'),

-- Case 4: DRO case — Marital Share Calculation stage
('DRO-2026-0031', 'Sarah Chen', 'DRO case opened per court order received 2026-02-18. Assigned urgent priority.', 'general', '2026-02-20 08:15:00-07'),
('DRO-2026-0031', 'Mike Torres', 'Court order reviewed. Marriage period: 1998-2020 (22 years). Service during marriage to be calculated.', 'decision', '2026-02-22 14:00:00-07'),
('DRO-2026-0031', 'Sarah Chen', 'Employment verification complete. Marital share calculation in progress.', 'review', '2026-03-01 10:30:00-07'),
('DRO-2026-0031', 'Legal Dept', 'External counsel confirmed court order meets plan requirements for qualified domestic relations order.', 'external', '2026-03-03 16:00:00-07')
ON CONFLICT DO NOTHING;

-- 2. Document metadata for demo cases (metadata only — no blob storage)
INSERT INTO case_document (case_id, document_type, filename, mime_type, size_bytes, uploaded_by, uploaded_at) VALUES
-- Case 1: Robert Martinez
('RET-2026-0147', 'election_form', 'martinez_retirement_application.pdf', 'application/pdf', 245760, 'Sarah Chen', '2026-03-05 08:15:00-07'),
('RET-2026-0147', 'employment_verification', 'martinez_employment_history.pdf', 'application/pdf', 156000, 'HR System', '2026-03-06 14:00:00-07'),

-- Case 2: Jennifer Kim
('RET-2026-0152', 'election_form', 'kim_retirement_application.pdf', 'application/pdf', 230400, 'Sarah Chen', '2026-02-26 08:30:00-07'),
('RET-2026-0152', 'birth_cert', 'kim_birth_certificate.pdf', 'application/pdf', 512000, 'Sarah Chen', '2026-02-26 08:35:00-07'),
('RET-2026-0152', 'employment_verification', 'kim_purchased_service_docs.pdf', 'application/pdf', 340000, 'HR System', '2026-02-28 11:00:00-07'),

-- Case 3: David Washington
('RET-2026-0159', 'election_form', 'washington_retirement_application.pdf', 'application/pdf', 215000, 'Sarah Chen', '2026-03-07 08:15:00-07'),

-- Case 4: DRO case
('DRO-2026-0031', 'court_order', 'martinez_dro_court_order.pdf', 'application/pdf', 890000, 'Legal Dept', '2026-02-20 08:00:00-07'),
('DRO-2026-0031', 'marriage_cert', 'martinez_marriage_certificate.pdf', 'application/pdf', 420000, 'Sarah Chen', '2026-02-20 08:10:00-07'),
('DRO-2026-0031', 'employment_verification', 'martinez_service_during_marriage.pdf', 'application/pdf', 178000, 'HR System', '2026-03-01 10:00:00-07')
ON CONFLICT DO NOTHING;
