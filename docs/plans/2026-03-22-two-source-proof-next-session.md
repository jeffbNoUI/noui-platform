# Starter Prompt: Two-Source Proof — Debug Loop (Session 2)

## Context

The Two-Source Proof infrastructure is built and 11/19 checks pass on first run.
Both PRISM and PAS source databases are up with 100 members each, Docker containers
healthy, cross-language verification passing. The proof fails on profiling and batch
execution due to missing tables in the migration schema.

## What Works (11/19)

- Engagement creation (PRISM + PAS)
- Source connection configuration (Docker DNS)
- Mapping generation (6 fields each)
- Batch creation
- Batch execution start (202 accepted)
- Cross-source canonical coexistence
- Cross-language Go/Python formula verification
- PAS and PRISM gate score endpoints respond

## What Fails (8/19)

### Failure 1: Profiling returns 500
**Root cause:** Profile handler now correctly connects to source DB, but the
profiler queries work. The **first** proof run used wrong table names (now fixed
to schema-qualified: `src_prism.prism_member`). Re-run to confirm profiling passes.

### Failure 2: Batch execution → FAILED status
**Root cause:** `clearPriorBatchData()` in `batch.go` references
`migration.canonical_row` which doesn't exist in the schema DDL.

```
ERROR: relation "migration.canonical_row" does not exist
```

**Fix needed:** Either:
a) Add `migration.canonical_row` table to schema (new migration 036)
b) Or use `migration.lineage` which already stores row-level data

### Failure 3: Reconciliation → FAILED
**Root cause:** Reconciler tier1/tier2/tier3 queries reference `canonical_members`
view/table which doesn't exist.

```
ERROR: relation "canonical_members" does not exist
```

**Fix needed:** Create `canonical_members` as a view joining `migration.lineage`
to the canonical `member` table, or create a materialized mapping table.

## Files to Read First

- `platform/migration/batch/batch.go` (lines 453-460: `clearPriorBatchData`)
- `platform/migration/reconciler/tier1.go` (SQL queries referencing `canonical_members`)
- `db/migrations/030_migration_schema.sql` (current migration tables)
- `scripts/run_two_source_proof.sh` (proof script)

## Approach

1. Re-run proof to confirm profiling now passes (table names were fixed)
2. Create migration 036: `canonical_row` table + `canonical_members` view
3. Verify batch execution loads rows
4. Verify reconciliation runs
5. Debug reconciliation gate failures (expect formula mismatches)
6. Iterate until 19/19 pass

## Branch

`claude/romantic-turing` — worktree in `.claude/worktrees/romantic-turing`

## Source Database Stats

PRISM: 100 members, 42,770 salary records, 39 benefit calcs, 6 employers
PAS: 100 members, 123,803 salary components, 60,740 contributions, 26 reconciliation records
