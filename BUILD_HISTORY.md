# noui-platform — Build History

## Security Hardening Session 2: Row-Level Security + CORS Lockdown (2026-03-15)

**Branch:** `claude/bold-albattani`
**Goal:** Implement PostgreSQL Row-Level Security (RLS) and lock down wildcard CORS, resolving F-009 (CRITICAL) and F-004 (MEDIUM) from the security review.

**What was built:**

### RLS Infrastructure (F-009 — CRITICAL → RESOLVED)

- **`domains/pension/schema/013_row_level_security.sql`** — 407-line migration enabling RLS on 35 content tables with FORCE ROW LEVEL SECURITY. Three policy tiers:
  - Direct: 17 tables with tenant_id column (retirement_case, crm_contact, etc.)
  - Child: 7 tables joined via parent FK (case_flag → retirement_case, etc.)
  - Legacy: 11 tables without tenant_id (member_master, salary_hist, etc.) — join through retirement_case with staff/member role branching
  - Supporting index: `idx_case_tenant_member` on `retirement_case(tenant_id, member_id)`
  - 3 reference tables excluded (department_ref, position_ref, case_stage_definition)

- **`platform/dbcontext/`** — New package for RLS connection scoping (122 lines, 7 tests)
  - `ScopedConn()` — acquires `*sql.Conn` from pool, calls `set_config('app.tenant_id', ...)` etc.
  - `DBMiddleware` — extracts auth claims → injects scoped conn into request context
  - `Querier` interface — satisfied by `*sql.DB`, `*sql.Conn`, `*sql.Tx` for transparent routing
  - `DB(ctx, fallback)` — single routing point: returns scoped conn if available, pool otherwise

- **Store migration** — All 6 DB services migrated to route queries through `dbcontext.DB(ctx, s.DB)`:
  - casemanagement: 25+ methods + handlers + all tests updated
  - crm: 10+ store files + handlers updated
  - correspondence, dataquality, knowledgebase: db/postgres.go + handlers updated
  - dataaccess: already used `dbcontext.DB()` directly in handlers

- **Middleware wiring** — `DBMiddleware` added to all 6 DB service `main.go` files. Middleware chain: CORS → Auth → DBContext → Logging → Handler

- **RLS integration tests** — 5 tests in `platform/dataaccess/db/rls_test.go` (skip with `-short`):
  - Tenant isolation (cases), member isolation (salary), staff visibility, wrong-tenant empty result, cross-tenant member blocking

### CORS Lockdown (F-004 — MEDIUM → RESOLVED)

- `connector/service/handlers.go` + `connector/dashboard/server.go` — replaced wildcard `*` CORS with `os.Getenv("CORS_ORIGIN")` defaulting to `http://localhost:3000`
- Added Authorization, X-Request-ID headers, credentials support, Max-Age caching
- Helm values updated for dataaccess and intelligence services

**New files:** `platform/dbcontext/` (go.mod, dbcontext.go, dbcontext_test.go), `domains/pension/schema/013_row_level_security.sql`, `platform/dataaccess/db/rls_test.go`, `docs/plans/2026-03-15-rls-cors-lockdown.md`

**Modified files:** 27+ files across 6 services (main.go, handlers, stores, tests)

**Tests:** All 7 platform services build and test clean. Frontend unaffected (794 tests, 0 regressions).

---

## Security Hardening Session 1: Auth Middleware + Structured Logging (2026-03-15)

**Branch:** `claude/silly-antonelli`
**Goal:** Add JWT authentication and structured logging to all 7 platform services as part of the comprehensive quality/security/performance review initiative.

**What was built:**
- `platform/auth/` — JWT HS256 middleware package (199 lines, 14 tests)
  - Validates Bearer token signatures, algorithm (HS256 only), and expiration
  - Extracts tenant_id, member_id, role, user_id from claims into request context
  - Strips spoofed `X-Tenant-ID` headers — tenant comes from token only
  - Health/readiness endpoints bypass auth
  - `NewMiddleware(secret)` constructor for testability
