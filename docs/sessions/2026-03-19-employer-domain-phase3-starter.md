# Next Session Starter — Employer Domain Phase 3: New Member Enrollment

## Current State (as of 2026-03-19)

**Phase 2 complete.** Phase 3 ready to start.

### What Phase 1 + Phase 2 Built
- `platform/employer-shared/` — Shared Go module (types, divisions, enums). 7 tests.
- `platform/employer-portal/` — Go service on port 8094 (role mgmt, dashboard, alerts, rate tables, divisions). 24 tests.
- `platform/employer-reporting/` — Go service on port 8095 (contribution validation, exceptions, payment setup, late interest). 38 tests.
- `domains/pension/schema/020_employer_shared.sql` — 5 tables, 14 seeded COPERA rate rows.
- `domains/pension/schema/021_employer_reporting.sql` — 5 tables (files, records, exceptions, payments, interest).
- `frontend/src/components/employer-portal/` — Portal app + 6 reporting components.
- `frontend/src/hooks/useEmployerPortal.ts` + `useEmployerReporting.ts` — 24 hooks total.
- `frontend/src/lib/employerApi.ts` — API client for portal + reporting services.
- `frontend/src/types/Employer.ts` — Full type definitions for all Phase 1+2 models.
- Test totals: 1,651 frontend tests (208 files), 69 Go tests across employer modules. All passing.

### Key Documents
- **Design doc:** `docs/plans/2026-03-19-employer-domain-design.md` — Full 7-domain architecture
- **Implementation plan:** `docs/plans/2026-03-19-employer-domain-plan.md` — 8 phases, Tasks 3.1-3.4 for Phase 3
- **COPERA rate data:** `docs/copera-contribution-rates-jan2026.md`

### What Phase 3 Builds

**Employer Enrollment Service** — `platform/employer-enrollment/` on port 8096.

From the plan (Tasks 3.1 through 3.4):

1. **Database schema** (`domains/pension/schema/022_employer_enrollment.sql`): enrollment_submission, enrollment_duplicate_flag, perachoice_election
2. **Go service** with endpoints: new-hire submission, member-submit, duplicate detection/resolution, PERAChoice election, conflict resolution, validation report download
3. **Domain logic:**
   - `domain/enrollment.go` — Mandatory field enforcement (SSN, hire_date, plan_code, division_code, name). Tier assignment from hire_date + division.
   - `domain/duplicates.go` — SSN exact match + name+DOB fuzzy match. Flag for admin review.
   - `domain/perachoice.go` — 60-day election window from hire_date. DC team notification trigger.
4. **Frontend** (`frontend/src/components/employer-portal/enrollment/`): NewHireForm, StatusChangeForm, DuplicateResolution, PERAChoiceTracker

### How to Execute

```
# Read the plan
Read docs/plans/2026-03-19-employer-domain-plan.md — Phase 3 section (Tasks 3.1-3.4)

# Copy patterns from employer-reporting (Phase 2)
# Same go.mod template, same Dockerfile template, same handler/store/domain structure
```

### Build Commands
```bash
# Verify Phase 1+2 still pass
cd platform/employer-shared && go build ./... && go test ./... -short
cd ../employer-portal && go build ./... && go test ./... -short
cd ../employer-reporting && go build ./... && go test ./... -short
cd ../../frontend && npx tsc --noEmit && npm test -- --run

# Phase 3 builds (after implementation)
cd platform/employer-enrollment && go build ./... && go test ./... -short -v
```

### Conflict Avoidance
All Phase 3 work is in new directories:
- `platform/employer-enrollment/` (new)
- `domains/pension/schema/022_employer_enrollment.sql` (new)
- `frontend/src/components/employer-portal/enrollment/` (new)
- `frontend/src/hooks/useEmployerEnrollment.ts` (new)

Zero overlap with any existing files. Safe for parallel work.

### Data Gaps (Not Blocking Phase 3 Core)
- **Complete mandatory enrollment field set** — Build with confirmed fields (SSN, hire_date, plan_code, division_code, name); add fields when COPERA confirms.
- **PERAChoice eligible employer/position categories** — Build 60-day window logic; defer employer/position eligibility filter until COPERA DC Team confirms.
