-- =============================================================================
-- CRM Platform Schema Extension
-- NoUI Platform — Customer Relationship Management
-- =============================================================================
-- PLATFORM TABLES: Clean design, proper constraints, temporal patterns.
-- These are NoUI's own tables, not legacy simulation.
-- =============================================================================
-- Applied after 001_legacy_schema.sql. Does NOT modify any legacy tables.
-- References MEMBER_MASTER.MBR_ID for linkage but no FK (legacy lacks constraints).
-- =============================================================================

BEGIN;

-- =============================================================================
-- crm_contact — Unified contact registry
-- =============================================================================

CREATE TABLE crm_contact (
    contact_id          UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    contact_type        VARCHAR(20)     NOT NULL CHECK (contact_type IN (
                            'MEMBER', 'BENEFICIARY', 'ALTERNATE_PAYEE', 'EXTERNAL')),

    -- Legacy linkage (NULL for EXTERNAL contacts)
    legacy_mbr_id       VARCHAR(20),

    -- Identity
    first_name          VARCHAR(100)    NOT NULL,
    last_name           VARCHAR(100)    NOT NULL,
    middle_name         VARCHAR(100),
    suffix              VARCHAR(20),
    date_of_birth       DATE,
    gender              VARCHAR(10),

    -- Primary contact info
    primary_email       VARCHAR(255),
    primary_phone       VARCHAR(30),
    primary_phone_type  VARCHAR(15) CHECK (primary_phone_type IN (
                            'HOME', 'WORK', 'CELL', 'FAX')),

    -- Communication preferences
    preferred_language  VARCHAR(10)     NOT NULL DEFAULT 'en',
    preferred_channel   VARCHAR(20)     NOT NULL DEFAULT 'SECURE_MESSAGE'
                        CHECK (preferred_channel IN (
                            'PHONE', 'EMAIL', 'SECURE_MESSAGE', 'MAIL', 'PORTAL')),

    -- Security and verification
    identity_verified   BOOLEAN         NOT NULL DEFAULT FALSE,
    identity_verified_at TIMESTAMP WITH TIME ZONE,
    identity_verified_by VARCHAR(100),
    security_flag       VARCHAR(20) CHECK (security_flag IN (
                            'FRAUD_ALERT', 'PENDING_DIVORCE', 'SUSPECTED_DEATH',
                            'LEGAL_HOLD', 'RESTRICTED_ACCESS')),
    security_flag_note  TEXT,

    -- Validation tracking
    email_deliverable   BOOLEAN,
    email_validated_at  TIMESTAMP WITH TIME ZONE,
    phone_validated_at  TIMESTAMP WITH TIME ZONE,
    mail_returned       BOOLEAN         NOT NULL DEFAULT FALSE,
    mail_returned_at    TIMESTAMP WITH TIME ZONE,

    -- Duplicate management
    merged_into_id      UUID,
    merge_date          TIMESTAMP WITH TIME ZONE,

    -- Temporal
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL,
    updated_by          VARCHAR(100)    NOT NULL,
    deleted_at          TIMESTAMP WITH TIME ZONE,

    PRIMARY KEY (contact_id)
);

CREATE INDEX idx_crm_contact_tenant ON crm_contact(tenant_id);
CREATE INDEX idx_crm_contact_legacy ON crm_contact(legacy_mbr_id) WHERE legacy_mbr_id IS NOT NULL;
CREATE INDEX idx_crm_contact_name ON crm_contact(tenant_id, last_name, first_name);
CREATE INDEX idx_crm_contact_email ON crm_contact(tenant_id, primary_email) WHERE primary_email IS NOT NULL;
CREATE INDEX idx_crm_contact_type ON crm_contact(tenant_id, contact_type);

-- =============================================================================
-- crm_contact_address — Address history with CASS validation tracking
-- =============================================================================

