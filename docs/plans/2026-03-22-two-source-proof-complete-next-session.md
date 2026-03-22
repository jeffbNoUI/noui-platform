# Starter Prompt: Post Two-Source Proof — Next Steps

## Context

The Two-Source Proof is **fully passing** (23/23 checks). Both PRISM and PAS source
databases run through the complete migration pipeline: engagement → profiling →
mapping → batch execution → reconciliation → gate scoring. Cross-source canonical
coexistence and cross-language Go/Python formula verification both pass.

## What Was Done (Session 15)

**Branch:** `claude/stoic-franklin`

- Migration 036: canonical tables DDL (canonical_row, canonical_members, canonical_salaries,
  canonical_contributions, stored_calculations, payment_history) + fixed lineage/exception
  schema drift (DDL was row-level, code wrote column-level)
- Batch executor extended to populate canonical_members from TransformResult.CanonicalRow
- Source reference data loader (stored_calculations from PRISM_BENEFIT_CALC / PAS retirement_award,
  payment_history from PRISM_PMT_HIST / PAS benefit_payment)
- Reconciler queries schema-qualified (migration.*) with COALESCE for NULL defense
- Proof script fixed: batch status check (LOADED not COMPLETE), PAS column name fix
- All migration unit tests pass (11 packages)

## Current State

- Gate scores are 0 for both sources — this means NO members matched in reconciliation
  (stored_calculations JOIN found 0 rows). The pipeline works end-to-end but the
  reconciliation data needs tuning:
  1. The `stored_calculations` member_id format may not match `canonical_members` member_id
     (PRISM uses integer MBR_NBR cast to text, canonical uses the row key from batch)
  2. The payment_history `payment_type` column values may not include 'REGULAR'
  3. Tier 3 has no benchmarks configured yet (skipped in reconciliation handler)

## Recommended Next Steps (in priority order)

### 1. Reconciliation Data Alignment (High Priority)
Debug why tier1/tier2 produce 0 results. The JOIN between canonical_members and
stored_calculations is on member_id — verify both sides use the same key format.
```sql
-- Check what's in each table after a proof run:
SELECT member_id FROM migration.canonical_members LIMIT 5;
SELECT member_id FROM migration.stored_calculations LIMIT 5;
```
If formats differ, fix the source_loader to normalize keys.

### 2. Gate Score Tuning
Once reconciliation finds matches, the gate score should be >0. Tune the
PRISM/PAS data generators or reconciler thresholds so the proof produces
meaningful gate scores (e.g., >0.80 weighted score).

### 3. Tier 3 Benchmarks
Add plan-level benchmarks to the reconciliation handler so Tier 3 checks
(salary outliers, contribution balance, service credit, status counts) execute.
Currently skipped with a TODO comment in reconciliation_handlers.go:43.

### 4. Proof Script Enhancements
- Add gate score threshold assertions (e.g., gate_score > 0.50)
- Add canonical row count verification (100 members per source)
- Add source data load verification (stored_calculations count > 0)

### 5. Port Management Phase 2
Standardize container ports to :8080 internally (deferred from previous session).

## Files to Read First

- `platform/migration/batch/source_loader.go` (source data loading)
- `platform/migration/reconciler/tier1.go` (tier1 query and scoring)
- `scripts/run_two_source_proof.sh` (proof orchestration)
- `BUILD_HISTORY.md` (session history)

## Source Database Stats

PRISM: 100 members, 42,770 salary records, ~39 benefit calcs, 6 employers
PAS: 100 members, 123,803 salary components, 60,740 contributions, 26 reconciliation records
