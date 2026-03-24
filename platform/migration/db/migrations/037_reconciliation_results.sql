-- Migration 037: Reconciliation results storage
--
-- Stores per-member reconciliation outcomes so the summary and detail
-- endpoints can query persisted data instead of recomputing on every read.
-- Schema matches the columns expected by db/reconciliation_detail.go.

DROP TABLE IF EXISTS migration.reconciliation CASCADE;

CREATE TABLE migration.reconciliation (
    recon_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id         UUID NOT NULL REFERENCES migration.batch(batch_id),
    member_id        VARCHAR(200) NOT NULL,
    tier             INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
    category         VARCHAR(10) NOT NULL CHECK (category IN ('MATCH','MINOR','MAJOR','ERROR')),
    priority         VARCHAR(2) CHECK (priority IN ('P1','P2','P3')),
    calc_name        VARCHAR(100),
    legacy_value     TEXT,
    recomputed_value TEXT,
    canonical_value  TEXT,
    variance_amount  TEXT,
    suspected_domain VARCHAR(30),
    details          TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reconciliation_batch ON migration.reconciliation(batch_id);
CREATE INDEX idx_reconciliation_priority ON migration.reconciliation(priority)
    WHERE priority IS NOT NULL;
CREATE INDEX idx_reconciliation_tier ON migration.reconciliation(batch_id, tier);