CREATE TABLE crm_contact_address (
    address_id          UUID            NOT NULL DEFAULT gen_random_uuid(),
    contact_id          UUID            NOT NULL REFERENCES crm_contact(contact_id),
    address_type        VARCHAR(15)     NOT NULL CHECK (address_type IN (
                            'HOME', 'WORK', 'MAILING', 'PREVIOUS')),
    is_primary          BOOLEAN         NOT NULL DEFAULT FALSE,

    line1               VARCHAR(200)    NOT NULL,
    line2               VARCHAR(200),
    city                VARCHAR(100)    NOT NULL,
    state_code          CHAR(2)         NOT NULL,
    zip_code            VARCHAR(10)     NOT NULL,
    country_code        CHAR(2)         NOT NULL DEFAULT 'US',

    -- USPS CASS validation
    validated           BOOLEAN         NOT NULL DEFAULT FALSE,
    validated_at        TIMESTAMP WITH TIME ZONE,
    standardized_line1  VARCHAR(200),

    effective_from      DATE            NOT NULL DEFAULT CURRENT_DATE,
    effective_to        DATE,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL,

    PRIMARY KEY (address_id)
);

CREATE INDEX idx_crm_addr_contact ON crm_contact_address(contact_id);

-- =============================================================================
-- crm_contact_preference — Communication preference tracking
-- =============================================================================

CREATE TABLE crm_contact_preference (
    preference_id       UUID            NOT NULL DEFAULT gen_random_uuid(),
    contact_id          UUID            NOT NULL REFERENCES crm_contact(contact_id),
    preference_type     VARCHAR(30)     NOT NULL,
    preference_value    VARCHAR(50)     NOT NULL,
    consent_source      VARCHAR(50),
    consent_date        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL,

    PRIMARY KEY (preference_id)
);

CREATE INDEX idx_crm_pref_contact ON crm_contact_preference(contact_id);

-- =============================================================================
-- crm_organization — Employer, vendor, and external agency records
-- =============================================================================

CREATE TABLE crm_organization (
    org_id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    org_type            VARCHAR(20)     NOT NULL CHECK (org_type IN (
                            'EMPLOYER', 'VENDOR', 'AGENCY', 'LEGAL', 'HEALTHCARE')),
    org_name            VARCHAR(200)    NOT NULL,
    org_short_name      VARCHAR(50),

    legacy_employer_id  VARCHAR(20),

    ein                 VARCHAR(20),
    address_line1       VARCHAR(200),
    address_line2       VARCHAR(200),
    city                VARCHAR(100),
    state_code          CHAR(2),
    zip_code            VARCHAR(10),
    main_phone          VARCHAR(30),
    main_email          VARCHAR(255),
    website_url         VARCHAR(500),

    -- Employer-specific
    employer_status     VARCHAR(20) CHECK (employer_status IN (
                            'ACTIVE', 'INACTIVE', 'DELINQUENT', 'PROBATION')),
    member_count        INTEGER,
    last_contribution_date DATE,
    reporting_frequency VARCHAR(15),

    -- Vendor-specific
    contract_reference  VARCHAR(100),
    contract_start_date DATE,
    contract_end_date   DATE,

    -- Temporal
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL,
    updated_by          VARCHAR(100)    NOT NULL,
    deleted_at          TIMESTAMP WITH TIME ZONE,

    PRIMARY KEY (org_id)
);

CREATE INDEX idx_crm_org_tenant ON crm_organization(tenant_id);
CREATE INDEX idx_crm_org_type ON crm_organization(tenant_id, org_type);
CREATE INDEX idx_crm_org_legacy ON crm_organization(legacy_employer_id) WHERE legacy_employer_id IS NOT NULL;

-- =============================================================================
-- crm_org_contact — Contact roles within organizations
-- =============================================================================

CREATE TABLE crm_org_contact (
    org_contact_id      UUID            NOT NULL DEFAULT gen_random_uuid(),
    org_id              UUID            NOT NULL REFERENCES crm_organization(org_id),
    contact_id          UUID            NOT NULL REFERENCES crm_contact(contact_id),
    role                VARCHAR(30)     NOT NULL CHECK (role IN (
                            'SUPER_USER', 'PAYROLL_SUBMITTER', 'BENEFITS_LIAISON',
                            'RETIREE_NOTIFICATION', 'PRIMARY_CONTACT', 'AUTHORIZED_SIGNER',
                            'ACCOUNT_MANAGER', 'TECHNICAL_CONTACT', 'BILLING_CONTACT')),
    is_primary_for_role BOOLEAN         NOT NULL DEFAULT FALSE,
    title               VARCHAR(100),
    direct_phone        VARCHAR(30),
    direct_email        VARCHAR(255),

    effective_from      DATE            NOT NULL DEFAULT CURRENT_DATE,
    effective_to        DATE,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL,

    PRIMARY KEY (org_contact_id)
);

