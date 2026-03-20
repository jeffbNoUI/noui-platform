-- Expanded Case Seed Data: 12 additional cases with SLA variation
-- Runs after 007_casemanagement_seed.sql and 011_case_enrichment_seed.sql
-- Uses NOW()-based timestamps so SLA stays fresh on every Docker rebuild

-- ============================================================
-- 1. Retirement cases (12 new cases)
-- ============================================================
INSERT INTO retirement_case (
    case_id, member_id, case_type, retirement_date,
    priority, sla_status, current_stage, current_stage_idx,
    assigned_to, days_open, status, dro_id,
    sla_target_days, created_at, updated_at, sla_deadline_at
) VALUES

-- === ON-TRACK cases (7) ===
-- sla_deadline_at = created_at + sla_target_days

-- Maria Santos — Stage 0 (Application Intake), standard, fresh intake
(
    'RET-2026-0201', 10006, 'RET', '2026-07-01',
    'standard', 'on-track', 'Application Intake', 0,
    'Michael Torres', 2, 'active', NULL,
    90, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days' + INTERVAL '90 days'
),
-- James Wilson — Stage 1 (Document Verification), standard
(
    'RET-2026-0202', 10007, 'RET', '2026-08-01',
    'standard', 'on-track', 'Document Verification', 1,
    'Lisa Park', 5, 'active', NULL,
    90, NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '5 days' + INTERVAL '90 days'
),
-- Lisa Park member — Stage 2 (Eligibility Review), low priority
(
    'RET-2026-0203', 10008, 'RET', '2026-09-01',
    'low', 'on-track', 'Eligibility Review', 2,
    'James Wilson', 8, 'active', NULL,
    120, NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '8 days' + INTERVAL '120 days'
),
-- Angela Davis — Stage 4 (Benefit Calculation), high priority
(
    'RET-2026-0204', 10010, 'RET', '2026-06-01',
    'high', 'on-track', 'Benefit Calculation', 4,
    'Sarah Chen', 15, 'active', NULL,
    60, NOW() - INTERVAL '15 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '15 days' + INTERVAL '60 days'
),
-- Richard Chen — Stage 0 (Application Intake), standard, brand new
(
    'RET-2026-0205', 10011, 'RET', '2026-10-01',
    'standard', 'on-track', 'Application Intake', 0,
    'Michael Torres', 1, 'active', NULL,
    90, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '90 days'
),
-- Patricia Moore — Stage 5 (Election Recording), standard
(
    'RET-2026-0206', 10012, 'RET', '2026-06-01',
    'standard', 'on-track', 'Election Recording', 5,
    'Lisa Park', 20, 'active', NULL,
    90, NOW() - INTERVAL '20 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '20 days' + INTERVAL '90 days'
),
-- Maria Santos DRO — Stage 3 (Marital Share Calculation), high priority
(
    'DRO-2026-0032', 10006, 'DRO', '2026-07-01',
    'high', 'on-track', 'Marital Share Calculation', 3,
    'Sarah Chen', 10, 'active', NULL,
    60, NOW() - INTERVAL '10 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '10 days' + INTERVAL '60 days'
),

-- === AT-RISK cases (3) ===

-- Thomas O'Brien — Stage 2, high priority, been open 52 days (60d SLA)
(
    'RET-2026-0207', 10009, 'RET', '2026-06-01',
    'high', 'at-risk', 'Eligibility Review', 2,
    'James Wilson', 52, 'active', NULL,
    60, NOW() - INTERVAL '52 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '52 days' + INTERVAL '60 days'
),
-- Angela Davis — Stage 6 (Certification), urgent, close to deadline (30d SLA)
(
    'RET-2026-0208', 10010, 'RET', '2026-05-01',
    'urgent', 'at-risk', 'Certification', 6,
    'Michael Torres', 25, 'active', NULL,
    30, NOW() - INTERVAL '25 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '25 days' + INTERVAL '30 days'
),
-- Patricia Moore — Stage 6 (Certification), standard but very slow (90d SLA, 78d open)
(
    'RET-2026-0209', 10012, 'RET', '2026-04-01',
    'standard', 'at-risk', 'Certification', 6,
    'Lisa Park', 78, 'active', NULL,
    90, NOW() - INTERVAL '78 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '78 days' + INTERVAL '90 days'
),

-- === OVERDUE cases (2) ===

