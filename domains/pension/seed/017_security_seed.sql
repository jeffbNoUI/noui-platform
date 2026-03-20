-- Security events + active sessions seed data — for Services Hub Security & Access panel.
-- All records use tenant_id = '00000000-0000-0000-0000-000000000001' (matches dev JWT and other seed files).

BEGIN;

-- ============================================================
-- ACTIVE SESSIONS (4 currently active users)
-- ============================================================

INSERT INTO active_sessions (tenant_id, user_id, session_id, email, role, ip_address, user_agent, started_at, last_seen_at)
VALUES
    ('00000000-0000-0000-0000-000000000001',
     'user_sarah', 'sess_abc123', 'sarah.chen@pension.gov', 'admin',
     '10.0.1.42', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0',
     NOW() - INTERVAL '2 hours', NOW() - INTERVAL '3 minutes'),

    ('00000000-0000-0000-0000-000000000001',
     'user_mike', 'sess_def456', 'mike.torres@pension.gov', 'staff',
     '10.0.1.58', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.0',
     NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '1 minute'),

    ('00000000-0000-0000-0000-000000000001',
     'user_lisa', 'sess_ghi789', 'lisa.park@pension.gov', 'staff',
     '10.0.2.15', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/125.0',
     NOW() - INTERVAL '1 hour', NOW() - INTERVAL '8 minutes'),

    ('00000000-0000-0000-0000-000000000001',
     'user_david', 'sess_jkl012', 'david.kim@pension.gov', 'staff',
     '10.0.1.91', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/124.0',
     NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '5 minutes');

-- ============================================================
-- SECURITY EVENTS (recent activity log)
-- ============================================================

INSERT INTO security_events (tenant_id, event_type, actor_id, actor_email, ip_address, user_agent, metadata, created_at)
VALUES
    -- Today's activity
    ('00000000-0000-0000-0000-000000000001',
     'login_success', 'user_sarah', 'sarah.chen@pension.gov',
     '10.0.1.42', 'Chrome/124.0', '{"method":"password"}',
     NOW() - INTERVAL '2 hours'),

    ('00000000-0000-0000-0000-000000000001',
     'session_start', 'user_sarah', 'sarah.chen@pension.gov',
     '10.0.1.42', 'Chrome/124.0', '{}',
     NOW() - INTERVAL '2 hours'),

    ('00000000-0000-0000-0000-000000000001',
     'login_success', 'user_mike', 'mike.torres@pension.gov',
     '10.0.1.58', 'Safari/17.0', '{"method":"sso"}',
     NOW() - INTERVAL '45 minutes'),

    ('00000000-0000-0000-0000-000000000001',
     'session_start', 'user_mike', 'mike.torres@pension.gov',
     '10.0.1.58', 'Safari/17.0', '{}',
     NOW() - INTERVAL '45 minutes'),

    ('00000000-0000-0000-0000-000000000001',
     'login_failure', 'unknown', 'admin@pension.gov',
     '203.0.113.42', 'curl/8.5.0', '{"reason":"invalid_password","attempt":3}',
     NOW() - INTERVAL '90 minutes'),

    ('00000000-0000-0000-0000-000000000001',
     'login_success', 'user_lisa', 'lisa.park@pension.gov',
     '10.0.2.15', 'Firefox/125.0', '{"method":"password"}',
     NOW() - INTERVAL '1 hour'),

    ('00000000-0000-0000-0000-000000000001',
     'session_start', 'user_lisa', 'lisa.park@pension.gov',
     '10.0.2.15', 'Firefox/125.0', '{}',
     NOW() - INTERVAL '1 hour'),

    ('00000000-0000-0000-0000-000000000001',
     'login_success', 'user_david', 'david.kim@pension.gov',
     '10.0.1.91', 'Edge/124.0', '{"method":"password"}',
     NOW() - INTERVAL '30 minutes'),

    ('00000000-0000-0000-0000-000000000001',
     'session_start', 'user_david', 'david.kim@pension.gov',
     '10.0.1.91', 'Edge/124.0', '{}',
     NOW() - INTERVAL '30 minutes'),

    -- Yesterday's activity
    ('00000000-0000-0000-0000-000000000001',
     'role_change', 'user_sarah', 'sarah.chen@pension.gov',
     '10.0.1.42', 'Chrome/124.0', '{"target_user":"user_david","old_role":"member","new_role":"staff"}',
     NOW() - INTERVAL '1 day'),

    ('00000000-0000-0000-0000-000000000001',
     'password_reset', 'user_james', 'james.wilson@pension.gov',
     '10.0.1.73', 'Chrome/124.0', '{"method":"email_link"}',
     NOW() - INTERVAL '1 day 3 hours'),

    ('00000000-0000-0000-0000-000000000001',
     'login_success', 'user_james', 'james.wilson@pension.gov',
     '10.0.1.73', 'Chrome/124.0', '{"method":"password"}',
     NOW() - INTERVAL '1 day 2 hours'),

    ('00000000-0000-0000-0000-000000000001',
     'session_start', 'user_james', 'james.wilson@pension.gov',
     '10.0.1.73', 'Chrome/124.0', '{}',
     NOW() - INTERVAL '1 day 2 hours'),

    ('00000000-0000-0000-0000-000000000001',
     'session_end', 'user_james', 'james.wilson@pension.gov',
     '10.0.1.73', 'Chrome/124.0', '{}',
     NOW() - INTERVAL '1 day'),

    -- Login failures from 2 days ago (brute force attempt)
    ('00000000-0000-0000-0000-000000000001',
     'login_failure', 'unknown', 'admin@pension.gov',
     '198.51.100.23', 'python-requests/2.31.0', '{"reason":"invalid_password","attempt":1}',
     NOW() - INTERVAL '2 days 4 hours'),

    ('00000000-0000-0000-0000-000000000001',
     'login_failure', 'unknown', 'admin@pension.gov',
     '198.51.100.23', 'python-requests/2.31.0', '{"reason":"invalid_password","attempt":2}',
     NOW() - INTERVAL '2 days 4 hours' + INTERVAL '30 seconds'),

    ('00000000-0000-0000-0000-000000000001',
     'login_failure', 'unknown', 'root@pension.gov',
     '198.51.100.23', 'python-requests/2.31.0', '{"reason":"user_not_found","attempt":1}',
     NOW() - INTERVAL '2 days 3 hours 59 minutes');

COMMIT;
