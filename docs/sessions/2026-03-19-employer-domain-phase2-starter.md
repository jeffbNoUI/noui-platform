# Next Session Starter — Employer Domain Phase 2: Reporting Engine

## Current State (as of 2026-03-19)

**Branch:** `claude/pedantic-kepler` (worktree at `.claude/worktrees/pedantic-kepler`)
**Phase 1 complete.** Phase 2 ready to start.

### What Phase 1 Built
- `platform/employer-shared/` — Shared Go module (types, divisions, enums). 7 tests.
- `platform/employer-portal/` — Go service on port 8094 (role mgmt, dashboard, alerts, rate tables, divisions). 24 tests.
- `domains/pension/schema/020_employer_shared.sql` — 5 tables, 14 seeded COPERA rate rows (Jan 2025 + Jan 2026).
- `frontend/src/components/employer-portal/` — New portal directory (EmployerPortalApp, OrgBanner, AlertBanner, PortalNav, EmployerDashboard). 6 tests.
- `frontend/src/types/Employer.ts`, `frontend/src/lib/employerApi.ts`, `frontend/src/hooks/useEmployerPortal.ts` — Types, API client, 10 hooks.
- `frontend/vite.config.ts` — 6 proxy routes for employer services (ports 8094-8099).
- Test totals: 1,636 frontend tests (206 files), 31 Go tests across employer modules. All passing.

### Key Documents
- **Design doc:** `docs/plans/2026-03-19-employer-domain-design.md` — Full 7-domain architecture, gap register, data status
- **Implementation plan:** `docs/plans/2026-03-19-employer-domain-plan.md` — 8 phases, 30+ tasks with exact file paths and patterns
- **COPERA rate data:** `docs/copera-contribution-rates-jan2026.md` — Official rates, already seeded in DB
- **Authoritative spec:** `docs/noui-copera-employer-domain-functionality.md` (in main repo, not worktree)
- **Gap register:** In the design doc, "Data Status" section — late interest rate, ORP rates, payment threshold still gaps

### What Phase 2 Builds

**Employer Reporting Engine** — `platform/employer-reporting/` on port 8095.

From the plan (Task 2.1 through 2.4):

1. **Database schema** (`domains/pension/schema/021_employer_reporting.sql`): contribution_file, contribution_record, contribution_exception, contribution_payment, late_interest_accrual
2. **Go service** with 15+ API endpoints: file upload (text/Excel), manual grid entry, validation, exception queue, payment setup, corrections, late interest
3. **Validation engine** (`domain/validator.go`): rate validation against contribution_rate_table, enrollment check (SSN match), retiree/IC detection, salary spreading, partial posting
4. **ORP separate code path**: Validate AED/SAED on ORP payroll only (not DB contribution rates). ORP member contributions go to ORP provider, not COPERA.
5. **Frontend** (`frontend/src/components/employer-portal/reporting/`): FileUpload, ManualGrid, ValidationProgress, ExceptionDashboard, CorrectionWorkflow, PaymentSetup

### How to Execute

```
# Read the plan
Read docs/plans/2026-03-19-employer-domain-plan.md — Phase 2 section (Tasks 2.1-2.4)

# Use subagent-driven development
Invoke superpowers:subagent-driven-development to execute tasks

# Or manual execution following the plan task-by-task
```

### Build Commands
```bash
# Verify Phase 1 still passes
cd platform/employer-shared && go build ./... && go test ./... -short
cd ../employer-portal && go build ./... && go test ./... -short
cd ../../frontend && npx tsc --noEmit && npm test -- --run

# Phase 2 builds (after implementation)
cd platform/employer-reporting && go build ./... && go test ./... -short -v
```

### Conflict Avoidance
All Phase 2 work is in new directories:
- `platform/employer-reporting/` (new)
- `domains/pension/schema/021_employer_reporting.sql` (new)
- `frontend/src/components/employer-portal/reporting/` (new)
- `frontend/src/hooks/useEmployerReporting.ts` (new)

Zero overlap with any existing files. Safe for parallel work.

### Data Gaps (Not Blocking Phase 2 Core)
- **Late interest rate** — schema slots ready, no values. Build calculation framework, defer actual rates.
- **ORP member contribution rate** — not a COPERA concern. Build ORP flag + AED/SAED validation path.
- **Payment discrepancy threshold** — build configurable field, defer value.
- These gaps only affect specific sub-features, not the core validation engine.
