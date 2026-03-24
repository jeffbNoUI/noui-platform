-- Migration 042: Demographic snapshot table for Tier 3 reconciliation.
-- Loaded from source system member/address tables.
-- Compared field-by-field against canonical member data.

CREATE TABLE IF NOT EXISTS migration.demographic_snapshot (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id        UUID NOT NULL REFERENCES migration.batch(batch_id),
    member_id       VARCHAR(200) NOT NULL,
    last_name       VARCHAR(60),
    first_name      VARCHAR(40),
    birth_date      DATE,
    ssn_last4       VARCHAR(4),      -- Last 4 digits only for comparison (no full SSN in staging)
    gender          VARCHAR(4),
    marital_status  VARCHAR(4),
    employer_code   VARCHAR(20),
    hire_date       DATE,
    status_code     VARCHAR(10),
    address_line1   VARCHAR(100),
    city            VARCHAR(60),
    state_code      VARCHAR(4),
    zip_code        VARCHAR(10),
    email           VARCHAR(120),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_demographic_snapshot_batch ON migration.demographic_snapshot(batch_id);
