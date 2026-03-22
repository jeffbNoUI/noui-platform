# Migration Phase 5e: Docker E2E Verification + Employer Portal — Starter Prompt

## Context

Migration Phase 5d is complete (PR pending). Two items done:

- **CRM Audit Trail:** Wired `CreateInteraction` → `WriteAuditLog` in
  `platform/crm/api/handlers.go`. Fire-and-forget goroutine with `context.Background()`,
  SHA-256 chain hash via `ComputeAuditHash` + `GetLastAuditHash`. This fixes the last
  E2E failure (Workflow B, test 20/20 — audit trail empty after interaction).
- **Migration E2E Script:** Created `tests/e2e/migration_e2e.sh` — 9-phase lifecycle
  test covering dashboard, engagement CRUD, source config, profiling, mappings, batches,
  reconciliation, risks, and events. Added `do_patch` to `tests/e2e/lib/http.sh`.

### Stats (Phase 5d)
- 5 files changed, +70 lines (handlers.go, audit.go, audit_test.go, migration_e2e.sh, http.sh)
- CRM Go: all packages passing (short mode)
- Frontend: typecheck clean
- New: 2 audit hash unit tests passing

## What Needs Doing (Phase 5e)

### 1. Docker E2E — Run All Suites

With the audit trail fix and migration E2E script in place, run the full Docker E2E
verification:

```bash
docker compose up --build -d
# Wait for services, then run all suites:
./tests/e2e/workflows_e2e.sh --wait
./tests/e2e/services_hub_e2e.sh --wait
./tests/e2e/correspondence_e2e.sh --wait
./tests/e2e/migration_e2e.sh --wait
```

**Expected results:**
- Workflows: 20/20 (was 19/20 — audit trail fix)
- Services Hub: 50/50
- Correspondence: 24/24
- Migration: first run — fix any payload/routing issues

### 2. Migration E2E Tuning

The migration E2E script uses flexible assertions but may need adjustments based on
actual migration service responses:
- Response envelope shape (`.data.id` vs `.id`)
- Status codes for async operations (profile, batch creation)
- Source configuration payload format (may need DB-specific fields)
- Table names in profile request (may need real table names from discovery)

### 3. Employer Portal E2E (Optional)

The employer portal services (reporting, enrollment, terminations, waret, scp) all
return valid data in Docker. Consider adding `tests/e2e/employer_e2e.sh`:
- GET endpoints for each service (reporting summaries, enrollment stats, etc.)
- Basic CRUD for enrollment events
- Termination lifecycle

### 4. apiClient.ts `raw` Extension (Optional)

If employer portal services also use UPPERCASE enums in TypeScript types, wire their
API modules with `{ raw: true }` following the migration pattern in `migrationApi.ts`.

## Architecture Reference

- **CRM audit wiring:** `platform/crm/api/handlers.go` (CreateInteraction ~line 485-510)
- **Audit hash functions:** `platform/crm/db/audit.go` (ComputeAuditHash, GetLastAuditHash)
- **Migration E2E:** `tests/e2e/migration_e2e.sh` (9 phases, ~250 lines)
- **E2E libs:** `tests/e2e/lib/` (jwt.sh, http.sh with do_patch, assert.sh, colors.sh)
- **nginx migration proxy:** `frontend/nginx.conf` (lines 104-119)
- **Migration API surface:** `frontend/src/lib/migrationApi.ts` (36 functions)

## Important Patterns

1. **Audit chain hash:** Each entry stores `prev_audit_hash` (from `GetLastAuditHash`)
   and its own `record_hash` (from `ComputeAuditHash`). SHA-256 of pipe-delimited fields.
2. **Fire-and-forget audit:** Goroutine with `context.Background()` — audit failure
   doesn't block the HTTP response. Acceptable for eventual consistency.
3. **`raw` mode:** Migration API passes `{ raw: true }` to skip enum normalization.
4. **E2E auth:** `generate_dev_jwt()` in `tests/e2e/lib/jwt.sh`. Must `export TENANT_ID`.
5. **E2E idempotency:** Engagement/batch names include timestamps for safe re-runs.