CREATE INDEX idx_crm_orgc_org ON crm_org_contact(org_id);
CREATE INDEX idx_crm_orgc_contact ON crm_org_contact(contact_id);

-- =============================================================================
-- crm_sla_definition — Configurable SLA rules
-- =============================================================================
-- Created before crm_conversation so FK can reference it.

CREATE TABLE crm_sla_definition (
    sla_id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    sla_name            VARCHAR(100)    NOT NULL,
    description         TEXT,

    match_channel       VARCHAR(20),
    match_category      VARCHAR(100),
    match_priority      VARCHAR(10),

    response_target_min INTEGER         NOT NULL,
    resolution_target_min INTEGER,

    warn_at_percent     INTEGER         NOT NULL DEFAULT 80,
    escalate_to_team    VARCHAR(100),
    escalate_to_role    VARCHAR(50),

    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    effective_from      DATE            NOT NULL DEFAULT CURRENT_DATE,
    effective_to        DATE,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL,

    PRIMARY KEY (sla_id)
);

CREATE INDEX idx_crm_sla_tenant ON crm_sla_definition(tenant_id, is_active);

-- =============================================================================
-- crm_conversation — Groups related interactions into threads
-- =============================================================================

CREATE TABLE crm_conversation (
    conversation_id     UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,

    anchor_type         VARCHAR(20)     NOT NULL CHECK (anchor_type IN (
                            'MEMBER', 'EMPLOYER', 'VENDOR', 'CASE', 'GENERAL')),
    anchor_id           VARCHAR(100),

    topic_category      VARCHAR(100),
    topic_subcategory   VARCHAR(100),
    subject             VARCHAR(500),

    status              VARCHAR(20)     NOT NULL DEFAULT 'OPEN' CHECK (status IN (
                            'OPEN', 'PENDING', 'RESOLVED', 'CLOSED', 'REOPENED')),
    resolved_at         TIMESTAMP WITH TIME ZONE,
    resolved_by         VARCHAR(100),
    resolution_summary  TEXT,

    sla_definition_id   UUID            REFERENCES crm_sla_definition(sla_id),
    sla_due_at          TIMESTAMP WITH TIME ZONE,
    sla_breached        BOOLEAN         NOT NULL DEFAULT FALSE,

    assigned_team       VARCHAR(100),
    assigned_agent      VARCHAR(100),

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL,
    updated_by          VARCHAR(100)    NOT NULL,

    PRIMARY KEY (conversation_id)
);

CREATE INDEX idx_crm_conv_tenant ON crm_conversation(tenant_id);
CREATE INDEX idx_crm_conv_anchor ON crm_conversation(anchor_type, anchor_id);
CREATE INDEX idx_crm_conv_status ON crm_conversation(tenant_id, status);
CREATE INDEX idx_crm_conv_assigned ON crm_conversation(assigned_agent) WHERE assigned_agent IS NOT NULL;
CREATE INDEX idx_crm_conv_sla ON crm_conversation(sla_due_at) WHERE NOT sla_breached AND status IN ('OPEN', 'PENDING');

-- =============================================================================
-- crm_interaction — Every touchpoint across all channels
-- =============================================================================

