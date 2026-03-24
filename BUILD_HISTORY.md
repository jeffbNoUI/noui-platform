# noui-platform — Build History

## Migration Phase 5g: dbcontext + Employer Defect Fixes (2026-03-24)

**Branch:** `claude/ecstatic-rosalind`

### What Was Done

**dbcontext Stale Connection Fix (systemic, all services):**
- Added `defer tx.Rollback()` after `BeginTx` in `DBMiddleware` — prevents failed
  transactions from poisoning pooled connections. One-line fix in `platform/dbcontext/dbcontext.go`.

**Employer Reporting `uploaded_by` Fix:**
- Wired `auth.UserID(r.Context())` into 3 handlers (ManualEntry, ResolveException, SubmitCorrection)
- Added `UploadedBy` field to `ManualEntryRequest` — accepts explicit portal user UUID
  from request body, falls back to JWT sub claim
- Root cause: DB column `uploaded_by UUID REFERENCES employer_portal_user(id)` requires
  a valid portal user, not a system user ID

**Employer Terminations Date Parsing Fix:**
- Added `parseFlexDate()` helper to handle both RFC3339 (`"2020-01-15T00:00:00Z"`)
  and date-only (`"2020-01-15"`) formats from PostgreSQL
- Applied to both `HireDate` and `TerminationDate` in `CalculateRefund`

**E2E Test Data Fixes:**
- JWT `sub` claim changed from `dev-admin-001` to valid UUID (`00000000-...099`)
- Portal user list jq path fixed (`.data[0].id` not `.data.items[0].id`)
- Manual-entry payload passes `uploadedBy` with portal user UUID
- Division code `SD` corrected to `STATE` (matching seed data)
- All 3 skip tolerances removed — tests now assert strictly

### Stats
- 7 files changed
- Go: all employer-reporting and employer-terminations tests passing (short mode)
- Docker E2E: **167/167** across 5 suites (20+50+24+23+50)
  - Employer suite grew from 46 to 50 (4 previously-skipped tests now passing)
  - Zero skips, zero failures

### What's Next
- PR review and merge
- Phase 5h: Additional employer service hardening or next migration phase

## Session 26: Migration Full Lifecycle — 2 Bugs Fixed, Certification E2E (2026-03-23)

**Branch:** `claude/gracious-pike`

### What Was Done

Full 6-phase migration lifecycle walkthrough through the browser, then repeated
with 100 real PRISM members to verify reconciliation and certification end-to-end.

**Bug 1 — Exception table schema drift:** `migration.exception` was created with a
simpler schema (row_key, handler_name, column_name) but Go code expected richer
columns (source_table, source_id, canonical_table, field_name, disposition, etc.).
Migration 041 adds the missing columns.

**Bug 2 — Scope-aware batch resolver:** `resolveSourceTable` picked the first
alphabetical mapping source table (prism_beneficiary, 0 rows) instead of matching
the batch scope to the right table. Added `scopeCanonicalHints` map:
`ACTIVE_MEMBERS` → "member", `SALARY_HISTORY` → "sal", `BENEFICIARIES` →
"beneficiary", etc.

### Verification

- 100 members loaded from prism-source → canonical tables
- 39 Tier 1 reconciliation records — all MATCH (100% gate score)
- Certification completed through UI — "Already Certified" persists
- Go tests: 11/11 packages pass (6 new scope-matching tests)

### Files Changed

| File | Change |
|------|--------|
| `platform/migration/db/migrations/041_exception_schema_align.sql` | Add 10 missing exception columns |
| `platform/migration/api/batch_handlers.go` | Scope-aware resolveSourceTable with scopeCanonicalHints |
| `platform/migration/api/batch_handlers_test.go` | 6 new tests for scope matching |
| `docs/plans/2026-03-23-post-full-lifecycle-next-session.md` | Next session starter |

### What's Next

- Populate all 21 source tables with seed data (not just prism_member)
- Fix JWT expiry silent failure (batch status stuck at RUNNING)
- Tier 2/3 reconciliation with payment history + demographic data
- Starter prompt: `docs/plans/2026-03-23-post-full-lifecycle-next-session.md`

## Session 25: Migration Pipeline Fixes — Batch Scope + NaN Guard (2026-03-23)

**Branch:** `claude/priceless-albattani` → PR #150 (merged)

### What Was Done

Fixed two critical blockers preventing the migration data pipeline from working end-to-end.

**1. Batch Scope → Source Table Mapping (production design — Option B)**

The batch executor treated `batch_scope` ("ACTIVE_MEMBERS") as a literal table name,
which failed because no such table exists. Implemented a proper resolution chain:

- **Primary**: Extract source table from field mappings (set during Phase 3 Mapping).
  These are authoritative — created by the user during mapping and reflect actual
  discovered table names.
- **Secondary**: Auto-discover primary key from source DB's `information_schema`.
- **Fallback**: Hard-coded system name → table mapping (PRISM, PAS) for backward
  compatibility.

**2. NaN% AI Recommendation Display**

`AIRecommendationCard` displayed `NaN%` when recommendation confidence was
undefined/null. Added type guard: `typeof confidence === 'number' && isFinite()`.

**3. Phase 5g Verification (already complete)**

Confirmed PR #134 already fixed: dbcontext stale connection cascade, uploaded_by UUID
in employer-reporting, hireDate timestamp parsing in employer-terminations.

### Files Changed

| File | Change |
|------|--------|
| `platform/migration/api/batch_handlers.go` | `resolveSourceTable` reads mappings; `resolvePrimaryKey` auto-discovers from info_schema |
| `platform/migration/api/batch_handlers_test.go` | 5 new tests for resolve functions |
| `frontend/src/components/migration/ai/AIRecommendationCard.tsx` | NaN confidence guard |

### Stats

- **Go migration:** 11/11 packages pass
- **Frontend:** 235 files, 1856 tests pass (0 typecheck errors)
- **Migration E2E:** 47/47 (baseline, pre-code-change)

### What's Next

- Docker E2E verification of batch execution with new resolve logic
- Browser walkthrough: batch execute → loaded rows → reconciliation → certification
- Full employer + migration E2E suites to confirm no regressions
- Starter prompt: `docs/plans/2026-03-23-migration-pipeline-docker-e2e-starter.md`

## Session 24: Migration UI Walkthrough — 6 Phases, 5 Bugs Fixed (2026-03-23)

**Branch:** `claude/elegant-elion`

### What Was Done

Full end-to-end browser walkthrough of the migration lifecycle (all 6 phases),
fixing bugs as encountered. Each phase was tested through the Docker-hosted
frontend with live backend services.

**Phase 1 — Discovery:** Create engagement, configure source (prism-source:5432),
discover 21 tables, select all, advance to Profiling. **No bugs.**

**Phase 2 — Profiling:** Run quality profile, radar chart renders (ISO 8000
dimensions), approve baseline. **Bug 1:** ProfileTimeliness crashed on VARCHAR
date columns in legacy source systems.

**Phase 3 — Mapping:** Generate 67 field mappings via auto-discovery, review
mapping table with confidence scores. **Bug 2:** Frontend sent empty tables
array; backend had no auto-discover fallback.

**Phase 4 — Transformation:** Phase gate transitions work, create batch, execute
batch (202 accepted). **Bug 3:** `normalizeEnums` in `rawRequest` lowercased ALL
API responses including migration status — defeating the `raw: true` flag. **Bug 4:**
No Execute Batch button for PENDING batches (only Retransform existed).

**Phase 5 — Reconciliation:** Panel renders empty state correctly. **Bug 5:**
Reconciliation hooks expected raw arrays but backend returns wrapped objects
(`{ records: [...], count }`), causing `.filter is not a function` crash.

**Phase 6 — Parallel Run + Certification:** Go/No-Go checklist renders with
2 auto-checks + 3 manual checks. Certify Complete button disabled until all
checked. Panel works correctly.

### 5 Bugs Fixed

| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 1 | ProfileTimeliness VARCHAR crash | `sql.NullTime` scan fails on VARCHAR dates | String-scan fallback + `parseFlexibleDate()` |
| 2 | Generate Mappings 400 on empty tables | Backend required explicit table list | `autoDiscoverMappingTables()` introspects source DB |
| 3 | Status casing (TRANSFORMING → transforming) | `normalizeEnums` in `rawRequest()` ran on ALL responses | Removed `normalizeEnums` from `rawRequest()` |
| 4 | No Execute Batch button | Only Retransform existed | Added `useExecuteBatch` + conditional button |
| 5 | ReconciliationPanel crash | API returns wrapped objects, hooks expected arrays | Added `select()` transforms to extract arrays |

### Stats

- **Frontend:** 1856/1856 tests (235 files)
- **Migration Go:** 11/11 packages pass
- **Files changed:** 7 across 2 commits
- **Browser verified:** All 6 phases render and function correctly

### What's Next

