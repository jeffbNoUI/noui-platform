# Session Starter — Employer Domain Phase 8: Cross-Service Enhancement

## Context

Phases 1–7 of the employer domain are complete and merged. The platform now has:
- **7 Go modules** (employer-shared + 6 services) with 234 tests
- **6 backend services** running on ports 8094–8099, all in Docker + CI
- **Tabbed EmployerPortalApp** with 6 domain tabs, wired into App.tsx
- **1,709 frontend tests** across 212 files, all passing

## What Phase 8 Covers

Phase 8 is documented in `docs/plans/2026-03-19-employer-domain-plan.md` (bottom section).
It enhances existing pension-domain services to be employer-aware:

### 8.1 — Data Access Service Enhancement
- Add employer-scoped member queries to `platform/dataaccess/`
- Employers should only see their own members (employer_id filter)
- New endpoints: `GET /api/v1/members?employer_id=...`

### 8.2 — CRM Integration
- Add employer contact type to `platform/crm/`
- Employer-initiated interactions (contribution questions, enrollment issues)
- Link CRM interactions to employer_id

### 8.3 — Correspondence Templates
- Add employer-facing letter templates to `platform/correspondence/`
- Enrollment confirmations, termination acknowledgments, contribution notices

### 8.4 — Data Quality Rules
- Add employer-specific DQ checks to `platform/dataquality/`
- Contribution amount validation, enrollment timeliness, reporting compliance

### 8.5 — Case Management Triggers
- Employer events (enrollment, termination) that should auto-create cases
- Link existing case workflow to employer actions

## Important Notes

- This phase touches **existing services** — requires conflict-avoidance strategy
- Each enhancement should be backward-compatible (existing pension endpoints unchanged)
- Create a detailed task-level plan before coding (Boris Rule applies — multi-file changes)
- Data dependencies checklist in the plan doc should be reviewed before starting

## Verification

```bash
# Verify current state before starting
cd platform/employer-shared && go build ./... && go test ./... -short
cd platform/employer-portal && go build ./... && go test ./... -short
cd frontend && npx tsc --noEmit && npm test -- --run
```

## Read First
1. `BUILD_HISTORY.md` — full history of Phases 1–7
2. `docs/plans/2026-03-19-employer-domain-plan.md` — Phase 8 section
3. CLAUDE.md files in any service you plan to modify
