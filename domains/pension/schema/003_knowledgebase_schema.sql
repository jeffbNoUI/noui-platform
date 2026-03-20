-- Knowledge Base schema — contextual help articles and business rule references.
-- Part of the NoUI platform services.

BEGIN;

-- kb_article — Contextual help articles indexed by workflow stage.
CREATE TABLE kb_article (
    article_id          UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    stage_id            VARCHAR(50)     NOT NULL,
    topic               VARCHAR(100),
    title               VARCHAR(200)    NOT NULL,
    context_text        TEXT            NOT NULL,
    checklist           JSONB           NOT NULL DEFAULT '[]'::jsonb,
    next_action         TEXT,
    sort_order          INTEGER         NOT NULL DEFAULT 0,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL DEFAULT 'system',
    updated_by          VARCHAR(100)    NOT NULL DEFAULT 'system',
    deleted_at          TIMESTAMP WITH TIME ZONE,

    PRIMARY KEY (article_id)
);

CREATE INDEX idx_kb_article_tenant ON kb_article(tenant_id);
CREATE INDEX idx_kb_article_stage ON kb_article(tenant_id, stage_id);
CREATE INDEX idx_kb_article_search ON kb_article USING gin(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(context_text, ''))
);

-- kb_rule_reference — Links articles to business rule definitions.
CREATE TABLE kb_rule_reference (
    reference_id        UUID            NOT NULL DEFAULT gen_random_uuid(),
    article_id          UUID            NOT NULL REFERENCES kb_article(article_id),
    rule_id             VARCHAR(100)    NOT NULL,
    rule_code           VARCHAR(100)    NOT NULL,
    rule_description    VARCHAR(500)    NOT NULL,
    rule_domain         VARCHAR(50),
    sort_order          INTEGER         NOT NULL DEFAULT 0,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL DEFAULT 'system',

    PRIMARY KEY (reference_id)
);

CREATE INDEX idx_kb_ruleref_article ON kb_rule_reference(article_id);
CREATE INDEX idx_kb_ruleref_ruleid ON kb_rule_reference(rule_id);
CREATE INDEX idx_kb_ruleref_domain ON kb_rule_reference(rule_domain);

COMMIT;
