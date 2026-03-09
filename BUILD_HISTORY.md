# noui-platform — Build History

## Phase 1 Complete: Docker Smoke Test (2026-03-08)

**Goal:** Prove all 6 backend services + PostgreSQL + frontend can boot together via Docker Compose.

**Results:**
- All 7 Docker images built successfully (Go services cached, frontend rebuilt)
- PostgreSQL 16: 35 tables created from 10 init scripts (5 schema + 5 seed)
- All 6 services connected to PostgreSQL and listening on correct ports
- Health checks: 6/6 services return 200 on `/healthz`
- Data verification: `GET /api/v1/members/10001` → Robert Martinez (confirmed)
- CRM verification: `GET /api/v1/crm/contacts-by-legacy/10001` → Robert Martinez contact with addresses
- Intelligence verification: `POST /api/v1/eligibility/evaluate` → Rule of 75, vested, 28.75yr service credit
- Nginx proxy: all 6 service paths route correctly through `localhost:3000/api/v1/*`

**Issues found:**
1. Port conflicts from stale `epic-knuth-*` containers (previous worktree). Resolved by stopping old containers.
2. UTF-8 mojibake in intelligence `tier_source` field — `§` and `→` characters garbled. Pre-existing encoding issue, non-blocking.
3. `docker-compose.yml` `version` attribute is obsolete — cosmetic warning, no impact.

**Status:** Phase 1 complete. Ready for Phase 2 (CRM integration).

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
