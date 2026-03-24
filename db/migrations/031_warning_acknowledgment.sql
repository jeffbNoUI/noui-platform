-- Warning acknowledgment persistence for false cognate warnings.
-- Analysts must acknowledge warnings before approving mappings.
-- One acknowledgment per mapping per engagement (idempotent).

CREATE TABLE IF NOT EXISTS migration.warning_acknowledgment (
    engagement_id    UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    mapping_id       UUID NOT NULL REFERENCES migration.field_mapping(mapping_id),
    acknowledged_by  VARCHAR(100) NOT NULL,
    acknowledged_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (engagement_id, mapping_id)
);
