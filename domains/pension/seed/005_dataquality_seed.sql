-- Data Quality Engine seed data — check definitions, sample results, and issues.
-- Provides realistic DQ data for the executive dashboard and DQ detail panel.

BEGIN;

-- ============================================================
-- CHECK DEFINITIONS (6 checks across 3 categories)
-- ============================================================

-- Completeness checks
INSERT INTO dq_check_definition (check_id, tenant_id, check_name, check_code, description, category, severity, target_table, threshold)
VALUES
    ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
     'SSN Completeness', 'SSN_COMPLETE', 'Verify all members have a valid SSN on file',
     'completeness', 'critical', 'MEMBER_MASTER', 99.00),
    ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
     'Date of Birth Present', 'DOB_PRESENT', 'Verify all members have a date of birth recorded',
     'completeness', 'critical', 'MEMBER_MASTER', 99.50);

-- Consistency checks
INSERT INTO dq_check_definition (check_id, tenant_id, check_name, check_code, description, category, severity, target_table, threshold)
VALUES
    ('d0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
     'Service Credit Consistency', 'SVC_CREDIT_CONSISTENT', 'Verify total service years equals sum of employment periods',
     'consistency', 'warning', 'EMPLOYMENT_HISTORY', 95.00),
    ('d0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
     'Salary Continuity', 'SALARY_CONTINUITY', 'Verify no gaps in monthly salary records for active members',
     'consistency', 'warning', 'SALARY_HISTORY', 97.00);

-- Validity checks
INSERT INTO dq_check_definition (check_id, tenant_id, check_name, check_code, description, category, severity, target_table, threshold)
VALUES
    ('d0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
     'SSN Format Validation', 'SSN_FORMAT', 'Verify SSN matches expected format (XXX-XX-XXXX)',
     'validity', 'warning', 'MEMBER_MASTER', 98.00),
    ('d0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001',
     'Contribution Balance Non-Negative', 'CONTRIB_NONNEG', 'Verify no negative contribution balances',
     'validity', 'info', 'CONTRIBUTION_BALANCE', 99.90);

-- ============================================================
-- CHECK RESULTS (recent runs with realistic pass rates)
-- ============================================================

-- Day 1 results (3 days ago)
INSERT INTO dq_check_result (result_id, check_id, tenant_id, run_at, records_checked, records_passed, records_failed, pass_rate, status, duration_ms)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '3 days', 500, 498, 2, 99.60, 'completed', 1250),
    ('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '3 days', 500, 499, 1, 99.80, 'completed', 980),
    ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '3 days', 500, 482, 18, 96.40, 'completed', 3200),
    ('a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '3 days', 500, 491, 9, 98.20, 'completed', 2100),
    ('a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '3 days', 500, 494, 6, 98.80, 'completed', 890),
    ('a0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '3 days', 500, 500, 0, 100.00, 'completed', 650);

-- Day 2 results (1 day ago - latest)
INSERT INTO dq_check_result (result_id, check_id, tenant_id, run_at, records_checked, records_passed, records_failed, pass_rate, status, duration_ms)
VALUES
    ('a0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 day', 500, 497, 3, 99.40, 'completed', 1300),
    ('a0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 day', 500, 499, 1, 99.80, 'completed', 950),
    ('a0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 day', 500, 479, 21, 95.80, 'completed', 3400),
    ('a0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 day', 500, 489, 11, 97.80, 'completed', 2200),
    ('a0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 day', 500, 493, 7, 98.60, 'completed', 920),
    ('a0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 day', 500, 500, 0, 100.00, 'completed', 700);

-- ============================================================
-- DQ ISSUES (4 open issues from latest run)
-- ============================================================

INSERT INTO dq_issue (issue_id, result_id, check_id, tenant_id, severity, record_table, record_id, field_name, current_value, expected_pattern, description, status)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
     'critical', 'MEMBER_MASTER', '1247', 'SSN', NULL, 'XXX-XX-XXXX', 'Member 1247 is missing SSN', 'open'),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
     'critical', 'MEMBER_MASTER', '1398', 'SSN', '000-00-0000', 'XXX-XX-XXXX', 'Member 1398 has invalid placeholder SSN', 'open'),
    ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
     'warning', 'EMPLOYMENT_HISTORY', '1052', 'total_service_years', '22.5', 'Sum=21.3', 'Member 1052 total service years (22.5) does not match employment period sum (21.3)', 'open'),
    ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
     'warning', 'MEMBER_MASTER', '1501', 'SSN', '12-345-6789', 'XXX-XX-XXXX', 'Member 1501 SSN format incorrect (missing digit grouping)', 'open');

-- ============================================================
-- MEMBER-SPECIFIC ISSUES (for demo member dashboard integration)
-- record_id matches demo member IDs: 10001, 10002, 10003
-- ============================================================

INSERT INTO dq_issue (issue_id, result_id, check_id, tenant_id, severity, record_table, record_id, field_name, current_value, expected_pattern, description, status)
VALUES
    ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
     'critical', 'MEMBER_MASTER', '10001', 'DOB', NULL, 'YYYY-MM-DD', 'Date of birth is missing from member record', 'open'),
    ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
     'warning', 'EMPLOYMENT_HISTORY', '10002', 'total_service_years', '18.5', 'Sum=17.8', 'Total service years (18.5) does not match employment period sum (17.8)', 'open'),
    ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
     'warning', 'MEMBER_MASTER', '10002', 'SSN', '123-4-56789', 'XXX-XX-XXXX', 'SSN format incorrect (4-digit middle group)', 'open'),
    ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
     'info', 'MEMBER_MASTER', '10003', 'PHONE', '3035551234', '(XXX)XXX-XXXX', 'Phone number in non-standard format', 'open');

COMMIT;
