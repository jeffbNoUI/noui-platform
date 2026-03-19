# Next Session Starter — Employer Domain Phase 4: Terminations & Refund

## Current State (as of 2026-03-19)

**Phase 3 complete.** Phase 4 ready to start.

### What Phase 1 + Phase 2 + Phase 3 Built
- `platform/employer-shared/` — Shared Go module (types, divisions, enums). 7 tests.
- `platform/employer-portal/` — Go service on port 8094 (role mgmt, dashboard, alerts, rate tables, divisions). 24 tests.
- `platform/employer-reporting/` — Go service on port 8095 (contribution validation, exceptions, payment setup, late interest). 38 tests.
- `platform/employer-enrollment/` — Go service on port 8096 (new member submissions, duplicate detection, PERAChoice elections). 43 tests.
- `domains/pension/schema/020_employer_shared.sql` — 5 tables, 14 seeded COPERA rate rows.
- `domains/pension/schema/021_employer_reporting.sql` — 5 tables (files, records, exceptions, payments, interest).
- `domains/pension/schema/022_employer_enrollment.sql` — 3 tables (submissions, duplicate flags, PERAChoice elections).
- `frontend/src/components/employer-portal/` — Portal app + 6 reporting + 4 enrollment components.
- `frontend/src/hooks/useEmployerPortal.ts` + `useEmployerReporting.ts` + `useEmployerEnrollment.ts` — 36 hooks total.
- `frontend/src/lib/employerApi.ts` — API client for portal + reporting + enrollment services.
- `frontend/src/types/Employer.ts` — Full type definitions for all Phase 1+2+3 models.
- Test totals: 1,674 frontend tests (209 files), 112 Go tests across employer modules. All passing.

### Key Documents
- **Design doc:** `docs/plans/2026-03-19-employer-domain-design.md` — Full 7-domain architecture
- **Implementation plan:** `docs/plans/2026-03-19-employer-domain-plan.md` — 8 phases, Tasks 4.1-4.4 for Phase 4
- **COPERA rate data:** `docs/copera-contribution-rates-jan2026.md`

### What Phase 4 Builds

**Employer Terminations Service** — `platform/employer-terminations/` on port 8097.

From the plan (Tasks 4.1 through 4.4):

1. **Database schema** (`domains/pension/schema/023_employer_terminations.sql`): termination_certification, certification_hold, refund_application
2. **Go service** with endpoints: termination certification CRUD, hold management, refund application, eligibility checks, refund calculation
3. **Domain logic — CRITICAL: monetary precision required:**
   - `domain/certification.go` — Hold logic: auto-create "Pending Employer Certification" when refund form exists but no termination date. Configurable countdown (45 days default). Reminder scheduling. Auto-escalation. Auto-cancellation.
   - `domain/refund.go` — Refund calculation: employee contributions + compound interest (board-set rate, compounded annually June 30). 20% federal tax withholding. DRO deductions. Payment method selection.
   - `domain/eligibility.go` — Separation waiting period check. Vesting check (5 years). Disability application check (<2 years blocks refund).
   - **Use `math/big.Rat` for all monetary arithmetic. Never float64. Tests must match to the penny ($0.00 tolerance).**
4. **Frontend** (`frontend/src/components/employer-portal/terminations/`): TerminationForm, CertificationHold, RefundStatus

### How to Execute

```
# Read the plan
Read docs/plans/2026-03-19-employer-domain-plan.md — Phase 4 section (Tasks 4.1-4.4)

# Copy patterns from employer-enrollment (Phase 3)
# Same go.mod template, same Dockerfile template, same handler/store/domain structure
# BUT: domain/refund.go MUST use math/big.Rat — not float64
```

### Build Commands
```bash
# Verify Phase 1+2+3 still pass
cd platform/employer-shared && go build ./... && go test ./... -short
cd ../employer-portal && go build ./... && go test ./... -short
cd ../employer-reporting && go build ./... && go test ./... -short
cd ../employer-enrollment && go build ./... && go test ./... -short
cd ../../frontend && npx tsc --noEmit && npm test -- --run

# Phase 4 builds (after implementation)
cd platform/employer-terminations && go build ./... && go test ./... -short -v
```

### Conflict Avoidance
All Phase 4 work is in new directories:
- `platform/employer-terminations/` (new)
- `domains/pension/schema/023_employer_terminations.sql` (new)
- `frontend/src/components/employer-portal/terminations/` (new)
- `frontend/src/hooks/useEmployerTerminations.ts` (new)

Minimal overlap with existing files: only `employerApi.ts` (terminations client appended) and `Employer.ts` (types appended).

### Data Gaps (Not Blocking Phase 4 Core)
- **Board-set interest rate for refund compound interest** — Build with placeholder rate; actual rate comes from COPERA board resolution.
- **DRO deduction calculation details** — Build the deduction slot; exact formula depends on court order format.
- **Separation waiting period duration** — Build with configurable default (60 days); confirm with COPERA.

### Critical Warning — Refund Calculation
From CLAUDE.md: "Every benefit calculation must match hand-calculated expected results to the penny ($0.00 tolerance)." The refund calculation in `domain/refund.go` must:
- Use `math/big.Rat` or scaled integers for all monetary arithmetic
- Never use `float64` for dollar amounts
- Compound interest annually on June 30
- Apply 20% federal tax withholding
- Handle DRO deductions
- Write extensive unit tests comparing against hand-calculated expected values
