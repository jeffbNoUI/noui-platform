# Next Session Starter — Employer Domain Phase 6: Service Credit Purchase (SCP)

## Current State (as of 2026-03-19)

**Phase 5 complete.** Phase 6 ready to start.

### What Phases 1–5 Built
- `platform/employer-shared/` — Shared Go module (types, divisions, enums). 3 tests.
- `platform/employer-portal/` — Go service on port 8094 (role mgmt, dashboard, alerts, rate tables, divisions). 24 tests.
- `platform/employer-reporting/` — Go service on port 8095 (contribution validation, exceptions, payment setup, late interest). 38 tests.
- `platform/employer-enrollment/` — Go service on port 8096 (new member submissions, duplicate detection, PERAChoice elections). 23 tests.
- `platform/employer-terminations/` — Go service on port 8097 (termination certifications, certification holds, refund calculation). 41 tests.
- `platform/employer-waret/` — Go service on port 8098 (designations, day tracking, penalty calculation, PERACare conflict detection). 58 tests.
- `domains/pension/schema/020_employer_shared.sql` — 5 tables, 14 seeded COPERA rate rows.
- `domains/pension/schema/021_employer_reporting.sql` — 5 tables (files, records, exceptions, payments, interest).
- `domains/pension/schema/022_employer_enrollment.sql` — 3 tables (submissions, duplicate flags, PERAChoice elections).
- `domains/pension/schema/023_employer_terminations.sql` — 3 tables (certifications, holds, refund applications). All NUMERIC for money.
- `domains/pension/schema/024_employer_waret.sql` — 5 tables + 1 view (designations, tracking, penalties, PERACare IC disclosures, YTD summary view).
- `frontend/src/components/employer-portal/` — Portal app + 6 reporting + 4 enrollment + 3 termination + 4 WARET components.
- `frontend/src/hooks/useEmployerPortal.ts` + `useEmployerReporting.ts` + `useEmployerEnrollment.ts` + `useEmployerTerminations.ts` + `useEmployerWaret.ts` — hooks for all 5 services.
- `frontend/src/lib/employerApi.ts` — API client for portal + reporting + enrollment + terminations + WARET services.
- `frontend/src/types/Employer.ts` — Full type definitions for all Phase 1–5 models.
- Test totals: 1,692 frontend tests (211 files), 187 Go tests across 6 employer modules. All passing.

### Key Phase 5 Details (WARET)
- **Penalty calculation uses `math/big.Rat`** — penny-accurate, 5% of monthly benefit per day over limit.
- **Designation types**: Standard (110 days/720 hrs), 140-Day (140/960 hrs), Critical Shortage (unlimited).
- **Capacity check**: 10 members per district for 140-day designations.
- **Consecutive year limit**: 6 years max, then 1-year mandatory break.
- **PERACare conflict detection**: Critical Shortage designations trigger subsidy conflict check, 30-day response window.
- **Effective month rule**: Working day 1 of a month = full benefit cancellation; subsequent days = 5% penalty each.
- **WARET tab wired into `EmployerPortalApp.tsx`** — will be visible when Phase 7 swaps `App.tsx`.

### Key Documents
- **Design doc:** `docs/plans/2026-03-19-employer-domain-design.md` — Full 7-domain architecture
- **Implementation plan:** `docs/plans/2026-03-19-employer-domain-plan.md` — 8 phases, Tasks 6.1-6.3 for Phase 6
- **COPERA rate data:** `docs/copera-contribution-rates-jan2026.md`

### What Phase 6 Builds

**Employer SCP (Service Credit Purchase) Service** — `platform/employer-scp/` on port 8099.

**NOTE:** SCP BPI document is not yet available. Build the framework and cost factor lookup; fill details when BPI is retrieved. This is a partial implementation.

From the plan (Tasks 6.1 through 6.3):

1. **Database schema** (`domains/pension/schema/025_employer_scp.sql`): `scp_cost_factor`, `scp_request`
   - **CRITICAL exclusion flags on `scp_request`:**
     - `excludes_from_rule_of_75_85 BOOLEAN NOT NULL DEFAULT true`
     - `excludes_from_ipr BOOLEAN NOT NULL DEFAULT true`
     - `excludes_from_vesting BOOLEAN NOT NULL DEFAULT true`
   - These flags are set at creation and NEVER changed. Purchased service contributes to benefit calculation but NOT to eligibility tests (Rule of 75/85, IPR, vesting).

2. **Go service** with domain logic:
   - `domain/costfactor.go` — Lookup cost factor by tier, hire date window, age at purchase. Calculate cost. Quote expiration.
   - `domain/eligibility.go` — Service type validation. Documentation requirements.
   - `domain/exclusions.go` — Enforce exclusion flags at record creation. Verify flags are immutable after creation. **This is a fiduciary critical path.**

3. **Frontend** (`frontend/src/components/employer-portal/scp/`): `CostQuote.tsx`, `PurchaseRequest.tsx`, `PaymentTracker.tsx`

### How to Execute

```
# Read the plan
Read docs/plans/2026-03-19-employer-domain-plan.md — Phase 6 section (Tasks 6.1-6.3)

# Copy patterns from employer-waret (Phase 5)
# Same go.mod template, same Dockerfile template, same handler/store/domain structure
# Exclusion flag immutability is the critical test — write a test that tries to UPDATE them and verifies failure
```

### Build Commands
```bash
# Verify Phases 1-5 still pass
cd platform/employer-shared && go build ./... && go test ./... -short
cd ../employer-portal && go build ./... && go test ./... -short
cd ../employer-reporting && go build ./... && go test ./... -short
cd ../employer-enrollment && go build ./... && go test ./... -short
cd ../employer-terminations && go build ./... && go test ./... -short
cd ../employer-waret && go build ./... && go test ./... -short
cd ../../frontend && npx tsc --noEmit && npm test -- --run

# Phase 6 builds (after implementation)
cd platform/employer-scp && go build ./... && go test ./... -short -v
```

### Conflict Avoidance
All Phase 6 work is in new directories:
- `platform/employer-scp/` (new)
- `domains/pension/schema/025_employer_scp.sql` (new)
- `frontend/src/components/employer-portal/scp/` (new)
- `frontend/src/hooks/useEmployerScp.ts` (new)

Only shared files touched:
- `frontend/src/types/Employer.ts` (append SCP types)
- `frontend/src/lib/employerApi.ts` (append SCP API functions)
- `frontend/src/components/employer-portal/EmployerPortalApp.tsx` (add SCP tab)

### After Phase 6
Phase 7 is **Integration** — Docker, CI, App.tsx wiring. This phase touches shared files (docker-compose, CI matrix, nginx config) and should be coordinated carefully since it merges all 6 employer services into the deployment stack.
