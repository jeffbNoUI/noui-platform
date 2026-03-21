-- migration.risk — risk register
CREATE TABLE migration.risk (
    risk_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id   UUID REFERENCES migration.engagement(engagement_id),  -- nullable for global risks
    tenant_id       UUID NOT NULL,
    source          VARCHAR(10) NOT NULL CHECK (source IN ('DYNAMIC','STATIC')),
    severity        VARCHAR(5) NOT NULL CHECK (severity IN ('P1','P2','P3')),
    description     TEXT NOT NULL,
    evidence        TEXT,
    mitigation      TEXT,
    status          VARCHAR(15) NOT NULL DEFAULT 'OPEN'
                    CHECK (status IN ('OPEN','ACKNOWLEDGED','MITIGATED','CLOSED')),
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_by VARCHAR(100),
    closed_at       TIMESTAMPTZ
);

-- migration.event — activity log
CREATE TABLE migration.event (
    event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id   UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    event_type      VARCHAR(50) NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_engagement_created ON migration.event(engagement_id, created_at DESC);

-- migration.exception_cluster — AI-grouped exceptions
CREATE TABLE migration.exception_cluster (
    cluster_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id                UUID NOT NULL REFERENCES migration.batch(batch_id),
    exception_type          VARCHAR(30) NOT NULL,
    field_name              VARCHAR(100) NOT NULL,
    count                   INTEGER NOT NULL,
    sample_source_ids       JSONB NOT NULL DEFAULT '[]',
    root_cause_pattern      TEXT,
    suggested_resolution    TEXT,
    suggested_disposition   VARCHAR(20) CHECK (suggested_disposition IN ('AUTO_FIXED','MANUAL_FIXED','EXCLUDED','DEFERRED')),
    confidence              DECIMAL(5,4) NOT NULL,
    applied                 BOOLEAN NOT NULL DEFAULT FALSE,
    applied_at              TIMESTAMPTZ
);
CREATE INDEX idx_cluster_batch ON migration.exception_cluster(batch_id);
CREATE INDEX idx_risk_engagement ON migration.risk(engagement_id);
CREATE INDEX idx_risk_tenant ON migration.risk(tenant_id);
