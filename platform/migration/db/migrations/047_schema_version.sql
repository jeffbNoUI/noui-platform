-- Migration 047: Schema versioning — first-class version entity with field inventory
--
-- schema_version: Tier A RLS (direct tenant_id). Tracks canonical schema versions.
-- schema_version_field: child table FK to schema_version. RLS via two-hop (field → version → tenant).
--
-- Only one version per tenant may be active at a time (partial unique index).
-- Version label must match ^v\d+\.\d+$ (e.g., v1.0, v2.1).
--
-- Seed data: v1.0 canonical entity fields for members, salaries, contributions,
-- stored_calculations, and payment_history — matching migration 036 table definitions.

BEGIN;

-- ============================================================
-- schema_version: canonical schema version entity
-- ============================================================

CREATE TABLE migration.schema_version (
    version_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    label        VARCHAR(20) NOT NULL
                 CHECK (label ~ '^v\d+\.\d+$'),
    description  TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, label)
);

-- Only one active version per tenant.
CREATE UNIQUE INDEX idx_schema_version_active_per_tenant
    ON migration.schema_version(tenant_id) WHERE is_active = true;

-- ============================================================
-- schema_version_field: fields belonging to a schema version
-- ============================================================

CREATE TABLE migration.schema_version_field (
    field_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id   UUID NOT NULL REFERENCES migration.schema_version(version_id) ON DELETE CASCADE,
    entity       VARCHAR(100) NOT NULL,
    field_name   VARCHAR(100) NOT NULL,
    data_type    VARCHAR(50)  NOT NULL,
    is_required  BOOLEAN NOT NULL DEFAULT false,
    description  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (version_id, entity, field_name)
);

CREATE INDEX idx_svf_version ON migration.schema_version_field(version_id);

-- ============================================================
-- RLS: schema_version — Tier A (direct tenant_id)
-- ============================================================

ALTER TABLE migration.schema_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.schema_version FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON migration.schema_version
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- ============================================================
-- RLS: schema_version_field — Tier B (FK to schema_version → tenant)
-- ============================================================

ALTER TABLE migration.schema_version_field ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.schema_version_field FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_schema_version ON migration.schema_version_field
  USING (version_id IN (
    SELECT version_id FROM migration.schema_version
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

-- ============================================================
-- Seed: v1.0 canonical schema (idempotent)
-- ============================================================

-- Insert v1.0 for the default dev tenant (ON CONFLICT DO NOTHING for idempotency).
INSERT INTO migration.schema_version (tenant_id, label, description, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'v1.0',
    'Initial canonical schema — members, salaries, contributions, stored calculations, payment history',
    true
)
ON CONFLICT (tenant_id, label) DO NOTHING;

-- Seed fields for v1.0 (uses a CTE to fetch the version_id safely).
WITH v AS (
    SELECT version_id FROM migration.schema_version
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND label = 'v1.0'
    LIMIT 1
)
INSERT INTO migration.schema_version_field (version_id, entity, field_name, data_type, is_required, description)
SELECT v.version_id, vals.entity, vals.field_name, vals.data_type, vals.is_required, vals.description
FROM v, (VALUES
    -- canonical_members
    ('canonical_members', 'member_id',            'VARCHAR(200)', true,  'Unique member identifier'),
    ('canonical_members', 'member_status',         'VARCHAR(20)',  false, 'Current member status'),
    ('canonical_members', 'canonical_benefit',     'TEXT',         false, 'Computed canonical benefit amount'),
    ('canonical_members', 'service_credit_years',  'DOUBLE PRECISION', false, 'Total service credit in years'),
    ('canonical_members', 'employment_start',      'TIMESTAMPTZ',  false, 'Employment start date'),
    ('canonical_members', 'employment_end',        'TIMESTAMPTZ',  false, 'Employment end date'),
    -- canonical_salaries
    ('canonical_salaries', 'member_id',     'VARCHAR(200)', true,  'FK to canonical_members'),
    ('canonical_salaries', 'salary_year',   'INTEGER',      true,  'Calendar year of salary record'),
    ('canonical_salaries', 'salary_amount', 'DOUBLE PRECISION', true, 'Annual salary amount'),
    -- canonical_contributions
    ('canonical_contributions', 'member_id',           'VARCHAR(200)',  true,  'FK to canonical_members'),
    ('canonical_contributions', 'contribution_amount', 'NUMERIC(18,2)', true,  'Contribution amount'),
    -- stored_calculations
    ('stored_calculations', 'member_id',      'VARCHAR(200)', true,  'FK to canonical_members'),
    ('stored_calculations', 'yos_used',       'TEXT',         false, 'Years of service used in calculation'),
    ('stored_calculations', 'fas_used',       'TEXT',         false, 'Final average salary used'),
    ('stored_calculations', 'age_at_calc',    'INTEGER',      false, 'Age at calculation time'),
    ('stored_calculations', 'plan_code',      'VARCHAR(20)',  false, 'Plan code'),
    ('stored_calculations', 'stored_benefit', 'TEXT',         true,  'Stored legacy benefit amount'),
    -- payment_history
    ('payment_history', 'member_id',     'VARCHAR(200)', true,  'FK to canonical_members'),
    ('payment_history', 'payment_type',  'VARCHAR(20)',  true,  'Payment type code'),
    ('payment_history', 'payment_date',  'DATE',         true,  'Date of payment'),
    ('payment_history', 'gross_amount',  'TEXT',         true,  'Gross payment amount')
) AS vals(entity, field_name, data_type, is_required, description)
ON CONFLICT (version_id, entity, field_name) DO NOTHING;

-- Performance index for RLS subquery on schema_version_field.
CREATE INDEX IF NOT EXISTS idx_schema_version_tenant ON migration.schema_version(tenant_id);

COMMIT;
