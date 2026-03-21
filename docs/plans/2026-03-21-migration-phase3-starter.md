# Migration Engine Phase 3: Reconciliation + Feedback — Starter Prompt

## What Exists (Phase 1 + Phase 2 Complete)

### Phase 1 (Foundation — merged via PR #122)
- Migration schema DDL: `db/migrations/030_migration_schema.sql` (10 tables, indexes)
- Go service skeleton: `platform/migration/` (port 8100) with `go.mod`, Dockerfile, `main.go`
- Engagement CRUD: `api/handlers.go` (create, get, list, update status)
- Source profiler: `profiler/profiler.go` (ISO 8000 quality dimensions)
- Dual mapping: `mapper/mapper.go` (template + signal scoring)
- DB layer: `db/db.go`, `db/canonical_init.sql`
- Python intelligence: `migration-intelligence/` (port 8101, FastAPI, scorer, corpus)
- API response envelope: `apiresponse/apiresponse.go`

### Phase 2 (Transformation + Loading — this branch)
- **Transformation pipeline**: `transformer/pipeline.go` + `transformer/handlers.go`
  - 12 ordered handlers: TypeCoerce, NormalizeSSN, ParseDate, ResolveCode, ResolveMemberKey, ResolveStatus, DetectGranularity, DeduplicateQDRO, ResolveAddress, MapHireDates, DeriveDefaults, ValidateConstraints
  - Confidence tagging: ACTUAL, DERIVED, ESTIMATED, ROLLED_UP
  - Exception types: MISSING_REQUIRED, INVALID_FORMAT, REFERENTIAL_INTEGRITY, BUSINESS_RULE, CROSS_TABLE_MISMATCH, THRESHOLD_BREACH
  - 61 handler+pipeline tests

- **Batch processor**: `batch/batch.go`
  - Idempotent execution, checkpoint/resume, configurable error thresholds
  - Retiree zero-tolerance (any retiree error = halt)
  - BatchEventEmitter interface for WebSocket integration
  - Resume restores error counters from exception table
  - 25 tests

- **Canonical loader**: `loader/loader.go`
  - WriteCanonicalRow (dynamic INSERT), WriteLineage (JSONB), WriteException
  - WriteBatchToCanonical orchestrator
  - `quoteIdent` for PostgreSQL-standard identifier quoting
  - Confidence level validation against CHECK constraint values
  - 20 tests

- **Re-transformation**: `loader/retransform.go`
  - Surgical retransform via lineage — finds correction, queries affected rows scoped by source_table + canonical_table, re-runs pipeline, marks old lineage superseded
  - POST /api/v1/migration/batches/{id}/retransform
  - 12 tests

- **Code table discovery**: `mapper/codetable.go`
  - DiscoverCodeColumns (cardinality heuristic with schema-qualified filtering)
  - InferDomain, ListCodeMappings, UpdateCodeMapping, ResolveCode
  - GET/PUT API endpoints
  - 10 tests

- **E2E verification**: `migration-simulation/tests/test_phase2_e2e.py`
  - Python integration tests for full pipeline against Docker services
  - Verifies both PRISM and PAS sources load to same canonical schema

### Test counts
- 10 Go packages, all passing
- ~130 unit tests across transformer, batch, loader, mapper, api packages

### Known TODOs from review
- `fetchSourceRow` hardcodes PK column to "id" — needs profiler's PK column name for real sources
- `retransform_handler.go` uses same DB for migration and source (placeholder)
- `ListCodeMappings` handler returns empty discoveries (needs source DB access)

## What to Build (Phase 3: Tasks 19–24)

Read the full plan: `docs/plans/2026-03-20-migration-engine-plan.md` (lines 1368–1750)

### Task 19: Tier 1 Reconciliation — Stored Calculations
- Create: `platform/migration/reconciler/engine.go`, `tier1.go`, `formula.go` + tests
- Port benefit formula from Python to Go using `math/big` (big.Rat for full precision)
- CRITICAL: intermediate calcs at full precision, final round HALF_UP to 2 decimal places
- Must match Python Decimal to $0.00
- Shared YAML fixtures for cross-language verification
- Variance categories: MATCH (≤$0.50), MINOR (<$25.00), MAJOR (≥$25.00), ERROR

### Task 20: Tier 2 Reconciliation — Payment History
- Create: `platform/migration/reconciler/tier2.go` + test
- Reverse-engineer benefit from payment records (no stored calcs)
- ±2% tolerance for COLA timing / tax withholding variability

### Task 21: Tier 3 Reconciliation — Aggregate Validation
- Create: `platform/migration/reconciler/tier3.go` + test
- Statistical checks: avg salary by employer/year, total contributions, service credit vs employment span, member count by status
- Flag members >2 standard deviations from mean

### Task 22: Weighted Scoring Gate
- Create: `platform/migration/reconciler/scoring.go` + test
- Create: `platform/migration/api/reconciliation_handlers.go`
- Gate: weighted_score ≥ 0.95 AND p1_unresolved == 0
- Priority: Retiree+any mismatch→P1, MAJOR→P1, MINOR active→P2, Tier 3 outlier→P3
- API: POST .../reconcile, GET .../reconciliation, GET .../reconciliation/p1

### Task 23: Python Mismatch Analysis + Correction Suggestions
- Create: `migration-intelligence/reconciliation/analysis.py`, `corrections.py` + tests
- Systematic pattern detection: ≥5 members, same direction, CV < 0.3
- Correction suggestions correlating patterns to mapping fields
- Wire to /intelligence/analyze-mismatches endpoint

### Task 24: Corpus Abstraction + Shared Model
- Modify: `migration-intelligence/corpus/store.py`, `abstractor.py`
- Create: `migration-intelligence/corpus/anonymizer.py` + tests
- Tenant-isolated decision storage, feature abstraction (no identifying info)
- k-anonymity quantization for null rates and cardinality

## Revert Checklist (if something goes wrong)

Phase 3 adds new packages only (`reconciler/`, `reconciliation/`). Safe to revert by:
```bash
rm -rf platform/migration/reconciler/
# For Python:
rm -rf migration-intelligence/reconciliation/
```
No existing files are modified except `api/handlers.go` (route registration).

## Execution Approach

Use subagent-driven development:
1. One task at a time, sequential (Tasks 19–24)
2. Each task: implement → spec review → code quality review → fix → commit
3. Task 19 is the most complex (benefit formula with exact penny matching) — take extra care with rounding
4. Tasks 20–21 are independent reconciliation tiers
5. Task 22 combines all tiers into the gate
6. Tasks 23–24 are Python (migration-intelligence service)

## Key Design Decisions

From the design doc (`docs/plans/2026-03-20-migration-engine-design.md`):
- Three-tier reconciliation: stored calcs → payment history → aggregate stats
- Retiree mismatches are always P1 (zero tolerance for payment-affecting errors)
- The weighted gate determines whether a batch can proceed to APPROVED status
- Correction suggestions are AI-proposed but human-approved (analyst decision tracking)
- Corpus abstraction ensures no identifying information crosses tenant boundaries
