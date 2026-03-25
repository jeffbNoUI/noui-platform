-- DQ Suppression Rules — context-driven suppression of data quality checks.
-- Allows specific checks to be suppressed based on engagement or system context
-- (e.g., suppress CONTRIB_NONNEG for employer-paid contribution models).
--
-- Suppression is query-time only: issues remain stored for audit purposes.

BEGIN;

CREATE TABLE IF NOT EXISTS dq_suppression_rule (
    rule_id       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id     UUID NOT NULL,
    check_code    TEXT NOT NULL,
    context_key   TEXT NOT NULL,
    context_value TEXT NOT NULL,
    reason        TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- One suppression rule per (tenant, check, context) combination
CREATE UNIQUE INDEX IF NOT EXISTS uq_dq_suppression
    ON dq_suppression_rule(tenant_id, check_code, context_key, context_value);

COMMIT;
