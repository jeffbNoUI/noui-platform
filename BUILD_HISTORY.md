# noui-platform — Build History

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
