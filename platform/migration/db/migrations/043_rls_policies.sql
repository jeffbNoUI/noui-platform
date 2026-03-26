-- Migration 043: Row-Level Security for migration schema tables
-- Resolves CLAUDE.md Section 6 compliance for all migration.* content tables.
--
-- RLS policies enforce tenant isolation at the database layer.
-- Session variable is set per-request by platform/dbcontext/:
--   SELECT set_config('app.tenant_id', $1, true)
--
-- FORCE ROW LEVEL SECURITY ensures policies apply to the table owner too
-- (otherwise owner bypasses RLS, making dev/test behave differently from prod).
-- Superusers still bypass RLS for migration/admin operations.
--
-- Pattern: tables with direct tenant_id use equality check.
-- Child tables without tenant_id join through their parent FK to engagement.
-- When adding a new migration.* table, add its RLS policy here and update
-- the allMigrationTables list in db/rls_test.go.

BEGIN;

-- ============================================================
-- Tier A: Tables with direct tenant_id — simple equality policy
-- ============================================================

ALTER TABLE migration.engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.engagement FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON migration.engagement
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE migration.analyst_decision ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.analyst_decision FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON migration.analyst_decision
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE migration.notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.notification FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON migration.notification
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE migration.risk ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.risk FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON migration.risk
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- ============================================================
-- Tier B: Tables with engagement_id FK — join to engagement
-- ============================================================

