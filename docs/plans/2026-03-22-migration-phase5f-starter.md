# Migration Phase 5f: Employer Portal E2E + PATCH Transition Fix — Starter Prompt

## Context

Migration Phase 5e is complete (PR merged). Full Docker E2E verification passed:

- **Workflows:** 20/20
- **Services Hub:** 50/50
- **Correspondence:** 24/24
- **Migration:** 23/23

### What Was Fixed in Phase 5e

**Migration E2E payloads** — 6 request body mismatches between the E2E script and
actual migration API contracts. Every payload now matches the real handler validation:
- `source_system_name` (not `name`/`source_system`)
- `DISCOVERY → PROFILING` status transition (initial status is DISCOVERY, not PROFILING)
- Source config: `driver`/`user`/`dbname` with correct DB credentials (`noui`/`noui`)
- Profile: real table names (`member_master`, `salary_hist`)
- Generate mappings: valid concept tag `employee-master` with realistic columns
- Batch: `batch_scope` field (not `name`/`record_count`)
- Risk: `severity: "P2"` + `description` (not `title`/`MEDIUM`/`category`)

**Schema drift bug** in `platform/migration/db/`:
- `reconciliation_detail.go`: Fixed `GetReconciliationByTier` query — column names
  matched planned schema not actual DDL (`recon_id`/`calc_name`/`legacy_value`/`recomputed_value`)
- `attention.go`: Fixed P1 reconciliation UNION query with same column corrections

### Stats (Phase 5e)
- 3 files changed, +64/-43 lines
- Migration Go: all 11 packages passing (short mode)
- Frontend: typecheck clean
- Docker E2E: 117/117 across 4 suites

## What Needs Doing (Phase 5f)

### 1. Employer Portal E2E Script (Primary)

The employer portal services (reporting, enrollment, terminations, waret, scp) all
return valid data in Docker. Create `tests/e2e/employer_e2e.sh`:

**Services to test:**
- **Reporting** (port 8094 via nginx): GET summaries, GET reports
- **Enrollment** (port 8095 via nginx): GET stats, POST enrollment event, GET event
- **Terminations** (port 8096 via nginx): GET stats, POST termination, lifecycle
- **WARET** (port 8097 via nginx): GET estimates, POST calculation
- **SCP** (port 8098 via nginx): GET service credit purchase estimates

**Pattern:** Follow the same structure as `migration_e2e.sh`:
- `--wait` flag for service readiness
- JWT auth via `lib/jwt.sh`
- Flexible status code assertions for creation endpoints
- Timestamp-based names for idempotent re-runs

**Check nginx routes:** Verify `frontend/nginx.conf` has proxy rules for all employer
portal services. If missing, add them (similar to the migration proxy added in Phase 5c).

### 2. PATCH Engagement Transition — Root Cause (Optional)

The engagement default status after creation is `DISCOVERY` (confirmed by testing),
but `platform/migration/db/engagement_test.go:42` asserts `StatusProfiling`. Either:
- The test fixture creates with a different default than the real DB migration
- The DB migration was updated after the test was written

Worth investigating and fixing the test to match reality. Not urgent since the E2E
now uses the correct transition (`DISCOVERY → PROFILING`).

### 3. apiClient.ts `raw` Extension for Employer Portal (Optional)

If employer portal API modules in `frontend/src/lib/` use TypeScript enum types that
expect UPPERCASE values, wire them with `{ raw: true }` following the migration pattern
in `migrationApi.ts`. Check whether employer services return UPPERCASE enum fields.

### 4. Full E2E Re-run After Employer Script

After adding employer E2E, run all 5 suites:
```bash
docker compose up --build -d
./tests/e2e/workflows_e2e.sh --wait
./tests/e2e/services_hub_e2e.sh --wait
./tests/e2e/correspondence_e2e.sh --wait
./tests/e2e/migration_e2e.sh --wait
./tests/e2e/employer_e2e.sh --wait
```

## Architecture Reference

- **Migration E2E:** `tests/e2e/migration_e2e.sh` (9 phases, 23 tests)
- **E2E libs:** `tests/e2e/lib/` (jwt.sh, http.sh with do_patch, assert.sh, colors.sh)
- **nginx proxy:** `frontend/nginx.conf`
- **Employer services:** `platform/employer/` (reporting, enrollment, terminations, waret, scp)
- **Employer frontend API:** `frontend/src/lib/employerApi.ts` (if exists)
- **Reconciliation fix:** `platform/migration/db/reconciliation_detail.go` (recon_id, calc_name)
- **Attention fix:** `platform/migration/db/attention.go` (P1 recon UNION query)

## Important Patterns

1. **E2E auth:** `generate_dev_jwt()` in `tests/e2e/lib/jwt.sh`. Must `export TENANT_ID`.
2. **E2E idempotency:** Names include timestamps for safe re-runs.
3. **Source DB credentials:** `noui`/`noui` on host `postgres`, DB name `noui`.
4. **Concept tags:** 18 registered tags. Pension-relevant: `employee-master`, `salary-history`,
   `employment-timeline`, `benefit-deduction`, `service-credit`, `beneficiary-designation`,
   `domestic-relations-order`, `benefit-payment`, `case-management`, `payroll-run`.
5. **Engagement lifecycle:** `DISCOVERY → PROFILING → MAPPING → TRANSFORMING → RECONCILING → PARALLEL_RUN → COMPLETE`.
6. **Schema drift risk:** Always verify Go queries against actual DDL (`\d migration.<table>`)
   when adding new DB-dependent code.
