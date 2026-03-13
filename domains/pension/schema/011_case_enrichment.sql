-- Case Enrichment: Notes, Document Metadata, SLA Deadlines
-- Extends case management with collaboration and tracking features.

-- 1. Case notes
CREATE TABLE IF NOT EXISTS case_note (
    id              SERIAL PRIMARY KEY,
    case_id         VARCHAR(20) NOT NULL REFERENCES retirement_case(case_id) ON DELETE CASCADE,
    author          VARCHAR(100) NOT NULL,
    content         TEXT NOT NULL,
    category        VARCHAR(20) NOT NULL DEFAULT 'general'
                    CHECK (category IN ('general', 'decision', 'review', 'external')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_note_case ON case_note(case_id);
CREATE INDEX IF NOT EXISTS idx_case_note_created ON case_note(case_id, created_at DESC);

-- 2. Case document metadata (no blob storage — metadata only)
CREATE TABLE IF NOT EXISTS case_document (
    id              SERIAL PRIMARY KEY,
    case_id         VARCHAR(20) NOT NULL REFERENCES retirement_case(case_id) ON DELETE CASCADE,
    document_type   VARCHAR(30) NOT NULL DEFAULT 'other'
                    CHECK (document_type IN (
                        'birth_cert', 'marriage_cert', 'court_order',
                        'employment_verification', 'election_form', 'other'
                    )),
    filename        VARCHAR(255) NOT NULL,
    mime_type       VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    size_bytes      INTEGER NOT NULL DEFAULT 0,
    uploaded_by     VARCHAR(100) NOT NULL,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_document_case ON case_document(case_id);

-- 3. SLA deadline columns on retirement_case
ALTER TABLE retirement_case
    ADD COLUMN IF NOT EXISTS sla_target_days INTEGER NOT NULL DEFAULT 90,
    ADD COLUMN IF NOT EXISTS sla_deadline_at TIMESTAMPTZ;

-- Backfill existing cases: deadline = created_at + target days
UPDATE retirement_case
SET sla_deadline_at = created_at + (sla_target_days || ' days')::INTERVAL
WHERE sla_deadline_at IS NULL;

-- Make sla_deadline_at NOT NULL after backfill
ALTER TABLE retirement_case
    ALTER COLUMN sla_deadline_at SET NOT NULL;
