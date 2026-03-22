# Migration Phase 5g: dbcontext Connection Recovery + Employer Service Fixes — Starter Prompt

## Context

Migration Phase 5f is complete (PR #133). Full Docker E2E verification passed:

- **Workflows:** 20/20
- **Services Hub:** 50/50
- **Correspondence:** 24/24
- **Migration:** 23/23
- **Employer:** 46/46 (new)

### What Was Done in Phase 5f

**Employer Portal E2E script** — 46 tests across 6 services (portal, reporting,
enrollment, terminations, WARET, SCP). nginx proxy routes added for all 6 services.
Engagement test mock fixed (DISCOVERY not PROFILING).

**8 payload mismatches fixed** — UUID org_id, correct enum values (SUPER_USER,
DB, SD, STANDARD, REFUNDED_PRIOR_PERA), POST-before-GET ordering workaround.

### Known Issues Discovered

Three bugs surfaced during E2E tuning. Two are in employer services, one is
systemic in `dbcontext`:

1. **`dbcontext` stale connection cascade** (systemic, all services)
2. **`uploaded_by` UUID empty** in employer-reporting manual-entry
3. **`hireDate` timestamp parsing** in employer-terminations refund calculator

### Stats (Phase 5f)
- 3 files changed, +717 lines
- Migration Go: all 11 packages passing (short mode)
- Frontend: typecheck clean
- Docker E2E: 163/163 across 5 suites

## What Needs Doing (Phase 5g)

### 1. dbcontext Stale Connection Recovery (Primary — Systemic Fix)

**Problem:** When a DB transaction fails (e.g., duplicate key INSERT), the pooled
connection carries the failed transaction state. The next request on that connection
gets `pq: could not complete operation in a failed transaction` or `driver: bad connection`.

**Where:** All platform services use `dbcontext` middleware from a shared pattern.
Check `platform/*/middleware/` or `platform/*/db/` for the `dbcontext` implementation.

**Symptom in E2E:** A POST that hits a duplicate key (500) poisons the connection,
then the *next* GET on that service returns 500. Workaround in E2E: reorder POST
before GET so the failed POST clears the connection before the GET runs.

**Fix approach:**
- In the dbcontext middleware, after a transaction fails, ensure the connection is
  properly rolled back (`tx.Rollback()`) before returning to the pool
- If using `database/sql` connection pool, the failed transaction must be explicitly
  rolled back — otherwise the connection stays in a failed state
- Check if there's a deferred `tx.Commit()` that runs even after errors (this would
  cause `could not complete operation in a failed transaction`)
- The fix should be: `defer tx.Rollback()` at transaction start, then only call
  `tx.Commit()` on the success path

**Verification:** After fixing, re-run employer E2E — the POST-before-GET ordering
workaround should no longer be necessary (but keep it for safety).

### 2. Employer Reporting: uploaded_by UUID Fix (Secondary)

**Problem:** `POST /api/v1/reporting/manual-entry` fails with
`pq: invalid input syntax for type uuid: ""` because `uploaded_by` is set to empty
string when the auth context doesn't provide a `user_id` claim.

**Where:** `platform/employer-reporting/api/handlers.go` — `ManualEntry` handler,
around the line that sets `uploaded_by`.

**Fix approach:**
- Extract `user_id` from the JWT auth context (same as `tenant_id` extraction)
- If no `user_id` in JWT, use the `sub` claim or a deterministic fallback UUID
- Check how other services handle this — `platform/crm/` sets user from JWT claims

**Verification:** After fixing, the employer E2E `POST /reporting/manual-entry`
should return 201 instead of the current `⊘ skipped (auth context UUID)`.

### 3. Employer Terminations: hireDate Parsing Fix (Secondary)

**Problem:** `POST /api/v1/terminations/refunds/:id/calculate` returns 422 with
`invalid hire date: parsing time "2020-01-15T00:00:00Z": extra text: "T00:00:00Z"`.

**Where:** `platform/employer-terminations/api/handlers.go` — `CalculateRefund`
handler, around the date parsing logic.

**Root cause:** The `hireDate` field is stored in the DB as a `timestamptz`
(with `T00:00:00Z` suffix), but the calculator parses it with `time.Parse("2006-01-02", ...)`
which expects date-only format.

**Fix approach:**
- Use `time.Parse(time.RFC3339, ...)` to handle the full timestamp format
- Or truncate to date-only before parsing: `strings.Split(hireDate, "T")[0]`
- Check other date fields in the same handler for the same issue

**Verification:** After fixing, the employer E2E `POST /terminations/refunds/:id/calculate`
should return 200 instead of the current `⊘ skipped (date parse bug)`.

### 4. Update Employer E2E After Fixes

After fixing issues 1-3, update `employer_e2e.sh`:
- Remove `⊘ skipped` tolerance for manual-entry (expect 201)
- Remove `⊘ skipped` tolerance for refund calculate (expect 200)
- Optionally restore GET-before-POST ordering now that dbcontext is fixed
- Re-run all 5 suites to confirm 163/163 with zero skips

### 5. Full E2E Re-run

After all fixes:
```bash
docker compose up --build -d
./tests/e2e/workflows_e2e.sh --wait
./tests/e2e/services_hub_e2e.sh --wait
./tests/e2e/correspondence_e2e.sh --wait
./tests/e2e/migration_e2e.sh --wait
./tests/e2e/employer_e2e.sh --wait
```

## Architecture Reference

- **dbcontext pattern:** Check `platform/crm/middleware/` or `platform/dataaccess/middleware/`
  for the shared transaction middleware. All services follow the same pattern.
- **JWT claims:** `tests/e2e/lib/jwt.sh` — `generate_dev_jwt()` creates tokens with
  `tenant_id`, `role: admin`, `sub` claim. Check if `user_id` is included.
- **Employer E2E:** `tests/e2e/employer_e2e.sh` (6 phases, 46 tests)
- **Employer handlers:** `platform/employer-reporting/api/handlers.go` (manual-entry),
  `platform/employer-terminations/api/handlers.go` (refund calculate)
- **nginx proxy:** `frontend/nginx.conf` (all 6 employer routes added in Phase 5f)

## Important Patterns

1. **Transaction lifecycle:** `BEGIN → query → COMMIT` on success, `BEGIN → query → ROLLBACK` on failure.
   The `defer tx.Rollback()` pattern ensures rollback even on panic. Check if dbcontext uses this.
2. **UUID from JWT:** The `sub` claim in Clerk JWTs is a UUID. Map it to `user_id` in auth middleware.
3. **Date vs timestamp:** PostgreSQL `date` columns return `"2020-01-15"`, but `timestamptz` returns
   `"2020-01-15T00:00:00Z"`. Handlers must handle both formats.
4. **E2E idempotency:** Employer E2E uses timestamp-based names for safe re-runs, plus tolerates
   duplicate-key 500s as "already exists".