- Batch execution needs a valid source scope (ACTIVE_MEMBERS doesn't map to a real table)
- Full reconciliation with real data (needs successful batch execution first)
- Certification end-to-end (needs reconciliation gate score > 0)
- NaN% display on AI Recommendation in Transformation tab (cosmetic)

## Session 23: Migration Wrap-Up — Certification, Lineage, UI Fixes (2026-03-23)

**Branch:** `claude/lucid-colden` → PR #147 (merged)

### What Was Done

Completed migration wrap-up plan (4 vertical slices) + fixed systemic bugs found
during browser verification.

**Slice 1 — Reconciliation UI Polish:**
- Mutation feedback (success/error) for Run Reconciliation and Resolve Pattern
- P1 issues currency formatting ($X,XXX.XX)
- Error states when API queries fail
- Member drill-down from root cause analysis (scroll to P1 table)
- Pattern card expansion showing affected members list
- 15 new unit tests (ReconciliationPanel, ParallelRunPanel, TierFunnel)

**Slice 2 — Certification Workflow:**
- Migration 040: `certification_record` table (immutable, audit trail)
- POST /certify (validates 5-item Go/No-Go checklist) + GET /certification
- ParallelRunPanel wired to API — persists checklist, shows "Already Certified" state

**Slice 3 — Lineage API:**
- GET /batches/{id}/lineage — paginated, filterable by member_id/column_name
- GET /batches/{id}/lineage/summary — aggregate stats (records, members, fields, types)

**Slice 4 — E2E Hardening:**
- Seed data readiness poll (prism-source member count check)
- Mapping approval fix (use valid mapping ID)
- Phase 12: certification assertions + Phase 13: lineage assertions

**Bug Fixes Found During Browser Testing:**
- JSONB insert casting: gate.go, pattern.go, certification.go — pq driver sends
  []byte as bytea, not JSONB. Fixed with string() + ::jsonb cast.
- Attention query: `r.resolved` column doesn't exist on reconciliation table (FALSE),
  UNION type mismatch ($1 needs ::text cast)
- Engagement status casing: lowercaseEnums was converting status despite RAW flag.
  Added select() normalization in useEngagement/useEngagements hooks.
- AIRecommendationCard crash: .detail.length and .suggestedActions.length on undefined
  when batch-sizing API returns different shape than AIRecommendation type.
- TabErrorBoundary: wraps all tab content in EngagementDetail so panel render errors
  don't crash the entire engagement view.

### Stats

- **Frontend:** 1856/1856 tests (235 files), 15 new
- **Migration Go:** 11 packages, all pass
- **E2E:** 46/46 (up from 40, 6 new assertions)
- **Browser verified:** Engagement detail loads, Transformation tab active, all tabs work

### What's Next

- **Full UI walkthrough** — test every phase of migration lifecycle through the browser
  (Discovery → Profiling → Mapping → Transformation → Reconciliation → Certification)
- See `docs/plans/2026-03-23-migration-e2e-ui-testing-starter.md`

## Session 22: Reconciliation E2E Verification — 40/40 PASSING (2026-03-23)

**Branch:** `claude/sad-goodall`

### What Was Done

Docker E2E verification of the full reconciliation pipeline from Sessions 20-21,
plus fixing all 3 pre-existing E2E failures to reach 40/40 passing.

**E2E Test Additions (Phase 7b + 7c):**
1. **POST /batches/:id/reconcile** — trigger full 3-tier reconciliation, verify gate result
2. **GET /reconciliation/patterns** — verify intelligence-detected patterns endpoint
3. **PATCH /reconciliation/patterns/:id/resolve** — pattern resolution workflow
4. **GET /reconciliation/root-cause** — enriched root cause with patterns array
5. **GET /reconciliation/p1** — P1 priority issues endpoint
6. **Corpus learning** — mapping approval triggers async RecordDecision
7. **Intelligence service health** — direct health check on port 8101
8. **GET /intelligence/corpus-stats** — corpus metrics endpoint

**Pre-existing Failures FIXED:**

| Failure | Root Cause | Fix |
|---------|-----------|-----|
| Phase 4: profiling 500 | E2E used `member_master` but source DB has `src_prism.prism_member` | Use schema-qualified table names in E2E payload |
| Phase 10: mapping-spec 500 | Migration 036 recreated `migration.exception` without `canonical_table` column | Updated `report_handler.go` query to use `handler_name` |
| Phase 11: source_connection missing | Rate limiting (1 req/s burst 20) exhausted by Phase 10; 429 responses lack data fields | Raised rate limits for Docker dev env + added HTTP status assert |

**Infrastructure Fixes:**
- Added migration 039 (`reconciliation_patterns.sql`) to docker-compose.yml volume mounts
- Exposed intelligence service port 8101 to host for direct E2E testing
- Added intelligence service health check to `--wait` flag (non-blocking)
- Raised migration service rate limits in Docker for E2E burst traffic

### Files Changed

- `tests/e2e/migration_e2e.sh` — Phase 7b + 7c, fixed table names, added status assert
- `docker-compose.yml` — Migration 039 mount, intelligence port, rate limit env vars
- `platform/migration/api/report_handler.go` — Fixed `canonical_table` → `handler_name`
- `BUILD_HISTORY.md` — Session record

### Stats

- **E2E: 40/40 PASSING** (up from 36/39)
- New tests: ~15 assertions across Phase 7b + 7c
- All reconciliation endpoints: 200 OK
- Intelligence service: healthy, corpus-stats accessible
- Nil-safe degradation verified: pattern count=0 when no mismatches exist

### What's Next

- Parallel run infrastructure (Phase 4 hardening)
- Auditor-readable lineage reports
- Performance testing at 250K+ member scale

## Session 21: Reconciliation Completion — 5 Items (2026-03-22)

**Branch:** `claude/quizzical-murdock`

### What Was Done

Completed all 5 remaining reconciliation items in 2 waves (backend Go sweep, frontend React sweep).

**Wave 1 — Backend (3 items):**
1. **Enhanced root cause** — `HandleGetRootCause` now includes intelligence-detected patterns
   in the response payload alongside the deterministic analysis.
2. **Resolution workflow** — New `PATCH /reconciliation/patterns/{id}/resolve` endpoint.
   `ResolvePattern()` DB function sets `resolved=TRUE`, `resolved_at`, `resolved_by`.
3. **Corpus learning** — New `RecordDecision()` method on intelligence client. Wired into
   `UpdateMapping` handler as fire-and-forget goroutine when analyst approves/rejects a mapping.

**Wave 2 — Frontend (3 items):**
4. **Rate limit fix** — Removed 3 `useReconciliationByTier` API calls that triggered 429.
   Tier breakdowns now derived client-side from `useReconciliation` via `useMemo`.
5. **Resolution workflow UI** — Resolve button on pattern cards, `useResolvePattern` mutation
   hook, `resolvePattern()` API function. Shows "Resolved" state after resolution.
6. **Batch trigger button** — "Run Reconciliation" button appears when latest batch is loaded.
   Uses existing `useReconcileBatch` mutation hook.

### Files Changed

- 12 files changed (+264 lines, -19 lines)
- Go: `ai_handlers.go`, `pattern_handlers.go`, `handlers.go`, `mapping_handlers.go`,
  `pattern.go`, `client.go`, `client_test.go`, `types.go`
- Frontend: `ReconciliationPanel.tsx`, `ReconciliationPatterns.test.tsx`,
  `useMigrationApi.ts`, `migrationApi.ts`

### Stats

- Migration Go: 11 packages, all pass (short mode)
- Frontend: 232 test files, 1840 tests passing
- 6 commits, zero regressions

### What's Next

- Docker E2E verification of full reconciliation flow
- Parallel run infrastructure (Phase 4 hardening)
- Auditor-readable lineage reports
- Performance testing at 250K+ member scale

## Session 20: Migration Intelligence Integration (2026-03-22)

**Branch:** `claude/exciting-jang`

### What Was Done

Wired the Python migration-intelligence service (`POST /intelligence/analyze-mismatches`)
into the Go reconciler's post-reconciliation flow. After `ReconcileBatch` persists variance
results, it now calls the Python service asynchronously for pattern detection and persists
detected patterns to a new `migration.reconciliation_pattern` table.

**Go backend (6 commits):**
1. Migration 039: `reconciliation_pattern` table with batch FK, pattern fields, correction
   suggestion columns, resolved tracking, and batch index
2. `ReconciliationPattern` model type in `models/types.go`
3. `AnalyzeMismatches()` on intelligence client — new `Analyzer` interface, request/response
   types (`MismatchRecord`, `DetectedPattern`, `CorrectionSuggestion`), 3 httptest tests
4. Pattern persistence layer (`PersistPatterns`, `GetPatternsByEngagement`)
5. Async `analyzePatterns` goroutine in `ReconcileBatch` — nil-safe, 5s timeout, errors
   logged not propagated, tenant ID passed from request context
6. `GET /api/v1/migration/engagements/{id}/reconciliation/patterns` endpoint

**Frontend (2 commits):**
7. `ReconciliationPattern` type, `getReconciliationPatterns` API method,
   `useReconciliationPatterns` query hook
8. Systematic Patterns section in `ReconciliationPanel` — domain/plan/direction badges,
   member count, correction type with confidence, evidence text. Hidden when no patterns.
9. Integration test: 2 tests (patterns render, empty state hidden)

### Files Changed

**New files (6):**
- `platform/migration/db/migrations/039_reconciliation_patterns.sql`
- `platform/migration/db/pattern.go`
- `platform/migration/db/pattern_test.go`
- `platform/migration/intelligence/client_test.go`
- `platform/migration/api/pattern_handlers.go`
- `frontend/src/components/migration/engagement/__tests__/ReconciliationPatterns.test.tsx`

**Modified files (7):**
- `platform/migration/models/types.go`
- `platform/migration/intelligence/client.go`
- `platform/migration/api/handlers.go`
- `platform/migration/api/reconciliation_handlers.go`
- `frontend/src/types/Migration.ts`
- `frontend/src/lib/migrationApi.ts`
- `frontend/src/hooks/useMigrationApi.ts`
- `frontend/src/components/migration/engagement/ReconciliationPanel.tsx`

### Stats

- 9 commits, 6 new files, 8 modified files
- Migration Go: 11 packages, all pass (short mode)
- Intelligence client: 8 tests (5 existing + 3 new)
- Frontend: 232 test files, 1840 tests passing
- Typecheck: clean

### What's Next

- Docker E2E: verify full reconcile → intelligence → patterns flow with services running
- Corpus learning: wire analyst decisions back to intelligence service
- Resolution workflow: mark patterns resolved, track who resolved them
- Port management Phase 2 (deferred, low priority)

## Session 19: Frontend Polish + Reconciliation UI Enhancement (2026-03-22)

**Branch:** `claude/interesting-hamilton`

### What Was Done

**Phase 5g verification:** Confirmed all 3 reported bugs (dbcontext stale connection,
uploaded_by UUID, hireDate parsing) were already fixed in the current codebase. No code
changes needed.

**Frontend polish (2 of 3 items — 1 was already correct):**
1. **Title truncation on engagement cards** — Added `overflow: hidden`, `textOverflow:
   ellipsis`, `whiteSpace: nowrap` to EngagementList card titles. Previously titles
   could overflow the card boundary.
2. **Default tab for DISCOVERY phase** — Already correct (`defaultTab()` maps DISCOVERY
   → 'discovery' tab). No change needed.
3. **Phase stepper responsive overflow** — Added CSS media query for `max-width: 640px`
   that shrinks connector width (32px → 16px) and label font size (11px → 9px). Added
   className hooks for media query targeting.

**Reconciliation UI enhancement:**
- Added **tier score cards** showing per-tier gate scores (T1/T2/T3) with color-coded
  pass/warn/fail thresholds
- Added **full variance detail table** (collapsible) showing all reconciliation records
  with legacy vs. recomputed values side-by-side
- Added **filter bar** with category (ALL/MATCH/MINOR/MAJOR/ERROR), tier (All/T1/T2/T3),
  and member ID search
- Displays **systematic flag** indicator (gold dot) and **resolved** checkmark
- Shows **suspected domain** column for variance root cause hints
- Sticky header, scrollable body (max 480px), responsive filter wrapping

### Files Changed

- `frontend/src/components/migration/dashboard/EngagementList.tsx` — title truncation
- `frontend/src/components/migration/engagement/PhaseStepper.tsx` — responsive CSS
- `frontend/src/components/migration/engagement/ReconciliationPanel.tsx` — full enhancement

### Stats

- 3 files changed
- Frontend: typecheck clean, 231 test files, 1838 tests passing
- Migration Go: 11 packages passing (short mode)

### What's Next

- Migration intelligence integration (wire Python service into Go reconciler)
- Port management Phase 2 (standardize container ports)
- Additional reconciliation features: batch-level reconcile button, resolution workflow

## Session 18: Two-Source Proof — Perfect Gate Scores (2026-03-22)

**Branch:** `claude/loving-pike`

### What Was Done

Fixed 6 root causes to achieve perfect reconciliation gate scores (1.0) on both
PRISM (39/39) and PAS (26/26) sources. Two-Source Proof passes 30/30 checks.

**Root causes fixed:**
1. **PRISM seed SQL corruption** — `print()` stats leaked via stdout redirect into
   SQL file. PostgreSQL aborted on `\U` meta-command. Fixed: stats to stderr.
2. **Profiler NULL scan** — `SUM()` returns NULL on empty tables, crashing `int64`
   scan. Added `COALESCE(..., 0)` to all 4 dimension queries.
3. **Gate threshold script** — `bc` unavailable on Windows, silent fallback. Replaced
   with `awk` for cross-platform support.
4. **Python formula alignment** — Replaced linear penalty model with lookup-table
   reduction matching Go reconciler. Updated `PLAN_REGISTRY` to TIER_1/2/3.
5. **Age truncation** — PostgreSQL `::INTEGER` rounds, Python `int()` truncates.
   Fixed source_loader to use `FLOOR()::INTEGER`.
6. **Below-table age clamping** — Ages below reduction table minimum now clamp to
   lowest factor (0.70) in Go, Python, and both seed generators.

### Files Changed

- `platform/migration/profiler/dimensions.go` — COALESCE on 4 SUM queries
- `platform/migration/batch/source_loader.go` — FLOOR() for age truncation
- `platform/migration/reconciler/formula.go` — below-table age clamping
- `migration-simulation/formula/benefit.py` — lookup-table reduction + clamping
- `migration-simulation/tests/test_cross_language.py` — tier_code + reduction_factor
- `migration-simulation/sources/prism/prism_data_generator.py` — stderr + clamping
- `migration-simulation/sources/pas/generate_pas_scenarios.py` — clamping fix
- `migration-simulation/sources/prism/init/02_seed.sql` — regenerated clean
- `migration-simulation/sources/pas/init/02_seed.sql` — regenerated
- `scripts/run_two_source_proof.sh` — awk replaces bc
- `docs/plans/2026-03-22-post-proof-next-session.md` — NEW

### Stats

- 11 files changed (1 new, 10 modified)
- Migration Go: 11 packages, all pass (short mode)
- Python cross-language: 9/9 pass
- Two-Source Proof: 30/30 pass, PRISM 39/39, PAS 26/26, both gates=1.0

### What's Next

- Phase 5g: dbcontext stale connection fix + employer service bugs
- Migration frontend polish (3 minor items)
- Reconciliation UI enhancement (gate score display, P1 detail table)
- Starter prompt: `docs/plans/2026-03-22-post-proof-next-session.md`

## Session 17: Universal Plan Config + Reconciler Refactor (2026-03-22)

**Branch:** `claude/charming-chaum`

### What Was Done

Replaced the hardcoded 2-plan reconciler registry with YAML-loaded configuration
supporting all 3 tiers, and produced two Tier 1 governing architecture documents.

**Architecture research & design:**
- Researched 11+ pension systems (CalPERS, LACERA, SDCERA, OCERS, NYCERS, OPERS,
  TRS Texas, HMEPS, FRS, COPERA, 20 California 37 Act county funds)
- Identified 5 formula types, 7+ COLA structures, FAS periods 1-8 years
- Designed Universal Plan/Tier Entity Model (System > Plan > Tier with 7 modules)
- Designed Multi-Tenant Design Framework (25 config surfaces, 12 process domains)
- Revised 3 items in multi-tenant doc after codebase cross-reference:
  DB isolation (two-layer), intelligence service split, connector topology

**Implementation (13 tasks, 16 commits):**
- `planconfig.go`: YAML loader with `LoadPlanConfig()`, `LookupTier()`, `ToBenefitParams()`
- `formula.go`: Refactored from hardcoded `planRegistry` to YAML-loaded `BenefitParams`
  with lookup-table reduction (replacing formula-based 6%/yr penalty)
- 3 tiers: TIER_1 (2.0%), TIER_2 (1.5%), TIER_3 (1.5%) with tier-specific reduction tables
- Source loader: plan code normalization (PRISM DB_MAIN→TIER_1, PAS DB-T1→TIER_1)
- Migration 038: `source_plan_code` column for UI display of original codes
- Seed generators aligned with reconciler formula (multipliers, reduction tables, floor)
- Tier 3 benchmarks computed from canonical data (salary, contributions, member counts)
- Proof script: gate score threshold assertions (> 0.50)
- Docker: plan-config.yaml mount + migration 038 volume

### Key Decisions

- **Tier is the fundamental rule unit** — all parameters hang off tiers, not plans
- **Lookup-table reduction** replaces formula-based penalty (matches statutory tables)
- **plan-config.yaml** is single source of truth (reconciler section coexists with intelligence service)
- **Source plan codes preserved** in `source_plan_code` for client-facing display
- **DB-per-tenant + RLS** two-layer isolation model established
- **Intelligence service split** into per-tenant Rules Engine + shared Pattern Intelligence Service

### Files Changed

- 24 files changed (+3,394 lines, -230 lines)
- 2 new architecture docs, 2 new plan docs, 1 new Go file, 1 new test file, 1 new migration

### Stats

- 11 migration test packages, all pass
- Zero regressions
- Seed SQL NOT yet regenerated (next session)

### What's Next

1. Regenerate seed SQL (run Python generators)
2. Docker rebuild + Two-Source Proof
3. Debug gate scores if needed (rounding, age computation)
4. Starter prompt: `docs/plans/2026-03-22-plan-config-next-session.md`

## Session 16: Reconciliation Data Alignment — Pipeline Complete (2026-03-22)

**Branch:** `claude/interesting-wu`

### What Was Done

Fixed 6 root causes preventing reconciliation from producing meaningful results.
The Two-Source Proof now passes **28/28 checks** with real data flowing through
both PRISM and PAS pipelines end-to-end.

**Root causes fixed:**
1. **No persistence layer** — `ReconcileBatch` computed results in-memory but never
   stored them. `migration.reconciliation` table didn't exist. Created Migration 037
   and added transactional persistence in the handler.
2. **PAS payment_type mismatch** — PAS stores "PAID"/"HELD" as `payment_status_code`,
   but tier2 filters on `payment_type = 'REGULAR'`. Normalized in source_loader.
3. **PRISM payment_type mismatch** — PRISM `SCHED_TYP` is CHAR(4) "REGR" (space-padded),
   not "REGULAR". Added TRIM + CASE normalization.
4. **Missing PRISM payment history seed** — Generator never created PMT_SCHEDULE/PMT_HIST.
   Added 39 schedules + 554 payment records. Fixed NUMERIC(5,2) overflow on tax columns.
5. **Missing PAS seed data entirely** — `generate_pas_scenarios.py` had never been run.
   Generated 310K lines of seed SQL (100 members, 26 retirement awards, 248 payments).
6. **Tier 3 NULL crash** — `service_credit_years` nullable DOUBLE PRECISION scanned into
   float64. Added COALESCE + NOT NULL filter.

**Additional improvements:**
- Wired Tier 3 into ReconcileBatch (was TODO)
- Defensive `batch_id` filter on tier1/tier2 JOINs
- Source DB readiness retry loop (45K seed statements need time)
- Data count assertions in proof script
- Gate score extracted from POST response instead of broken summary endpoint
- Zero-count warnings in source_loader

### Files Changed

- `platform/migration/db/migrations/037_reconciliation_results.sql` — NEW
- `platform/migration/api/reconciliation_handlers.go` — Major rewrite (persistence + tier3)
- `platform/migration/api/reconciliation_handlers_test.go` — Updated for new behavior
- `platform/migration/batch/source_loader.go` — Payment type normalization + logging
- `platform/migration/reconciler/tier1.go` — batch_id JOIN filter
- `platform/migration/reconciler/tier2.go` — batch_id JOIN filters
- `platform/migration/reconciler/tier3.go` — NULL defense on service credit query
- `platform/migration/reconciler/tier3_test.go` — Updated mock patterns
- `migration-simulation/sources/prism/prism_data_generator.py` — PMT_HIST generation
- `migration-simulation/sources/pas/init/02_seed.sql` — NEW (generated)
- `scripts/run_two_source_proof.sh` — Gate extraction, retry loop, assertions
- `docker-compose.yml` — Mount for migration 037

### Stats

- 12 files changed (2 new, 10 modified)
- Migration unit tests: 12 packages, all pass
- Two-Source Proof: 28/28 checks pass
- Gate scores: 0 (expected — seed data formulas don't match reconciler formulas yet)

### What's Next

- Gate score tuning: align seed data benefit formulas with reconciler's RecomputeFromStoredInputs()
- Tier 3 benchmarks: configure plan-level expectations
- Starter prompt: `docs/plans/2026-03-22-reconciliation-alignment-complete-next-session.md`

## Session 15: Two-Source Proof — Debug Loop Complete (2026-03-22)

**Branch:** `claude/stoic-franklin`

### What Was Done

Took the Two-Source Proof from 11/19 passing (Session 14 infrastructure) to **23/23 passing**.
Both PRISM and PAS source databases run the complete migration pipeline end-to-end:
engagement → profiling → mapping → batch execution → reconciliation → gate scoring.

**Root causes fixed:**
1. **Schema drift** — Migration 036 reconciled lineage/exception DDL (designed as row-level,
   code evolved to column-level) and added 6 canonical/reference tables
2. **Missing canonical output** — Batch executor discarded TransformResult.CanonicalRow;
   now writes to canonical_members for reconciliation
3. **Source reference loading** — New source_loader.go bridges PRISM_BENEFIT_CALC / PAS
   retirement_award into migration.stored_calculations, and payment history for tier 2
4. **Unqualified table references** — 8 SQL queries in reconciler lacked `migration.` prefix
5. **NULL defense** — COALESCE in reconciler queries, NULLIF in inserts
6. **Missing seed data** — Generated PRISM (100 members, 44K SQL statements) and PAS
   (100 members, 185K records) seed data via Python generators
7. **Proof script bugs** — Batch status check (LOADED not COMPLETE), PAS column name fix

### Files Changed

- `platform/migration/db/migrations/036_canonical_tables.sql` — NEW (DDL for 8 tables)
- `platform/migration/batch/batch.go` — writeCanonicalMember, expanded clearPriorBatchData
- `platform/migration/batch/source_loader.go` — NEW (source reference data loading)
- `platform/migration/api/batch_handlers.go` — Trigger source data load post-execution
- `platform/migration/reconciler/tier1.go` — Schema-qualify, COALESCE
- `platform/migration/reconciler/tier2.go` — Schema-qualify, COALESCE
- `platform/migration/reconciler/tier3.go` — Schema-qualify
- `platform/migration/batch/batch_test.go` — Updated sqlmock for new tables
- `docker-compose.yml` — Volume mount for 036
- `scripts/run_two_source_proof.sh` — Status check + column name fixes

### Stats

- 10 files changed (2 new, 8 modified)
- Migration unit tests: 11 packages, all pass
- Two-Source Proof: 23/23 checks pass
- Gate scores: 0 (reconciliation data alignment is next step)

### What's Next

- Reconciliation data alignment (member_id format mismatch between canonical_members and stored_calculations)
- Gate score tuning for meaningful reconciliation results
- Tier 3 benchmarks
- Starter prompt: `docs/plans/2026-03-22-two-source-proof-complete-next-session.md`

## Session 14: AMS Competitive Analysis — Governance Documents (2026-03-22)

**Branch:** `claude/lucid-robinson`

### Context

Session 14 competitive analysis compared NoUI against five pension/enterprise platforms
(Sagitec Xelence, Vitech V3locity, TELUS Health Ariel, Mendix, OutSystems). Identified
13 capability gaps across six AMS domains. Engineering assessment against the actual
codebase found: 1 gap already fully built (employer portal), 4 gaps partially addressed,
3 genuine infrastructure gaps (deferred to Phase 4), 3 wrongly timed, and 2 process concerns.

### Decision: AFS Model NOT Adopted

The "Application Foundation Services" model (six standalone engines modeled after Sagitec)
was evaluated and rejected. NoUI's 18-service microservices architecture already distributes
these capabilities with better isolation, independent deployment, and testability. Adding
"engine" abstractions would reintroduce the coupling that caused the original repo split.

### Documents Produced

**`docs/RBAC_MATRIX.md` — Phase 1 Security Artifact**
- Documents current enforcement: JWT auth + 43 RLS policies + 2 RLS branches (staff/member)
- Defines 6 target roles: system_admin, pension_admin, noui_engineer, employer_hr, member, auditor
- Service access matrix: 21 services x 6 roles (R/W/A/—)
- Category A/B/C change authorization definitions
- Data sensitivity tiers + restricted field access rules
- Enforcement roadmap: Phase 1 (current) → Phase 2 (role-based filtering) → Phase 3 (ABAC)
- Honest about gap: architecture docs describe 5 roles but RLS only branches on staff/member

**`docs/RELEASE_GOVERNANCE.md` — Platform Release Process**
- Three release types: quarterly major, monthly patch, emergency
- Version scheme: YYYY.Q.patch (e.g., 2026.2.0)
- Promotion pipeline: dev → staging → production with gate requirements
- Per-plane update procedures (Plane 1: AI, Plane 2: Tenant, Plane 3: Connector)
- Rollback procedures with time windows
- Client notification templates and timelines
- SOC 2 evidence collection per deployment
- Colorado compliance requirements (breach notification, privacy act)

**`docs/SESSION14_AMS_FINDINGS.md` — Competitive Analysis Reference**
- Gap register with honest NoUI status for each of 13 items
- 6 competitive advantages documented (calculation transparency, AI boundary enforcement,
  migration tooling, degradation model, audit architecture, multi-tenant isolation)
- Deferred items with trigger conditions (not target dates)
- Competitive intelligence: Sagitec clients, Vitech TCO claims, TELUS parameter model
- Positioned as sales/strategy reference, explicitly NOT an engineering backlog

### Stats
- 3 documents, 0 code changes
- No tests affected (docs only)

### What's Next
- Continue migration engine development (Phase 3)
- Two-Source Proof or Port Management Phase 2

## Port Management Phase 1 + Migration Plan Status (2026-03-22)

**Branch:** `claude/bold-grothendieck`

### What Was Done

**Port Management Phase 1:**
- Removed host port mappings from 19 Docker services in docker-compose.yml
- Only frontend (3000), postgres (5432), pgbouncer (6432) retain host mappings
- All service access goes through nginx proxy at localhost:3000
- Created `infrastructure/ports.env` — single-source port registry for all 21 services
- Updated health smoke test to route through nginx (not direct healthagg port)
- Updated CLAUDE.md service table: replaced port column with API path column
- Added clarifying comment to vite.config.ts (dev proxy is local-only)

**Migration Engine Plan Status:**
- Added completion status section to migration engine plan
- All 26 tasks confirmed code-complete (Tasks 1–24 done, 25 done, 18+26 need integration run)
- Remaining work: two-source proof (run pipeline against PRISM + PAS databases)

**Bug Fixes (pre-existing, surfaced during E2E):**
- Missing docker-compose volume mounts for migrations 033-035 (gate_transition,
  notification, platform_type) — added in #135 but mounts were missed
- `HTTP_BODY` → `BODY` variable typo in migration E2E Phase 10 coverage report test

### Stats
- 7 files changed
- Docker E2E: 169/169 across 5 suites (up from 166 — 3 new migration Phase 10 tests)
  - Workflows: 20/20
  - Services Hub: 50/50
  - Correspondence: 24/24
  - Migration: 26/26 (up from 23)
  - Employer: 49/49
- Host port `localhost:8081` confirmed unreachable (port removal verified)
- No pgbouncer timeout cascades on startup (clean single-pass boot)

### What's Next
- Two-Source Proof: run migration pipeline against PRISM + PAS databases end-to-end
- Or: Port Management Phase 2 (standardize container ports to :8080)
- Starter prompt: `docs/plans/2026-03-22-next-session-starter.md`

## Migration Phase 5g: dbcontext Connection Recovery + Employer Fixes (2026-03-22)

**Branch:** `claude/intelligent-mclaren`

### What Was Done

**dbcontext Stale Connection Recovery (Systemic — All 17 Services):**
- Added `defer tx.Rollback()` after `BeginTx` in `DBMiddleware` to prevent connection
  pool poisoning when handler queries fail (e.g., duplicate key INSERT)
- Without this fix, failed transactions stayed open and the next request on the pooled
  connection got `pq: could not complete operation in a failed transaction`
- Removed redundant explicit `tx.Rollback()` on set_config failure (defer handles it)

**Employer Reporting: uploaded_by UUID Fix:**
- Replaced hardcoded `UploadedBy: ""` with `auth.UserID(r.Context())` via `userIDOrDefault()`
- Added `isUUID()` validation — dev JWT `sub` claim ("dev-admin-001") is not a valid UUID,
  so non-UUID values fall back to default system UUID
- Same fix applied to `resolved_by` in `ResolveException` handler

**Employer Terminations: hireDate Timestamp Parsing:**
- Added `parseFlexDate()` helper that accepts both date-only ("2006-01-02") and RFC3339
  ("2006-01-02T00:00:00Z") formats
- PostgreSQL `timestamptz` columns return full timestamps, but the refund calculator
  only accepted date-only format

**Employer E2E Script Fixes:**
- Removed 3 skip tolerances (alerts stale conn, manual-entry UUID, refund date parse)
- JWT regeneration: after portal user creation, regenerate JWT with real user UUID as
  `sub` claim so FK constraints on `uploaded_by` are satisfied
- Fixed jq path: `.data[0].id` (not `.data.items[0].id`) matching actual API response
- Fixed division code: "STATE" (not "SD") matching seeded `employer_division` table

**Port Management Plan:**
- Created `docs/plans/2026-03-22-port-management-phase1.md` — plan for removing host
  port mappings, creating single port registry, and fixing CRM port anomaly

### Tests Added
- `TestDBMiddleware_RollbackOnHandlerError` — single-connection pool, duplicate key trigger,
  verifies next request succeeds (DB-dependent, skipped with -short)
- `TestCalculateRefund_RFC3339Dates` — full calculation with timestamp inputs
- `TestParseFlexDate` — 4 format variations (date-only, RFC3339, with timezone offset)

### Stats
- 7 files changed (+182 lines)
- All 3 modified Go packages: tests passing (short mode)
- Docker E2E: 166/166 across 5 suites (up from 163 — 3 previously-skipped tests now real passes)
  - Workflows: 20/20
  - Services Hub: 50/50
  - Correspondence: 24/24
  - Migration: 23/23
  - Employer: 49/49 (up from 46)

### Known Issues (Resolved This Session)
- pgbouncer `query_wait_timeout` on Docker startup — too many services binding host ports
  simultaneously. All services recovered on second start. Root cause addressed in port
  management plan (remove host port mappings for internal services).

### What's Next
- Port Management Phase 1: Remove host port mappings, create port registry, fix CRM anomaly
  (see `docs/plans/2026-03-22-port-management-phase1.md`)
- Starter prompt: `docs/plans/2026-03-22-port-management-phase1-starter.md`

## Migration Phase 5f: Employer Portal E2E + nginx Proxy + Engagement Test Fix (2026-03-22)

**Branch:** `claude/nostalgic-shaw`

### What Was Done

**nginx Proxy Routes — 6 Employer Services:**
- Added location blocks for `/api/v1/employer` (8094), `/api/v1/reporting` (8095),
  `/api/v1/enrollment` (8096), `/api/v1/terminations` (8097), `/api/v1/waret` (8098),
  `/api/v1/scp` (8099) with X-Tenant-ID forwarding

**Employer E2E Script (`tests/e2e/employer_e2e.sh`) — 46 tests:**
- Phase 1: Portal — dashboard, divisions, users, alerts, rate tables (7 tests)
- Phase 2: Reporting — files, manual-entry, exceptions, payments, interest (5 tests)
- Phase 3: Enrollment — submission lifecycle (create→submit→approve), duplicates, PERAChoice (7 tests)
- Phase 4: Terminations — certifications (create→verify), holds, refunds, eligibility, calculate (9 tests)
- Phase 5: WARET — designations (create→approve), tracking, summary, PERACare check, penalties, disclosures (10 tests)
- Phase 6: SCP — cost factors, quotes, requests, eligibility, lookup (8 tests)

**Payload Tuning (8 fixes):**
- UUID org_id from seed data (not string `org-001`)
- Portal role: `SUPER_USER` not `ADMIN`; division codes: `SD` not `DIV-A`
- Enrollment: `planCode: DB`, `divisionCode: SD`
- WARET: `designationType: STANDARD` (not `WARET_ELIGIBLE`)
- SCP: `serviceType: REFUNDED_PRIOR_PERA` (not `PURCHASE`)
- POST-before-GET ordering to avoid stale DB connection cascades

**Engagement Test Fix:**
- `engagement_test.go`: Mock returns `DISCOVERY` (not `PROFILING`) matching actual DB default

**Known Issues (skipped in E2E, not blocking):**
- `POST /reporting/manual-entry`: `uploaded_by` UUID empty — auth context lacks `user_id` claim
- `POST /terminations/refunds/:id/calculate`: `hireDate` stored as timestamp, calculator expects date-only

### Stats
- 3 files changed, +717 lines
- Migration Go: all 11 packages passing (short mode)
- Frontend: typecheck clean
- Docker E2E: 163/163 across 5 suites (20+50+24+23+46)

### What's Next
- Fix `dbcontext` stale connection recovery (root cause of POST-before-GET ordering workaround)
- Fix `uploaded_by` UUID extraction from JWT auth context in employer-reporting
- Fix refund calculator date parsing (`hireDate` timestamp vs date-only)
- PR review and merge

## Migration Phase 5e: Docker E2E Verification + Schema Drift Fix (2026-03-22)

**Branch:** `claude/busy-ardinghelli`

### What Was Done

**Full Docker E2E Verification — 117/117:**
- Workflows: 20/20 (audit trail fix from Phase 5d confirmed)
- Services Hub: 50/50
- Correspondence: 24/24 (transient DB connection error on first run, clean on retry)
- Migration: 23/23 (after payload tuning + schema drift fix)

**Migration E2E Payload Tuning (6 fixes):**
- Engagement: `source_system_name` (only required field)
- Status transition: `DISCOVERY → PROFILING` (initial status is DISCOVERY)
- Source config: `driver`/`user`/`dbname` with correct credentials (`noui`/`noui`)
- Profile: real table names (`member_master`, `salary_hist`)
- Generate mappings: valid concept tag `employee-master` with realistic column set
- Batch: `batch_scope` field; Risk: `severity: "P2"` + `description`

**Schema Drift Bug Fix:**
- `reconciliation_detail.go`: `GetReconciliationByTier` query used planned column names
  (`reconciliation_id`, `field_name`, `source_value`, `target_value`) but actual DDL uses
  `recon_id`, `calc_name`, `legacy_value`, `recomputed_value`
- `attention.go`: Same stale column names in P1 reconciliation UNION query
- Both queries now match the actual `migration.reconciliation` table DDL

### Stats
- 4 files changed (3 code + 1 starter prompt)
- Migration Go: all 11 packages passing (short mode)
- Frontend: typecheck clean
- Docker E2E: 117/117 across 4 suites

### What's Next
- Employer Portal E2E script (`tests/e2e/employer_e2e.sh`)
- Engagement test fixture fix (`db/engagement_test.go` asserts PROFILING but real default is DISCOVERY)
- Starter prompt: `docs/plans/2026-03-22-migration-phase5f-starter.md`

## Migration Phase 5d: CRM Audit Trail + Migration E2E Script (2026-03-22)

**Branch:** `claude/magical-goldstine` — PR #130 (merged)

### What Was Built

**CRM Audit Trail — Interaction Creation:**
- Wired `CreateInteraction` → `WriteAuditLog` in `platform/crm/api/handlers.go`
- Fire-and-forget goroutine with `context.Background()` (audit failure doesn't block HTTP response)
- SHA-256 chain hash: `ComputeAuditHash` produces hex digest, `GetLastAuditHash` links chain
- Each audit entry stores `prev_audit_hash` + `record_hash` for tamper-evident trail
- Fixes last E2E failure: Workflow B test 20/20 (audit trail empty after interaction)

**Migration E2E Script (`tests/e2e/migration_e2e.sh`):**
- 9-phase lifecycle test: dashboard → engagement CRUD → source config → profiling → mappings → batches → reconciliation → risks → events
- Flexible status code assertions for async operations (200/201/202)
- Multi-path engagement ID extraction for response envelope variations
- Timestamp-based names for idempotent re-runs

**E2E Library Enhancement:**
- Added `do_patch` to `tests/e2e/lib/http.sh` (migration API uses PATCH for updates)

### Stats
- 6 files changed, +477 lines
- CRM Go: all packages passing (short mode)
- 2 new audit hash unit tests (determinism + uniqueness)
- Frontend: typecheck clean

### What's Next
- Run full Docker E2E: expect workflows 20/20, migration_e2e.sh first run
- Tune migration E2E payload shapes based on actual service responses
- Optional: employer portal E2E, apiClient.ts `raw` extension for employer services

## Migration Phase 5c: Docker Infra + E2E Fixes + Enum Tech Debt (2026-03-22)

**Branch:** `claude/pedantic-carson`

### What Was Built

**Docker nginx — Migration Proxy:**
- Added `/api/v1/migration` proxy route → migration:8100
- Added `/ws/migration` WebSocket proxy with upgrade headers
- Migration API now works through Docker-served frontend (was 502 before)

**E2E Test Fixes (workflows_e2e.sh):**
- Workflow A (cases): Added missing `caseId` field, fixed `memberId` from string to int, added required `retirementDate`
- Workflow A (notes): Fixed field name `authorId` → `author` to match Go struct
- Workflow C (issues): Fixed `category: "bug"` → `"defect"` (valid enum value)
- Workflow C (comments): Fixed field name `authorId` → `author` to match Go struct
- Added timestamp-based caseId for idempotent re-runs

**apiClient.ts Enum Tech Debt — `raw` Option:**
- Added `raw` option to `FetchOptions` — skips global enum case normalization
- Threaded through `fetchAPI`, `postAPI`, `putAPI`, `patchAPI`, `deleteAPI`, `fetchPaginatedAPI`
- Migration API module passes `{ raw: true }` on all 36 API functions
- Removed `normalizeEngagement` workaround from useMigrationApi.ts
- CRM/case/DQ services continue using global normalization unchanged

### E2E Results
- **Workflows:** 19/20 passing (was 9/13) — 1 pre-existing audit trail gap
- **Services Hub:** 50/50 passing (was 48/50)
- **Correspondence:** 24/24 passing
- **Migration proxy:** Verified through Docker nginx

### Known Issues
- Workflow B audit trail: `CreateInteraction` doesn't write to `crm_audit_log` — design gap, not a regression
- Overall health status shows "unhealthy" — connector service not in healthagg service list (cosmetic)

### What's Next
- CRM audit trail: Wire interaction creation → audit log write (if desired)
- Full Docker E2E: engagement → profile → map → transform → reconcile flow (needs seed data)
- apiClient.ts: Consider adding `raw` to employer portal services if they use UPPERCASE enums

## Migration Phase 5b: Panel Polish + CRM E2E Fix (2026-03-22)

**Branch:** `claude/brave-cray`

### What Was Built

**Mappings Panel Polish:**
- `useMappingCorpusContext` lazy-load hook for per-row corpus context
- `LazyCorpusIndicator` wrapper component — fetches corpus data on demand per mapping
- "Generate Mappings" button (empty state) and "Re-generate Mappings" button (header bar)
- Wired to existing `useGenerateMappings` mutation hook

**Reconciliation Panel Polish:**
- Replaced inline tier score cards with `TierFunnel` chart component
- Wired to real `useReconciliationByTier` hook data
- Derives `{total, match}` from `Reconciliation[]` arrays (match = category === 'MATCH')

**CRM Enum Casing Fix (E2E blocker):**
- Root cause: Go handler validation used lowercase enums but DB CHECK constraints use UPPERCASE
- Fixed `handlers.go`, `employer_handlers.go` enum validation lists → UPPERCASE
- Fixed `models/types.go` all constants (InteractionChannel, InteractionType, Direction, Visibility, Outcome) → UPPERCASE
- Updated `employer_handlers_test.go` test fixtures to match
- `apiClient.ts` ENUM_FIELDS bridge already handles frontend lowercase ↔ backend UPPERCASE

### Stats
- 7 files changed, +155/-107 lines
- Frontend: 231 test files, 1,838 tests passing
- CRM Go: all packages passing
- E2E: correspondence 24/24 passing (Test 3 CRM bridge was the blocker — now fixed)

### Known Issues
- Docker `nginx.conf` missing `/api/v1/migration` proxy route (migration only works via Vite dev server)
- Workflows E2E: 3/6 passing (case/issue creation 400 — likely same casing pattern)
- Services Hub E2E: 48/50 passing (issues service query bug)

### What's Next
- Add migration proxy to nginx.conf for Docker E2E
- Fix remaining E2E casing issues (cases, issues services)
- apiClient.ts enum normalization tech debt decision
- Full Docker E2E: engagement → profile → map → transform → reconcile flow
- Starter prompt: `docs/plans/2026-03-22-migration-phase5c-starter.md`

## Migration Phase 5: Panel Wiring — Real API Data (2026-03-22)

**PR:** #127
**Branch:** `claude/optimistic-lalande`

### What Was Built

**Quality Profile Panel — Wired to Real Data:**
- GET `/engagements/{id}/profiles` endpoint + `ListProfiles` DB query
- PATCH `/engagements/{id}/approve-baseline` endpoint
- `useProfiles` + `useApproveBaseline` React Query hooks
- Panel now fetches real ISO 8000 profiles, displays radar chart + per-table scores
- "Approve Quality Baseline" button with approved indicator

**Transformation Panel — Full Batch Management:**
- 4 new Go endpoints: list/create/get batches, list exceptions
- `MigrationBatch`, `MigrationException`, `CreateBatchRequest` Go types
- `useBatches`, `useBatch`, `useCreateBatch`, `useExceptions` hooks
- Panel rewritten: batch list table with status badges, "+ Create Batch" dialog
- Phase gate: only shows batch management when engagement reaches TRANSFORMING

**BatchDetail Component — Replaces Placeholder:**
- Full batch detail view with header stats (source rows, loaded, exceptions, error rate)
- Exception clusters section with "Apply Fix" button (uses existing `useApplyCluster`)
- Exception table (first 100 rows) with disposition color coding
- Retransform / Reconcile Batch action buttons
- Back navigation to engagement detail

### Stats
- 8 commits, 17 files, +3,245 lines
- Backend: 6 new endpoints, 2 new DB query files, 3 new model types
- Frontend: 6 new API functions, 6 new hooks, 2 new components, 3 rewrites
- Go: 11 migration packages passing
- Frontend: 231 test files, 1,838 tests passing

### Known Issues
- E2E Integration Tests fail on CI — pre-existing failure in Correspondence→CRM bridge test (also fails on main)
- apiClient.ts ENUM_FIELDS global lowercase affects all status fields; migration hooks use `select: normalizeEngagement` workaround

### What's Next
- Phase 5b polish: CorpusIndicator on Mappings, TierFunnel on Reconciliation
- Fix pre-existing E2E failure (correspondence_e2e.sh Test 3)
- Docker E2E: rebuild stack, run full profile→transform→reconcile flow
- Starter prompt: `docs/plans/2026-03-22-migration-phase5b-polish-starter.md`

## Migration Engine Phases 2-4: Full Backend + Frontend v2.0 (2026-03-22)

**PR:** #126 (merged)
**Branch:** `claude/stupefied-jones`

### What Was Built

**Migration Engine Phase 2 — Transformation Pipeline:**
- 12 transformation handlers, canonical loader with lineage tracking
- Idempotent batch processor with thresholds, code table discovery
- Re-transformation via lineage for mapping corrections

**Migration Engine Phase 3 — Reconciliation + Feedback:**
- Three-tier reconciliation (benefit formula, payment history, aggregate validation)
- Weighted gate scoring with P1/P2/P3 priority
- Mismatch pattern detection with correction suggestions
- Corpus abstraction with k-anonymity

**Migration Frontend Phase 4 (v2.0):**
- 7-phase stepper with DISCOVERY phase, gate tooltips, attention badges
- Phase gate dialog with AI readiness stubs, override controls, audit trail
- Discovery panel: inline source connection, table discovery (85 tables), selection
- Attention queue: cross-cutting P1/P2/P3 unified view with filters
- Parallel run panel: Go/No-Go certification checklist
- Comparative view: stage-gated side-by-side engagement comparison
- Notification bell, dashboard enhancements (attention count, health bar colors)
- AI components: AIRecommendationCard, CorpusIndicator, RootCauseAnalysis
- 14 new backend endpoints (gates, attention, AI stubs, notifications)

**Polish Fixes:**
- Title truncation (minWidth 120px), default DISCOVERY tab, stepper overflow
- Pre-commit hook: added missing shebang, converted CRLF to LF
- Enum case mismatch: apiClient lowercases `status` fields; added `select: normalizeEngagement` in migration hooks

### Stats
- 47 commits, 36+ files, ~6,000+ lines added
- Backend: 30+ total API endpoints, 4 DB migrations (031-034)
- Frontend: 20+ components, 1,838 tests passing, 12 Go packages passing

### What's Next
- Wire real API data into panel UIs (Quality Profile, Mappings, Transformation, Reconciliation)
- Starter prompt: `docs/plans/2026-03-22-migration-phase5-panel-wiring-starter.md`

## Migration Management Frontend + Source DB Connection (2026-03-21)

**Branch:** `claude/laughing-nash`

### What Was Built
- **Migration Management UI** — Full frontend with dashboard, engagement detail, batch detail views
  - Dashboard: 4 summary cards (live API), engagement list, risk panel, system health bar
  - Engagement Detail: 6-phase stepper, 5 tab panels, activity log sidebar
  - 3 Recharts visualizations: RadarChart (ISO 8000), GateScoreGauge, TierFunnel
  - 4 dialogs: Create Engagement, Add Risk, Configure Source, Run Quality Profile
- **Backend: 16 new API endpoints** — Dashboard summary, system health, risk CRUD, exception clusters, reconciliation detail, compare, events, source connection, table discovery
- **WebSocket hub** — Per-engagement channels with gorilla/websocket, polling fallback in frontend
- **Source DB connection** — SQL Server + PostgreSQL drivers, test connection, table discovery via INFORMATION_SCHEMA
- **Integration wiring** — ViewMode, App.tsx lazy route, Vite proxy (REST + WS)

### New Dependencies
- `github.com/microsoft/go-mssqldb v1.7.2` — SQL Server source DB support
- `github.com/gorilla/websocket v1.5.3` — WebSocket hub
- Dockerfile Go version: 1.22 → 1.25

### DB Migrations
- `031_migration_risk_event.sql` — risk, event, exception_cluster tables
- `032_source_connection.sql` — source_connection JSONB on engagement

### Key Decisions
- SQL Server listed first in driver selector (most common PAS database)
- Oracle deferred — requires CGO + Oracle Instant Client
- `binary_parameters=yes` in postgres DSN for pgbouncer compatibility
- JSONB writes use `$2::text::jsonb` cast to avoid pgbouncer binary encoding issue

### Tests
- Go: 12 packages, all passing
- Frontend: 231 test files, 1838 tests passing

### What's Next
- Complete Quality Profile flow (table selection → profile → radar chart)
- Full Mapping Panel (agreement status, approve/reject, code tables)
- Exception triage UI (P1 individual, P2/P3 clusters)
- Reconciliation panel (gate score gauge, tier funnel)
- Design polish (header truncation, stepper scroll position)

## Employer Ops Agent Desktop (2026-03-19)

**Branch:** `claude/strange-cori`
**Goal:** Staff-facing two-panel operational desktop aggregating all 13 Phase 8 cross-service employer endpoints into an alert-first workspace.

**What was built:**

### Design & Planning
- `docs/plans/2026-03-19-employer-ops-desktop-design.md` — Full design document
- `docs/plans/2026-03-19-employer-ops-desktop-plan.md` — 12-task implementation plan

### Types & Config (`frontend/src/types/EmployerOps.ts`, `lib/employerOpsConfig.ts`)
- TypeScript types for all 13 Phase 8 response shapes + frontend alert types
- Build-time configurable thresholds via `import.meta.env.VITE_*` (DQ score critical/warning, SLA overdue, case volume)
- Shared `dqScoreColor()` helper

### API Layer (`frontend/src/lib/employerOpsApi.ts`)
- 13 fetch functions for all Phase 8 endpoints using shared `apiClient.ts` helpers
- Custom Vite proxy plugin (`vite.config.ts`) routing `/api/v1/employer/{orgId}/members*` → 8081 and `/api/v1/employer/{orgId}/cases*` → 8088 before the catch-all → 8094

### React Query Hooks (`frontend/src/hooks/useEmployerOps.ts`)
- 10 query hooks, 3 mutation hooks (create case, log interaction, generate letter)
- `useEmployerAlerts` — `useQueries` fan-out across all orgs with 60s refetch for alert aggregation

### Navigation Integration
- `ViewMode` type extended with `'employer-ops'` (admin + staff roles)
- `App.tsx` — lazy-loaded route with TopNav + ErrorBoundary + Suspense
- `StaffPortal.tsx` — sidebar link for cross-view navigation

### Main Container (`EmployerOpsDesktop.tsx`)
- Two-panel layout: 280px left (alert queue + org list) + flex-1 right (OrgBanner + tabs)
- Key-based component remounting (`key={selectedOrgId}`) to reset pagination/filter state on org switch

### 5 Detail Tabs
- **Health** — DQ score gauge, issues table with "Create Case" per row, check results with color-coded pass rates
- **Cases** — Summary cards (total/active/completed/at-risk), case table, "New Case" button
- **CRM** — Interaction timeline with category filter, contacts table, "Log Interaction" button
- **Correspondence** — Template card grid with "Generate" button per card
- **Members** — Tier/status summary cards, paginated roster (25 per page)

### 3 Action Dialogs
- `CreateCaseDialog` — trigger type, reference ID, member ID, priority, assigned to
- `LogInteractionDialog` — category, channel, direction, summary, outcome
- `GenerateLetterDialog` — auto-populated org fields, editable merge fields, contact ID

### Bug Fixes
- Null guard on `dqScore.categoryScores` (backend returns null when no DQ data)
- Extracted duplicate `dqScoreColor()` to shared config
- Key-based remount prevents stale pagination/filter state across org switches

**Test results:** 1,709 frontend tests (212 files) passing, typecheck clean. No unit tests for Employer Ops hooks/components yet (Task 12 deferred).

---

## Rules Explorer Card Drill-Down Redesign (2026-03-20)

**Branch:** `claude/mystifying-jones`
**Goal:** Replace flat-list Rules Explorer with a visually appealing three-level card drill-down.

**What was built:**

### Level 1 — Domain Cards
- 9 semantic domain categories (Eligibility, Benefits, Salary & AMS, Service Credit, Payment Options, DRO, Tiers & Contributions, Death Benefits, Process & Compliance)
- `DomainCard.tsx` — Card with domain name, description, rule count, SVG progress ring
- `DomainCardGrid.tsx` — Responsive 3-column grid (1 col mobile, 2 tablet, 3 desktop)
- `ProgressRing.tsx` — 36px SVG circular indicator showing % rules passing
- `domainMapping.ts` — Static mapping of 52 rule IDs → 9 domain categories

### Level 2 — Rule Cards
- `RuleCard.tsx` — Redesigned from flat row to card with full name (no truncation), full description, rule ID, test badge, colored left border (green/red/gray)
- `RuleCardGrid.tsx` — Responsive 3-column grid of rule cards
- Search filters rules by name, ID, or description within the domain

### Level 3 — Rule Detail
- Existing `RuleDetail.tsx` (4-tab: Logic, I/O, Tests, Governance) — unchanged
- `Breadcrumb.tsx` — Clickable navigation: Rules Explorer > Domain > Rule ID
- `RulesSummaryBar.tsx` — Added `label` prop for domain-scoped display ("4/10 passing in Eligibility")

### Navigation & State
- `RulesExplorer.tsx` — Three-level state machine (domain → rule → detail)
- Breadcrumb navigation at every level with clickable segments
- Contextual search at each level (domains at L1, rules at L2)
- Removed `DomainFilter.tsx` and `RulesList.tsx` (replaced by card grids)

**Tests:** 1789/1789 passing (54 rules-related tests across 10 test files)

**Design doc:** `docs/plans/2026-03-20-rules-explorer-redesign-design.md`

---

## Employer Domain Phase 8: Cross-Service Enhancement (2026-03-19)

**Branch:** `claude/brave-mendel`
**Goal:** Make 5 existing platform services employer-aware with new endpoints and queries.

**What was built:**

### 8.1 — Data Access (`platform/dataaccess/`)
- `api/employer_handlers.go` — 2 handlers: `EmployerMemberRoster` (paginated), `EmployerMemberSummary` (tier/status breakdown)
- Member↔employer bridge via CRM JOINs: `crm_org_contact` → `crm_contact(legacy_mbr_id)` → `MEMBER_MASTER(member_id)`
- `api/employer_handlers_test.go` — 5 tests

### 8.2 — CRM (`platform/crm/`)
- `db/employer_queries.go` — `ListOrgInteractions`, `ListOrgContacts`
- `api/employer_handlers.go` — 3 handlers + 6 employer interaction category constants
- `api/employer_handlers_test.go` — 7 tests

### 8.3 — Correspondence (`platform/correspondence/`)
- `db/postgres.go` — `GetOrgMergeFields`, `RenderTemplatePublic` methods
- `api/employer_handlers.go` — `ListEmployerTemplates`, `GenerateEmployer` (auto-populates org merge fields)
- `models/types.go` — `EmployerGenerateRequest`, `EmployerMergeFields` (7 fields)
- `api/employer_handlers_test.go` — 5 tests

### 8.4 — Data Quality (`platform/dataquality/`)
- `db/employer_queries.go` — `GetEmployerScore`, `ListEmployerIssues`, `ListEmployerChecks` (all filtered to 6 employer target tables)
- `api/employer_handlers.go` — 3 handlers with UUID validation
- `models/types.go` — `EmployerDQSummary`, 4 check category constants, `EmployerTargetTables`
- `api/employer_handlers_test.go` — 11 tests

### 8.5 — Case Management (`platform/casemanagement/`)
- `domain/triggers.go` — 5 trigger type → case config mappings (enrollment, termination, contribution exception, WARET, SCP)
- `db/employer_queries.go` — `ListCasesByEmployer`, `GetEmployerCaseSummary`, `GetCaseByTriggerRef` (idempotency)
- `api/employer_handlers.go` — 3 handlers: `ListEmployerCases`, `GetEmployerCaseSummary`, `CreateEmployerCase`
- `models/types.go` — `EmployerTriggerTypes`, `CreateEmployerCaseRequest`, `EmployerCaseSummary`, `TriggerConfig`
- Routes under `/api/v1/employer/{orgId}/cases` prefix (avoids Go 1.22 ServeMux wildcard conflict with `/cases/{id}`)
- `api/employer_handlers_test.go` — 17 tests

**New endpoints (13 total):**
- `GET /api/v1/employer/{orgId}/members` — member roster
- `GET /api/v1/employer/{orgId}/members/summary` — member summary
- `GET /api/v1/crm/organizations/{id}/interactions` — org interactions
- `GET /api/v1/crm/organizations/{id}/contacts` — org contacts
- `POST /api/v1/crm/interactions/employer` — create employer interaction
- `GET /api/v1/correspondence/templates/employer` — employer templates
- `POST /api/v1/correspondence/generate/employer` — generate employer letter
- `GET /api/v1/dq/employer/{orgId}/score` — employer DQ score
- `GET /api/v1/dq/employer/{orgId}/issues` — employer DQ issues
- `GET /api/v1/dq/employer/{orgId}/checks` — employer DQ checks
- `GET /api/v1/employer/{orgId}/cases` — employer cases
- `GET /api/v1/employer/{orgId}/cases/summary` — employer case summary
- `POST /api/v1/employer/cases` — create case from employer trigger

**Test results:** All 5 services build clean, all tests pass (0 regressions). 45 new employer tests across 5 services.

---

## Employer Domain Phase 7: Integration (2026-03-19)

**Branch:** `claude/hopeful-diffie` → merged as PR #110
**Goal:** Wire all 6 employer backend services into Docker, CI, and frontend routing.

**What was built:**

### docker-compose.yml
- 6 new services: employer-portal (8094), employer-reporting (8095), employer-enrollment (8096), employer-terminations (8097), employer-waret (8098), employer-scp (8099)
- 6 employer schema mounts in postgres init sequence (029–034)
- healthagg HEALTH_SERVICES updated with all 6 employer endpoints
- frontend depends_on updated with all 6 employer services
- Total services: 21 (up from 15)

### CI pipeline (.github/workflows/ci.yml)
- 7 employer modules added to platform-services matrix: employer-shared, employer-portal, employer-reporting, employer-enrollment, employer-terminations, employer-waret, employer-scp
- Total CI matrix entries: 18 (up from 11)

### Frontend (App.tsx)
- Swapped `EmployerPortal` → `EmployerPortalApp` from `@/components/employer-portal/EmployerPortalApp`
- New component is self-contained tabbed portal with all 6 domain tabs
- Vite proxy routes for 8094–8099 were already configured in prior phases

**What was NOT needed:**
- Nginx routing — no nginx.conf exists; Vite proxy handles dev routing
- Seed data — employer domain uses API-driven data, not init.d seeds

**Test totals:** 1,709 frontend tests (212 files), 234 Go tests across 7 employer modules. All passing, zero regressions.

---

## Rules & Test Explorer (2026-03-19)

**Branch:** `claude/sweet-lalande`
**Goal:** Configuration support tool for viewing business rules, test execution status, and demo case walkthroughs with full traceability.

**What was built:**

### Backend — KB Service Extension (6 new endpoints)
- `platform/knowledgebase/rules/` package — YAML rule loader, `go test -json` report parser, demo case JSON loader
- `GET /api/v1/kb/rules/definitions` — full rule definitions parsed from YAML (9 domain files, ~50 rules)
- `GET /api/v1/kb/rules/definitions/{ruleId}` — single rule with test status enrichment
- `GET /api/v1/kb/test-report` — CI test report summary with per-rule aggregation
- `GET /api/v1/kb/test-report/{ruleId}` — tests linked to a specific rule
- `GET /api/v1/kb/demo-cases` / `GET /api/v1/kb/demo-cases/{caseId}` — demo case fixtures
- In-memory cache with configurable TTL (default 5 min), thread-safe with RWMutex
- Added `gopkg.in/yaml.v3` dependency to KB service

### Frontend — 2 new views, 21 new components
- **Rules Explorer** (`/rules-explorer` view mode) — browse rules by domain, search, see inline test pass/fail
  - 4 structured logic renderers: Conditional (IF/THEN blocks), Formula (code blocks), Lookup Table (data grids), Procedural (numbered steps)
  - Rule detail with 4 tabs: Logic, Inputs/Outputs, Tests, Governance
  - Test status badges on every rule from CI report
- **Demo Cases** (`/demo-cases` view mode) — 4 member scenario walkthroughs
  - Calculation Trace: step-by-step rule execution with clickable rule links
  - Member Profile with service credit breakdown and purchased service warnings
  - Test Points checklist
- Cross-linking between Rules Explorer and Demo Cases (bidirectional navigation)
- Sidebar navigation: new "Configuration / Reference" section

### Infrastructure
- `scripts/generate-test-report.sh` — generates `go test -json` output for intelligence service
- `test-results/test-rule-mapping.json` — 27 test→rule mappings
- Docker Compose volume mounts for rules, demo cases, and test results

### Test Coverage
- Backend: 26 Go tests (types, loader, testreport, democase, 9 handler tests)
- Frontend: 40 new component/page tests (1755 total, 221 test files)
- All existing tests unaffected — zero regressions

### Stats
- 59 files changed, +4,340 lines
- 10 commits on branch

---

## Employer Domain Phase 6: Service Credit Purchase (2026-03-19)

**Branch:** `claude/youthful-euclid` → merged as PR #109
**Goal:** Build the SCP (Service Credit Purchase) service — cost factor lookup, exclusion flag enforcement, payment tracking.

**What was built:**

### Database schema (`domains/pension/schema/025_employer_scp.sql`)
- `scp_cost_factor` — actuarial cost factor lookup with versioning (tier × hire date × age)
- `scp_request` — purchase requests with 3 immutable boolean exclusion flags
- PostgreSQL `BEFORE UPDATE` trigger `trg_scp_exclusion_immutable` prevents any modification of exclusion flags after creation (defense-in-depth)

### Go service (`platform/employer-scp/`, port 8099, 47 tests)
- `domain/costfactor.go` — `CalculateCost` using `math/big.Rat` for penny accuracy, 60-day quote expiry
- `domain/eligibility.go` — 5 service types (refunded PERA, military/USERRA, prior public, leave of absence, PERAChoice transfer), 3 tiers, documentation requirements
- `domain/exclusions.go` — flag creation (always true), validation, immutability verification
- `db/store.go` — full CRUD + quote application, payment recording, approval/denial workflows
- `api/handlers.go` — 15 endpoints across cost factors, quotes, requests, eligibility
- 19 handler tests + 13 cost factor tests + 5 eligibility tests + 10 exclusion tests

### Frontend (17 tests)
- `CostQuote.tsx` — tier/age/salary quote generator with form validation
- `PurchaseRequest.tsx` — request CRUD with exclusion flag notice, status badges, approve/deny/cancel actions
- `PaymentTracker.tsx` — payment progress with progress bars, record payment form
- `useEmployerScp.ts` — 10 React Query hooks (queries + mutations with cache invalidation)
- `employerApi.ts` — SCP API client appended (cost factors, quotes, requests, eligibility)
- `Employer.ts` — SCP types appended (SCPCostFactor, SCPRequest, SCPEligibilityResult, etc.)
- SCP tab wired into `EmployerPortalApp.tsx` (will be visible when Phase 7 swaps App.tsx)

**Key design decisions:**
- Exclusion flags enforced at 3 levels: domain logic, store layer (hardcoded true), and DB trigger
- SCP BPI document not yet available — framework built with cost factor lookup; details to be filled when BPI is retrieved
- Cost calculation formula: `totalCost = yearsRequested × annualSalary × costFactor` using `math/big.Rat`

**Test totals:** 1,709 frontend tests (212 files), 234 Go tests across 7 employer modules. All passing, zero regressions.

---

## Employer Domain — Phase 5: WARET (2026-03-19)

**Branch:** `claude/happy-montalcini`
**Goal:** Build Phase 5 of the employer domain — Working After Retirement (WARET) service with penny-accurate penalty calculations, designation management, day tracking, and PERACare conflict detection.

**What was built:**

1. **`domains/pension/schema/024_employer_waret.sql`** (NEW) — 5 tables + 1 view: waret_designation (3 types with capacity/consecutive-year limits), waret_tracking (day definition: >4hrs = 1 day), waret_penalty (5% monthly benefit per over-limit day, `math/big.Rat`), waret_ic_disclosure (PERACare insurance carrier conflict tracking), waret_ytd_summary (aggregate view). All monetary columns NUMERIC.

2. **`platform/employer-waret/`** (NEW) — Go HTTP service on port 8098. 4 domain packages:
   - `domain/designation.go` — Validate employer type per designation, capacity check (10/district for 140-day), consecutive year limit (6yr + 1yr break), ORP exemption.
   - `domain/tracking.go` — Day accumulation, hour-to-day conversion (>4hrs = 1 day), annual limit enforcement (110/720, 140/960, unlimited).
   - `domain/penalty.go` — `math/big.Rat` penny-accurate: 5% of monthly benefit per over-limit day, effective month rule (day 1 = full cancellation), deduction spreading.
   - `domain/peracare.go` — PERACare subsidy conflict detection, 30-day response window, auto-subsidy removal.
   - 58 Go tests (handler + domain). All passing.

3. **`frontend/src/components/employer-portal/waret/`** (NEW) — 4 components: DesignationForm (type selection + employer validation), DesignationDashboard (status overview + capacity), LimitTracker (day/hour accumulation + warnings), AnnualWorksheet (yearly summary + penalty history). 12 tests.

4. **`frontend/src/hooks/useEmployerWaret.ts`** (NEW) — 10 hooks for designations, tracking, penalties, PERACare conflicts.

5. **Shared files extended** — `employerApi.ts` (+120 lines WARET client), `Employer.ts` (+156 lines WARET types), `EmployerPortalApp.tsx` (WARET tab wired).

**Test totals:** Frontend 1,692 tests (211 files). 187 Go tests across 6 employer modules (shared: 3, portal: 24, reporting: 38, enrollment: 23, terminations: 41, waret: 58). All passing, zero regressions.

**Next phase:** Phase 6 — Service Credit Purchase (SCP). See `docs/sessions/2026-03-19-employer-domain-phase6-starter.md`.

---

## Employer Domain — Phase 4: Terminations & Refund (2026-03-19)

**Branch:** `claude/happy-montalcini`
**Goal:** Phase 4 — termination certifications, certification holds, and penny-accurate refund calculation using `math/big.Rat`.

**Merged via:** PR #107

---

## Employer Domain — Phase 3: New Member Enrollment (2026-03-19)

**Branch:** `claude/happy-montalcini`
**Goal:** Phase 3 — new member submissions, duplicate detection, PERAChoice elections.

**Merged via:** PR #106

---

## Background Job Infrastructure — Security Service (2026-03-19)

**Branch:** `claude/focused-driscoll`
**Goal:** Add in-process gocron scheduler to the security service with two background jobs: session cleanup and brute-force detection.

**What was built:**

1. **gocron scheduler in security service** — Scheduler starts alongside HTTP server, shuts down gracefully on SIGTERM. Two jobs registered: session cleanup (every 5 min), brute-force detection (every 1 min). All config via env vars with sensible defaults.

2. **Session cleanup job** (`platform/security/jobs/cleanup.go`) — Deletes sessions exceeding idle timeout (default 30 min) or max lifetime (default 8 hr). Logs count of cleaned sessions. Parameterized `ListActiveSessions` to use same configurable timeout.

3. **Brute-force detection job** (`platform/security/jobs/bruteforce.go`) — Queries `login_failure` events grouped by actor/IP within a configurable window (default 15 min). If count exceeds threshold (default 5), inserts `brute_force_detected` event with metadata (fail count, window, IP). Dedup prevents duplicate alerts within the same window. Uses `encoding/json.Marshal` for metadata (not string formatting).

4. **Store methods added** — `CleanupExpiredSessions`, `CountFailedLoginsByActor`, `HasRecentBruteForceAlert` in db layer. `GetEventStats` extended with `bruteForceAlerts24h` count.

5. **Types added** — `JobConfig` (4 env-var fields), `BruteForceActor` struct, `brute_force_detected` event type added to `EventTypeValues`.

**Dependency added:** `github.com/go-co-op/gocron/v2 v2.19.1` — in-process cron scheduler for background jobs.

**Config env vars (all with defaults):**
- `SESSION_IDLE_TIMEOUT_MIN` = 30
- `SESSION_MAX_LIFETIME_HR` = 8
- `BRUTE_FORCE_THRESHOLD` = 5
- `BRUTE_FORCE_WINDOW_MIN` = 15

**Frontend impact:** Zero — brute-force alerts auto-appear in cross-service audit trail (already fetches all security events).

**Test totals:** Security service: 3 packages (api, db, jobs), all passing. 6 new job tests + 4 new store tests + test updates. Frontend: 1,636 tests unchanged.

**Design documents:**
- `docs/plans/2026-03-19-job-infrastructure-design.md` — Design rationale (gocron vs SKIP LOCKED vs dedicated service)
- `docs/plans/2026-03-19-job-infrastructure-plan.md` — 9-task TDD implementation plan

**Next session:** Wire same gocron pattern into issues service for SLA breach detection. See `docs/sessions/2026-03-19-post-job-infra-starter.md`.

---

## Employer Domain — Phase 2: Reporting Engine (2026-03-19)

**Branch:** `claude/nifty-chatelet`
**Goal:** Build Phase 2 of the 7-domain employer roadmap — contribution reporting engine with validation, exception workflow, payment setup, and late interest tracking.

**What was built:**

1. **`domains/pension/schema/021_employer_reporting.sql`** (NEW) — 5 tables: contribution_file (10 lifecycle states), contribution_record (per-member line items with SSN hash), contribution_exception (11 exception types, 5 statuses), contribution_payment (ACH/wire with 6 payment statuses), late_interest_accrual (per-period interest tracking). 13 indexes for query performance. All monetary columns NUMERIC — never float.

2. **`platform/employer-reporting/`** (NEW) — Go HTTP service on port 8095. 15 API routes: file CRUD, manual entry with inline validation, exception queue (list/get/resolve/escalate), payment setup + history + cancellation, corrections, late interest. Full middleware chain matching employer-portal pattern. **Validation engine** (`domain/validator.go`): rate validation against contribution_rate_table with $0.01 tolerance, ORP separate code path (only AED/SAED validated), negative amount detection, total mismatch detection. 38 Go tests (21 handler + 17 domain). All passing.

3. **`frontend/src/components/employer-portal/reporting/`** (NEW) — 6 React components: FileUpload (drag-drop zone + file list), ManualGrid (editable table with 11 columns), ValidationProgress (5-step stepper with record counts), ExceptionDashboard (filterable table with resolve/escalate), CorrectionWorkflow (file selector + correction form), PaymentSetup (ACH/wire selection + payment history).

4. **`frontend/src/hooks/useEmployerReporting.ts`** (NEW) — 14 hooks: 7 query (useContributionFiles, useContributionFile, useContributionRecords, useExceptions, useException, usePayments, useLateInterest) + 7 mutation (useUploadManualEntry, useDeleteFile, useResolveException, useEscalateException, useSetupPayment, useCancelPayment, useSubmitCorrection).

5. **`frontend/src/lib/employerApi.ts`** — Extended with `employerReportingAPI` object (15 API client methods for files, exceptions, payments, corrections, interest).

6. **`frontend/src/types/Employer.ts`** — Updated placeholder types to match Go models. Added: FileStatus, ExceptionType, ExceptionStatus, PaymentMethod, PaymentStatus, ContributionRecord, ContributionPayment, LateInterestAccrual, ManualEntryRecord.

**Test totals:** Frontend 1,651 tests (208 files). employer-reporting: 38 Go tests. employer-shared: 7 Go tests. employer-portal: 24 Go tests. All passing, zero regressions.

**Zero conflicts:** All new directories/files — no existing files modified except employerApi.ts (reporting client appended) and Employer.ts (types updated from placeholders).

**Data gaps (not blocking):** Late interest rate values, ORP member contribution rate, payment discrepancy threshold — all have schema slots built, awaiting COPERA confirmation. Validation engine works without these.

**Next phase:** Phase 3 — Employer Enrollment (new member submissions, duplicate detection, PERAChoice tracking).
---

## Visual Polish + Cross-Service Audit + Clerk Events (2026-03-19)

**Branch:** `claude/quizzical-lovelace`
**Goal:** Complete visual polish items, add cross-service audit trail, extend Clerk webhook event types.

**What was built:**

1. **DQ Score formatting fix** — `OperationalMetricsPanel.tsx` now uses `.toFixed(1)` to display `98.6%` instead of raw float `98.61538461538461%`. +1 test.
2. **Cross-service audit trail** — `AuditTrailPanel.tsx` now fetches from both `/crm/audit` and `/security/events`, merges and sorts by timestamp descending. Source badges (CRM in gray, Security in violet) distinguish entries. Either source can fail independently. Updated CSV export includes Source column. +5 tests.
3. **Clerk webhook event types** — Added 5 new mappings to security service: `user.created`, `user.deleted`, `session.revoked`, `organization.membership.created`, `organization.membership.deleted`. Total: 9 mapped types. +5 test cases.

**Test totals:** Frontend 1,636 tests (204 files). Security Go 49 tests. All green.

---

## Employer Domain — Phase 1: Foundation (2026-03-19)

**Branch:** `claude/pedantic-kepler`
**Goal:** Build Phase 1 of the 7-domain employer roadmap — shared module, portal service, database schema, frontend scaffold.

**What was built:**

1. **`platform/employer-shared/`** (NEW) — Shared Go module with types for all 6 employer services: PortalRole (4 roles), ContributionCategory (7), PlanType (3), Tier (3), FileStatus (10 lifecycle states), ExceptionStatus (5), EnrollmentType (3), DesignationType (4 WARET), ServiceCreditType (5), Division struct, ContributionRateRow struct, LateInterestRate struct. 3 test functions (7 sub-tests).

2. **`domains/pension/schema/020_employer_shared.sql`** (NEW) — 5 tables: employer_division (5 COPERA divisions), employer_portal_user (role-based access), contribution_rate_table (versioned rates keyed by division × safety_officer × effective_date), late_interest_rate (schema ready, no values yet), employer_alert (system-wide + org-specific). 14 rate rows seeded from COPERA fact sheet REV 1-26 (Jan 2025 + Jan 2026, all 5 divisions + Safety Officers). All rate totals verified against source document.

3. **`platform/employer-portal/`** (NEW) — Go HTTP service on port 8094. 11 API routes: portal user CRUD, dashboard summary, alerts, rate tables, divisions. Full middleware chain (CORS → Auth → RateLimit → DBContext → Logging). 24 handler tests. Follows exact CRM service pattern.

4. **`frontend/src/components/employer-portal/`** (NEW) — React portal with 7-tab navigation (Dashboard, Communications, Reporting, Enrollment, Terminations, WARET, SCP). Components: EmployerPortalApp, OrgBanner, AlertBanner, PortalNav, EmployerDashboard. API client (`employerApi.ts`), 10 React Query hooks, TypeScript types. 6 tests.

5. **Vite proxy routes** — Added 6 proxy entries for employer services (ports 8094-8099).

**Design documents:**
- `docs/plans/2026-03-19-employer-domain-design.md` — Full 7-domain architecture with service topology, database schema, gap register
- `docs/plans/2026-03-19-employer-domain-plan.md` — 8-phase implementation plan with 30+ tasks

**Test totals:** Frontend 1,636 tests (206 files). employer-shared: 7 tests. employer-portal: 24 tests. All passing.

**Zero conflicts:** All new directories — no existing files modified except vite.config.ts (proxy entries appended).

**Data sourced:** COPERA contribution rates (Jan 2025 + Jan 2026) committed to `docs/copera-contribution-rates-jan2026.md`. Rate table key corrected to division × safety_officer × effective_date (not plan_type × tier).

**Gaps flagged:** Late interest rate, minimum charge, payment discrepancy threshold, ORP rates, statutory caps/floors — all have schema slots built, awaiting COPERA confirmation.

**Next phase:** Phase 2 — Employer Reporting engine (contribution validation, exceptions, payment setup).

---

## E2E Test Gaps + Platform Polish (2026-03-19)

**Branch:** `claude/sweet-mahavira`
**Goal:** Fill E2E integration test gaps, wire tests into CI, and complete medium-priority visual/backend polish.

**What was built:**

### E2E Integration Tests
1. **Shared test libraries** (`tests/e2e/lib/`) — 4 files: colors, assertions, JWT generation, HTTP helpers. Eliminated ~120 lines of duplication across scripts.
2. **Refactored existing scripts** — `services_hub_e2e.sh` and `correspondence_e2e.sh` now source shared libs. Added JWT auth to correspondence tests (was missing).
3. **`negative_paths_e2e.sh`** (NEW) — 21 assertions: auth failures (401 — no auth, malformed token, expired), validation errors (400 — empty body, field overflow, missing required), not found (404), pagination edge cases.
4. **`workflows_e2e.sh`** (NEW) — 20 assertions: case lifecycle (create→note→advance→history→stats), correspondence→CRM audit trail, issue lifecycle with comments.
5. **CI wiring** — New `e2e` job in `.github/workflows/ci.yml`: boots Docker Compose stack, waits for health, runs all 4 E2E scripts, collects logs on failure, tears down. `continue-on-error: true` initially.
6. **Total: ~118 E2E assertions across 4 scripts** (was ~65 across 2).

### Backend Polish
7. **Audit Trail filtering** — Added `agent_id`, `date_from`, `date_to` query params to `GET /api/v1/crm/audit`. Introduced `AuditFilter` struct in `platform/crm/db/audit.go`.
8. **Clerk webhook signature validation** — Replaced TODO with Svix HMAC-SHA256 signature checking. Skips validation in dev mode (no `CLERK_WEBHOOK_SECRET`). 4 new tests.

### Frontend Polish
9. **Tab bar responsive icons** — Added `lucide-react` dependency with 7 icons (Heart, Database, ScrollText, BarChart3, Shield, AlertCircle, Settings). Icon-only mode on mobile (<640px), icon+text on desktop. `aria-label` on all tabs. 2 new tests.
10. **Metrics unavailability banner** — Amber alert banner when all data hooks return no data (not loading). 3 new tests.

**Test totals:** Frontend 1,630 tests (204 files). CRM + Security Go tests passing. 118 E2E assertions. All green.

**Next session starter:** `docs/sessions/2026-03-19-enhancements-backlog-starter.md` — covers background job infrastructure, security event enhancements, and issue management SLA/notifications.

---

## API Consistency — Shared apiresponse Package (2026-03-18)

**Branch:** `claude/eager-fermat` → PR #99
**Goal:** Extract duplicated API response helpers into a shared package, standardize `requestId` (camelCase).

**What was built:**

1. **`platform/apiresponse/`** (NEW) — Shared response envelope package with `WriteSuccess`, `WriteError`, `WritePaginated`, `WriteJSON`, `BuildSuccess`, `BuildPaginated`. 8 unit tests.
2. **10 platform services wired** — dataaccess, intelligence, crm, correspondence, dataquality, knowledgebase, casemanagement, issues, preferences, security. ~460 lines of duplicated local helpers removed.
3. **`requestId` standardized** — All Go services and frontend types/mocks changed from `request_id` (snake_case) to `requestId` (camelCase). 32 frontend test files updated.
4. **CI matrix expanded** — Added apiresponse, casemanagement, issues, preferences, security to the platform-services CI job (6 → 11 services).

**Cleanup:** Closed PR #79 (unmergeable `nostalgic-moser` branch), deleted worktree and branch.

**Test totals:** Frontend 1,610 tests (202 files). All 11 Go service test suites passing. 14/14 CI jobs green.

---

## CI Fix + Session Cleanup (2026-03-18)

**Branch:** `main` (direct commit)

- Fixed CI workflow: added `-short` flag to platform service test job so RLS integration tests (which need live PostgreSQL) are skipped in CI. Connector job already had `-short`.
- PR #79 (`claude/nostalgic-moser`) identified as unmergeable — too many rebase conflicts from portal redesign sessions. Session starter created at `docs/sessions/2026-03-18-api-consistency-reimplementation-starter.md` for fresh re-implementation next session.
- Original implementation plan saved to `docs/plans/2026-03-16-api-consistency-final-regression.md`.

---

## Member Portal Redesign — Phase 11: Polish & E2E Testing (2026-03-18)

**Branch:** `claude/confident-aryabhata`
**Goal:** Final quality assurance pass — cross-section navigation, accessibility, error resilience, tour edge cases, design system consistency.

**What was built:**

### 5 new test files, 50 new tests (all test-only, zero component changes)

1. **MemberPortal.navigation.test.tsx** (13 tests) — Full sidebar traversal for active/retiree/inactive/beneficiary personas, fallback "coming soon" sections, notification bell presence, back-to-dashboard navigation
2. **MemberPortalSidebar.a11y.test.tsx** (11 tests) — ARIA landmarks (`role="navigation"`, `aria-label`), `aria-current="page"` tracking, collapse toggle labels, badge accessibility, focusability, no duplicate landmarks
3. **MemberPortal.resilience.test.tsx** (10 tests) — Loading state, API error → demo data fallback, ErrorBoundary catch/retry, DEMO_MEMBER persona resolution
4. **TourProvider.edge.test.tsx** (8 tests) — Inactive/beneficiary step counts, autoStart=false, version bump re-trigger, rapid clicking safety, skip button persistence, "Done" on last step
5. **MemberPortal.consistency.test.tsx** (8 tests) — Design system colors/fonts (hex→rgb conversion for JSDOM), sidebar widths (56px/220px), border colors, badge rendering, collapsed text hiding

**Key finding:** `resolveMemberPersona` compares `status_code.toLowerCase()` against full words ('active', 'inactive', 'retired'), not single-letter codes ('A', 'I', 'R'). Test mocks must use full words.

**Test totals:** Frontend 1,610 tests (202 files). All green. No regressions.

**Phase 11 completes the member portal redesign. All 11 phases are done.**

---

## Member Portal Redesign — Phase 10: Notifications & Preferences (2026-03-18)

**Branch:** `claude/determined-meitner`
**Goal:** Complete Phase 10 (Tasks 69–75) — Preferences section, notification provider, guided tour expansion, and final portal wiring.

**What was built:**

### Tasks 69–72: Preferences Section (Frontend)
- **PreferencesSection** — 3-tab container (Communication, Accessibility, Security) following DocumentSection pattern
- **CommunicationPreferences** — Notification type × channel matrix driven by plan-profile.yaml, legally required items enforced as always-on, SMS opt-in with phone number input
- **AccessibilityPreferences** — Text size radio group (Standard/Larger/Largest), high contrast toggle, reduce motion toggle, live CSS custom property updates
- **SecurityPreferences** — Clerk-delegated password change, 2FA management, active sessions display, account activity section
- **useMemberPreferences hook** — react-query CRUD for member preferences (GET/PUT)
- 23 component tests across 4 test files

### Task 73: Notification Provider Interface (Go backend)
- `NotificationProvider` interface: `Send`, `GetStatus` in `platform/dataaccess/notify/`
- `ConsoleProvider` — dev adapter with in-memory store, structured slog logging, thread-safe (sync.RWMutex)
- Same interface+adapter pattern as ECM provider
- 8 tests (interface compliance, send/status roundtrip, validation, unique IDs)

### Task 74: Guided Tour Content
- Expanded tour steps for all 4 personas: 4 common + persona-specific steps
- Active: 8 steps (was 4), Retiree: 7 (was 2), Inactive: 6 (was 2), Beneficiary: 6 (was 2)
- Bumped CURRENT_TOUR_VERSION to 2 (triggers re-tour for returning users)
- Updated TourProvider tests for new step counts
- 7 new tour step tests

### Task 75: Final Portal Wiring
- Added "⚙ Preferences" to sidebar NAV_ITEMS (visible to all personas)
- Wired PreferencesSection into MemberPortal.tsx section router
- Updated fallback exclusion list

**Test totals:** Go dataaccess 85 tests (77 existing + 8 notify), Frontend 1,560 tests (197 files). All green.

**Visual verification:** All 3 preference tabs render correctly in browser. Tour shows "1 of 8" for active persona.

**After Phase 10, only Phase 11 (Polish & E2E Testing) remains to complete the portal redesign.**

---

## Member Portal Redesign — Phase 9: Documents (2026-03-18)

**Branch:** `claude/agitated-greider`
**Goal:** Complete Phase 9 (Tasks 63–68) — Full document pipeline from plan profile rules through ECM storage to archive UI.

**What was built:**

### Task 67: ECM Integration (Go backend)
- `ECMProvider` interface: `Ingest`, `Retrieve`, `Delete` in `platform/dataaccess/ecm/`
- Local filesystem adapter for dev/testing (production adapters added per-client)
- 8 tests

### Task 68: Document Upload & Download Endpoints (Go backend)
- 4 endpoints: POST upload (multipart/ECM), GET issue docs, GET member docs, GET download URL
- Handler struct extended with ECM provider dependency injection
- 13 tests (sqlmock + local ECM adapter)

### Task 63: DocumentSection Shell (Frontend)
- Two-tab container: "My Checklist" + "All Documents"
- Wired into MemberPortal sidebar navigation
- 4 tests

### Task 64: DocumentChecklist (Frontend)
- `useDocumentChecklist` hook: merges plan profile rules with existing uploads via react-query
- `statusToContext()` maps member status → plan profile context
- Outstanding items show FileUpload (compact) per item; received items show checkmark
- 15 tests (9 component + 6 hook)

### Task 65: DocumentArchive (Frontend)
- Categorized view: uploaded by member, from plan, DRO court orders
- Type filter dropdown, download via ECM signed URL
- DRO security: "Request Copy" only (no direct download)
- 9 tests

### API Layer Updates
- `documentAPI.upload()` signature fixed to match backend (member_id as query param)
- Added `documentAPI.download()` method

**Test totals:** Go dataaccess 77 tests, Frontend 1,530 tests (192 files). All green.

**Key decisions:**
- ECM as pluggable interface — local adapter for dev, production adapters added per-client deployment
- Document checklist context driven by member status (ACTIVE→retirement, INACTIVE→refund, etc.)
- Shared react-query cache key between checklist and archive for automatic cross-tab sync
- DRO download restriction implemented as render-level decision, not permissions system

**Next:** Phase 10 — Notifications & Preferences (Tasks 69–75). See `docs/sessions/2026-03-18-phase10-session11-starter.md`.

---

## Member Portal Redesign — Phase 8: Messages & Activity (2026-03-18)

**Branch:** `claude/charming-cerf`
**Goal:** Implement Phase 8 (Tasks 56–61) — Messages & Activity section with activity tracker, secure messaging, interaction history, and notification bell.

**What was built:**

### Task 56: Activity Tracker
- `useActivityTracker` hook: normalizes CRM conversations + issues into `ActivityItem[]` with urgency classification
- `ActivityItem` + `ActivityTracker` components with Action Needed / In Progress / Completed buckets
- 10 tests

### Task 57: Secure Messaging
- `MessageList`: conversation list with unread indicators, sorted by last activity
- `MessageThread`: chat bubbles (inbound right/sage, outbound left/white) with reply input
- 11 tests

### Task 58: Compose Message
- New conversation form: subject + body, validation, whitespace trimming, error handling
- No attachment support (deferred to Phase 9 FileUpload)
- 8 tests

### Task 59: Interaction History
- Read-only timeline filtered to public-visibility entries only
- Channel filter dropdown (phone, email, mail, portal message, walk-in)
- 8 tests

### Task 60: MessagesSection Router
- 3-tab layout: Activity / Messages / History
- Compose flow integration (New Message → compose → back to Messages)
- Wired into MemberPortal.tsx
- 6 tests

### Task 61: NotificationBell
- `useNotifications` hook: badge count from active conversations
- Bell with red badge (9+ cap), dropdown with recent items, click-outside close
- Wired into MemberPortal header
- 9 tests

**Key decisions:**
- Task 62 backend deferred — existing CRM APIs are sufficient
- Activity aggregation uses unified feed with urgency buckets normalized across CRM + issues
- No file attachments in ComposeMessage — deferred to Phase 9 FileUpload

**Test results:** 187 test files, 1490 tests, all passing. Zero type errors.

**Visual verification:** All components verified in browser with live backend data.

**Next session:** Phase 9 — Documents (Tasks 63–68). See `docs/sessions/2026-03-18-phase9-starter.md`.

---

## Member Portal Redesign — Phase 4: What-If Calculator (2026-03-18)

**Branch:** `claude/compassionate-beaver`
**Goal:** Implement Phase 4 (Tasks 25–33) of the Member Portal Redesign plan — complete what-if retirement calculator with guided wizard, open calculator, saved scenarios, staleness detection, and contextual help.

**What was built:**

### Task 25: Calculator Hooks
- `useWhatIfCalculator` — Wraps 3 intelligence API calls (eligibility, benefit calc, payment options) with 500ms debounce, exposes `inputs`, `updateInput`, `calculateNow`, `result`, `toScenario()`
- `useSavedScenarios` — CRUD hook using React Query mutations with cache invalidation
- 15 tests

### Task 26: Guided Wizard
- 5-step wizard: Retirement Date → Service Purchase → Salary Growth → Payment Option → Results
- `WizardStep` reusable layout with contextual data panel
- Progress bar, Back/Next navigation, validation (date required before advancing)
- 11 tests

### Task 27: Results Display
- `FormulaBreakdown` — AMS × multiplier × years transparency
- `WaitComparison` — Side-by-side "what if you wait?" at multiple dates
- `PaymentOptionTable` — Payment option comparison with beneficiary context
- `BenefitResult` — Composite component composing all three
- 8 tests

### Task 28: Open Calculator
- Side-by-side input/result layout with all controls in one panel
- Real-time updates via debounced calculator hook
- 5 tests

### Task 29: Calculator Section Router
- Mode toggle (Guided / Open Calculator)
- Integrates `useWhatIfCalculator`, `useSavedScenarios`, wait scenarios, save functionality
- 7 tests

### Task 30: Saved Scenarios
- `SaveScenarioDialog` — Modal with label input
- `SavedScenariosList` — Cards with stale indicator, delete, compare
- `ScenarioCompare` — Side-by-side table with best-benefit highlighting
- 9 tests

### Task 31: Staleness Detection
- `computeDataVersion()` — djb2 hash of member data fields (member_id, earned_years, purchased_years, military_years, beneficiary_count, plan_config_version)
- `isScenarioStale()` — Version comparison
- 11 tests

### Task 32: Contextual Help Panel
- `ContextualHelpPanel` — Collapsible glossary panel, section-filtered (calculator/profile/dashboard), tier-filtered
- `GlossaryItem` — Term + definition + optional tier note
- 8 tests

### Task 33: Wire into Portal Shell
- Replaced `projections` nav item with `calculator` ("Plan My Retirement") for active + inactive personas
- Added `CalculatorSection` route in `MemberPortal.tsx`
- Updated 2 existing test files for new nav key

**Totals:** 62 files changed, 8,268 lines added. 74 new tests. 1,210 total tests passing across 160 test files.

**Key decisions:**
- Calculator never computes monetary values in frontend — all calculations go through intelligence service API
- Staleness detection uses djb2 hash (non-cryptographic, fast) to compare data snapshots
- Guided wizard defaults to 5 steps; open calculator shows all inputs simultaneously
- Plan-profile-driven payment options and glossary terms ensure plan portability

**Next session should:**
- Start Phase 5 (Retirement Application) at Task 34, or
- Create PR to merge Phase 3+4 work from this branch

---

## Member Portal Redesign — Phase 1: Foundation (2026-03-17)

**Branch:** `claude/mystifying-chebyshev`
**Goal:** Implement Phase 1 (7 tasks) of the Member Portal Redesign plan — types, configuration, database schema, seed data, dev auth, API client, and proxy routes.

**What was built:**

### Task 1: Plan Profile Types & Configuration Loader
- `frontend/src/types/PlanProfile.ts` — 15 TypeScript interfaces for plan-driven portal configuration
- `frontend/src/config/plan-profile.yaml` — DERP plan profile (3 tiers, eligibility rules, payment options, document checklists, glossary)
- `frontend/src/lib/planProfile.ts` — Cached config loader with helper functions (getFieldPermission, getDocumentChecklist, etc.)
- 14 tests covering identity, tiers, permissions, checklists, glossary

### Task 2: Member Portal Types & Persona Resolver
- `frontend/src/types/MemberPortal.ts` — Types for personas, preferences, scenarios, notifications, payments, documents, change requests
- `resolveMemberPersona()` — Returns array of personas (supports dual-role members like active + beneficiary)
- 8 tests covering all persona resolution paths

### Task 3: Database Migration 016
- `domains/pension/schema/016_member_portal.sql` — 7 tables: member_account_links, member_preferences, saved_scenarios, notifications, member_documents, payment_history, tax_documents
- ALTER TABLE retirement_case: added initiated_by, bounce_message, bounce_stage columns

### Task 4: Seed Data
- `domains/pension/seed/018_member_portal_seed.sql` — 8 account links, 8 preferences, 4 saved scenarios, 18 payment records, 5 tax documents, 8 notifications

### Task 5: Dev Auth Extension
- Extended `devAuth.ts` with 8 member persona accounts (active near/early, inactive vested/not-vested, retiree, survivor, death benefit, dual role)
- `memberAccountToAuthUser()` converter function
- 4 new tests

### Task 6: Member Portal API Client
- `frontend/src/lib/memberPortalApi.ts` — 9 API service objects (memberAuth, preferences, scenarios, notifications, payments, documents, changeRequests, addresses, refunds)
- 12 tests using Go API envelope pattern `{data: ...}`

### Task 7: Vite Proxy Routes
- Added proxy entries for `/api/v1/member-auth`, `/api/v1/scenarios`, `/api/v1/notifications` (other paths covered by existing prefixes)

**Key decisions:**
- Named portal documents table `member_documents` to avoid conflicts
- Corrected plan's `ALTER TABLE cases` → `ALTER TABLE retirement_case`
- Mapped personas to existing seed member IDs (10001–10012) instead of creating new ones
- Only 3 new proxy routes needed — other portal paths already matched existing prefixes

**Test Results:** 985 tests passing, 134 test files, 0 TypeScript errors
**Browser Verified:** App loads cleanly, Staff Portal renders correctly, no console errors

**Next session should start with:** Phase 2, Task 8 of the Member Portal Redesign plan (`docs/plans/2026-03-17-member-portal-redesign-plan.md`)

---

## Services Hub Integration Tests (2026-03-17)

**Branch:** `claude/gifted-zhukovsky`
**Goal:** Verify all 7 Services Hub tabs receive valid data from live Docker Compose stack.

**What was built:**
- `tests/e2e/services_hub_e2e.sh` — bash/curl/jq E2E test script, ~35 assertions across 7 sections
- Health: aggregate status, per-service health for 8 platform services
- Data Quality: score, checks list, issues list, status update round-trip with restore
- Audit Trail: log retrieval, entity_type filtering
- Metrics: case stats, SLA stats, volume trends
- Security: event stats, POST event → GET verification
- Issues: full CRUD lifecycle (create → read → update → filter by status)
- Config: rules list, field presence checks

**Test Results:** 50 assertions passed, 0 failed across all 7 sections

**Next session should start with:** Visual polish or audit trail server-side filtering

---

## Defect Fixes: UUID Normalization, Proxy Routes, Portal Access (2026-03-17)

**PR:** #86
**Goal:** Fix three runtime defects affecting the Supervisor Dashboard, Services Hub Issues tab, and Member Portal navigation.

**What was fixed:**

### Defect 1: UUID Tenant ID Normalization
- Supervisor Dashboard showed PostgreSQL error 22P02 — dev JWT used TEXT `'dev-tenant-001'` but columns were `UUID NOT NULL`
- Normalized all dev auth tenant IDs to UUID `'00000000-0000-0000-0000-000000000001'`
- Migrated issues and security service schemas from `TEXT` to `UUID` with conditional `ALTER COLUMN`
- Updated all seed data (016, 017) to match

### Defect 2: Missing Vite Dev Proxy Routes
- Services Hub Issues tab showed "service unavailable" in dev mode
- Added Vite proxy entries for `/api/v1/issues` (8092) and `/api/v1/security` (8093)

### Defect 3: Staff Portal Access
- Member Portal sidebar link did nothing for staff users
- Added `'portal'` to `ROLE_ACCESS.staff` in `auth.ts`, updated tests

### Test Results
- Frontend: 131 test files, 947 tests — all passing
- TypeScript typecheck: clean
- Go builds: clean across all services

**Next session should start with:** `docs/plans/2026-03-17-defect-fixes-next-session.md`

---

## Services Hub — 7-Tab Admin Center (2026-03-17)

**Branch:** `claude/strange-cray`
**Goal:** Transform the single "Platform Health" tab into a comprehensive Services Hub with 7 functional sections covering system monitoring, data quality, audit, operations, security, issue management, and configuration.

**What was built:**

### ServicesHub Shell
- New `ServicesHub.tsx` component with horizontal tab bar replacing `ServiceHealthDashboard` in StaffPortal
- 7 tabs: Health, Data Quality, Audit Trail, Metrics, Security, Issues, Config
- ARIA-compliant: `role="tablist"`, `role="tab"`, `role="tabpanel"` with `aria-labelledby`
- Sidebar renamed from "Platform Health" to "Services Hub", Data Quality merged as sub-tab

### Audit Trail Panel (CRM audit API — frontend only)
- Entity type filter (6 entity types), date range presets (24h/7d/30d/90d), agent ID filter
- Free-text search across summary field
- Expandable entries showing field-level diffs (old→new), agent IP/device, hash chain
- CSV export of filtered results, offset-based Load More pagination
- Types: `Audit.ts`, API client: `auditApi.ts`, Hook: `useAuditLog.ts`

### Operational Metrics Panel (existing APIs — frontend only)
- KPI cards: Active Cases, SLA On-Track %, Avg Processing, DQ Score
- Case Pipeline: horizontal bars per stage from `caseloadByStage`
- SLA Health: stacked bar (on-track/at-risk/overdue) with percentages
- Case Volume Trend: Recharts 6-month bar chart
- Commitments Due: overdue/this week/upcoming from CRM commitments API
- New hook: `useCommitmentStats.ts`

### Security & Access Panel (Phase A — frontend only)
- Summary stats: Roles Defined (5), Portals (8), Phase B badges for Active Users/Sessions
- Role Definitions table: role name, portal count, portal list, key permissions
- Access Matrix: role × portal grid with checkmarks/crosses from `ROLE_ACCESS`
- Security Events section: Phase B planned capabilities notice

### Issue Management Panel (Phase A — demo data)
- 6 demo issues (ISS-037 to ISS-042) spanning critical/high/medium/low severities
- Summary cards: Open Issues, Critical, Avg Resolution, Resolved (30d)
- 4 filter dropdowns: Status, Severity, Category, Assigned To
- Expandable issue detail with description, affected service, activity log
- Accessible expand: `role="button"`, keyboard support (Enter/Space)
- Demo data banner indicating Phase B will provide live backend

### Configuration & Rules Panel (KB API + static — frontend only)
- Plan Provisions: expandable tree grouped by domain from `useKBRules()` hook
- System Parameters table: SLA targets, DQ target, contribution rates, vesting, retirement age
- Service Catalog: `FeatureBurndown` component relocated from Health tab

### Cleanup
- Removed dead `ServiceMap.tsx` (265 lines) and its test file
- FeatureBurndown moved from Health tab to Config tab

### Test Results
- Frontend: 131 test files, 947 tests — all passing (+37 new, -4 dead code)
- TypeScript typecheck: clean
- Production build: clean

### Phase B Deferred (tracked in memory)
- Security events backend (Clerk webhooks, session tracking, failed login monitoring)
- Issue Management service (`platform/issues/`, port 8092, PostgreSQL tables)

**Design doc:** `docs/plans/2026-03-17-services-hub-design.md`
**Implementation plan:** `docs/plans/2026-03-17-services-hub-plan.md`

**Next session should start with:** `docs/plans/2026-03-17-services-hub-next-session.md`

---

## Live Platform Health Dashboard (2026-03-17)

**Branch:** `claude/loving-gagarin`
**Goal:** Transform the static Service Map into a live health dashboard with real-time service monitoring, feature development burndown, and predictive resource alerts.

**What was built:**

### Backend: `platform/healthutil/` (shared package)
- Reusable health infrastructure: `ServiceHealth`, `DBPoolStats`, `RequestStats`, `RuntimeStats` types
- `NewDetailHandler()` — rich health endpoint with DB pool stats, request counters, runtime metrics
- `NewReadyHandler()` — DB connectivity probe with 2s timeout (Kubernetes readiness pattern)
- `RequestCounters` — atomic counters + 1000-entry ring buffer for P95 latency
- `CounterMiddleware` — HTTP middleware capturing status codes and request duration
- `statusCapture` ResponseWriter implements `http.Flusher` per security rules
- 12 unit tests, all passing

### Backend: `platform/healthagg/` (Port 8091)
- New aggregation service: concurrent fan-out to all 9 services' `/health/detail` endpoints
- `GET /api/v1/health/aggregate` — single frontend polling endpoint
- Service registry via `HEALTH_SERVICES` env var
- Overall status: all ok → "healthy"; any degraded → "degraded"; any unreachable → "unhealthy"
- 6 unit tests, all passing

### Backend: All 8 platform services wired
- `/health/detail` and `/ready` endpoints added to all services
- `CounterMiddleware` added to middleware chain (CORS → Auth → RateLimit → DBContext → Counter → Logging → Handler)
- Auth and DBContext bypass paths updated for new health endpoints
- Intelligence service: nil-safe DB handling (optional database)

### Frontend: ServiceHealthDashboard
- Summary stats row: healthy/degraded/down counts, platform completion %
- Four-Layer Architecture diagram (preserved from original ServiceMap)
- Live health grid: 3-column ServiceHealthCards with color-coded status (green/yellow/red)
- Graceful degradation: falls back to static catalog when healthagg unavailable
- HealthTrendsPanel: rolling 10-min Recharts charts for latency + DB pool utilization
- Predictive alert banners for high pool utilization and error rates
- FeatureBurndown: 30-service catalog with category progress bars, expandable detail tables
- Enriched `platformServices.ts` data with buildStatus, completionPct, targetSprint, backendService mapping

### Infrastructure
- Docker Compose: healthagg service entry (port 8091, depends on all backends)
- Vite proxy: `/api/v1/health` → healthagg, `/api/v1/preferences` → preferences (fix)

### Test Results
- Go: 18 new tests (12 healthutil + 6 healthagg) — all passing
- Frontend: 126 test files, 907 tests — all passing (+20 new tests, zero regressions)
- TypeScript typecheck: clean
- Production build: clean

**Design doc:** `docs/plans/2026-03-17-live-health-dashboard-design.md` (in plan file)
**Implementation plan:** Plan mode document (proud-scribbling-pudding.md)

---

## Workspace Preference Learning — V1 Implementation (2026-03-16)

**Branch:** `claude/loving-gagarin`
**Goal:** Per-user workspace layout preferences with role-based aggregate suggestions. Process Efficiency Learning (Dimension 2) — enabling the AI composition engine to learn from explicit user feedback.

**What was built:**

### Backend: `platform/preferences/` (Port 8089)
- New Go service with 5 API endpoints: GET/PUT/DELETE preferences, GET suggestions, POST respond
- 4 PostgreSQL tables with RLS: `preference_events` (append-only event log), `user_preferences` (materialized read model), `role_suggestions` (batch-computed), `suggestion_responses`
- Context key computation: deterministic hash from coarsened CaseFlags (hasDRO, isEarlyRetirement, tier) → 12 context buckets
- Suggestion convergence computation: 70% threshold, 5-user minimum sample size
- Docker Compose entry, database migration, Dockerfile
- Auth middleware, CORS, rate limiting, RLS — matching all existing platform services

### Frontend: Preference Override Pipeline
- Pure `applyPreferences()` function: overlay user preferences onto `composeStages()` output
- Mandatory stage protection (intake, benefit-calc, election, submit cannot be hidden)
- `useComposedWorkspace()` hook wired into `RetirementApplication.tsx` — one-line integration
- `PanelCustomizeControls` component: visibility toggle (visible/pinned/hidden), expansion toggle
- `SuggestionToast` component: peer-count-based suggestions with accept/dismiss/snooze
- Preferences API client + 6 React Query hooks with cache invalidation
- `deleteAPI` helper added to shared API client

### Architecture: Progressive Hybrid
- V1: Structured rules engine with event sourcing (events are write model, preferences are read model)
- V2 (future): AI aggregation layer consumes the same event data — no schema migration needed
- Multi-agency ready: context keys are tenant-independent, event schema supports anonymized pattern sharing

### Test Results
- Go: 7 tests (3 context key + 4 convergence) — all passing
- Frontend: 122 test files, 887 tests — all passing (+10 new tests, zero regressions)
- TypeScript typecheck: clean
- Production build: clean

**Design doc:** `docs/plans/2026-03-16-workspace-preference-learning-design.md`
**Implementation plan:** `docs/plans/2026-03-16-workspace-preference-learning-plan.md`

---

## Quality Session 9: Dead Code Cleanup + API Consistency + Final Regression (2026-03-16)

**Branch:** `claude/inspiring-sammet`
**Goal:** Complete the master quality review plan (Tasks 30-32). Dead code cleanup, API response consistency across all 7 services, and final regression suite.

**What was built:**

### Task 30: Dead Code + Dependency Cleanup
**Branch:** `claude/naughty-germain`
**Goal:** Add test coverage for all 14 workflow non-stage components (view modes, navigation controls, support panels, correspondence). Coverage 0% → 100%.

**What was built:**
- 82 new tests across 14 test files + 1 shared fixture file
- View layouts: GuidedView (8), ExpertView (6), DeckView (7), OrbitView (8)
- Navigation controls: ModeToggle (4), StageCard (8), ProgressIndicator (5)
- Support panels: ContextualHelp (8), LiveSummary (7), PreviewStack (4)
- Selectors: NavigationModelPicker (5), ProficiencySelector (4)
- Correspondence: CorrespondencePanel (5), StageCorrespondencePrompt (3)

**New files (15):**
- `frontend/src/components/workflow/__tests__/fixtures.ts` — shared StageDescriptor test data
- `frontend/src/components/workflow/__tests__/ModeToggle.test.tsx` — 4 tests
- `frontend/src/components/workflow/__tests__/StageCard.test.tsx` — 8 tests
- `frontend/src/components/workflow/__tests__/ProgressIndicator.test.tsx` — 5 tests
- `frontend/src/components/workflow/__tests__/GuidedView.test.tsx` — 8 tests
- `frontend/src/components/workflow/__tests__/ExpertView.test.tsx` — 6 tests
- `frontend/src/components/workflow/__tests__/DeckView.test.tsx` — 7 tests
- `frontend/src/components/workflow/__tests__/OrbitView.test.tsx` — 8 tests
- `frontend/src/components/workflow/__tests__/ContextualHelp.test.tsx` — 8 tests
- `frontend/src/components/workflow/__tests__/LiveSummary.test.tsx` — 7 tests
- `frontend/src/components/workflow/__tests__/PreviewStack.test.tsx` — 4 tests
- `frontend/src/components/workflow/__tests__/NavigationModelPicker.test.tsx` — 5 tests
- `frontend/src/components/workflow/__tests__/ProficiencySelector.test.tsx` — 4 tests
- `frontend/src/components/workflow/__tests__/CorrespondencePanel.test.tsx` — 5 tests
- `frontend/src/components/workflow/__tests__/StageCorrespondencePrompt.test.tsx` — 3 tests

**Testing patterns used:**
- `Element.prototype.scrollIntoView = vi.fn()` for ExpertView/DeckView/OrbitView (jsdom limitation)
- Regex matchers for JSX literal unicode escapes (`\u2190`, `\u2713` render literally in JSX text)
- `vi.mock()` for ContextualHelp (kbAPI + helpContent) and CorrespondencePanel (correspondenceApi + useCorrespondenceSend)

**Tests:** 426 → 508 (+82 new, 0 regressions)
**TypeScript:** 0 errors

---

## CSR Context Hub Live APIs + VendorPortal Tests — Session 10 (2026-03-15)

**Branch:** `claude/hardcore-mclaren`
**Goal:** Wire CSRContextHub to live backend APIs (replacing hardcoded demo data) with a working Log Call CRM action, and add component tests for both CSRContextHub and VendorPortal.

**What was built:**
- `useCSRContext` aggregating hook — composes 8 sub-hooks (member, service credit, beneficiaries, contributions, eligibility, CRM contact, timeline, cases) into formatted card data
- `useLogCall` mutation hook — thin wrapper around `useCreateInteraction` for phone_inbound CRM interactions
- CSRContextHub rewritten — `MemberSearch` for live search, `useCSRContext` for card data, inline Log Call form with auto-dismiss on success
- VendorPortal component tests — 10 tests covering rendering, navigation, data display (VendorPortal stays on demo data for now)

**New files (5):**
- `frontend/src/hooks/useCSRContext.ts` — aggregating hook (207 lines)
- `frontend/src/hooks/useLogCall.ts` — CRM mutation hook (27 lines)
- `frontend/src/hooks/__tests__/useCSRContext.test.ts` — 8 hook unit tests
- `frontend/src/components/staff/__tests__/CSRContextHub.test.tsx` — 8 component tests
- `frontend/src/components/portal/__tests__/VendorPortal.test.tsx` — 10 component tests

**Modified files (2):**
- `frontend/src/components/staff/CSRContextHub.tsx` — full rewrite (166→204 lines)
- `frontend/src/components/__tests__/StaffPortal.test.tsx` — added `useMemberCases` mock

**E2E verification (Docker):**
- Member search: "Martinez" → Robert Martinez (10001, T1, Public Works) from live dataaccess API
- Context cards: all 8 populated with live data (Open Tasks, Recent Activity, Benefit Estimate, Service Credit, Contributions, Beneficiary Info, Cases, Contact Info)
- Log Call: form opens, accepts note, submits to CRM API, shows ✓ Logged, auto-dismisses
- Vendor Portal: renders enrollment queue, stats cards, status badges

**Tests:** 355 → 381 (+26 new: 8 useCSRContext, 8 CSRContextHub, 10 VendorPortal)
**TypeScript:** 0 errors

---

## Seed Data Expansion + Demo Richness — Session 9 (2026-03-14)

**Branch:** `claude/cool-bardeen`
**Goal:** Expand demo data from 3 members / 6 cases to 12 members / 18 cases for realistic dashboard population.

**What was built:**
- 7 new members (10006–10012) with full history: employment, salary, contributions, service credit, beneficiaries
- 12 new retirement cases with multi-stage, multi-priority, multi-assignee distribution
- 7 CRM contacts + 7 conversations + 18 interactions for new members
- Docker init sequence extended with 3 new seed files (023–025)

**New files (3):**
- `domains/pension/seed/013_expanded_members.sql` — 7 members across 5 departments, 3 tiers
- `domains/pension/seed/014_expanded_cases.sql` — 12 cases with SLA variation (NOW()-based dates)
- `domains/pension/seed/015_expanded_crm.sql` — CRM contacts + interactions for new members

**Modified files (1):**
- `docker-compose.yml` — 3 new volume mounts for expanded seeds

**Member distribution:**
| ID | Name | Tier | Dept | Status | Notable |
|----|------|------|------|--------|---------|
| 10006 | Maria Santos | 1 | Fire | A | Married, 28yr service |
| 10007 | James Wilson | 2 | Human Svc | A | Purchased service (2yr) |
| 10008 | Lisa Park | 3 | Tech Svc | A | Early career, 11yr |
| 10009 | Thomas O'Brien | 1 | Police | T | Terminated, deferred vested |
| 10010 | Angela Davis | 2 | Aviation | A | Near tier boundary |
| 10011 | Richard Chen | 3 | Water | A | Married |
| 10012 | Patricia Moore | 1 | City Atty | A | Leave-payout eligible |

**Case distribution (18 total):**
- Priority: standard (8), high (4), urgent (3), low (3)
- SLA: on-track (14), at-risk (3), overdue (1)
- Assignees: Sarah Chen (9), James Wilson (3), Lisa Park (3), Michael Torres (3)
- Stages: 2-3 per stage across all 7 stages

**E2E verification:**
- Member search: 11+ results for query "a" (12 total members)
- Case stats: 18 active cases, 4 at-risk, all 7 stages populated
- SLA stats: on-track 14, at-risk 3, overdue 1, avg 23.9 days
- Docker: 25 init scripts, zero SQL errors, all 9 services healthy

**Issues encountered + fixed:**
1. Member ID conflict: `008_additional_seed.sql` already used IDs 10004-10005 — shifted new members to 10006-10012
2. `sla_deadline_at` NOT NULL constraint — migration 011 makes it NOT NULL after backfill, so new inserts must provide it inline

**Tests:** 355 frontend (unchanged), TypeScript clean, all Go services healthy

---

## Docker Rebuild + E2E Dashboard Verification — Session 8 (2026-03-14)

**Branch:** `claude/adoring-nobel`
**Goal:** Rebuild Docker images with Session 7 (PR #52) code, verify dashboards and member search render live API data end-to-end.

**What was done:**
- Repository cleanup: removed 5 stale worktrees, 7 merged local branches, 11 merged remote branches, killed 4 orphaned Node processes
- Docker rebuild: stopped stale `noui-platform` stack (12hrs old, missing stats/SLA/search endpoints), rebuilt all 9 images, fresh `docker compose up`
- Backend smoke tests: all 4 new endpoints returning valid JSON via direct port and nginx proxy
- Frontend E2E: verified SupervisorDashboard, ExecutiveDashboard, and MemberSearch with live data — zero console errors, zero network failures

**E2E Results:**
| View | Verified |
|------|----------|
| SupervisorDashboard | KPIs (6 active, 0 at-risk), Caseload by Stage (6 stages × 1 case), Team Performance table, Pending Approvals (0) |
| ExecutiveDashboard | On-Time Rate 100.0%, Avg Processing 13.4d, SLA Health Breakdown stacked bar, DQ 8 open / 98.6% score |
| MemberSearch | "Martinez" → Robert Martinez (10001, T1, Public Works), dropdown with keyboard nav |

**Repository state after cleanup:**
- Branches: 2 (main + claude/adoring-nobel)
- Remote branches: 1 (origin/main)
- Worktrees: 2 (main + adoring-nobel)
- 7 empty directory shells remain locked by Windows processes (clear on reboot)

**Tests:** 355 frontend (unchanged), TypeScript clean, all Go services healthy
**No code changes required** — full integration worked on first attempt after rebuild.

---

## Data Quality Dashboard + Recharts Migration — Session 6 (2026-03-13)

**Branch:** `claude/xenodochial-herschel`
**Goal:** Add DQ visualization charts (score trend, category breakdown) to DataQualityPanel, write tests for existing DQ components, and migrate all hand-rolled SVG charts to Recharts.

**What was built:**
- Installed Recharts as the standard charting library for the frontend
- `DQScoreTrendChart` — AreaChart with sage gradient fill, coral 95% reference line, custom tooltip
- `DQCategoryChart` — Horizontal BarChart with per-category colors (sage/sky/gold), capitalize labels
- Wired both charts into `DataQualityPanel` (trend between KPI cards and checks, category below)
- Migrated `BenefitProjectionChart` from hand-rolled SVG to Recharts AreaChart (3 gradient series)
- Migrated `ContributionBars` from hand-rolled SVG to Recharts stacked BarChart (employer/employee)
- RingGauge left as raw SVG (radial gauge not a Recharts pattern)

**New files (6):**
- `frontend/src/components/admin/DQScoreTrendChart.tsx`
- `frontend/src/components/admin/DQCategoryChart.tsx`
- `frontend/src/components/admin/__tests__/DQScoreTrendChart.test.tsx` (4 tests)
- `frontend/src/components/admin/__tests__/DQCategoryChart.test.tsx` (3 tests)
- `frontend/src/components/admin/__tests__/DataQualityPanel.test.tsx` (10 tests)
- `frontend/src/components/dashboard/__tests__/DataQualityCard.test.tsx` (6 tests, rewritten)

**Modified files (5):**
- `frontend/src/components/admin/DataQualityPanel.tsx` — imports + chart wiring
- `frontend/src/components/portal/BenefitProjectionChart.tsx` — Recharts migration
- `frontend/src/components/portal/ContributionBars.tsx` — Recharts migration
- `frontend/src/components/portal/__tests__/BenefitProjectionChart.test.tsx` — Recharts test updates
- `frontend/src/components/portal/__tests__/ContributionBars.test.tsx` — Recharts test updates

**Tests:** 327 → 334 (+7 net new: 4 trend, 3 category, 10 panel, 6 card = 23 new tests, 16 replaced)
**Design system:** All charts use "Institutional Warmth" palette (sage, coral, gold, sky) from `designSystem.ts`
**Recharts jsdom note:** ResponsiveContainer renders at 0 width in jsdom — tests check container presence, not SVG text content

---

## Dashboard Aggregation API + Member Search — Session 2 of Production Foundations (2026-03-13)

**PR:** #50 (merged)
**Goal:** Build aggregation queries for supervisor/executive dashboards and add member search to the dataaccess service.

**What was built:**
- `GET /api/v1/cases/stats` — case metrics aggregation (by stage, status, priority, assignee) with at-risk count using 20% SLA proportional thresholds
- `GET /api/v1/cases/stats/sla` — SLA health metrics (on-track/at-risk/overdue buckets, avg processing days)
- `GET /api/v1/cases?stage=X` — stage filter on existing ListCases endpoint for approval queue views
- `GET /api/v1/members/search?q={query}&limit=10` — member search by name (ILIKE) or member ID, limit cap at 50
- Migration 012: functional index on `LOWER(last_name), LOWER(first_name)` for search performance
- Docker Compose updated with migration 012

**New files:**
- `platform/casemanagement/db/stats.go` — GetCaseStats (5 SQL queries) + GetSLAStats (FILTER WHERE bucketing)
- `platform/casemanagement/db/stats_test.go` — 4 tests (with-data, empty, mixed-SLA, no-cases)
- `domains/pension/schema/012_member_search_index.sql`

**Modified files:**
- `platform/casemanagement/models/types.go` — CaseStats, SLAStats, SLAThresholds + 4 supporting types
- `platform/casemanagement/db/cases.go` — stage filter in ListCases
- `platform/casemanagement/api/handlers.go` — GetCaseStats + GetSLAStats handlers, route registration
- `platform/dataaccess/models/member.go` — MemberSearchResult type
- `platform/dataaccess/api/handlers.go` — SearchMembers handler

**Tests:** 78 → 86 casemanagement (+8), 39 → 44 dataaccess (+5), 327 frontend (unchanged)
**Roadmap:** Session 2 of 8. Next: Session 3 — Wire Live Dashboards + Member Search UI.

---

## Case Management Enrichment — Session 1 of Production Foundations (2026-03-13)

**PR:** #48 (merged)
**Goal:** Add case notes, document metadata, and SLA deadline tracking to the case management Go service.

**What was built:**
- Migration `011_case_enrichment.sql`: `case_note` table, `case_document` table, `sla_target_days`/`sla_deadline_at` columns on `retirement_case`
- Notes CRUD: `CreateNote`, `ListNotes`, `DeleteNote`, `NoteCount` in `db/notes.go`
- Documents CRUD: `CreateDocument`, `ListDocuments`, `DeleteDocument`, `DocumentCount` in `db/documents.go`
- 6 new HTTP routes: GET/POST/DELETE for `/cases/{id}/notes` and `/cases/{id}/documents`
- SLA logic: priority-based target days (urgent=30d, high=60d, standard=90d), deadline computed on `CreateCase`
- `GET /cases/{id}` enriched to return `CaseDetail` with `noteCount` and `documentCount`
- Seed data: 13 notes + 9 document records across all 4 demo cases
- Docker Compose updated with migrations 010 (summary_log) + 011 + enrichment seed

**Tests:** 52 → 78 Go tests (+26 new: 10 notes, 8 documents, 8 updated for SLA/enrichment)
**Files:** 7 modified, 6 new (892 insertions, 16 deletions)

**Roadmap:** This is Session 1 of 8 in the Production Foundations plan (`.claude/plans/merry-stirring-ritchie.md`). Next: Session 2 — Dashboard Aggregation API + Member Search.

---

## Universal Drill-Down Overlays (2026-03-13)

**Result:** Every card with repeating records now has a click-to-drill-down overlay. Shared shell component eliminates duplication across 7 overlay types. Search/filter added to 4 cards.

**Architecture:**
- Shared `DetailOverlay` shell (backdrop, spawn animation, keyboard nav, prev/next, header slots, scrollable body, optional footer)
- Helper components: `MetadataGrid`, `Section`, `StatusBadge`
- 2 existing overlays refactored to use shared shell (InteractionDetailPanel, ConversationDetailOverlay)
- 5 new detail overlays created

**New overlays:**
| Overlay | Card | Features |
|---------|------|----------|
| CorrespondenceDetail | CorrespondenceHistoryCard | Status badge, merge fields table, body preview, search input |
| BeneficiaryDetail | BeneficiaryCard | Type badge (Primary/Contingent/Death Benefit), DOB with age, allocation % |
| DQIssueDetail | DataQualityCard | Severity filter (All/Critical/Warning/Info), inline Acknowledge/Resolve/False Positive actions |
| CommitmentDetail | CommitmentTracker | Two-click Fulfill (with note input), Cancel action, search input |
| OutreachDetail | OutreachQueue | Attempt/Complete/Defer actions, talking points, max-attempts warning, search input |

**Files created (10):** `DetailOverlay.tsx`, 5 detail components + 5 test files
**Files modified (5):** InteractionDetailPanel, ConversationDetailOverlay, CorrespondenceHistoryCard, BeneficiaryCard, DataQualityCard, CommitmentTracker, OutreachQueue
**Tests:** 262 → 320 (58 new tests, 0 regressions)
**Verification:** 320/320 tests pass, 0 TS errors.

---

## Bug Fix Sweep: Bugs 1, 2, 4, 5 from E2E Testing (2026-03-12)

**Result:** Resolved 3 of 4 bugs from E2E workflow testing (Bug 4 was already fixed). All fixes in 2 files.

**Bugs fixed:**

| Bug | Description | Root Cause | Fix |
|-----|-------------|------------|-----|
| 1 | Rule sum = 0.00 in scenario stage | `useScenario()` hook never called; `ScenarioStage` never received data | Wire `useScenario()` in RetirementApplication, compute wait dates (+1/+2/+3yr), transform API response to ScenarioData shape |
| 2 | DRO stage marked completed on non-DRO case | Race condition: `computeInitialState()` fired when stages/flags were out of sync | Add guard: skip sync when `stages.some(s => s.id === 'dro') !== flags.hasDRO` |
| 4 | DRO seed data placeholder | Already fixed in prior session | No action — seed data has valid dates and positive division values |
| 5 | KB 404 for scenario stage | No KB article seeded for `scenario` stage | Added article + 2 rule references in `004_knowledgebase_seed.sql` |

**Files changed:**
- `frontend/src/components/RetirementApplication.tsx` — Bug 1 (useScenario wiring) + Bug 2 (DRO guard)
- `domains/pension/seed/004_knowledgebase_seed.sql` — Bug 5 (scenario KB article)

**Verification:** 262/262 frontend tests pass, 0 TS errors.

---

## Bug Fix Session — DRO Case-Scoping + Dead Field Cleanup, PR #39 (2026-03-12)

**Result:** Fixed 3 bugs found during E2E workflow testing. Primary fix: `CalculatePaymentOptions` and `CalculateScenario` handlers now only fetch DRO data when `dro_id` is explicitly provided, matching the existing `CalculateBenefit` pattern.

**Bugs addressed:**
| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Bug 3: Inflated payment amounts ($85K+ vs ~$2,962) | `PaymentOptions` and `Scenario` handlers unconditionally fetched DRO per-member, not per-case | Added optional `DROID *int` to request types; DRO fetch now conditional on `dro_id` presence |
| Bug 1: Rule sum = 0.00 display | Frontend had dead optional fields with broken fallback chains | Removed `is_vested`, `eligible_normal`, `rule_of_75_sum`, `rule_of_85_sum`, `reduction_percentage` from `EligibilityResult` type |
| Bug 2: DRO stage on non-DRO case | Already fixed in `stageMapping.ts:152` | Confirmed with regression tests — no action needed |

**Files changed (10):** `handlers.go`, `types.go` (intelligence), `EligibilityStage.tsx`, `fixtures.ts`, `useBenefitCalculation.ts`, `api.ts`, `mergeFieldResolver.ts`, `BenefitCalculation.ts`

**Verification:** 21/21 Go intelligence tests, 262/262 frontend tests, 0 TS errors.

**Docker E2E verified (2026-03-12):**
- `POST /benefit/options` (no `dro_id`): base_amount = **$2,962.01** (was $85K+ pre-fix)
- `POST /benefit/options` (`dro_id=1`): base_amount = **$2,213.35** (DRO-adjusted, ~74.7% marital fraction)
- `POST /benefit/scenario` (no `dro_id`): $2,996.35 / $3,047.87 (non-DRO)
- `POST /benefit/scenario` (`dro_id=1`): same amounts (DRO applies at payment level, not benefit calc)

---

## Post-Correspondence Follow-Up (2026-03-12)

**Result:** Completed 4 follow-up items from the correspondence enrichment work (PRs #35–#37).

**Changes:**
| Item | Description |
|------|-------------|
| Case Journal case-scoped query | `CaseJournalPanel` now accepts optional `caseId` prop; uses `useCaseCorrespondence(caseId)` when available, falls back to `useCorrespondenceHistory(memberId)` |
| act() warning fix | 9 act() warnings eliminated across RetirementApplication (6) and StaffPortal (1) tests by wrapping async assertions in `waitFor()` |
| Docker E2E re-validation | Clean `docker compose down -v && up --build` + correspondence_e2e.sh — all 5 test suites passing |
| BUILD_HISTORY.md | Added entries for PRs #35–#37 below |

**Verification:** 262/262 frontend tests pass, 0 TS errors, 0 act() warnings, E2E suite green.

---

## Correspondence Enrichment — Tasks D+E, PR #37 (2026-03-12)

**Result:** Migrated `caseId` from INTEGER to TEXT across full stack. Implemented `on_send_effects` execution in CorrespondencePanel (create_commitment, advance_stage notifications).

**Changes:**
- Migration 009: `ALTER COLUMN case_id TYPE TEXT` on correspondence_history + index
- Seed 010: Associate existing correspondence with string case IDs (RET-2026-0001)
- Go correspondence service: case_id parameter now TEXT in queries
- Frontend: `useCorrespondenceSend` mutation executes `on_send_effects` after send — create_commitment (via CRM API), advance_stage (notification only)
- `useCaseCorrespondence(caseId: string)` hook added for case-scoped queries
- 12 new sendEffects unit tests

**Verification:** 274 frontend tests (262 + 12 sendEffects), 17 Go tests, 0 TS errors.

---

## Correspondence Enrichment — Task C, PR #36 (2026-03-12)

**Result:** Docker integration and E2E test suite for correspondence. Wired migrations 008/009 (stage_category enrichment) and 009/010 (caseId TEXT) into Docker Compose init sequence.

**Changes:**
- Docker Compose: 18 init scripts (schema + seed) in correct execution order
- E2E test script: `tests/e2e/correspondence_e2e.sh` — 5 test suites, 27 assertions
  - Schema verification (stage_category column)
  - Letter generation with merge fields
  - Correspondence → CRM bridge
  - Stage-filtered template queries (6 stages)
  - Case-scoped history (caseId TEXT filtering)

**Verification:** All 5 E2E suites pass on clean Docker start.

---

## Correspondence Enrichment — Tasks A+B, PR #35 (2026-03-12)

**Result:** Integrated correspondence across CRM, portals, and workflow. Stage-mapped templates, merge field auto-populate, CRM logging on send, and portal correspondence tabs.

**Changes:**
- Backend: `stage_category` + `on_send_effects` columns on `correspondence_template`
- 9 stage-mapped templates (intake, verify-employment, eligibility, election, submit, dro)
- `mergeFieldResolver.ts`: 30+ field auto-populate mappings from case context
- Enhanced `CorrespondencePanel`: auto-populate merge fields, CRM interaction logging on send
- Stage-triggered correspondence prompts after workflow advance (`stageCorrespondenceMapping.ts`)
- Member Portal "Letters" tab, Employer Portal "Correspondence" tab
- Case Journal correspondence tab (member-scoped)
- `case_id` filtering added to correspondence history API

**Verification:** 262 frontend tests, 17 Go tests, 0 TS errors.

---

## Tenant-Scoping for Case Management, PR #34 (2026-03-12)

**Result:** Added tenant isolation to case management handlers and fixed test mock column mismatch from PR #30's `dro_id` migration.

**Changes:**
- Threaded `tenantID` from request headers into `GetCase`, `UpdateCase`, and `AdvanceStage` handlers
- Added `GetCaseByID` for unscoped post-create re-fetch
- Fixed test mocks: `caseCols` and `addCaseRow` helpers updated from 17→18 columns (adding `dro_id`)
- Expanded test coverage for tenant isolation scenarios
- Cleaned up `apiClient.ts` (21 lines removed)

**Files changed (5):** `handlers.go`, `handlers_test.go`, `cases.go`, `cases_test.go` (casemanagement), `apiClient.ts`

**Verification:** 52/52 casemanagement tests (32 handler + 20 db), 0 TS errors.

---

## Frontend Polish + Send-Message E2E (2026-03-12)

**Result:** Fixed NaN SVG warnings in 2 chart components, implemented bidirectional enum normalization in API client, fixed conversation auto-select bug in portals, verified send-message E2E.

**Fixes:**
| Component | Bug | Fix |
|-----------|-----|-----|
| `BenefitProjectionChart.tsx` | `Math.max(...[0,0,0]) * 1.12 = 0` → NaN in SVG coords | Guard `max` to minimum 1; early return for `< 2` data points |
| `ContributionBars.tsx` | `Math.max(...[0,0,0]) = 0` → NaN in rect height/y | Guard `max` to minimum 1 |
| `apiClient.ts` | Go/PostgreSQL returns UPPERCASE enums, TS expects lowercase | Added `uppercaseEnums` (outgoing) + `lowercaseEnums` (incoming) |
| `MemberPortal.tsx` | `useMemberPublicInteractions(selectedConvId)` called with empty string, not `effectiveConvId` | Moved hook call after `effectiveConvId` computation |
| `EmployerPortal.tsx` | Same auto-select bug as MemberPortal | Same fix — use `effectiveConvId` |

**New tests:** `frontend/src/components/portal/__tests__/`
- `BenefitProjectionChart.test.tsx` — 3 tests (zero data, empty data, normal data)
- `ContributionBars.test.tsx` — 3 tests (zero data, empty data, normal data)

**E2E Verification (Docker + Vite dev server):**
- POST `/api/v1/crm/interactions` → 201 Created (enum normalization works)
- Message appears in Member Portal conversation thread immediately
- Message appears in Staff Portal CRM interaction timeline with correct direction (Inbound) and channel (Message)
- React Query cache invalidation triggers proper re-fetch after send

**Verification:** 235/235 tests pass, 0 TS errors

---

## Case Management Go Tests — 52/52 Pass (2026-03-11)

**Result:** Added db-level Store tests and handler edge case tests for the case management service. Total test count: 52 (32 handler + 20 db-level).

**New test files:**

| File | Tests | Coverage |
|------|-------|----------|
| `db/cases_test.go` | 17 | ListCases (5 filter combos), GetCase (null member, not found), AdvanceStage (final stage, success, not found), GetStageHistory (DESC ordering), GetCaseFlags (empty, multiple), CreateCase (with/without flags), UpdateCase (no-op, multi-field) |
| `db/stages_test.go` | 3 | ListStages (all 7 stages), GetStage (valid, not found) |

**New handler edge cases (in `api/handlers_test.go`):**

| Test | What It Validates |
|------|-------------------|
| TestListCases_FilterCombination | HTTP with combined status + priority query params |
| TestAdvanceStage_FinalStage_HTTP | HTTP 400 with ADVANCE_ERROR when case at final stage |
| TestGetCase_NullMemberJoin | HTTP 200 with COALESCE defaults for missing member data |
| TestListCases_WithAssignedToFilter | assigned_to query parameter flows through to Store |

**Other changes:**
- Promoted `go-sqlmock` from indirect to direct dependency in `go.mod`
- Ran `go mod tidy`

**Verification:** `go test ./... -v -count=1` → 52/52 pass (api: 32, db: 20)

---

## E2E Workflow Testing — All 4 Cases Completed (2026-03-11)

**Result:** Full end-to-end browser testing of the 7-stage retirement workflow. All 4 seeded cases advanced to Final Certification via live Docker stack. 14 audit trail entries verified.

**Cases tested:**
| Case | Member | Path | Key Validation |
|------|--------|------|----------------|
| RET-2026-0159 | David Washington (T3) | Stage 1→6, full path | Auto-skip Marital Share (2 POSTs in 17ms) |
| RET-2026-0152 | Jennifer Kim (T2) | Stage 2→6 | Auto-skip + purchased service in calc (21.17y vs 18.17y earned) |
| DRO-2026-0031 | Robert Martinez DRO (T1) | Stage 3→6 | DRO Division NOT skipped (single POST, no auto-skip) |
| RET-2026-0147 | Robert Martinez (T1) | Stage 4→6, short path | 2 advances to Certification |

**Stage advancement verified:**
- Single-step advances work correctly
- Auto-skip fires sequential POSTs (~16ms apart) with "Stage not applicable for this case" audit note
- DRO flag correctly prevents auto-skip of Marital Share stage
- Frontend-only stages (Salary & AMS, Scenario Comparison) advance UI without backend calls
- Certify & Submit button wired and working (8/8 confirmed for all cases)
- Audit trail: 14 transitions total, all with correct from/to stages, timestamps, transitionedBy

**Bugs found:**
1. **Rule sum display = 0.00** (intelligence API) — Rule of 75/85 displays "0.00" instead of actual age+service sum. Determination (Met/Not Met) and reduction calculations are correct — display-only bug.
2. **DRO stage on non-DRO case** (frontend) — RET-2026-0147 (flags: leave-payout only) shows DRO Division as completed stage. `computeInitialState()` likely includes DRO when backend stageIdx > 3 regardless of flags.
3. **Payment amounts inflated** (intelligence API) — Standard Robert Martinez case shows DRO-adjusted amounts ($85K+ vs expected $2,962). Intelligence service returns DRO data per-member not per-case.
4. **DRO seed data placeholder** — Marriage dates "12/31/1", negative marital fractions. Expected — DRO engine not implemented.
5. **KB 404 for scenario stage** — `/api/v1/kb/stages/scenario` returns 404. Expected — no KB article for frontend-only stage.

**Data accuracy verified:**
- Jennifer Kim: 27% early retirement reduction correct (T2: 3%/yr × 9yr under 65)
- Jennifer Kim: Purchased service (3y) in benefit calc, excluded from IPR ✓
- David Washington: T3 60-month AMS window, 1.5% multiplier ✓
- Robert Martinez: T1 36-month AMS window, 2.0% multiplier ✓

---

## Housekeeping Sprint (2026-03-11)

**Result:** Cleaned up accumulated debt from rapid feature development.

**Changes:**
- Deleted orphaned `MemberDetailsCard.tsx` (zero imports since PR #25 progressive disclosure refactor)
- Closed stale PR #2 (`claude/upbeat-hellman` — "Add interaction detail panel with spawn animation") — superseded by existing InteractionDetailPanel in main
- Deleted remote branch `origin/claude/upbeat-hellman`

**Previously reported issues now resolved:**
- useMemberDashboard commitments crash — fixed in PR #21 (commit c35f7f0)
- React act() warnings — no act() calls exist; tests use renderWithProviders pattern

**Verification:** 222/222 frontend tests pass, TypeScript clean.

---

## Option F: Wire useAdvanceStage — Backend-Connected Stage Workflow (2026-03-11)

**Result:** Frontend RetirementApplication stage navigation now persists to the backend case management API. Three bugs fixed, stage mapping translation layer created.

**Bug Fixes:**
- **Bug #2 (SubmitStage.tsx):** "Certify & Submit" button had no `onClick` handler — added `onSubmit` prop wired to `advance()`
- **Bug #3 (handlers.go):** Advance endpoint accepted empty `transitionedBy`, creating blank audit entries — added server-side validation

**Stage Mapping Translation Layer (`stageMapping.ts`):**
- Maps between 7-9 dynamic frontend stages and 7 fixed backend stages
- Auto-skip logic: non-DRO cases auto-advance through Marital Share (backend stage 3) with audit note
- Frontend-only stages (`salary-ams`, `scenario`) advance UI position without backend calls
- 5 exported functions: `getBackendStageIdx`, `isAutoSkipStage`, `computeAdvanceSequence`, `frontendIdxFromBackendIdx`, `computeInitialState`
- 25 unit tests covering all mapping functions and edge cases

**RetirementApplication.tsx Wiring:**
- Initializes stage position from backend `caseData.stageIdx` on load
- Re-syncs when stage count changes (handles DRO flag resolving late from calculation API)
- `advance()` is now async — computes advance sequence, fires sequential `POST /advance` calls
- "Saving..." indicator shown during backend mutations

**Verification:**
- Browser: Robert Martinez (Stage 8/8 Final Certification) — correct for backend stage 6
- Browser: Jennifer Kim — clicked Confirm & Continue at Eligibility, auto-skip fired 2 POST /advance calls (2→3, 3→4), backend history shows "Stage not applicable for this case"
- 222/222 frontend tests pass, Go build+vet clean, zero console errors

**Files changed:** 5 modified, 2 new (`stageMapping.ts`, `stageMapping.test.ts`)

---

## PR #19: Case Management + CRM Polish + Dashboard Tests — MERGED (2026-03-10)

**Result:** Three workstreams delivered in a single PR. All 9 CI checks green. Docker Compose verified with 10 services + PostgreSQL.

**Workstream A — CRM Polish:**
- Wired Member Portal messaging to live CRM API (replaced demo hooks)
- Added `conversationId` filter support to backend `ListInteractions` handler

**Workstream B — Case Management Service:**
- New Go service `platform/casemanagement/` (port 8088) — 8 API endpoints, 7-stage workflow
- Schema: `case_stage_definition`, `retirement_case`, `case_flag`, `case_stage_history`
- 3-table JOIN queries enrich cases with member name, tier, department
- Frontend: React Query hooks, new types, nginx proxy routes
- `fetchPaginatedAPI` bugfix in `apiClient.ts` (was losing pagination metadata)
- Deleted `demoData.ts` (fully replaced by live APIs)

**Workstream C — Dashboard Testing:**
- 71 new component tests across 5 dashboard cards + 7 workflow stages
- Shared test fixtures for consistent test data

**Test results:** 197/197 frontend tests pass, all Go services build and vet clean, 9/9 CI checks pass.

**Docker verification (2026-03-10):**
- All 12 PostgreSQL init scripts ran in order (001-012)
- All 10 containers started healthy (postgres, 7 Go services, connector, frontend)
- `GET /api/v1/cases` returns 4 seeded cases with correct member JOINs
- Staff Portal work queue renders all 4 cases at http://localhost:3000

**Status:** PR merged to main. Full-stack integration complete.

---

## Phase 5: Full Stack Verification & Cleanup — DONE (2026-03-08)

**Result:** Full-stack integration verified end-to-end. All 8 Member Dashboard cards render live data from PostgreSQL-backed Go services (except work queue, which has no backend).

**Verification results:**
- 43/43 frontend tests pass
- All 6 Go service test suites pass (dataaccess, intelligence, crm, correspondence, dataquality, knowledgebase)
- UI walkthrough: members 10001 (Robert Martinez), 10002 (Jennifer Kim), 10003 (David Washington) — all dashboard cards display correct live data
- Zero console errors across all navigation

**Cleanup:**
- Removed dead demo exports: `DEMO_CORRESPONDENCE`, `DEMO_DQ_ISSUES`, `DemoCorrespondence`, `DemoDataQualityIssue` from `demoData.ts`
- Added clarifying comments to `crmDemoData.ts` (portal messaging still uses demo data)
- Updated `INTEGRATION_PLAN.md` progress table — all 5 phases marked complete

**What still uses demo data:**
- `WORK_QUEUE` + `STAGES` in `demoData.ts` — no backend service exists for case management
- `crmDemoData.ts` — cross-portal messaging (conversations, staff notes, member messages)

**Status:** Integration complete. All phases done.

---

## Phase 4: Data Quality Integration — DONE (2026-03-08)

**Result:** Member Dashboard DQ card now shows live data from the Data Quality Go service (port 8086).

**Changes made:**
- `frontend/src/hooks/useDataQuality.ts` — New React Query hooks (`useDQScore`, `useMemberDQIssues`)
- `frontend/src/hooks/useMemberDashboard.ts` — Wire real DQ hooks, remove `DEMO_DQ_ISSUES`
- `frontend/src/components/dashboard/DataQualityCard.tsx` — Hybrid layout: org-wide score + per-member issues
- `frontend/src/components/dashboard/MemberDashboard.tsx` — Pass new props to card
- `domains/pension/seed/005_dataquality_seed.sql` — Added 4 member-specific DQ issues

**Design decision:** Hybrid approach — org-wide quality score at top, per-member issues filtered by matching `recordId` to `memberId`.

**Status:** Phase 4 complete. 43 frontend tests pass.

---

## Phase 3: Correspondence Integration — DONE (2026-03-08)

**Result:** Member Dashboard correspondence card now shows live data from the Correspondence Go service (port 8085).

**Changes made:**
- `frontend/src/hooks/useCorrespondence.ts` — New `useCorrespondenceHistory()` hook using React Query + `correspondenceAPI.listHistory()`
- `frontend/src/hooks/useMemberDashboard.ts` — Wire real hook, remove `DEMO_CORRESPONDENCE`
- `frontend/src/components/dashboard/CorrespondenceHistoryCard.tsx` — Adapted to real `Correspondence` type
- `domains/pension/seed/006_correspondence_seed.sql` — Added 4 correspondence history records for demo members

**Design decision:** Hard-switch to API only (no demo fallback), consistent with Phase 2.

**Status:** Phase 3 complete. 43 frontend tests pass.

---

## Phase 2: CRM Integration — DONE (2026-03-08)

**Result:** Member Dashboard CRM data now flows from PostgreSQL via CRM Go service instead of in-memory demo data.

**Changes made:**
- `frontend/src/lib/crmApi.ts` — Fixed URL: `contacts/legacy/` → `contacts-by-legacy/` (matched Go route)
- `frontend/src/hooks/useCRM.ts` — Switched 3 portal hooks from `demo.*` to `crmAPI.*`
- `frontend/src/components/dashboard/InteractionHistoryCard.tsx` — `.toLowerCase()` for enum lookups (Go=UPPERCASE)
- `frontend/src/hooks/useMemberDashboard.ts` — Updated comment

**Design decision:** Hard-switch to API only (no demo fallback).

**Issues found & fixed:** URL mismatch, case mismatch (Go UPPERCASE vs JS lowercase), type mismatch on commitments response.

**Status:** Phase 2 complete. 43 frontend tests pass. Ready for Phase 3.

---

## Phase 1: Docker Smoke Test — PASSED (2026-03-08)

**Result:** All 6 backend services + PostgreSQL + nginx frontend boot and respond correctly via Docker Compose.

**What happened:**
- All 7 Docker images built successfully (6 Go services + nginx frontend)
- PostgreSQL initialized all 10 init scripts (5 schema + 5 seed) without errors
- All 6 health endpoints returned `{"status":"ok"}`:
  - dataaccess `:8081`, intelligence `:8082`, crm `:8084`, correspondence `:8085`, dataquality `:8086`, knowledgebase `:8087`
- Real data verified: `GET /api/v1/members/10001` → Robert Martinez (Senior Engineer, Public Works)
- Nginx proxy verified: `GET localhost:3000/api/v1/members/10001` → same response proxied through nginx

**Issues found:**
1. **Port conflict** — Previous worktree (`gallant-varahamihira`) had a Docker stack running on the same ports (5432, 3000, 8081, 8084-8087). Resolved by stopping the old stack with `docker compose -p gallant-varahamihira down -v`.
2. **`version` attribute warning** — `docker-compose.yml` uses deprecated `version: '3.8'` attribute. Non-blocking, cosmetic only.
3. **Frontend npm install required** — `tsc` not found on host without `npm install` first. Not an issue in Docker (uses `npm ci`).

**No code changes required.** The entire stack worked on first boot after clearing port conflicts.

**Status:** Phase 1 complete. Ready for Phase 2 (CRM Integration).

---

## Planning: Full-Stack Integration (2026-03-08)

**Decision:** Connect frontend to all 6 Go backend services via Docker Compose, replacing in-memory demo data with live PostgreSQL-backed API calls.

**Current state assessed:**
- Member data + benefit calc hooks already call real APIs (dataaccess :8081, intelligence :8082)
- CRM, correspondence, and data quality hooks use demo data despite real API clients existing
- All Docker infrastructure in place: Dockerfiles, compose, nginx proxy, seed data for all 6 services
- Zero blockers identified for Docker smoke test

**Plan:** 5 phases across multiple sessions:
1. Docker smoke test — boot all services, fix issues
2. CRM integration — switch from `crmDemoData.ts` to live CRM API
3. Correspondence integration — switch from `DEMO_CORRESPONDENCE` to live API
4. Data quality integration — switch from `DEMO_DQ_ISSUES` to live API
5. Full verification — end-to-end testing, cleanup, documentation

**Artifacts created:**
- `docs/INTEGRATION_PLAN.md` — master plan with tasks, decisions, file lists
- `.claude/prompts/integration-phase{1-5}-*.md` — session starter prompts for each phase

**Status:** Planning complete. Ready for Phase 1 (Docker smoke test).

---

## Migration: Repository Consolidation (2026-03-07)

**Decision:** Consolidated two tangled repositories (`noui-derp-poc` + `noui-connector-lab`) into a single production-ready monorepo.

**Problem:** Both repos shared git history, contained each other's code, and had conflicting CLAUDE.md files. This caused merge conflicts, identity confusion in Claude Code sessions, and 17 orphaned worktrees.

**Sources:**
- Connector infrastructure from `noui-connector-lab` (session 12, 103 tests, Go 1.26)
- Platform services from `noui-connector-lab` (6 Go microservices, Go 1.22)
- Frontend from `noui-connector-lab` (88 React/TypeScript components)
- Domain data from `noui-connector-lab` (pension schemas, rules, demo cases)

**Key changes:**
- `services/connector/` renamed to `platform/dataaccess/` (eliminates naming confusion with `connector/`)
- Go module paths updated from `github.com/noui/derp-poc/*` and `github.com/noui/connector-lab` to `github.com/noui/platform/*`
- `database/` moved to `domains/pension/schema/` + `domains/pension/seed/`
- `rules/` moved to `domains/pension/rules/`
- `compose-sim/` moved to `tools/compose-sim/`
- `prototypes/` archived to `docs/prototypes/`
- Docker service name `connector` → `dataaccess` (docker-compose, nginx, helm)
- Added GitHub Actions CI
- Added `.claude/settings.json` with guardrails

**Archived repos:**
- Previous connector lab history: see `docs/prototypes/BUILD_HISTORY_connector-lab.md` (sessions 1-12)
- Previous DERP POC history: see `docs/prototypes/BUILD_HISTORY_archived.md`

**Status:** Migration complete. All Go modules build. Frontend builds. Docker compose validates.

---

_Future entries go above this line, newest first._
