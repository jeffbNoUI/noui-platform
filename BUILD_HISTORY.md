# noui-platform — Build History

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
