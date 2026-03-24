# Starter Prompt: Post Plan Config Implementation — Next Steps

## Context

The reconciler's hardcoded plan registry has been replaced with YAML-loaded configuration
from `plan-config.yaml`. All 3 tiers (TIER_1, TIER_2, TIER_3) are supported with correct
multipliers (0.020, 0.015, 0.015) and lookup-table early retirement reduction matching
the statutory tables from plan-config.yaml.

## What Was Done (Session 17)

**Branch:** `claude/charming-chaum`

**Architecture documents (3):**
- `docs/architecture/UNIVERSAL_PLAN_TIER_MODEL.md` — Tier 1 governing doc (System > Plan > Tier with 7 composable modules)
- `docs/architecture/MULTI_TENANT_DESIGN_FRAMEWORK.md` — Tier 1 governing doc (25 config surfaces, 12 process domains, tenant isolation)
- `docs/plans/2026-03-22-plan-config-reconciler-design.md` — Implementation design

**Implementation (13 tasks, 16 commits):**
1. `plan-config.yaml` extended with reconciler section (3 tiers)
2. `planconfig.go` — YAML loader, `LoadPlanConfig()`, `LookupTier()`, `ToBenefitParams()`
3. `formula.go` — refactored to use `BenefitParams` with lookup-table reduction
4. `tier1.go` — accepts `*PlanConfig`
5. Handler + `main.go` — loads PlanConfig at startup via `PLAN_CONFIG_PATH` env var
6. Migration 038 — `source_plan_code` column on `stored_calculations`
7. Source loader — plan code normalization (PRISM/PAS → canonical TIER_1/2/3)
8. PRISM generator — aligned multipliers and reduction tables
9. PAS generator — aligned multipliers, added reduction, fixed early_reduction_factor
10. Tier 3 benchmarks — computed from canonical data (salary, contributions, member counts)
11. Proof script — gate score threshold assertions (> 0.50)
12. Docker — plan-config.yaml mount + migration 038 volume
- All 11 migration test packages pass

## Recommended Next Steps (in priority order)

### 1. Regenerate Seed SQL (Required)

The Python generators were updated but seed SQL was NOT regenerated. Run:

```bash
cd migration-simulation/sources/prism && python3 prism_data_generator.py > init/02_seed.sql
cd migration-simulation/sources/pas && python3 generate_pas_scenarios.py
```

Verify the generated SQL has the correct benefit values (multiplier 0.020/0.015, reduction
factors from lookup tables, $800 floor).

### 2. Docker Rebuild + Two-Source Proof

```bash
docker compose down && docker compose up --build -d
# Wait for source DBs to initialize (may need 60-90s for seed SQL)
bash scripts/run_two_source_proof.sh
```

Expected: gate scores > 0 for both PRISM and PAS. Target: gate_passed = true
(weighted_score >= 0.95).

### 3. Debug Gate Scores (if needed)

If gate scores are still below target, check:
- Rounding differences between Python `round()` and Go `roundHalfUpRat()` (HALF_EVEN vs HALF_UP)
- Age computation: Python `(date - dob).days / 365.25` vs Go `int(age)` truncation
- Members below the reduction table minimum age (TIER_3 min is 60 — members aged 55-59 get reduction=0.0)
- Check specific members via: `GET /api/v1/migration/engagements/{id}/reconciliation/p1`

### 4. Code Review and PR Merge

The PR is created. Review and merge when gate scores pass.

## Key Files

- `domains/pension/plan-config.yaml` — plan parameters (reconciler section at bottom)
- `platform/migration/reconciler/planconfig.go` — YAML loader
- `platform/migration/reconciler/formula.go` — benefit calculation with BenefitParams
- `platform/migration/reconciler/tier1.go` — stored calc reconciliation
- `platform/migration/batch/source_loader.go` — plan code normalization
- `migration-simulation/sources/prism/prism_data_generator.py` — PRISM seed generator
- `migration-simulation/sources/pas/generate_pas_scenarios.py` — PAS seed generator
- `scripts/run_two_source_proof.sh` — proof orchestration with gate assertions

## Environment Note

Pre-commit hook OOMs with default parallelism on Windows ARM. Use `GOGC=50 GOMAXPROCS=2`
before `git commit` for Go files.