- `platform/logging/` — Structured JSON logging package (80 lines, 6 tests)
  - `Setup(serviceName)` creates JSON logger with service attribute
  - `RequestLogger` middleware logs method, path, status, duration_ms, request_id
  - `ContextExtractor` pattern for auth claims without coupling to auth package
  - `statusWriter` implements `http.Flusher` for SSE/streaming compatibility
- All 7 services wired: dataaccess, intelligence, crm, correspondence, dataquality, knowledgebase, casemanagement
  - Middleware chain: CORS → Auth → Logging → Handler
  - All `log.Printf` replaced with `slog.Info`/`slog.Error`/`slog.Warn`
  - `tenantFromHeader` replaced with context-aware `tenantID` helper (fallback for tests)

**New files (6):**
- `platform/auth/go.mod`, `platform/auth/auth.go`, `platform/auth/auth_test.go`
- `platform/logging/go.mod`, `platform/logging/logging.go`, `platform/logging/logging_test.go`

**Modified files (33):** All 7 services' main.go, api/handlers.go, db/postgres.go, go.mod

**Security findings documented:** 13 findings (F-001 through F-013) in `docs/SECURITY_FINDINGS.md`. 8 resolved in this session, 5 tracked for future sessions. Prevention rules added to CLAUDE.md.

**Design documents:**
- `docs/plans/2026-03-15-quality-security-performance-review-design.md`
- `docs/plans/2026-03-15-quality-security-performance-review-plan.md`

**Tests:** 794 frontend (0 regressions), 14 auth, 6 logging, all Go service tests pass
**TypeScript:** 0 errors

---

## Root Component Tests Batch 1 — Session 16 (2026-03-15)

**Branch:** `claude/infallible-knuth`
**PR:** #67 (merged)
**Goal:** Add test coverage for root-level components batch 1 — case/workflow orchestration, CRM contact panels, and benefit calculation display components.

**Key decision: Network-layer fetch mocking (not hook mocking)**
User directed that all tests should mock at the `fetch` boundary, not at the hook level. This means real hooks, React Query caching, and `apiClient.ts` enum normalization all run in tests. Props-based components need no mocking at all. This is the testing strategy going forward.

**What was built:**
- 45 new tests across 6 test files for root-level components
- CaseJournalPanel (8 tests) — cascading contact resolution via fetch mocks for 7+ API endpoints, tab switching between timeline/conversations/commitments/correspondence
- CommitmentTracker (7 tests) — paginated list rendering, search filtering, status badges, action buttons
- OutreachQueue (9 tests) — queue rendering, priority/status badges, max attempts warning, talking points
- InteractionTimeline (7 tests) — timeline entries, channel badges, direction indicators, duration formatting
- BenefitCalculationPanel (8 tests) — benefit display with CollapsibleSections, AMS, formula, reduction, leave payout
- IPRCalculator (6 tests) — IPR amounts, medicare/non-medicare highlighting, fractional service years

**New files (7):**
- `frontend/src/components/__tests__/CaseJournalPanel.test.tsx` — 8 tests
- `frontend/src/components/__tests__/CommitmentTracker.test.tsx` — 7 tests
- `frontend/src/components/__tests__/OutreachQueue.test.tsx` — 9 tests
- `frontend/src/components/__tests__/InteractionTimeline.test.tsx` — 7 tests
- `frontend/src/components/__tests__/BenefitCalculationPanel.test.tsx` — 8 tests
- `frontend/src/components/__tests__/IPRCalculator.test.tsx` — 6 tests
- `docs/session-starters/session17-root-components-batch2.md` — next session starter

**Testing patterns established:**
- `setupFetch()` helper for URL-pattern-based fetch mocking (reusable across test files)
- `renderWithProviders()` for components using React Query hooks
- `getAllByText()` for CollapsibleSection badge duplication (CSS grid `0fr` keeps content in DOM)
- Regex matchers for text split across elements

**Tests:** 508 → 592 (+45 new from Session 16, +39 from Session 15's PR merge, 0 regressions)
**TypeScript:** 0 errors

---

## Workflow Non-Stage Component Tests — Session 15 (2026-03-15)

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
