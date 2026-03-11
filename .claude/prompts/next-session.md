# Next Session Starter

## Current State (as of 2026-03-10)

**PR #19 merged. Full-stack integration is COMPLETE.** All demo data has been replaced with live PostgreSQL-backed APIs.

**Option A (Fix Test Fixture Types) is DONE** on branch `claude/happy-villani` — ready to merge. `tsc --noEmit` now reports 0 errors (was 105). All 197 frontend tests pass.

**What was fixed in Option A:**
- Installed missing `@testing-library/dom` peer dependency (23 import errors)
- Added `/// <reference types="vitest/globals" />` to `vite-env.d.ts` (1 error)
- Completed `mockCalculation.eligibility` in shared fixtures with 7 missing required fields (70+ errors)
- Changed `null` → `undefined` in 5 test files, fixed minor mock data issues (12 errors)
- Added explicit type annotations (`BenefitCalcResult`, `Member`) to fixture declarations

**What's built and running on main:**
- 10-service Docker Compose stack: 7 Go services + PostgreSQL + connector + nginx frontend
- All 12 PostgreSQL init scripts (schema + seed) run on first boot
- Staff Portal work queue showing 4 live retirement cases from `platform/casemanagement/` (port 8088)
- Member Dashboard with 8 cards — all showing live data (no demo fallback anywhere)
- CRM, Correspondence, Data Quality, Case Management all wired to real APIs
- `demoData.ts` deleted — all frontend data comes from Go services
- 197/197 frontend tests passing, all Go services build clean, 9/9 CI checks green

**Services:**

| Service | Port | Status |
|---------|------|--------|
| `platform/dataaccess` | 8081 | Live — member/salary/benefit queries |
| `platform/intelligence` | 8082 | Live — eligibility, benefit calc, DRO |
| `platform/crm` | 8083 (host: 8084) | Live — contacts, interactions, messaging |
| `platform/correspondence` | 8085 | Live — templates, merge fields, letters |
| `platform/dataquality` | 8086 | Live — quality checks, scoring, issues |
| `platform/knowledgebase` | 8087 | Live — articles, stage help, search |
| `platform/casemanagement` | 8088 | Live — case workflow, 7 stages, work queue |
| `connector` | 8090 | Live — schema introspection |

## Build Verification

Run these to confirm the codebase is green before starting work:

```bash
# Frontend (tsc is now a reliable gate after Option A!)
cd frontend && npx tsc --noEmit && npm test -- --run

# Go services (each independent module)
cd platform/dataaccess && go build ./... && go test ./...
cd platform/intelligence && go build ./... && go test ./...
cd platform/crm && go build ./... && go test ./...
cd platform/casemanagement && go build ./...
```

## What to Work On Next

Choose from Options B through E:

### Option B: End-to-End Workflow Testing
Click through cases in the browser: open a case from the work queue, advance stages, verify the full 7-stage workflow from Application Intake to Certification. Requires Docker stack running (`docker compose up --build`). Tests the case management API's `POST /api/v1/cases/{id}/advance` endpoint and stage transition audit trail.

### Option C: Case Management Go Tests
The `platform/casemanagement/` service has zero test coverage (`[no test files]` for all packages). Adding handler tests and data access tests would match the pattern in `platform/crm/api/handlers_test.go` and `platform/dataaccess/api/handlers_test.go`.

### Option D: Member Portal CRM Messaging
`crmDemoData.ts` still provides cross-portal messaging data (conversations, staff notes, member messages). Wire the Member Portal conversation view to the real CRM API so members see their actual interaction history.

### Option E: User's Choice
The platform is at a stable milestone. Good time for new features, polish, or hardening.
