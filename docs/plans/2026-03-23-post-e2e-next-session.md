# Next Session Starter — Post E2E Verification

## Context

Session 22 completed Docker E2E verification of the reconciliation pipeline (Sessions 20-21).
All 40/40 E2E tests passing. Branch `claude/sad-goodall` merged to main.

## What Was Accomplished

1. **Phase 7b E2E tests** — reconcile trigger, patterns, resolve, root-cause, P1 issues, corpus learning
2. **Phase 7c E2E tests** — intelligence service health, corpus-stats
3. **3 pre-existing failures fixed:**
   - Profiler used wrong table names (`member_master` → `src_prism.prism_member`)
   - Report handler referenced dropped column (`canonical_table` → `handler_name`)
   - Rate limiting caused late-phase 429s (raised limits for Docker dev)
4. **Infrastructure:** migration 039 mounted, intelligence port 8101 exposed

## Priority Queue (from post-reconciliation plan)

### Tier 1 — High Value
1. **Reconciliation UI** — Frontend components for the reconciliation workflow
   - Gate status dashboard, pattern viewer, P1 issue list, root-cause display
   - Wire to existing API endpoints (all verified working in E2E)
2. **Source simulation seed data** — The prism-source DB has schema but no rows
   - Profiling works but returns zero-row profiles
   - Batch execute fails because `active_members` view doesn't exist
   - Need seed data to exercise the full ETL → reconciliation → pattern detection pipeline

### Tier 2 — Medium Value
3. **Parallel run infrastructure** — Run source and target calculations side-by-side
4. **Auditor-readable lineage reports** — Export transformation audit trail
5. **Performance testing at 250K+ member scale**

### Tier 3 — Polish
6. **Fix remaining E2E soft failures:**
   - Mapping approval returns 400 (corpus learning test)
   - Pattern resolve test skipped (no patterns generated without seed data)

## Recommended Starting Point

Start with **source simulation seed data** (item 2) — it unblocks the full pipeline.
The prism-source DB at `migration-simulation/sources/prism/init/01_schema.sql` has 21 tables
but zero rows. Adding realistic seed data (50-100 members with salary history, contributions,
benefits) would make batch execute, reconciliation, and pattern detection all produce
meaningful results in E2E tests.

Alternatively, start with **Reconciliation UI** (item 1) if the user wants visible progress
on the frontend. All backend endpoints are verified working.

## Key Files

- `tests/e2e/migration_e2e.sh` — 40 assertions, 11 phases
- `docker-compose.yml` — 24 services, migration 039 mounted
- `platform/migration/api/reconciliation_handlers.go` — reconcile, patterns, root-cause
- `migration-simulation/sources/prism/init/01_schema.sql` — source DB schema (no seed data)
- `migration-intelligence/service.py` — Python FastAPI on port 8101