-- James Wilson — Stage 1, urgent, stuck at document verification (30d SLA, 35d open)
(
    'RET-2026-0210', 10007, 'RET', '2026-05-01',
    'urgent', 'urgent', 'Document Verification', 1,
    'Sarah Chen', 35, 'active', NULL,
    30, NOW() - INTERVAL '35 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '35 days' + INTERVAL '30 days'
),
-- Richard Chen — Stage 4, low priority, severely overdue (120d SLA, 95d open)
(
    'RET-2026-0211', 10011, 'RET', '2026-04-01',
    'low', 'urgent', 'Benefit Calculation', 4,
    'James Wilson', 95, 'active', NULL,
    120, NOW() - INTERVAL '95 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '95 days' + INTERVAL '120 days'
)
ON CONFLICT (case_id) DO NOTHING;


-- ============================================================
-- 2. Case flags
-- ============================================================
INSERT INTO case_flag (case_id, flag_code) VALUES
-- ON-TRACK
('RET-2026-0201', 'leave-payout'),         -- Maria Santos T1 pre-2010
('RET-2026-0202', 'purchased-service'),     -- James Wilson has 2yr purchased
('RET-2026-0203', 'early-retirement'),      -- Lisa Park T3
('RET-2026-0204', 'early-retirement'),      -- Angela Davis T2
('RET-2026-0206', 'leave-payout'),          -- Patricia Moore T1 pre-2010
('DRO-2026-0032', 'dro'),                   -- Maria Santos DRO
('DRO-2026-0032', 'leave-payout'),          -- Maria Santos T1 pre-2010
-- AT-RISK
('RET-2026-0207', 'early-retirement'),      -- Thomas O'Brien deferred
('RET-2026-0208', 'early-retirement'),      -- Angela Davis urgent
-- OVERDUE
('RET-2026-0210', 'purchased-service'),     -- James Wilson stuck
('RET-2026-0211', 'early-retirement')       -- Richard Chen overdue
ON CONFLICT (case_id, flag_code) DO NOTHING;


-- ============================================================
-- 3. Stage transition history
-- ============================================================
INSERT INTO case_stage_history (case_id, from_stage_idx, to_stage_idx, from_stage, to_stage, transitioned_by, note, transitioned_at) VALUES

-- RET-2026-0202: James Wilson — currently at Stage 1
('RET-2026-0202', 0, 1, 'Application Intake', 'Document Verification', 'Lisa Park', 'Application complete, proceeding to document verification.', NOW() - INTERVAL '3 days'),

-- RET-2026-0203: Lisa Park — currently at Stage 2
('RET-2026-0203', 0, 1, 'Application Intake', 'Document Verification', 'James Wilson', 'Intake complete.', NOW() - INTERVAL '6 days'),
('RET-2026-0203', 1, 2, 'Document Verification', 'Eligibility Review', 'James Wilson', 'All documents verified.', NOW() - INTERVAL '4 days'),

-- RET-2026-0204: Angela Davis — currently at Stage 4
('RET-2026-0204', 0, 1, 'Application Intake', 'Document Verification', 'Sarah Chen', 'Priority intake processed.', NOW() - INTERVAL '14 days'),
('RET-2026-0204', 1, 2, 'Document Verification', 'Eligibility Review', 'Sarah Chen', 'Documents verified.', NOW() - INTERVAL '12 days'),
('RET-2026-0204', 2, 3, 'Eligibility Review', 'Marital Share Calculation', 'Sarah Chen', 'Eligibility confirmed. Early retirement with T2 provisions.', NOW() - INTERVAL '9 days'),
('RET-2026-0204', 3, 4, 'Marital Share Calculation', 'Benefit Calculation', 'Sarah Chen', 'Stage not applicable for this case', NOW() - INTERVAL '9 days'),

-- RET-2026-0206: Patricia Moore — currently at Stage 5
('RET-2026-0206', 0, 1, 'Application Intake', 'Document Verification', 'Lisa Park', 'Application received.', NOW() - INTERVAL '18 days'),
('RET-2026-0206', 1, 2, 'Document Verification', 'Eligibility Review', 'Lisa Park', 'Documents complete.', NOW() - INTERVAL '15 days'),
('RET-2026-0206', 2, 3, 'Eligibility Review', 'Marital Share Calculation', 'Lisa Park', 'Eligibility confirmed.', NOW() - INTERVAL '12 days'),
('RET-2026-0206', 3, 4, 'Marital Share Calculation', 'Benefit Calculation', 'Lisa Park', 'Stage not applicable for this case', NOW() - INTERVAL '12 days'),
('RET-2026-0206', 4, 5, 'Benefit Calculation', 'Election Recording', 'Lisa Park', 'Benefit calculated and reviewed.', NOW() - INTERVAL '5 days'),

