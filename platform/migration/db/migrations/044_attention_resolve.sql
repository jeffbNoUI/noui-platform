-- Migration 044: Attention queue resolve/defer — schema evolution
-- Adds resolved/resolved_by/resolution_note columns to reconciliation and risk tables.
-- Adds DEFERRED to risk status CHECK constraint.
--
-- Sprint contract: M01

BEGIN;

-- ============================================================
-- 1. Reconciliation table — add resolve tracking columns
-- ============================================================
ALTER TABLE migration.reconciliation ADD COLUMN resolved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE migration.reconciliation ADD COLUMN resolved_by VARCHAR(200);
ALTER TABLE migration.reconciliation ADD COLUMN resolution_note TEXT;

-- ============================================================
-- 2. Risk table — add DEFERRED to status enum + resolve tracking
-- ============================================================
-- Drop and recreate the status CHECK constraint to add DEFERRED.
-- PostgreSQL auto-names inline CHECK constraints as {table}_{column}_check.
ALTER TABLE migration.risk DROP CONSTRAINT IF EXISTS risk_status_check;
ALTER TABLE migration.risk ADD CONSTRAINT risk_status_check
  CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'MITIGATED', 'CLOSED', 'DEFERRED'));

-- Add resolve tracking columns to risk (mirroring reconciliation).
ALTER TABLE migration.risk ADD COLUMN resolved_by VARCHAR(200);
ALTER TABLE migration.risk ADD COLUMN resolution_note TEXT;

COMMIT;
