# Port Management Phase 1: Remove Host Ports + Port Registry — Starter Prompt

## Context

Migration Phase 5g is complete (PR #TBD). All Docker E2E suites pass: 166/166.

During Phase 5g Docker startup, we observed pgbouncer `query_wait_timeout` cascades
caused by 22+ services simultaneously binding host ports. This is the motivating
issue for port management cleanup.

### What Was Done in Phase 5g
- dbcontext stale connection recovery (systemic fix for all 17 services)
- Employer reporting: uploaded_by UUID extraction from JWT auth context
- Employer terminations: flexible date parsing (date-only + RFC3339)
- E2E: 3 skip tolerances removed, JWT regen with real portal user UUID,
  division code fix, jq path fix → 166/166 (up from 163)

### Full Plan
See `docs/plans/2026-03-22-port-management-phase1.md` for the complete plan.

## What Needs Doing (Port Management Phase 1)

### 1. Audit Direct Port References (Do First)

Before removing host ports, find all direct localhost:PORT references:

```bash
grep -rn 'localhost:80[89][0-9]' tests/ scripts/ docs/ frontend/ tools/
grep -rn 'localhost:81[0-9][0-9]' tests/ scripts/ docs/ frontend/ tools/
grep -rn 'localhost:80[89][0-9]' platform/ connector/
```

Any matches in test scripts or tooling must be updated to use nginx proxy
(`localhost:3000/api/v1/...`) or Docker DNS before proceeding.

### 2. Remove Host Port Mappings from docker-compose.yml

**Keep** `ports:` blocks only for:
- `frontend` (3000:80) — developer browser access
- `postgres` (5432:5432) — local DB tools
- `pgbouncer` (6432:6432) — local connection pooler access

**Remove** `ports:` blocks from all 19 other services. They are accessed via:
- nginx proxy (browser/E2E) → container DNS internally
- Docker DNS (inter-service) → `service-name:PORT`

### 3. Create Port Registry

**New file:** `infrastructure/ports.env`

Single source of truth for all port assignments. See the full plan for the
template. This is reference documentation — it does NOT change runtime behavior
since Go services already use `PORT` env var.

### 4. Fix CRM Port Anomaly

CRM is mapped as `8084:8083` (host 8084, container 8083). Since we're removing
host ports, this anomaly goes away. But verify no tooling references `localhost:8084`.

### 5. Update CLAUDE.md Service Table

Replace "Port" column with "API Path" column in the service naming table.
Ports are internal implementation details; API paths are what developers use.

### 6. Verification

After changes:

```bash
docker compose down -v
docker compose up --build -d
# Wait for services to stabilize (should be faster without host port contention)
./tests/e2e/workflows_e2e.sh --wait
./tests/e2e/services_hub_e2e.sh --wait
./tests/e2e/correspondence_e2e.sh --wait
./tests/e2e/migration_e2e.sh --wait
./tests/e2e/employer_e2e.sh --wait
```

All 166 tests must pass. Also verify:
- `curl localhost:3000/api/v1/health/aggregate` returns all services healthy
- `curl localhost:8081/healthz` returns connection refused (host port removed)

## Architecture Reference

- **docker-compose.yml** — 22+ services, all with host port mappings currently
- **frontend/nginx.conf** — Single ingress, path-based routing to all services
- **platform/*/main.go** — All use `PORT` env var with hardcoded fallback
- **infrastructure/helm/** — Helm charts (dataaccess, intelligence, crm, frontend)
- **tests/e2e/lib/http.sh** — E2E uses `BASE_URL=http://localhost:3000` (nginx)

## Important Patterns

1. **E2E scripts already use nginx proxy** — `BASE_URL=http://localhost:3000`.
   No direct port references in the main test flow.
2. **`wait_for_services` polls via nginx** — uses `BASE_URL` + service endpoints.
3. **Inter-service calls use Docker DNS** — `http://dataaccess:8081`, etc.
   These do NOT change — only host-level port bindings are removed.
4. **healthagg has hardcoded service URLs** — `HEALTH_SERVICES` env var in
   docker-compose.yml. These use Docker DNS names, not localhost. No change needed.
