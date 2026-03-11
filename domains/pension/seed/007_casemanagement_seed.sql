-- Case Management Seed Data
-- Matches the 4 demo cases from frontend/src/lib/demoData.ts WORK_QUEUE

-- 1. Stage definitions (7 stages)
INSERT INTO case_stage_definition (stage_idx, stage_name, description, sort_order) VALUES
(0, 'Application Intake',       'Initial application received and logged',           0),
(1, 'Document Verification',    'Verify all required documents are submitted',       1),
(2, 'Eligibility Review',       'Review eligibility criteria and service credit',    2),
(3, 'Marital Share Calculation', 'Calculate marital share if DRO applies',           3),
(4, 'Benefit Calculation',      'Calculate final monthly benefit amount',            4),
(5, 'Election Recording',       'Record member benefit election choices',            5),
(6, 'Certification',            'Final certification and benefit activation',        6)
ON CONFLICT (stage_idx) DO NOTHING;

-- 2. Retirement cases (4 demo cases)
-- dro_id links to DRO_MASTER for case-scoped DRO lookups (NULL = no DRO for this case)
INSERT INTO retirement_case (
    case_id, member_id, case_type, retirement_date,
    priority, sla_status, current_stage, current_stage_idx,
    assigned_to, days_open, status, dro_id, created_at, updated_at
) VALUES
-- Case 1: Robert Martinez — Tier 1, standard retirement with leave payout (no DRO on this case)
(
    'RET-2026-0147', 10001, 'RET', '2026-04-01',
    'standard', 'on-track', 'Benefit Calculation', 4,
    'Sarah Chen', 5, 'active', NULL,
    '2026-03-05 08:00:00-07', '2026-03-10 09:00:00-07'
),
-- Case 2: Jennifer Kim — Tier 2, early retirement with purchased service
(
    'RET-2026-0152', 10002, 'RET', '2026-05-01',
    'high', 'at-risk', 'Eligibility Review', 2,
    'Sarah Chen', 12, 'active', NULL,
    '2026-02-26 08:00:00-07', '2026-03-10 09:00:00-07'
),
-- Case 3: David Washington — Tier 3, early retirement
(
    'RET-2026-0159', 10003, 'RET', '2026-04-01',
    'standard', 'on-track', 'Document Verification', 1,
    'Sarah Chen', 3, 'active', NULL,
    '2026-03-07 08:00:00-07', '2026-03-10 09:00:00-07'
),
-- Case 4: Robert Martinez DRO — domestic relations order (links to DRO record 1)
(
    'DRO-2026-0031', 10001, 'DRO', '2026-04-01',
    'urgent', 'urgent', 'Marital Share Calculation', 3,
    'Sarah Chen', 18, 'active', 1,
    '2026-02-20 08:00:00-07', '2026-03-10 09:00:00-07'
)
ON CONFLICT (case_id) DO NOTHING;

-- 3. Case flags
INSERT INTO case_flag (case_id, flag_code) VALUES
-- Case 1: leave payout
('RET-2026-0147', 'leave-payout'),
-- Case 2: early retirement + purchased service
('RET-2026-0152', 'early-retirement'),
('RET-2026-0152', 'purchased-service'),
-- Case 3: early retirement
('RET-2026-0159', 'early-retirement'),
-- Case 4: leave payout + DRO
('DRO-2026-0031', 'leave-payout'),
('DRO-2026-0031', 'dro')
ON CONFLICT (case_id, flag_code) DO NOTHING;
