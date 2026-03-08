# Phase 1: Docker Smoke Test

## Goal

Prove all 6 backend services + PostgreSQL + frontend can boot together via Docker Compose. Fix any build or startup failures. Verify data flows from PostgreSQL through Go services to nginx.

## Context

Read `docs/INTEGRATION_PLAN.md` for the full plan. This is Phase 1 of 5.

## Entry Criteria

- None. This is the starting phase.

## Tasks

1. Run `/session-start` to verify builds
2. Run `docker compose up --build` from repo root
3. Watch for build failures — fix any Go compilation, dependency, or Docker issues
4. Verify PostgreSQL initializes (10 init scripts: 5 schema + 5 seed)
5. Hit health endpoints for all 6 services:
   - `curl http://localhost:8081/healthz` (dataaccess)
   - `curl http://localhost:8082/healthz` (intelligence)
   - `curl http://localhost:8084/healthz` (crm)
   - `curl http://localhost:8085/healthz` (correspondence)
   - `curl http://localhost:8086/healthz` (dataquality)
   - `curl http://localhost:8087/healthz` (knowledgebase)
6. Verify real data: `curl http://localhost:8081/api/v1/members/10001` → Robert Martinez
7. Verify nginx proxy: `curl http://localhost:3000/api/v1/members/10001` → same response
8. Document all issues found and fixes applied
9. Update `docs/INTEGRATION_PLAN.md` Phase 1 status
10. Update `BUILD_HISTORY.md`

## Exit Criteria

- All 6 services respond to health checks
- At least one data endpoint returns seeded data
- nginx proxy routes correctly
- All issues documented

## Likely Issues

- Go module version mismatches (connector=Go 1.26, platform=Go 1.22)
- Missing dependencies in go.sum
- PostgreSQL init script errors
- Docker networking / DNS resolution
- CORS configuration
