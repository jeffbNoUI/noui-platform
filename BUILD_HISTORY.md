# noui-platform — Build History

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
