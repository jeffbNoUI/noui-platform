CREATE TABLE IF NOT EXISTS migration.gate_transition (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id    UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    from_phase       VARCHAR(20) NOT NULL,
    to_phase         VARCHAR(20) NOT NULL,
    direction        VARCHAR(10) NOT NULL CHECK (direction IN ('ADVANCE', 'REGRESS')),
    gate_metrics     JSONB NOT NULL DEFAULT '{}',
    ai_recommendation TEXT NOT NULL DEFAULT '',
    overrides        JSONB NOT NULL DEFAULT '[]',
    authorized_by    VARCHAR(100) NOT NULL,
    authorized_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes            TEXT
);
CREATE INDEX IF NOT EXISTS idx_gate_transition_engagement ON migration.gate_transition(engagement_id);
