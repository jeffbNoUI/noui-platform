# noui-platform — Build History

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
