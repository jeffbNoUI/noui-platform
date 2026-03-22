# Port Management Phase 1: Remove Host Ports + Single Source of Truth

## Context

NoUI has 22+ services, each with port numbers defined in 4 places:
- Go `main.go` default (`PORT` env var fallback)
- `docker-compose.yml` (host:container mapping)
- `frontend/nginx.conf` (proxy_pass targets)
- Helm `values.yaml` (Kubernetes service port)

This creates startup pressure (all services bind host ports simultaneously, causing
pgbouncer `query_wait_timeout` cascades) and maintenance overhead.

### Current State (22 services)
- Port range: 8081–8101 (sequential, with gaps)
- All services expose host ports in docker-compose — even internal-only ones
- CRM has a host port anomaly: container 8083, host 8084
- Inter-service calls already use DNS names (good)
- nginx already acts as single ingress (good)
- Helm charts already use ClusterIP (good)

## Phase 1 Changes (This Plan)

### 1. Remove Host Port Mappings for Internal Services

**File:** `docker-compose.yml`

**Change:** Remove `ports:` blocks from all services EXCEPT:
- `frontend` (3000:80) — developer browser access
- `postgres` (5432:5432) — local DB tools (pgAdmin, psql)
- `pgbouncer` (6432:6432) — local connection pooler access

All other services are accessed via:
- nginx proxy (browser/E2E) → `service-name:PORT` internally
- Docker DNS (inter-service) → `service-name:PORT` internally

**Why:** Eliminates host port collision pressure during `docker compose up`.
This is the root cause of the pgbouncer timeout cascade seen in Phase 5g.

**Risk:** Any scripts or tools that directly call `localhost:808X` will break.
Audit for these before making the change.

### 2. Create Single Port Registry

**File:** `infrastructure/ports.env` (new)

```env
# NoUI Service Port Registry — Single Source of Truth
# All services read PORT from environment. This file is the canonical reference.
#
# Usage in docker-compose.yml:
#   env_file: [../../infrastructure/ports.env]  (for PORT default)
#
# Range allocation:
#   5432       PostgreSQL
#   6432       PgBouncer
#   8081-8089  Core platform services
#   8090       Connector (generic infrastructure)
#   8091       Health aggregator
#   8092-8093  Issues + Security
#   8094-8099  Employer services
#   8100-8101  Migration services
#   3000       Frontend (host mapping only)

DATAACCESS_PORT=8081
INTELLIGENCE_PORT=8082
CRM_PORT=8083
CORRESPONDENCE_PORT=8085
DATAQUALITY_PORT=8086
KNOWLEDGEBASE_PORT=8087
CASEMANAGEMENT_PORT=8088
PREFERENCES_PORT=8089
CONNECTOR_PORT=8090
HEALTHAGG_PORT=8091
ISSUES_PORT=8092
SECURITY_PORT=8093
EMPLOYER_PORTAL_PORT=8094
EMPLOYER_REPORTING_PORT=8095
EMPLOYER_ENROLLMENT_PORT=8096
EMPLOYER_TERMINATIONS_PORT=8097
EMPLOYER_WARET_PORT=8098
EMPLOYER_SCP_PORT=8099
MIGRATION_PORT=8100
MIGRATION_INTELLIGENCE_PORT=8101
```

**Why:** One file to check when adding a new service or debugging port conflicts.
Does NOT change runtime behavior — Go services still use `PORT` env var.

### 3. Fix CRM Host Port Anomaly

**File:** `docker-compose.yml`

**Change:** CRM is mapped as `8084:8083` (host 8084, container 8083).
Since we're removing host ports (step 1), this anomaly goes away naturally.
But if any local tooling references `localhost:8084`, update it to use
nginx proxy at `localhost:3000/api/v1/crm` instead.

### 4. Update E2E Scripts

**Files:** `tests/e2e/lib/http.sh`, all `*_e2e.sh` scripts

**Change:** E2E scripts already use `BASE_URL=http://localhost:3000` (nginx proxy).
Verify no scripts directly call `localhost:808X`. If any do, route through nginx.

The `wait_for_services` function checks health via nginx proxy — confirm this
still works without host port mappings. Internal Docker DNS resolves regardless.

### 5. Update CLAUDE.md Service Table

**File:** `CLAUDE.md`

**Change:** Update the "Service Naming" table to remove "Port" column (ports are
internal implementation detail) and add "API Path" column instead:

| Service | API Path | Purpose |
|---------|----------|---------|
| dataaccess | /api/v1/members | Member/salary/benefit queries |
| crm | /api/v1/crm | Contact management |
| ... | ... | ... |

## Phase 2 (Future — Separate Plan)

Standardize all container ports to `:8080`. Requires:
- Update all 22 `main.go` default ports
- Update all docker-compose PORT env vars
- Update all nginx proxy_pass targets
- Update all Helm values.yaml
- Run full E2E suite

This is a larger change with more risk. Phase 1 should be validated first.

## Verification

1. `docker compose up --build -d` — all services start without port conflicts
2. All 5 E2E suites pass (166/166) via nginx proxy
3. `docker compose ps` — all services running
4. `curl localhost:3000/api/v1/health/aggregate` — all services healthy
5. Verify `localhost:8081` etc. are NOT reachable (host ports removed)

## Audit Before Implementation

Before removing host ports, grep for direct localhost:PORT references:
```bash
grep -rn 'localhost:80[89][0-9]' tests/ scripts/ docs/ frontend/ tools/
grep -rn 'localhost:81[0-9][0-9]' tests/ scripts/ docs/ frontend/ tools/
```

Any matches must be updated to use nginx proxy or Docker DNS.

## Estimated Scope

**M** — 4-6 files modified, ~100 lines changed, low risk with proper audit.
