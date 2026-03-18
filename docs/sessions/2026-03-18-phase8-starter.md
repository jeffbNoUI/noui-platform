# Phase 8 Session Starter — Retirement Application Hardening

> **Read this before writing any code.**

## What Was Completed (Phase 7 — Inactive Member Experience)

Phase 7 delivered the full inactive member portal experience in commit `0af30fb`:

### Frontend (3 new components, 28 tests)
- **DeferredBenefitExplorer** (`frontend/src/components/portal/inactive/DeferredBenefitExplorer.tsx`)
  - 4-step wizard: Retirement Date → Service Purchase → Payment Option → Results
  - Frozen salary display (no salary growth for inactive members)
  - Uses `useWhatIfCalculator` with `salary_growth_pct: 0`
  - 10 tests passing

- **RefundEstimate** (`frontend/src/components/portal/inactive/RefundEstimate.tsx`)
  - Contribution breakdown: employee contributions + interest = total
  - Tax comparison: 20% mandatory withholding vs. IRA rollover
  - Uses backend-provided withholding values (single source of truth)
  - 8 tests passing

- **RefundApplication** (`frontend/src/components/portal/inactive/RefundApplication.tsx`)
  - 5-stage flow: Verify Info → Distribution → Review → Acknowledge → Processing
  - Double acknowledgment (forfeiture + tax implications) before submit
  - Application ID generated on submission
  - 10 tests passing

- **MemberPortal.tsx** — 3 new section routes wired: `projections`, `refund`, `refund-apply`

### Backend (5 new Go endpoints, 12 tests)
- `GET /api/v1/members/{id}/refund-estimate` — calculates from CONTRIBUTION_HIST
- `GET /api/v1/members/{id}/payments` — paginated payment history
- `GET /api/v1/members/{id}/tax-documents` — paginated tax documents
- `GET /api/v1/members/{id}/addresses` — member addresses
- `PUT /api/v1/members/{id}/addresses/{aid}` — update address with validation

### Known Issues from Code Review (not blocking)
1. `float64` for monetary values in dataaccess models — existing pattern; fiduciary precision rules apply to intelligence service only
2. `UpdateAddress` could use more edge-case tests (empty body, unknown fields)
3. Tenant identity in `UpdateAddress` relies on RLS via `dbcontext.DB` — no explicit handler-level check

## What's Next

Potential next phases:
- **Retirement Application hardening** — end-to-end flow testing, edge cases
- **Payment/tax document views** — wire frontend to new backend endpoints
- **Address management UI** — profile section with address editing
- **Integration testing** — full stack tests with real database

## Key Patterns to Follow

- **Single source of truth for financial calcs**: Frontend uses backend-provided values with client-side fallback
- **Persona-driven navigation**: `resolveMemberPersona()` in `@/types/MemberPortal` drives sidebar items
- **Stage-based wizard pattern**: See `RefundApplication.tsx` for the 5-stage pattern with validation gates
- **Go handler pattern**: `serveWithPathValue` helper in tests, `validation.Errors` for input validation, member existence check before aggregate queries
