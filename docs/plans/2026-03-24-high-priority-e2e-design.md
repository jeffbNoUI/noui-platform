# Design: Error Reporting Auth Bypass + E2E Tier 2/3 Reconciliation

**Date:** 2026-03-24
**Status:** Approved

## Item 1: Error Reporting Auth Bypass

### Problem

`POST /api/v1/errors/report` returns 401 because the issues service applies auth
middleware to all routes. The frontend `errorReporter.ts` intentionally sends requests
without auth headers — error reports must work when JWT is expired.

### Solution

Add `/api/v1/errors/report` to the `bypassPaths` map in `platform/auth/auth.go`.
One-line change following the existing pattern for `/healthz`, `/health`, `/ready`, `/metrics`.

### Security

- Write-only ingestion endpoint — no data exposure
- Handler already falls back to `defaultTenantID` for unauthenticated callers (line 425-429)
- Rate limiter still applies (upstream in middleware chain)
- Only `/api/v1/errors/report` is exempted; `GET /api/v1/errors/recent` stays protected

### Files

| File | Change |
|------|--------|
| `platform/auth/auth.go` | Add bypass path (1 line) |

---

## Item 2: E2E Tier 2/3 Reconciliation Verification

### Problem

Tier 2/3 reconciliation code and data loaders are implemented but untested E2E.
Seed data (69K rows, 21 tables) is loaded. Need to verify the full pipeline produces
meaningful Tier 2 (payment matching) and Tier 3 (aggregate checks) results.

### What Must Work

1. Batch execution populates `canonical_salaries`, `canonical_contributions`,
   `payment_history` tables via the Tier 2/3 source loaders
2. `POST /batches/{id}/reconcile` returns Tier 2 + Tier 3 results (not just Tier 1)
3. Tier 2: Payment matching with +/-2% tolerance produces MATCH/MINOR/MAJOR categories
4. Tier 3: Salary outlier, contribution total, service credit span checks produce P3 advisories
5. Gate scoring includes Tier 2 in weighted score

### Potential Blocker

The source loaders in `source_loader.go` may not be wired into the batch execution
flow. If `writeCanonicalSalary`/`writeCanonicalContribution` aren't called during
transformation, Tier 2/3 tables will be empty. Must trace the batch execution path
to confirm and wire if needed.

### Approach

Extend `tests/e2e/migration_e2e.sh` Phase 7 with Tier 2/3 assertions:
- Reconciliation results include `tier=2` and `tier=3` entries
- Tier 2 results have `source_value` (payment amounts) populated
- Tier 3 produces advisory results for salary outliers
- Summary endpoint returns non-zero P3 counts

### Files

| File | Change |
|------|--------|
| `tests/e2e/migration_e2e.sh` | Add Tier 2/3 assertions to Phase 7 |
| `platform/migration/batch/batch.go` | Wire Tier 2/3 loaders if not already connected |
| `platform/migration/batch/source_loader.go` | Verify/fix loader integration |
