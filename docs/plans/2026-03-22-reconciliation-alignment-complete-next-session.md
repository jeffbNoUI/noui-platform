# Starter Prompt: Post Reconciliation Alignment — Next Steps

## Context

The Two-Source Proof is **28/28 passing** with real data flowing through the full
pipeline for both PRISM and PAS sources. Reconciliation results are now persisted
to `migration.reconciliation` and queryable via summary/detail/P1 endpoints.

## What Was Done (Session 16)

**Branch:** `claude/interesting-wu`

- Migration 037: `migration.reconciliation` table for result persistence
- `ReconcileBatch` handler: persists results in a transaction, wires Tier 3
- Source loader fixes: PAS "PAID"→"REGULAR", PRISM "REGR"→"REGULAR" normalization
- PRISM seed: added PMT_SCHEDULE (39) + PMT_HIST (554 rows), fixed NUMERIC overflow
- PAS seed: generated via `generate_pas_scenarios.py` (was never run — 310K lines)
- Tier1/Tier2: defensive `batch_id` filter on JOINs
- Tier3: NULL defense on `service_credit_years` query
- Proof script: gate extraction from POST response, source DB retry loop, data count assertions
- All migration unit tests pass (12 packages)

## Current State

- PRISM: 100 canonical members, 39 stored calcs, 554 payments → 39 reconciliation results
- PAS: 100 canonical members, 26 stored calcs, 248 payments → 26 reconciliation results
- Gate scores: **0** for both sources (0/39 and 0/26 matched)
- Gate `passed=false` because `weighted_score < 0.95`

**Why gate scores are 0:** The reconciler recomputes benefits from stored inputs
(YOS, FAS, age, plan_code) using `RecomputeFromStoredInputs()` and compares against
the stored legacy value. The seed data generators create benefit values using their
own formula (different multipliers, penalty calc, rounding) that doesn't match the
reconciler's `RecomputeFromStoredInputs()` formula. Every member shows as MAJOR variance.

## Recommended Next Steps (in priority order)

### 1. Gate Score Tuning (High Priority)

Two approaches to get gate scores above 0:

**Option A — Align seed generators with reconciler formula:**
Modify `prism_data_generator.py` and `generate_pas_scenarios.py` to compute benefits
using the same formula as `reconciler/formula.go:RecomputeFromStoredInputs()`. This
means: `benefit = yos * multiplier * fas / 12`, with the same penalty and floor logic.

**Option B — Tune reconciler thresholds:**
Widen the MATCH threshold (currently ≤$0.50) or add a CLOSE category. This is less
clean but faster.

Recommended: **Option A** — the proof should demonstrate that reconciliation actually
works, not that we loosened the thresholds.

Files to read first:
- `platform/migration/reconciler/formula.go` (the recompute function)
- `migration-simulation/sources/prism/prism_data_generator.py` (lines 310-343, benefit calc)
- `migration-simulation/sources/pas/generate_pas_scenarios.py` (retirement_award generation)

### 2. Tier 3 Benchmarks

Configure meaningful `PlanBenchmarks` from engagement config or seed data:
- `AvgSalaryByYear`: compute from canonical_salaries after batch load
- `TotalContributions`: sum from canonical_contributions
- `MemberCountByStatus`: expected distribution

Currently Tier 3 runs but produces 0 results because benchmarks are empty.

### 3. Tier 2 Verification

Tier 2 reconciles members who have payments but NO stored calculations. Currently
both sources have stored calcs for all retirees, so Tier 2 finds 0 qualifying members.
Consider:
- Adding some PAS members with payments but no retirement_award
- Or verifying that Tier 2 intentionally covers the gap case

### 4. Proof Script — Gate Score Threshold Assertion

Once gate scores are above 0, add an assertion that `gate_score > 0.50` (or whatever
the target is) to prevent regression.

### 5. Port Management Phase 2 (deferred)

Standardize container ports to :8080 internally.

## Key Files

- `platform/migration/reconciler/formula.go` — benefit recomputation
- `platform/migration/reconciler/tier1.go` — stored calc reconciliation
- `platform/migration/reconciler/scoring.go` — gate computation
- `platform/migration/api/reconciliation_handlers.go` — persistence + all 3 tiers
- `migration-simulation/sources/prism/prism_data_generator.py` — PRISM seed
- `migration-simulation/sources/pas/generate_pas_scenarios.py` — PAS seed
- `scripts/run_two_source_proof.sh` — proof orchestration

## Source Database Stats

PRISM: 100 members, 39 benefit calcs, 39 PMT schedules, 554 PMT history,
       42,770 salary records, 6 employers
PAS:   100 members, 26 retirement awards, 248 benefit payments,
       123,803 salary components, 60,740 contributions