ALTER TABLE migration.quality_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.quality_profile FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_engagement ON migration.quality_profile
  USING (engagement_id IN (
    SELECT engagement_id FROM migration.engagement
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE migration.field_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.field_mapping FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_engagement ON migration.field_mapping
  USING (engagement_id IN (
    SELECT engagement_id FROM migration.engagement
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE migration.code_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.code_mapping FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_engagement ON migration.code_mapping
  USING (engagement_id IN (
    SELECT engagement_id FROM migration.engagement
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE migration.batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.batch FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_engagement ON migration.batch
  USING (engagement_id IN (
    SELECT engagement_id FROM migration.engagement
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE migration.correction ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.correction FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_engagement ON migration.correction
  USING (engagement_id IN (
    SELECT engagement_id FROM migration.engagement
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE migration.gate_transition ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.gate_transition FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_engagement ON migration.gate_transition
  USING (engagement_id IN (
    SELECT engagement_id FROM migration.engagement
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE migration.event ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.event FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_engagement ON migration.event
  USING (engagement_id IN (
    SELECT engagement_id FROM migration.engagement
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE migration.certification_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.certification_record FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_engagement ON migration.certification_record
  USING (engagement_id IN (
    SELECT engagement_id FROM migration.engagement
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE migration.profiling_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.profiling_run FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_engagement ON migration.profiling_run
  USING (engagement_id IN (
    SELECT engagement_id FROM migration.engagement
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE migration.job ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.job FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_engagement ON migration.job
  USING (engagement_id IN (
    SELECT engagement_id FROM migration.engagement
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE migration.warning_acknowledgment ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.warning_acknowledgment FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_engagement ON migration.warning_acknowledgment
  USING (engagement_id IN (
    SELECT engagement_id FROM migration.engagement
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

-- ============================================================
-- Tier C: Tables with batch_id FK — join through batch → engagement
-- ============================================================

ALTER TABLE migration.lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.lineage FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_batch ON migration.lineage
  USING (batch_id IN (
    SELECT batch_id FROM migration.batch
    WHERE engagement_id IN (
      SELECT engagement_id FROM migration.engagement
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  ));

ALTER TABLE migration.exception ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.exception FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_batch ON migration.exception
  USING (batch_id IN (
    SELECT batch_id FROM migration.batch
    WHERE engagement_id IN (
      SELECT engagement_id FROM migration.engagement
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  ));

ALTER TABLE migration.exception_cluster ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.exception_cluster FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_batch ON migration.exception_cluster
  USING (batch_id IN (
    SELECT batch_id FROM migration.batch
    WHERE engagement_id IN (
      SELECT engagement_id FROM migration.engagement
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  ));

ALTER TABLE migration.reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.reconciliation FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_batch ON migration.reconciliation
  USING (batch_id IN (
    SELECT batch_id FROM migration.batch
    WHERE engagement_id IN (
      SELECT engagement_id FROM migration.engagement
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  ));

ALTER TABLE migration.reconciliation_pattern ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.reconciliation_pattern FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_batch ON migration.reconciliation_pattern
  USING (batch_id IN (
    SELECT batch_id FROM migration.batch
    WHERE engagement_id IN (
      SELECT engagement_id FROM migration.engagement
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  ));

ALTER TABLE migration.canonical_row ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.canonical_row FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_batch ON migration.canonical_row
  USING (batch_id IN (
    SELECT batch_id FROM migration.batch
    WHERE engagement_id IN (
      SELECT engagement_id FROM migration.engagement
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  ));

ALTER TABLE migration.canonical_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.canonical_members FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_batch ON migration.canonical_members
  USING (batch_id IN (
    SELECT batch_id FROM migration.batch
    WHERE engagement_id IN (
      SELECT engagement_id FROM migration.engagement
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  ));

ALTER TABLE migration.canonical_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.canonical_salaries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_batch ON migration.canonical_salaries
  USING (batch_id IN (
    SELECT batch_id FROM migration.batch
    WHERE engagement_id IN (
      SELECT engagement_id FROM migration.engagement
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  ));

ALTER TABLE migration.canonical_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.canonical_contributions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_batch ON migration.canonical_contributions
  USING (batch_id IN (
    SELECT batch_id FROM migration.batch
    WHERE engagement_id IN (
      SELECT engagement_id FROM migration.engagement
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  ));

ALTER TABLE migration.stored_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.stored_calculations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_batch ON migration.stored_calculations
  USING (batch_id IN (
    SELECT batch_id FROM migration.batch
    WHERE engagement_id IN (
      SELECT engagement_id FROM migration.engagement
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  ));

ALTER TABLE migration.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.payment_history FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_batch ON migration.payment_history
  USING (batch_id IN (
    SELECT batch_id FROM migration.batch
    WHERE engagement_id IN (
      SELECT engagement_id FROM migration.engagement
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  ));

-- ============================================================
-- Tier D: Deep FK chain — profiling tables
-- ============================================================

-- source_table → profiling_run.engagement_id → engagement.tenant_id
ALTER TABLE migration.source_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.source_table FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_profiling ON migration.source_table
  USING (profiling_run_id IN (
    SELECT id FROM migration.profiling_run
    WHERE engagement_id IN (
      SELECT engagement_id FROM migration.engagement
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  ));

-- source_column → source_table → profiling_run → engagement
ALTER TABLE migration.source_column ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration.source_column FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_source_table ON migration.source_column
  USING (source_table_id IN (
    SELECT id FROM migration.source_table
    WHERE profiling_run_id IN (
      SELECT id FROM migration.profiling_run
      WHERE engagement_id IN (
        SELECT engagement_id FROM migration.engagement
        WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
      )
    )
  ));

-- ============================================================
-- Supporting indexes for RLS subquery performance
-- ============================================================
-- Ensure FK columns used in RLS subqueries are indexed.
-- engagement.tenant_id: Tier A equality check + inner subquery for all tiers.
CREATE INDEX IF NOT EXISTS idx_engagement_tenant ON migration.engagement(tenant_id);
-- batch.engagement_id: middle hop for all 11 Tier C policies.
CREATE INDEX IF NOT EXISTS idx_batch_engagement ON migration.batch(engagement_id);
-- source_table.profiling_run_id: middle hop for Tier D source_column policy.
CREATE INDEX IF NOT EXISTS idx_src_table_profiling_run ON migration.source_table(profiling_run_id);

COMMIT;