-- DRO-2026-0032: Maria Santos DRO — currently at Stage 3
('DRO-2026-0032', 0, 1, 'Application Intake', 'Document Verification', 'Sarah Chen', 'DRO intake with court order.', NOW() - INTERVAL '9 days'),
('DRO-2026-0032', 1, 2, 'Document Verification', 'Eligibility Review', 'Sarah Chen', 'Court order and marriage records verified.', NOW() - INTERVAL '7 days'),
('DRO-2026-0032', 2, 3, 'Eligibility Review', 'Marital Share Calculation', 'Sarah Chen', 'Eligibility confirmed. Proceeding to marital share calculation.', NOW() - INTERVAL '4 days'),

-- RET-2026-0207: Thomas O'Brien — currently at Stage 2 (at-risk)
('RET-2026-0207', 0, 1, 'Application Intake', 'Document Verification', 'James Wilson', 'Application received for deferred retirement.', NOW() - INTERVAL '48 days'),
('RET-2026-0207', 1, 2, 'Document Verification', 'Eligibility Review', 'James Wilson', 'Documents verified after delay obtaining employment records.', NOW() - INTERVAL '30 days'),

-- RET-2026-0208: Angela Davis — currently at Stage 6 (at-risk)
('RET-2026-0208', 0, 1, 'Application Intake', 'Document Verification', 'Michael Torres', 'Urgent intake processed same day.', NOW() - INTERVAL '24 days'),
('RET-2026-0208', 1, 2, 'Document Verification', 'Eligibility Review', 'Michael Torres', 'Documents verified.', NOW() - INTERVAL '21 days'),
('RET-2026-0208', 2, 3, 'Eligibility Review', 'Marital Share Calculation', 'Michael Torres', 'Eligibility confirmed.', NOW() - INTERVAL '17 days'),
('RET-2026-0208', 3, 4, 'Marital Share Calculation', 'Benefit Calculation', 'Michael Torres', 'Stage not applicable for this case', NOW() - INTERVAL '17 days'),
('RET-2026-0208', 4, 5, 'Benefit Calculation', 'Election Recording', 'Michael Torres', 'Benefit calculated. Expediting due to urgent priority.', NOW() - INTERVAL '12 days'),
('RET-2026-0208', 5, 6, 'Election Recording', 'Certification', 'Michael Torres', 'Election recorded. Final certification pending.', NOW() - INTERVAL '5 days'),

-- RET-2026-0209: Patricia Moore — currently at Stage 6 (at-risk)
('RET-2026-0209', 0, 1, 'Application Intake', 'Document Verification', 'Lisa Park', 'Application received.', NOW() - INTERVAL '75 days'),
('RET-2026-0209', 1, 2, 'Document Verification', 'Eligibility Review', 'Lisa Park', 'Documents verified.', NOW() - INTERVAL '65 days'),
('RET-2026-0209', 2, 3, 'Eligibility Review', 'Marital Share Calculation', 'Lisa Park', 'Eligibility confirmed.', NOW() - INTERVAL '55 days'),
('RET-2026-0209', 3, 4, 'Marital Share Calculation', 'Benefit Calculation', 'Lisa Park', 'Stage not applicable for this case', NOW() - INTERVAL '55 days'),
('RET-2026-0209', 4, 5, 'Benefit Calculation', 'Election Recording', 'Lisa Park', 'Benefit calculation required multiple revisions.', NOW() - INTERVAL '35 days'),
('RET-2026-0209', 5, 6, 'Election Recording', 'Certification', 'Lisa Park', 'Election recorded. Awaiting final certification.', NOW() - INTERVAL '15 days'),

-- RET-2026-0210: James Wilson — currently at Stage 1 (overdue)
('RET-2026-0210', 0, 1, 'Application Intake', 'Document Verification', 'Sarah Chen', 'Urgent intake processed. Missing employment verification.', NOW() - INTERVAL '32 days'),

