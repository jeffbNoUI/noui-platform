-- Issue Management seed data — realistic issues for Services Hub panel.
-- All records use tenant_id = '00000000-0000-0000-0000-000000000001' (matches dev JWT and other seed files).

BEGIN;

INSERT INTO issues (issue_id, tenant_id, title, description, severity, category, status, affected_service, reported_by, assigned_to, reported_at, resolved_at, resolution_note)
VALUES
    -- Open / critical
    ('ISS-001', '00000000-0000-0000-0000-000000000001',
     'Benefit calculation timeout for large service histories',
     'Members with 30+ years of service credit experience timeouts when running benefit calculations. The intelligence service exceeds the 30-second request limit.',
     'critical', 'defect', 'open', 'intelligence',
     'Sarah Chen', 'Mike Torres',
     NOW() - INTERVAL '2 days', NULL, NULL),

    -- Open / high
    ('ISS-002', '00000000-0000-0000-0000-000000000001',
     'CRM contact search returns stale results after merge',
     'After merging duplicate contacts, search results still show the old record for several minutes. Cache invalidation appears delayed.',
     'high', 'defect', 'triaged', 'crm',
     'James Wilson', NULL,
     NOW() - INTERVAL '5 days', NULL, NULL),

    -- In-work / medium
    ('ISS-003', '00000000-0000-0000-0000-000000000001',
     'Correspondence template rendering slow for batch jobs',
     'Batch letter generation for annual statements takes 45+ minutes for 1,000 members. Individual rendering is fine.',
     'medium', 'defect', 'in-work', 'correspondence',
     'Lisa Park', 'Sarah Chen',
     NOW() - INTERVAL '8 days', NULL, NULL),

    -- Open / medium (enhancement)
    ('ISS-004', '00000000-0000-0000-0000-000000000001',
     'Add employer contribution summary to member portal',
     'Members have requested visibility into employer contribution totals on their dashboard. Currently only employee contributions are shown.',
     'medium', 'enhancement', 'open', 'dataaccess',
     'David Kim', NULL,
     NOW() - INTERVAL '12 days', NULL, NULL),

    -- Resolved / high
    ('ISS-005', '00000000-0000-0000-0000-000000000001',
     'DRO calculation applies wrong reduction factor for Tier 1',
     'Domestic Relations Order benefit split was using 6% early retirement reduction for Tier 1 members instead of the correct 3%. Affected Case 4 fixture.',
     'high', 'defect', 'resolved', 'intelligence',
     'Mike Torres', 'Sarah Chen',
     NOW() - INTERVAL '20 days', NOW() - INTERVAL '15 days',
     'Fixed reduction factor lookup to use tier-specific rates. Added regression test for all three tiers.'),

    -- Resolved / critical
    ('ISS-006', '00000000-0000-0000-0000-000000000001',
     'Data quality check marking valid SSNs as missing',
     'The SSN completeness check was not handling the new format for members migrated from the legacy system. 2,400 false positives generated.',
     'critical', 'defect', 'resolved', 'dataquality',
     'Lisa Park', 'James Wilson',
     NOW() - INTERVAL '25 days', NOW() - INTERVAL '22 days',
     'Updated SSN validation regex to accept legacy format (XXX-XX-XXXX and XXXXXXXXX). Re-ran check — false positives cleared.'),

    -- Closed / low
    ('ISS-007', '00000000-0000-0000-0000-000000000001',
     'Knowledge base article links broken after URL migration',
     'Several internal links in KB articles pointed to old /docs/ paths. Redirects were in place but caused double-loading.',
     'low', 'defect', 'closed', 'knowledgebase',
     'David Kim', 'David Kim',
     NOW() - INTERVAL '30 days', NOW() - INTERVAL '28 days',
     'Bulk-updated 47 article links to new paths. Added link validation to the KB import script.'),

    -- Open / high (incident)
    ('ISS-008', '00000000-0000-0000-0000-000000000001',
     'Case management work queue not updating after stage transition',
     'When a case moves from Stage 3 to Stage 4, the work queue for Stage 4 analysts does not refresh until manual page reload. WebSocket event appears to fire but UI does not react.',
     'high', 'incident', 'open', 'casemanagement',
     'Sarah Chen', 'Mike Torres',
     NOW() - INTERVAL '1 day', NULL, NULL),

    -- Open / low (question)
    ('ISS-009', '00000000-0000-0000-0000-000000000001',
     'Should connector schema discovery run on a schedule?',
     'Currently schema introspection runs only on manual trigger. For production monitoring, we may want a daily or weekly scheduled run.',
     'low', 'question', 'open', 'connector',
     'James Wilson', NULL,
     NOW() - INTERVAL '7 days', NULL, NULL),

    -- Triaged / medium
    ('ISS-010', '00000000-0000-0000-0000-000000000001',
     'AMS window calculation edge case with mid-month hire dates',
     'Members hired on the 15th or later in a month may have their AMS highest consecutive window shifted by one month depending on how partial months are counted.',
     'medium', 'defect', 'triaged', 'intelligence',
     'Mike Torres', 'Lisa Park',
     NOW() - INTERVAL '3 days', NULL, NULL);

COMMIT;
