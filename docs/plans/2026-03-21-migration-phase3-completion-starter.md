# Migration Engine Phase 3 Completion: Cross-Language Fixtures + Frontend — Starter Prompt

## What Exists (Phase 1 + Phase 2 + Phase 3 Core Complete)

### Phase 3 (Reconciliation + Feedback — merged via PR #TBD)

**Go reconciler package** (`platform/migration/reconciler/`):
- `engine.go` — Shared types: VarianceCategory (MATCH/MINOR/MAJOR/ERROR), ReconciliationTier (TIER1/TIER2/TIER3), MemberStatus, ReconciliationResult, ClassifyVariance
- `formula.go` — Benefit formula using `math/big.Rat` exclusively. CalcRetirementBenefit, RecomputeFromStoredInputs, RoundHalfUp (HALF_UP to 2dp). Plan registry: DB_MAIN (multiplier=0.20), DB_T2 (multiplier=0.18)
- `tier1.go` — ReconcileTier1: queries stored legacy calculations, recomputes, classifies variance
- `tier2.go` — ReconcileTier2: reverse-engineers benefit from payment history, ±2% tolerance gate
- `tier3.go` — ReconcileTier3: aggregate statistical checks (salary outliers >2σ, contribution totals, service credit spans, member counts)
- `scoring.go` — ComputeGate (weighted_score = (match*1.0 + minor*0.5) / (tier1+tier2 total)), AssignPriority (P1/P2/P3), PrioritizeResults. Gate: score ≥ 0.95 AND P1 unresolved == 0

**API endpoints** (`platform/migration/api/`):
- POST `/api/v1/migration/batches/{id}/reconcile` — runs Tier 1+2, computes gate
- GET `/api/v1/migration/engagements/{id}/reconciliation` — placeholder (needs storage)
- GET `/api/v1/migration/engagements/{id}/reconciliation/p1` — placeholder (needs storage)

**Python intelligence** (`migration-intelligence/`):
- `reconciliation/analysis.py` — detect_systematic_patterns (≥5 members, same direction, CV<0.3)
- `reconciliation/corrections.py` — suggest_corrections (MAPPING_FIX or DATA_FIX)
- `corpus/store.py` — DecisionStore with tenant isolation
- `corpus/abstractor.py` — FeatureAbstractor strips all identifiers
- `corpus/anonymizer.py` — quantize_null_rate (nearest 0.05), quantize_cardinality (LOW/MED/HIGH/UNIQUE)
- Endpoints wired: POST /intelligence/analyze-mismatches, POST /intelligence/record-decision, GET /intelligence/corpus-stats

**YAML fixtures**: `platform/migration/reconciler/testdata/reconciliation_fixtures.yaml` — 5 test cases for cross-language verification

### Test counts
- Go: 10 packages, ~165 tests (including ~55 new reconciler + 5 API handler tests)
- Python: 81 tests (9 analysis + 35 anonymizer/corpus + 37 existing)

### Known TODOs from Phase 3
- GET reconciliation + GET p1 endpoints return placeholders (need reconciliation result storage table)
- Tier 3 not wired into POST /reconcile (needs PlanBenchmarks input)
- `fetchSourceRow` still hardcodes PK to "id"
- `retransform_handler.go` uses same DB for migration and source
- Formula multiplier noted as 0.20 (spec comment said 0.02 — spec typo, 0.20 matches fixtures)

## What to Build Next

Two parallel tracks are ready:

### Track A: Task 25 — Cross-Language Verification Fixtures

Read the full plan: `docs/plans/2026-03-20-migration-engine-plan.md` (lines 1722–1857)

**Goal:** Both Go (`math/big.Rat`) and Python (`decimal.Decimal`) must produce $0.00 variance on all 5 YAML fixture cases.

1. Create `migration-simulation/fixtures/reconciliation_fixtures.yaml` (shared location)
2. Create `migration-simulation/tests/test_cross_language.py` — loads fixtures, runs Python benefit formula, asserts exact match
3. Modify `platform/migration/reconciler/formula_test.go` — add TestCrossLanguageFixtures loading from shared path
4. Both test suites must pass with $0.00 variance

**Note:** The Python benefit formula doesn't exist yet — you need to port the Go formula to Python using `decimal.Decimal` with identical rounding behavior.

### Track B: Migration Management Frontend

Read the full design: `docs/plans/2026-03-21-migration-frontend-design.md`

**Goal:** Build the migration management UI that exposes the complete engagement lifecycle.

This is a major frontend feature with:
- Engagement list + create flow
- Phase timeline stepper (PROFILING → MAPPING → TRANSFORMING → RECONCILING → COMPLETE)
- Mapping review table with AI confidence scores
- Batch monitoring with real-time progress (WebSocket)
- Three-tier reconciliation dashboard (gate gauge, tier funnel, member drill-down)
- Exception triage (P1 individual, P2/P3 AI-grouped bulk resolution)
- Risk register (static + AI-detected)
- Multi-engagement comparison for two-source proof

**Recommended approach:** Use the `feature-dev` skill with interview-then-implement pattern. The design doc has full component breakdown, API contracts, and WebSocket event types.

### Track C: Task 26 — Two-Source Proof E2E (depends on Track A)

Read: `docs/plans/2026-03-20-migration-engine-plan.md` (lines 1860–1930)

Full end-to-end verification: both PRISM and PAS migrated, reconciled, gates passed, cross-language verified.

## Recommended Session Approach

1. Start with Track A (Task 25) — it's small and closes the Phase 3 milestone
2. Then begin Track B (Frontend) — it's the largest remaining deliverable
3. Track C depends on Docker services running, so defer until Track A is complete

## Key Design Decisions to Remember

- Retiree mismatches are ALWAYS P1 (zero tolerance for payment-affecting errors)
- The weighted gate determines batch APPROVED status
- Correction suggestions are AI-proposed but human-approved
- Corpus abstraction ensures zero identifying info crosses tenant boundaries
- Frontend uses WebSocket for real-time batch/reconciliation progress
