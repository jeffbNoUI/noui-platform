# Migration Phase 5d: Audit Trail + Docker E2E Flow — Starter Prompt

## Context

Migration Phase 5c is complete (PR pending). The four Phase 5c items are done:

- **nginx.conf migration proxy:** `/api/v1/migration` + `/ws/migration` routes added.
  Migration API now works through Docker-served frontend (was 502 before).
- **E2E test fixes:** 5 payload mismatches fixed in `workflows_e2e.sh`:
  missing `caseId`, `memberId` string→int, `retirementDate`, `"bug"`→`"defect"`,
  `"authorId"`→`"author"`. Workflows now 19/20 (was 9/13).
- **apiClient.ts enum tech debt:** Added `{ raw: true }` option to fetch helpers.
  Migration API module opts out of global lowercase normalization. Removed
  `normalizeEngagement` workaround. All 36 migration API functions use raw mode.
- **Docker E2E verified:** Services Hub 50/50, Correspondence 24/24, Workflows 19/20.

### Stats (Phase 5c)
- 5 files changed, +122/-80 lines
- Frontend: 231 test files, 1,838 tests passing
- E2E: workflows 19/20, services_hub 50/50, correspondence 24/24

## What Needs Doing (Phase 5d)

### 1. CRM Audit Trail — Wire Interaction Creation

The only remaining E2E failure (Workflow B, test 20/20) is that `CreateInteraction`
in `platform/crm/api/handlers.go` doesn't write to `crm_audit_log`. The audit table
and query infrastructure exist — the handler just never calls `store.WriteAudit()`.

**Fix:** After successful `CreateInteraction`, call `store.WriteAudit()` with:
- `event_type`: `"interaction_created"`
- `entity_type`: `"interaction"`
- `entity_id`: the new interaction's ID
- `summary`: channel + direction info

**Files:**
- `platform/crm/api/handlers.go` — `CreateInteraction` handler (~line 481)
- `platform/crm/db/audit.go` — `WriteAudit` function (already exists)
- `platform/crm/db/audit_test.go` — add test for audit on interaction creation

### 2. Full Docker E2E — Migration Flow

Now that nginx proxies migration routes, run a complete migration flow in Docker:
- Create engagement → configure source → run profile → verify radar chart
- Advance to MAPPING → generate mappings → verify mapping table + CorpusIndicator
- Advance to TRANSFORMING → create batch → verify batch list + detail
- Run reconciliation → verify gate score gauge + TierFunnel

This requires the migration service to be running with seed data or manual setup.
Consider creating a `tests/e2e/migration_e2e.sh` script.

### 3. Employer Portal E2E (Optional)

The employer portal services (reporting, enrollment, terminations, waret, scp) all
return valid data in Docker. Consider adding an employer_e2e.sh test suite.

### 4. apiClient.ts `raw` Extension (Optional)

If employer portal services also use UPPERCASE enums in TypeScript types, wire their
API modules with `{ raw: true }` following the migration pattern.

## Architecture Reference

- **nginx config:** `frontend/nginx.conf` (migration proxy lines 104-119)
- **apiClient.ts:** `frontend/src/lib/apiClient.ts` (FetchOptions.raw, lines 240-244)
- **Migration API:** `frontend/src/lib/migrationApi.ts` (RAW constant, line 50)
- **CRM handlers:** `platform/crm/api/handlers.go` (CreateInteraction ~line 428)
- **CRM audit store:** `platform/crm/db/audit.go` (WriteAudit, GetAuditLog)
- **E2E tests:** `tests/e2e/workflows_e2e.sh`, `tests/e2e/services_hub_e2e.sh`
- **E2E libs:** `tests/e2e/lib/` (jwt.sh, http.sh, assert.sh, colors.sh)

## Important Patterns

1. **`raw` mode:** `migrationApi.ts` uses `const RAW = { raw: true }` passed to all
   fetch helpers. This skips `ENUM_FIELDS` lowercase/uppercase transforms.
2. **E2E auth:** `generate_dev_jwt()` in `tests/e2e/lib/jwt.sh` creates HS256 tokens.
   Must `export TENANT_ID` before sourcing. Case IDs use timestamps for idempotency.
3. **CRM audit:** `WriteAudit` expects tenant_id, event_type, entity_type, entity_id,
   agent_id, summary, and computes a chain hash from the previous audit entry.
4. **Pre-commit hook:** `.husky/pre-commit` runs lint-staged + Go tests + frontend
   typecheck. All must pass for commit to succeed.
