# Migration Phase 5g: dbcontext + Employer Defect Fixes — Design

**Date:** 2026-03-24
**Status:** Approved
**Scope:** 3 code defects + E2E script cleanup

---

## Defect 1: dbcontext Stale Connection Cascade (Systemic)

**File:** `platform/dbcontext/dbcontext.go` (lines 165–197)

**Root cause:** `DBMiddleware` calls `tx.Commit()` at end of handler but has no
`defer tx.Rollback()`. When a handler triggers a DB error (e.g., duplicate key),
the transaction is left in a failed state. The connection returns to the pool dirty,
causing the next request on that connection to fail with
`pq: could not complete operation in a failed transaction`.

**Fix:** Add `defer tx.Rollback()` immediately after `BeginTx` succeeds. This is
safe — a committed tx silently ignores Rollback. One line, affects all services.

## Defect 2: Employer Reporting `uploaded_by` UUID Empty

**Files:** `platform/employer-reporting/api/handlers.go` (lines 168, 372, 513)

**Root cause:** Three handlers set `UploadedBy: ""` instead of extracting the
user ID from JWT context. The auth middleware already provides
`auth.UserID(r.Context())` — it's just not called.

**Fix:** Replace `""` with `auth.UserID(r.Context())` in ManualEntry,
ResolveException, and SubmitCorrection handlers.

## Defect 3: Terminations `hireDate` Timestamp Parsing

**File:** `platform/employer-terminations/domain/refund.go` (lines 59–66)

**Root cause:** `time.Parse("2006-01-02", input.HireDate)` fails when PostgreSQL
returns `timestamptz` values like `"2020-01-15T00:00:00Z"`. Both `HireDate` and
`TerminationDate` have this issue.

**Fix:** Add `parseFlexDate` helper that tries RFC3339 first, then date-only format.
Apply to both date fields in `CalculateRefund`.

## Defect 4: E2E Script Cleanup

**File:** `tests/e2e/employer_e2e.sh`

After code fixes, remove skip tolerances for manual-entry and refund-calculate
endpoints. Expect 201 and 200 respectively.

## Verification

Re-run all 5 E2E suites. Target: 163/163 with zero skips.
