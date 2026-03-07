-- Correspondence schema — letter templates and generated correspondence history.
-- Part of the NoUI DERP POC platform services.

BEGIN;

-- correspondence_template — Letter/document templates with merge fields.
CREATE TABLE correspondence_template (
    template_id         UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    template_code       VARCHAR(50)     NOT NULL,
    template_name       VARCHAR(200)    NOT NULL,
    description         TEXT,
    category            VARCHAR(50)     NOT NULL,
    body_template       TEXT            NOT NULL,
    merge_fields        JSONB           NOT NULL DEFAULT '[]'::jsonb,
    output_format       VARCHAR(20)     NOT NULL DEFAULT 'text'
                        CHECK (output_format IN ('text', 'html', 'pdf')),
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    version             INTEGER         NOT NULL DEFAULT 1,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL DEFAULT 'system',
    updated_by          VARCHAR(100)    NOT NULL DEFAULT 'system',
    deleted_at          TIMESTAMP WITH TIME ZONE,

    PRIMARY KEY (template_id)
);

CREATE INDEX idx_corr_tmpl_tenant ON correspondence_template(tenant_id, is_active);
CREATE INDEX idx_corr_tmpl_code ON correspondence_template(template_code);
CREATE INDEX idx_corr_tmpl_category ON correspondence_template(category);

-- correspondence_history — Generated correspondence records.
CREATE TABLE correspondence_history (
    correspondence_id   UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    template_id         UUID            NOT NULL REFERENCES correspondence_template(template_id),
    member_id           INTEGER,
    case_id             INTEGER,
    contact_id          UUID,

    subject             VARCHAR(500)    NOT NULL,
    body_rendered       TEXT            NOT NULL,
    merge_data          JSONB           NOT NULL DEFAULT '{}'::jsonb,

    status              VARCHAR(20)     NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'final', 'sent', 'void')),
    generated_by        VARCHAR(100)    NOT NULL DEFAULT 'system',
    sent_at             TIMESTAMP WITH TIME ZONE,
    sent_via            VARCHAR(30),
    delivery_address    TEXT,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMP WITH TIME ZONE,

    PRIMARY KEY (correspondence_id)
);

CREATE INDEX idx_corr_hist_tenant ON correspondence_history(tenant_id);
CREATE INDEX idx_corr_hist_member ON correspondence_history(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX idx_corr_hist_contact ON correspondence_history(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_corr_hist_template ON correspondence_history(template_id);
CREATE INDEX idx_corr_hist_status ON correspondence_history(tenant_id, status);

COMMIT;
