-- Data Quality Engine schema — check definitions, results, and issues.
-- Part of the NoUI platform services.

BEGIN;

-- dq_check_definition — Configurable data quality check definitions.
CREATE TABLE dq_check_definition (
    check_id            UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    check_name          VARCHAR(200)    NOT NULL,
    check_code          VARCHAR(50)     NOT NULL,
    description         TEXT,
    category            VARCHAR(50)     NOT NULL,
    severity            VARCHAR(20)     NOT NULL DEFAULT 'warning'
                        CHECK (severity IN ('critical', 'warning', 'info')),
    target_table        VARCHAR(100)    NOT NULL,
    check_query         TEXT,
    threshold           NUMERIC(5,2),
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    schedule            VARCHAR(50)     DEFAULT 'daily',

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL DEFAULT 'system',
    updated_by          VARCHAR(100)    NOT NULL DEFAULT 'system',
    deleted_at          TIMESTAMP WITH TIME ZONE,

    PRIMARY KEY (check_id)
);

CREATE INDEX idx_dq_check_tenant ON dq_check_definition(tenant_id, is_active);
CREATE INDEX idx_dq_check_category ON dq_check_definition(category);

-- dq_check_result — Individual check run results.
CREATE TABLE dq_check_result (
    result_id           UUID            NOT NULL DEFAULT gen_random_uuid(),
    check_id            UUID            NOT NULL REFERENCES dq_check_definition(check_id),
    tenant_id           UUID            NOT NULL,
    run_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    records_checked     INTEGER         NOT NULL,
    records_passed      INTEGER         NOT NULL,
    records_failed      INTEGER         NOT NULL,
    pass_rate           NUMERIC(5,2)    NOT NULL,
    status              VARCHAR(20)     NOT NULL DEFAULT 'completed'
                        CHECK (status IN ('completed', 'failed', 'skipped')),
    duration_ms         INTEGER,
    error_message       TEXT,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    PRIMARY KEY (result_id)
);

CREATE INDEX idx_dq_result_check ON dq_check_result(check_id, run_at DESC);
CREATE INDEX idx_dq_result_tenant ON dq_check_result(tenant_id, run_at DESC);

-- dq_issue — Detected data quality issues (individual records).
CREATE TABLE dq_issue (
    issue_id            UUID            NOT NULL DEFAULT gen_random_uuid(),
    result_id           UUID            NOT NULL REFERENCES dq_check_result(result_id),
    check_id            UUID            NOT NULL REFERENCES dq_check_definition(check_id),
    tenant_id           UUID            NOT NULL,
    severity            VARCHAR(20)     NOT NULL,
    record_table        VARCHAR(100)    NOT NULL,
    record_id           VARCHAR(100)    NOT NULL,
    field_name          VARCHAR(100),
    current_value       TEXT,
    expected_pattern    TEXT,
    description         TEXT            NOT NULL,
    status              VARCHAR(20)     NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'acknowledged', 'resolved', 'false_positive')),
    resolved_at         TIMESTAMP WITH TIME ZONE,
    resolved_by         VARCHAR(100),
    resolution_note     TEXT,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    PRIMARY KEY (issue_id)
);

CREATE INDEX idx_dq_issue_tenant ON dq_issue(tenant_id, status);
CREATE INDEX idx_dq_issue_check ON dq_issue(check_id);
CREATE INDEX idx_dq_issue_record ON dq_issue(record_table, record_id);
CREATE INDEX idx_dq_issue_severity ON dq_issue(tenant_id, severity) WHERE status = 'open';

COMMIT;
