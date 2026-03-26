# Sprint B Design: Profiling Data Model + Levels 1-2

**Date:** 2026-03-25
**Parent Plan:** `docs/plans/MIGRATION_OVERHAUL.md` — Part 2
**Scope:** Migration 043, L1+L2 profiler executors, pension patterns, sampling, profiling API

## Context

Part 1 (Job System) is complete — `jobqueue/queue.go`, `worker/worker.go`, migration 033, job API handlers all built and tested. This sprint builds the 5-level profiling data model and implements Levels 1-2 (the source-DB-touching levels).

## Scope Decisions

- **Structural/algorithmic only** — no AI integration (deferred to Sprint C)
- **L1 table classification** uses existing `conceptTagHeuristics` substring matching
- **L2 pension patterns** use regex detectors only
- **L3-L5 not implemented** — run stops at `level_reached = 2`
- **Existing `quality_profile` table retained** for backward compat; L2 populates it

## Architecture

```
API → enqueue "profile_orchestrate" job
  → Worker discovers tables (L1 work)
  → Creates source_table rows
  → Enqueues N "profile_l1" jobs (one per table)
  → Each L1 completion enqueues 1 "profile_l2" for same table
  → Gate job polls until all L2 complete → marks run level_reached = 2
```

## Migration 043: profiling_run, source_table, source_column

Three tables in the `migration` schema. See `MIGRATION_OVERHAUL.md` lines 106-173 for full DDL.

Key design points:
- `profiling_run.status` tracks overall run state (INITIATED → RUNNING_L1 → RUNNING_L2 → L2_COMPLETE)
- `source_table.profile_status` tracks per-table progress (PENDING → L1_DONE → L2_DONE → SKIPPED → FAILED)
- `source_column` stores both L1 (schema) and L2 (statistics) data in one table
- `source_column.is_sampled` + `sample_size` track whether stats are from sample or full scan

## Pension Pattern Detectors

10 named regex patterns for pension-domain data:
- CYYMMDD (AS400 date), YYYYMMDD, IMPLICIT_2DEC (integer cents)
- PCT_WHOLE, TIER_CODE, STATUS_CODE, MEMBER_NUM, SSN, FISCAL_YEAR

Applied during L2 on every VARCHAR/TEXT column. Results stored in `source_column.pattern_frequencies` JSONB.

## Sampling Strategy

- **L1 row counts:** Catalog estimates (`pg_class.reltuples` / `sys.dm_db_partition_stats`) for tables > 1M estimated rows. Exact COUNT(*) for smaller tables.
- **L2 column stats:** `TABLESAMPLE BERNOULLI(1) REPEATABLE(42)` for PostgreSQL tables > 1M rows. Full scan for smaller tables.
- MSSQL: `TABLESAMPLE SYSTEM(1 PERCENT)` with fallback to `TOP(N)`.

## Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `db/migrations/043_profiling_run.sql` | DDL |
| Create | `platform/migration/profiler/levels.go` | Level dispatcher, orchestration executor |
| Create | `platform/migration/profiler/level1_inventory.go` | Table/column discovery |
| Create | `platform/migration/profiler/level2_statistics.go` | Column stats computation |
| Create | `platform/migration/profiler/pension_patterns.go` | 10 regex detectors |
| Create | `platform/migration/profiler/sampling.go` | Driver-aware sampling |
| Create | `platform/migration/db/profiling.go` | Profiling run + source table/column DB ops |
| Create | `platform/migration/api/profiling_handlers.go` | 4 endpoints |
| Create | `platform/migration/worker/profile_l1_executor.go` | L1 executor |
| Create | `platform/migration/worker/profile_l2_executor.go` | L2 executor |
| Modify | `platform/migration/models/types.go` | ProfilingRun, SourceTable, SourceColumn types |
| Modify | `platform/migration/api/handlers.go` | Register profiling routes |
| Modify | `platform/migration/main.go` | Register L1/L2 executors with worker |

## API Endpoints

```
POST   /api/v1/migration/engagements/{id}/profiling-runs         — initiate run
GET    /api/v1/migration/engagements/{id}/profiling-runs         — list runs
GET    /api/v1/migration/profiling-runs/{run_id}                 — status + summary
GET    /api/v1/migration/profiling-runs/{run_id}/inventory       — L1+L2 tables + columns
```

## Testing

- Pension patterns: all 10 regex with positive + negative cases
- Sampling: threshold logic tests
- L1/L2 executors: mock DB tests
- Profiling handlers: HTTP handler tests
- Build: `go build ./...` + `go test ./... -short`