CREATE TABLE crm_interaction (
    interaction_id      UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    conversation_id     UUID            REFERENCES crm_conversation(conversation_id),

    contact_id          UUID            REFERENCES crm_contact(contact_id),
    org_id              UUID            REFERENCES crm_organization(org_id),
    agent_id            VARCHAR(100),

    channel             VARCHAR(20)     NOT NULL CHECK (channel IN (
                            'PHONE_INBOUND', 'PHONE_OUTBOUND', 'SECURE_MESSAGE',
                            'EMAIL_INBOUND', 'EMAIL_OUTBOUND', 'WALK_IN',
                            'PORTAL_ACTIVITY', 'MAIL_INBOUND', 'MAIL_OUTBOUND',
                            'INTERNAL_HANDOFF', 'SYSTEM_EVENT', 'FAX')),

    interaction_type    VARCHAR(30)     NOT NULL DEFAULT 'INQUIRY' CHECK (interaction_type IN (
                            'INQUIRY', 'REQUEST', 'COMPLAINT', 'FOLLOW_UP', 'OUTREACH',
                            'ESCALATION', 'CALLBACK', 'NOTIFICATION', 'STATUS_UPDATE',
                            'DOCUMENT_RECEIPT', 'PROCESS_EVENT', 'SYSTEM_EVENT')),
    category            VARCHAR(100),
    subcategory         VARCHAR(100),

    outcome             VARCHAR(30) CHECK (outcome IN (
                            'RESOLVED', 'ESCALATED', 'CALLBACK_SCHEDULED',
                            'INFO_PROVIDED', 'WORK_ITEM_CREATED', 'TRANSFERRED',
                            'VOICEMAIL_LEFT', 'NO_ANSWER', 'IN_PROGRESS')),

    direction           VARCHAR(10)     NOT NULL DEFAULT 'INBOUND' CHECK (direction IN (
                            'INBOUND', 'OUTBOUND', 'INTERNAL')),
    started_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at            TIMESTAMP WITH TIME ZONE,
    duration_seconds    INTEGER,

    -- Telephony metadata
    external_call_id    VARCHAR(200),
    queue_name          VARCHAR(100),
    wait_time_seconds   INTEGER,
    recording_url       VARCHAR(500),
    transcript_url      VARCHAR(500),

    -- Email/message metadata
    message_subject     VARCHAR(500),
    message_thread_id   VARCHAR(200),

    summary             TEXT,

    linked_case_id      VARCHAR(100),
    linked_workflow_id  VARCHAR(100),

    wrap_up_code        VARCHAR(50),
    wrap_up_seconds     INTEGER,

    visibility          VARCHAR(15)     NOT NULL DEFAULT 'INTERNAL' CHECK (visibility IN (
                            'INTERNAL', 'PUBLIC')),

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL,

    PRIMARY KEY (interaction_id)
);

