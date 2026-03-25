-- DQ Suppression Rule seed — suppress CONTRIB_NONNEG for employer-paid systems.
-- In employer-paid pension plans (e.g., Nevada PERS EPC, Utah RS Tier 1),
-- member contribution balances are expected to be zero.

BEGIN;

INSERT INTO dq_suppression_rule (tenant_id, check_code, context_key, context_value, reason)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'CONTRIB_NONNEG',
    'contribution_model',
    'employer_paid',
    'Zero/negative contribution balance is expected in employer-paid pension systems'
) ON CONFLICT DO NOTHING;

COMMIT;
