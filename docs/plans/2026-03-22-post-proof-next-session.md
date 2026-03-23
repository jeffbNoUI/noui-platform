# Starter Prompt: Post Two-Source Proof — Next Steps

## Context

The Two-Source Proof is **30/30 passing** with **perfect gate scores** on both sources:

| Source | Stored Calcs | Matched | Gate Score | Gate Passed |
|--------|-------------|---------|------------|-------------|
| PRISM  | 39          | 39/39   | 1.0        | true        |
| PAS    | 26          | 26/26   | 1.0        | true        |

Cross-language verification (Go + Python) passes on all shared YAML fixtures.

## What Was Done (Session 18)

**Branch:** `claude/loving-pike` → merged to main

**6 root causes fixed:**
1. **PRISM seed SQL corruption** — Python `print()` stats leaked into SQL file via
   stdout redirect. Fixed by sending stats to stderr. The generator writes the file
   internally; stdout redirect was never needed.
2. **Profiler NULL scan on empty tables** — `SUM(CASE WHEN ... THEN 1 ELSE 0 END)`
   returns SQL NULL on 0-row tables, crashing `int64` scan. Added `COALESCE(..., 0)`
   to all 4 profiler dimension queries (Completeness, Accuracy, Consistency, Validity).
3. **Gate score threshold script** — `bc` unavailable on Windows/Git Bash, silent
   fallback to `echo "0"`. Replaced with `awk` for cross-platform compatibility.
4. **Python formula module alignment** — Replaced old `PlanParams` (linear penalty
   `ery_penalty_rate`/`max_penalty`) with lookup-table reduction matching the Go
   reconciler. Updated `PLAN_REGISTRY` from `DB_MAIN`/`DB_T2` to `TIER_1`/`TIER_2`/`TIER_3`.
5. **Age truncation mismatch** — PostgreSQL `::INTEGER` rounds (61.654→62), Python
   `int()` truncates (61.654→61). Fixed source_loader to use `FLOOR()::INTEGER`.
6. **Below-table age clamping** — Ages below reduction table minimum (e.g., 52 < 55)
   now clamp to the lowest table factor (0.70) instead of defaulting to 1.0 (Go) or
   0.0 (Python). Applied consistently in Go formula, Python formula, and both seed
   generators.

**Tests:** 11 migration Go packages pass, 9/9 Python cross-language tests pass.

## Recommended Next Steps (in priority order)

### 1. Phase 5g: dbcontext + Employer Fixes (Engineering Debt)

Three known bugs from Phase 5f E2E testing remain unfixed:

1. **`dbcontext` stale connection cascade** (systemic, all services) — When a DB
   transaction fails, the pooled connection carries failed state. Fix: `defer tx.Rollback()`
   pattern. Affects all platform services using the shared dbcontext middleware.

2. **`uploaded_by` UUID empty** — employer-reporting `ManualEntry` handler sets
   `uploaded_by` to empty string. Fix: extract from JWT `sub` claim.

3. **`hireDate` timestamp parsing** — employer-terminations refund calculator uses
   `time.Parse("2006-01-02")` but DB returns RFC3339. Fix: use `time.Parse(time.RFC3339)`.

**Starter prompt:** `docs/plans/2026-03-22-migration-phase5g-starter.md`

### 2. Migration Frontend Polish (3 minor items deferred from Phase 4)

- Title truncation on engagement cards
- Default tab for DISCOVERY phase
- Phase stepper overflow on narrow viewports

### 3. Reconciliation UI Enhancement

The `ReconciliationPanel.tsx` component exists but likely shows limited data now that
reconciliation is fully functional. Potential enhancements:
- Display gate score gauge with pass/fail status
- Show tier breakdown (Tier 1 stored calcs, Tier 2 payments, Tier 3 benchmarks)
- P1 variance detail table with member-level drill-down
- Comparison view: legacy value vs. recomputed value with variance highlighting

### 4. Migration Intelligence Integration

The `migration-intelligence` Python service exists in Docker but its signals aren't
wired into the reconciliation flow yet. Next step: have the Go reconciler call the
Python service for pattern detection on variance clusters (e.g., "14 members with
FORMULA_PARAMETERS variance — all have ages below 55").

### 5. Port Management Phase 2 (deferred)

Standardize container ports to :8080 internally. Low priority.

## Key Files

### Migration Backend
- `platform/migration/reconciler/formula.go` — benefit recomputation
- `platform/migration/reconciler/planconfig.go` — YAML config loader
- `platform/migration/batch/source_loader.go` — source data loading + plan code normalization
- `platform/migration/profiler/dimensions.go` — profiling with COALESCE defense
- `platform/migration/api/reconciliation_handlers.go` — persistence + all 3 tiers
- `domains/pension/plan-config.yaml` — plan parameters (reconciler section)

### Migration Frontend (31 components)
- `frontend/src/components/migration/MigrationManagementUI.tsx` — main entry
- `frontend/src/components/migration/ReconciliationPanel.tsx` — reconciliation display
- `frontend/src/lib/migrationApi.ts` — 30+ API functions
- `frontend/src/types/Migration.ts` — TypeScript types

### Seed Generators
- `migration-simulation/sources/prism/prism_data_generator.py` — stats to stderr
- `migration-simulation/sources/pas/generate_pas_scenarios.py`
- `migration-simulation/formula/benefit.py` — Python formula (lookup-table reduction)
- `migration-simulation/tests/test_cross_language.py` — cross-language verification

### Proof
- `scripts/run_two_source_proof.sh` — 30-check proof orchestration (awk, not bc)

## Architecture Docs

- `docs/architecture/UNIVERSAL_PLAN_TIER_MODEL.md` — System > Plan > Tier entity model
- `docs/architecture/MULTI_TENANT_DESIGN_FRAMEWORK.md` — 25 config surfaces, 12 process domains