CREATE INDEX idx_crm_int_tenant ON crm_interaction(tenant_id);
CREATE INDEX idx_crm_int_contact ON crm_interaction(contact_id);
CREATE INDEX idx_crm_int_conv ON crm_interaction(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_crm_int_agent ON crm_interaction(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_crm_int_channel ON crm_interaction(tenant_id, channel);
CREATE INDEX idx_crm_int_started ON crm_interaction(tenant_id, started_at DESC);
CREATE INDEX idx_crm_int_org ON crm_interaction(org_id) WHERE org_id IS NOT NULL;

-- =============================================================================
-- crm_interaction_link — Many-to-many links between interactions
-- =============================================================================

CREATE TABLE crm_interaction_link (
    link_id             UUID            NOT NULL DEFAULT gen_random_uuid(),
    from_interaction_id UUID            NOT NULL REFERENCES crm_interaction(interaction_id),
    to_interaction_id   UUID            NOT NULL REFERENCES crm_interaction(interaction_id),
    link_type           VARCHAR(20)     NOT NULL CHECK (link_type IN (
                            'RELATED', 'FOLLOW_UP', 'DUPLICATE', 'ESCALATION', 'TRANSFER')),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL,

    PRIMARY KEY (link_id)
);

CREATE INDEX idx_crm_ilink_from ON crm_interaction_link(from_interaction_id);
CREATE INDEX idx_crm_ilink_to ON crm_interaction_link(to_interaction_id);

-- =============================================================================
-- crm_note — Structured notes attached to interactions
-- =============================================================================

CREATE TABLE crm_note (
    note_id             UUID            NOT NULL DEFAULT gen_random_uuid(),
    interaction_id      UUID            NOT NULL REFERENCES crm_interaction(interaction_id),

    template_id         VARCHAR(50),
    category            VARCHAR(100)    NOT NULL,
    subcategory         VARCHAR(100),
    summary             VARCHAR(500)    NOT NULL,
    outcome             VARCHAR(30)     NOT NULL,
    next_step           TEXT,

    narrative           TEXT,

    sentiment           VARCHAR(15) CHECK (sentiment IN (
                            'POSITIVE', 'NEUTRAL', 'NEGATIVE', 'ESCALATION_RISK')),
    urgent_flag         BOOLEAN         NOT NULL DEFAULT FALSE,

    ai_suggested        BOOLEAN         NOT NULL DEFAULT FALSE,
    ai_confidence       DECIMAL(3,2),

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by          VARCHAR(100)    NOT NULL,

    PRIMARY KEY (note_id)
);

CREATE INDEX idx_crm_note_interaction ON crm_note(interaction_id);
CREATE INDEX idx_crm_note_category ON crm_note(category);

-- =============================================================================
-- crm_commitment — Tracked promises made to customers
-- =============================================================================

CREATE TABLE crm_commitment (
    commitment_id       UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    interaction_id      UUID            NOT NULL REFERENCES crm_interaction(interaction_id),
    contact_id          UUID            REFERENCES crm_contact(contact_id),
    conversation_id     UUID            REFERENCES crm_conversation(conversation_id),

    description         TEXT            NOT NULL,
    target_date         DATE            NOT NULL,
    owner_agent         VARCHAR(100)    NOT NULL,
    owner_team          VARCHAR(100),

    status              VARCHAR(20)     NOT NULL DEFAULT 'PENDING' CHECK (status IN (
                            'PENDING', 'IN_PROGRESS', 'FULFILLED', 'OVERDUE', 'CANCELLED')),
    fulfilled_at        TIMESTAMP WITH TIME ZONE,
    fulfilled_by        VARCHAR(100),
    fulfillment_note    TEXT,

    alert_days_before   INTEGER         NOT NULL DEFAULT 2,
    alert_sent          BOOLEAN         NOT NULL DEFAULT FALSE,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by          VARCHAR(100)    NOT NULL,

    PRIMARY KEY (commitment_id)
);

CREATE INDEX idx_crm_commit_tenant ON crm_commitment(tenant_id);
CREATE INDEX idx_crm_commit_contact ON crm_commitment(contact_id);
CREATE INDEX idx_crm_commit_status ON crm_commitment(status, target_date) WHERE status IN ('PENDING', 'IN_PROGRESS');
CREATE INDEX idx_crm_commit_owner ON crm_commitment(owner_agent, status);

-- =============================================================================
-- crm_outreach — Proactive contact campaigns
-- =============================================================================

CREATE TABLE crm_outreach (
    outreach_id         UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,

    contact_id          UUID            REFERENCES crm_contact(contact_id),
    org_id              UUID            REFERENCES crm_organization(org_id),

    trigger_type        VARCHAR(40)     NOT NULL,
    trigger_detail      TEXT,

    outreach_type       VARCHAR(20)     NOT NULL CHECK (outreach_type IN (
                            'PHONE', 'EMAIL', 'SECURE_MESSAGE', 'MAIL', 'IN_PERSON')),
    subject             VARCHAR(500),
    talking_points      TEXT,
    priority            VARCHAR(10)     NOT NULL DEFAULT 'NORMAL' CHECK (priority IN (
                            'LOW', 'NORMAL', 'HIGH', 'URGENT')),

    assigned_agent      VARCHAR(100),
    assigned_team       VARCHAR(100),
    status              VARCHAR(20)     NOT NULL DEFAULT 'PENDING' CHECK (status IN (
                            'PENDING', 'ASSIGNED', 'ATTEMPTED', 'COMPLETED',
                            'CANCELLED', 'DEFERRED')),
    attempt_count       INTEGER         NOT NULL DEFAULT 0,
    max_attempts        INTEGER         NOT NULL DEFAULT 3,
    last_attempt_at     TIMESTAMP WITH TIME ZONE,
    completed_at        TIMESTAMP WITH TIME ZONE,

    result_interaction_id UUID          REFERENCES crm_interaction(interaction_id),
    result_outcome      VARCHAR(30),

    scheduled_for       TIMESTAMP WITH TIME ZONE,
    due_by              TIMESTAMP WITH TIME ZONE,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by          VARCHAR(100)    NOT NULL,

    PRIMARY KEY (outreach_id)
);

CREATE INDEX idx_crm_out_tenant ON crm_outreach(tenant_id);
CREATE INDEX idx_crm_out_contact ON crm_outreach(contact_id);
CREATE INDEX idx_crm_out_status ON crm_outreach(status, scheduled_for);
CREATE INDEX idx_crm_out_agent ON crm_outreach(assigned_agent) WHERE assigned_agent IS NOT NULL;

-- =============================================================================
-- crm_sla_tracking — Per-conversation SLA state
-- =============================================================================

CREATE TABLE crm_sla_tracking (
    tracking_id         UUID            NOT NULL DEFAULT gen_random_uuid(),
    conversation_id     UUID            NOT NULL REFERENCES crm_conversation(conversation_id),
    sla_id              UUID            NOT NULL REFERENCES crm_sla_definition(sla_id),

    started_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    response_due_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    resolution_due_at   TIMESTAMP WITH TIME ZONE,

    first_response_at   TIMESTAMP WITH TIME ZONE,
    resolved_at         TIMESTAMP WITH TIME ZONE,

    response_breached   BOOLEAN         NOT NULL DEFAULT FALSE,
    resolution_breached BOOLEAN         NOT NULL DEFAULT FALSE,
    warn_sent           BOOLEAN         NOT NULL DEFAULT FALSE,
    escalation_sent     BOOLEAN         NOT NULL DEFAULT FALSE,

    PRIMARY KEY (tracking_id)
);

CREATE INDEX idx_crm_slat_conv ON crm_sla_tracking(conversation_id);
CREATE INDEX idx_crm_slat_due ON crm_sla_tracking(response_due_at) WHERE NOT response_breached;

-- =============================================================================
-- crm_audit_log — Append-only audit trail for all CRM operations
-- =============================================================================

CREATE TABLE crm_audit_log (
    audit_id            BIGINT          GENERATED ALWAYS AS IDENTITY,
    tenant_id           UUID            NOT NULL,
    event_time          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    event_type          VARCHAR(30)     NOT NULL,
    entity_type         VARCHAR(30)     NOT NULL,
    entity_id           UUID,
    agent_id            VARCHAR(100)    NOT NULL,
    agent_ip            INET,
    agent_device        VARCHAR(200),

    field_changes       JSONB,
    summary             TEXT,

    prev_audit_hash     VARCHAR(64),
    record_hash         VARCHAR(64)     NOT NULL,

    PRIMARY KEY (audit_id)
);

CREATE INDEX idx_crm_audit_tenant ON crm_audit_log(tenant_id, event_time DESC);
CREATE INDEX idx_crm_audit_entity ON crm_audit_log(entity_type, entity_id);
CREATE INDEX idx_crm_audit_agent ON crm_audit_log(agent_id, event_time DESC);

-- =============================================================================
-- crm_category_taxonomy — Configurable call/interaction categories
-- =============================================================================

CREATE TABLE crm_category_taxonomy (
    category_id         UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    parent_id           UUID            REFERENCES crm_category_taxonomy(category_id),
    category_code       VARCHAR(50)     NOT NULL,
    display_name        VARCHAR(200)    NOT NULL,
    description         TEXT,
    sort_order          INTEGER         NOT NULL DEFAULT 0,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    wrap_up_codes       TEXT[],

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL,

    PRIMARY KEY (category_id)
);

CREATE INDEX idx_crm_cat_tenant ON crm_category_taxonomy(tenant_id, is_active);
CREATE INDEX idx_crm_cat_parent ON crm_category_taxonomy(parent_id);

-- =============================================================================
-- crm_note_template — Configurable note templates
-- =============================================================================

CREATE TABLE crm_note_template (
    template_id         UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    template_code       VARCHAR(50)     NOT NULL,
    template_name       VARCHAR(200)    NOT NULL,
    description         TEXT,

    applicable_channels TEXT[],
    applicable_categories TEXT[],

    field_config        JSONB           NOT NULL,

    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    version             INTEGER         NOT NULL DEFAULT 1,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100)    NOT NULL,

    PRIMARY KEY (template_id)
);

CREATE INDEX idx_crm_tmpl_tenant ON crm_note_template(tenant_id, is_active);

COMMIT;
