-- Migration 040: Certification record for parallel run Go/No-Go
--
-- Stores analyst certification decisions for migration engagements,
-- including the gate score, P1 count, and a checklist of required
-- sign-off items. Immutable after creation (no UPDATE).

CREATE TABLE migration.certification_record (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id   UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    gate_score      NUMERIC NOT NULL,
    p1_count        INTEGER NOT NULL DEFAULT 0,
    checklist_json  JSONB NOT NULL,
    certified_by    TEXT NOT NULL,
    certified_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cert_engagement ON migration.certification_record(engagement_id);
