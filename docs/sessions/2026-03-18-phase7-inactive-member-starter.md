# Phase 7 Session Starter — Inactive Member Experience

## Context
Phases 1–6 (Tasks 1–50) are complete and merged to main.
The member portal now has: dashboard router, profile section, what-if calculator
with guided wizard and saved scenarios, contextual help, the full 5-stage
retirement application flow, My Benefit section (payments, tax documents,
benefit details, manage tab), death notification page, survivor claim tracker,
and lump sum death benefit view. All 1,410 tests passing across 178 test files.

## What to Build
Execute Phase 7 (Tasks 51–55) from `docs/plans/2026-03-17-member-portal-redesign-plan.md`.

### Tasks
- **Task 51: Deferred Benefit Explorer** — Adapts guided wizard for inactive members (frozen salary, deferred start date). Same intelligence APIs.
- **Task 52: Refund Estimate Display** — Employee contributions + interest = total. Tax implications: 20% withholding vs IRA rollover comparison.
- **Task 53: Refund Application Flow** — 5-stage simplified flow with double confirmation and staff processing status.
- **Task 54: Backend — Refund Estimate Endpoint** — `GET /api/v1/members/{id}/refund-estimate` in platform/dataaccess. First backend work in this plan.
- **Task 55: Backend — Payment History & Tax Document Endpoints** — Payment history, tax documents, addresses endpoints in platform/dataaccess.

### Key Patterns to Follow
- Frontend tab/section pattern: see `frontend/src/components/portal/benefit/BenefitSection.tsx`
- Wizard pattern: see `frontend/src/components/portal/calculator/` (guided wizard)
- Application flow: see `frontend/src/components/portal/application/ApplicationSection.tsx`
- Test helpers: `frontend/src/test/helpers.tsx` (renderWithProviders)
- Design system: `frontend/src/lib/designSystem.ts` (C colors, DISPLAY/BODY fonts)
- API client: `frontend/src/lib/memberPortalApi.ts` (refundAPI already exists)
- Go handler pattern: `platform/dataaccess/api/handlers.go`

### Notes
- Phase 7 is the first phase that touches Go backend code (Tasks 54–55)
- The `refundAPI.estimate()` frontend call already exists in `memberPortalApi.ts`
- Inactive members have `status_code: 'inactive'` or `'deferred'` — resolved to `'inactive'` persona
- The inactive dashboard already exists in `DashboardRouter.tsx`
- Wire new components into `MemberPortal.tsx` router (follow the `benefit` section pattern)
