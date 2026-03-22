CREATE TABLE IF NOT EXISTS migration.notification (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    engagement_id    UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    engagement_name  VARCHAR(200) NOT NULL,
    type             VARCHAR(30) NOT NULL,
    summary          TEXT NOT NULL,
    read             BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_tenant ON migration.notification(tenant_id, read, created_at DESC);