-- RET-2026-0211: Richard Chen — currently at Stage 4 (overdue)
('RET-2026-0211', 0, 1, 'Application Intake', 'Document Verification', 'James Wilson', 'Application received.', NOW() - INTERVAL '90 days'),
('RET-2026-0211', 1, 2, 'Document Verification', 'Eligibility Review', 'James Wilson', 'Documents verified.', NOW() - INTERVAL '75 days'),
('RET-2026-0211', 2, 3, 'Eligibility Review', 'Marital Share Calculation', 'James Wilson', 'Eligibility confirmed for early retirement.', NOW() - INTERVAL '60 days'),
('RET-2026-0211', 3, 4, 'Marital Share Calculation', 'Benefit Calculation', 'James Wilson', 'Stage not applicable for this case', NOW() - INTERVAL '60 days')
;


-- ============================================================
-- 4. Case notes (8 notes across new cases)
-- ============================================================
INSERT INTO case_note (case_id, author, content, category, created_at) VALUES
-- Maria Santos intake
('RET-2026-0201', 'Michael Torres', 'Application received with leave payout documentation. Tier 1 member hired 1998, qualifies for sick/vacation payout.', 'general', NOW() - INTERVAL '2 days'),

-- James Wilson doc verification
('RET-2026-0202', 'Lisa Park', 'Employment verification received from HR. Purchased service credit of 2 years confirmed via payroll records.', 'review', NOW() - INTERVAL '3 days'),

-- Angela Davis benefit calc (on-track)
('RET-2026-0204', 'Sarah Chen', 'Eligibility confirmed under Tier 2 early retirement provisions. Proceeding with benefit calculation using 3% per year reduction.', 'decision', NOW() - INTERVAL '3 days'),

-- DRO case
('DRO-2026-0032', 'Sarah Chen', 'Court order received and reviewed. Marriage period overlaps 15 years of service. Calculating marital share per plan DRO policy.', 'review', NOW() - INTERVAL '5 days'),

-- Thomas O'Brien at-risk
('RET-2026-0207', 'James Wilson', 'Eligibility review delayed pending clarification of deferred vesting status. Contacted member for additional information.', 'external', NOW() - INTERVAL '15 days'),
('RET-2026-0207', 'James Wilson', 'Follow-up: member provided documentation of prior employment. Resuming eligibility review.', 'general', NOW() - INTERVAL '5 days'),

-- James Wilson overdue
('RET-2026-0210', 'Sarah Chen', 'Missing employment verification from prior employer. Multiple requests sent. Escalating to supervisor.', 'external', NOW() - INTERVAL '15 days'),

-- Richard Chen overdue
('RET-2026-0211', 'James Wilson', 'Benefit calculation delayed due to complexity of early retirement provisions. Consulting with actuary on reduction factors.', 'review', NOW() - INTERVAL '20 days')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 6. Case documents (7 documents)
-- ============================================================
INSERT INTO case_document (case_id, document_type, filename, mime_type, size_bytes, uploaded_by, uploaded_at) VALUES
-- Maria Santos
('RET-2026-0201', 'election_form', 'santos_retirement_application.pdf', 'application/pdf', 234500, 'Michael Torres', NOW() - INTERVAL '2 days'),
('RET-2026-0201', 'employment_verification', 'santos_leave_balance_report.pdf', 'application/pdf', 145000, 'HR System', NOW() - INTERVAL '1 day'),

-- James Wilson doc verification
('RET-2026-0202', 'election_form', 'wilson_retirement_application.pdf', 'application/pdf', 228000, 'Lisa Park', NOW() - INTERVAL '5 days'),
('RET-2026-0202', 'employment_verification', 'wilson_purchased_service_proof.pdf', 'application/pdf', 312000, 'HR System', NOW() - INTERVAL '4 days'),

-- DRO case
('DRO-2026-0032', 'court_order', 'santos_dro_court_order.pdf', 'application/pdf', 756000, 'Legal Dept', NOW() - INTERVAL '10 days'),

-- Thomas O'Brien at-risk
('RET-2026-0207', 'election_form', 'obrien_retirement_application.pdf', 'application/pdf', 241000, 'James Wilson', NOW() - INTERVAL '52 days'),

-- James Wilson overdue
('RET-2026-0210', 'election_form', 'wilson_second_retirement_app.pdf', 'application/pdf', 219000, 'Sarah Chen', NOW() - INTERVAL '35 days')
ON CONFLICT DO NOTHING;
