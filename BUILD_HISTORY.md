# noui-platform — Build History

## Phase 2: CRM Integration (2026-03-10)

**Goal:** Switch Member Dashboard CRM data from in-memory demo to live PostgreSQL-backed CRM API.

**What changed:**
- `frontend/src/hooks/useCRM.ts` — 3 portal hooks now call live CRM API with demo fallback via `VITE_USE_DEMO_CRM` env toggle:
  - `useContactByMemberId()` → `crmAPI.getContactByLegacyId()`
  - `useFullTimeline()` → `crmAPI.getContactTimeline()`
  - `useContactCommitments()` → `crmAPI.listCommitments()` with array/paginated response handling
- `frontend/src/lib/crmApi.ts` — Fixed URL mismatch: `contacts/legacy/{id}` → `contacts-by-legacy/{id}` to match Go CRM router
- `frontend/vite.config.ts` — Dynamic port (`process.env.PORT || '5173'`) to avoid conflict with Docker frontend on port 3000

**Decision made:** Keep demo data as development fallback. Set `VITE_USE_DEMO_CRM=true` in `.env.local` to use demo data when Docker stack isn't running. Default behavior: live API.

**Issues found and fixed:**
- CRM API URL mismatch between `crmApi.ts` and Go router (`contacts/legacy` vs `contacts-by-legacy`)
- Commitments API returns flat array after `fetchAPI` unwraps `{ data }` envelope, not paginated wrapper — added `Array.isArray` guard with fallback
- Vite port 3000 conflicted with Docker nginx container

**Verification:**
- 43/43 frontend tests pass
- Member Dashboard shows 3 live interactions from PostgreSQL (was 4 demo entries)
- All 3 CRM API calls confirmed via performance resource entries
- Zero console errors on clean session

**Status:** Phase 2 complete. Ready for Phase 3 (Correspondence Integration).

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
