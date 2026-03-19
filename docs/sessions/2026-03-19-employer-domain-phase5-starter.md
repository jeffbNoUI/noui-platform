# Next Session Starter — Employer Domain Phase 5: WARET (Working After Retirement)

## Current State (as of 2026-03-19)

**Phase 4 complete.** Phase 5 ready to start.

### What Phase 1 + Phase 2 + Phase 3 + Phase 4 Built
- `platform/employer-shared/` — Shared Go module (types, divisions, enums). 7 tests.
- `platform/employer-portal/` — Go service on port 8094 (role mgmt, dashboard, alerts, rate tables, divisions). 24 tests.
- `platform/employer-reporting/` — Go service on port 8095 (contribution validation, exceptions, payment setup, late interest). 38 tests.
- `platform/employer-enrollment/` — Go service on port 8096 (new member submissions, duplicate detection, PERAChoice elections). 43 tests.
- `platform/employer-terminations/` — Go service on port 8097 (termination certifications, certification holds, refund calculation). 38 tests.
- `domains/pension/schema/020_employer_shared.sql` — 5 tables, 14 seeded COPERA rate rows.
- `domains/pension/schema/021_employer_reporting.sql` — 5 tables (files, records, exceptions, payments, interest).
- `domains/pension/schema/022_employer_enrollment.sql` — 3 tables (submissions, duplicate flags, PERAChoice elections).
- `domains/pension/schema/023_employer_terminations.sql` — 3 tables (certifications, holds, refund applications). All NUMERIC for money.
- `frontend/src/components/employer-portal/` — Portal app + 6 reporting + 4 enrollment + 3 termination components.
- `frontend/src/hooks/useEmployerPortal.ts` + `useEmployerReporting.ts` + `useEmployerEnrollment.ts` + `useEmployerTerminations.ts` — 50 hooks total.
- `frontend/src/lib/employerApi.ts` — API client for portal + reporting + enrollment + terminations services.
- `frontend/src/types/Employer.ts` — Full type definitions for all Phase 1-4 models.
- Test totals: 1,680 frontend tests (210 files), 150 Go tests across employer modules. All passing.

### Key Phase 4 Details
- **Refund calculation uses `math/big.Rat`** — penny-accurate compound interest, June 30 annual compounding.
- **Certification hold countdown**: 45-day default, auto-reminder at day 15, auto-escalate at day 30, auto-expire at day 45.
- **Eligibility checks**: separation waiting period (60 days), vesting (5 years), disability application block (2 years).
- **Terminations tab wired into `EmployerPortalApp.tsx`** — will be visible when Phase 7 swaps `App.tsx` to use the new portal app.

### Key Documents
- **Design doc:** `docs/plans/2026-03-19-employer-domain-design.md` — Full 7-domain architecture
- **Implementation plan:** `docs/plans/2026-03-19-employer-domain-plan.md` — 8 phases, Tasks 5.1-5.4 for Phase 5
- **COPERA rate data:** `docs/copera-contribution-rates-jan2026.md`

### What Phase 5 Builds

**Employer WARET Service** — `platform/employer-waret/` on port 8098.

From the plan (Tasks 5.1 through 5.4):

1. **Database schema** (`domains/pension/schema/024_employer_waret.sql`): waret_designation, waret_tracking, waret_ytd_summary (view), waret_penalty, waret_ic_disclosure
2. **Go service** with endpoints: designation management, tracking, penalty calculation, PERACare conflict detection
3. **Domain logic — CRITICAL: monetary precision required for penalties:**
   - `domain/designation.go` — Validate eligible employer type per designation. Capacity check (10 per district for 140-day). Consecutive year limit (6 years + 1-year break). ORP loophole exemption.
   - `domain/tracking.go` — Day definition: >4 hours = 1 day. Accumulate hours/days against annual limits (110/720 standard, 140/960 for 140-day, unlimited for Critical Shortage).
   - `domain/penalty.go` — 5% of monthly benefit per day over limit. Effective month rule: first business day = full cancellation, subsequent days = 5% each. Non-disclosure: recover both retiree + employer contributions. Deduction spreading across months.
   - `domain/peracare.go` — PERACare subsidy conflict detection when Critical Shortage designation submitted. 30-day response window. Auto-remove subsidy if no response.
   - **Use `math/big.Rat` for all penalty calculations. Never float64. Tests must match to the penny ($0.00 tolerance).**
4. **Frontend** (`frontend/src/components/employer-portal/waret/`): DesignationForm, DesignationDashboard, LimitTracker, AnnualWorksheet

### How to Execute

```
# Read the plan
Read docs/plans/2026-03-19-employer-domain-plan.md — Phase 5 section (Tasks 5.1-5.4)

# Copy patterns from employer-terminations (Phase 4)
# Same go.mod template, same Dockerfile template, same handler/store/domain structure
# domain/penalty.go MUST use math/big.Rat — copy pattern from terminations/domain/refund.go
```

### Build Commands
```bash
# Verify Phase 1+2+3+4 still pass
cd platform/employer-shared && go build ./... && go test ./... -short
cd ../employer-portal && go build ./... && go test ./... -short
cd ../employer-reporting && go build ./... && go test ./... -short
cd ../employer-enrollment && go build ./... && go test ./... -short
cd ../employer-terminations && go build ./... && go test ./... -short
cd ../../frontend && npx tsc --noEmit && npm test -- --run

# Phase 5 builds (after implementation)
cd platform/employer-waret && go build ./... && go test ./... -short -v
```

### Conflict Avoidance
All Phase 5 work is in new directories:
- `platform/employer-waret/` (new)
- `domains/pension/schema/024_employer_waret.sql` (new)
- `frontend/src/components/employer-portal/waret/` (new)
- `frontend/src/hooks/useEmployerWaret.ts` (new)

Minimal overlap with existing files: only `employerApi.ts` (waret client appended), `Employer.ts` (types appended), and `EmployerPortalApp.tsx` (waret tab wired in).

### WARET-Specific Complexity Warnings

1. **Three designation types with different limits:**
   - Standard: 110 days / 720 hours per calendar year
   - 140-Day: 140 days / 960 hours (school employers only, max 10 per district)
   - Critical Shortage: no cap (rural schools/BOCES only)

2. **Day counting rule:** >4 hours in a day = 1 full day. This is NOT rounding — it's a binary threshold.

3. **Effective month rule for penalties:**
   - If work occurs on the first business day of a month → full benefit cancellation for that month
   - Work on subsequent days → 5% of monthly benefit per day over the limit

4. **Consecutive year limit:** Max 6 consecutive years with a designation, then 1-year mandatory break. Track across calendar years.

5. **ORP loophole:** Members who elected ORP in the 1990s and maintained continuous employment are exempt from WARET limits entirely.

6. **PERACare conflict:** Critical Shortage designation triggers a check against PERACare health subsidy. If conflict exists → 30-day letter to retiree → auto-remove subsidy if no response.
