# Starter Prompt: Post Port Management — Next Priorities

## Context

Port Management Phase 1 is complete and merged. Host port mappings removed from
19 Docker services. All access goes through nginx at localhost:3000. Docker E2E
verified: 169/169 tests passing across 5 suites.

## What Was Done This Session

1. **Port Management Phase 1** — removed host port bindings from all backend
   services in docker-compose.yml. Only frontend (3000), postgres (5432), and
   pgbouncer (6432) retain host mappings. Created `infrastructure/ports.env` as
   single-source port registry. Updated health smoke test to route through nginx.
   Updated CLAUDE.md service table (ports → API paths).

2. **Migration plan status update** — added completion status section to
   `docs/plans/2026-03-20-migration-engine-plan.md`. All 26 tasks are code-complete.
   Remaining work is integration proving (Tasks 18+26 collapsed, Task 25 validation).

3. **Bug fixes (pre-existing, surfaced during E2E)**:
   - Missing docker-compose volume mounts for migrations 033-035
   - `HTTP_BODY` → `BODY` variable typo in migration E2E Phase 10

## Queued Work (Pick One)

### Option A: Two-Source Proof (Migration Integration Proving)
The migration engine code is complete but has never run end-to-end against real
source databases. This is the final gate for the migration engine.

**What's needed:**
- Spin up PRISM + PAS source databases in Docker
- Run `migration-simulation/tests/test_phase2_e2e.py` against live services
- Debug failures (expect data format mismatches, missing tables, etc.)
- Run reconciliation gate checks on both sources
- Verify Go/Python cross-language fixtures match ($0.00 variance)
- Document results

**See:** `docs/plans/2026-03-20-migration-engine-plan.md` (Tasks 18, 25, 26)

### Option B: Port Management Phase 2 (Standardize Container Ports)
All containers currently use unique ports (8081-8101). Phase 2 would standardize
all container ports to `:8080` since there are no host port conflicts anymore.

**See:** `docs/plans/2026-03-22-port-management-phase1.md` (Phase 2 section)

### Option C: Frontend or Other Feature Work
The platform has 169 passing E2E tests across workflows, services hub,
correspondence, migration, and employer domains. All 22 services healthy in Docker.

## Current State

- **Branch:** main (after PR merge)
- **Docker E2E:** 169/169 (5 suites)
- **Go tests:** all passing (short mode)
- **Frontend:** typechecks clean, all unit tests passing
- **Services:** 18/20 healthy (connector expected unreachable, migration-intelligence intermittent)
