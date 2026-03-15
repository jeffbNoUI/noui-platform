# Session 11: E2E Tests + Coverage Gaps + UI Polish

## Goal

Harden the existing feature set with three workstreams:
1. **E2E test suite** for the 7-stage retirement workflow
2. **Component test coverage** for untested portal components
3. **UI polish** — loading states, error boundaries, skeleton screens

## Context

Session 10 wired CSRContextHub to live APIs and added tests for CSR + VendorPortal. The platform now has 381 frontend tests across 40 files. Several areas remain untested:

### Coverage Gaps (no tests exist)
- `MemberPortal.tsx` (~400 lines, CRM messaging, conversations)
- `EmployerPortal.tsx` (~985 lines, 4 tabs, CRM hooks, org selection)
- `RetirementApplication.tsx` (~300 lines, 7-stage workflow, stage mapping)
- `StaffPortal.tsx` (partial — only 1 test in existing file)
- `MemberDashboard.tsx` (5 tests exist, but individual dashboard cards mostly untested)

### E2E Workflow (from Session 8 E2E testing)
The 7-stage retirement workflow was manually verified in browser (Session 8), but there's no automated test suite. Key flows to automate:
- Stage advancement (advance button → POST /advance → UI update)
- Auto-skip logic (non-DRO cases skip Marital Share stage)
- DRO flag preventing auto-skip
- Frontend-only stages (Salary & AMS, Scenario) advance without backend calls
- Certify & Submit button

### UI Polish Opportunities
- Loading skeletons on Supervisor/Executive dashboards (currently show empty state briefly)
- Error boundaries around each dashboard card (one API failure shouldn't crash the whole dashboard)
- Consistent loading spinners across all views
- Empty state messages for new installations with no data

## Suggested Approach

### Workstream A: RetirementApplication E2E Tests (~15 tests)
File: `frontend/src/components/__tests__/RetirementApplication.test.tsx`

Mock the stage advance mutation, case data, and verify:
- Initial stage renders from backend stageIdx
- Advance button triggers mutation
- Auto-skip fires sequential advances for non-DRO cases
- DRO flag prevents auto-skip
- Frontend-only stages advance locally
- Certify & Submit calls advance

### Workstream B: Portal Component Tests (~20 tests)
Files:
- `frontend/src/components/portal/__tests__/MemberPortal.test.tsx`
- `frontend/src/components/portal/__tests__/EmployerPortal.test.tsx`

Both portals use CRM hooks (conversations, interactions, messaging). Mock the hooks and test:
- Tab rendering and switching
- Message send flow
- Conversation list rendering
- Organization selection (EmployerPortal)

### Workstream C: UI Polish (~5 files)
- Add `ErrorBoundary` wrapper component
- Wrap each dashboard card in error boundary
- Add skeleton loading to SupervisorDashboard and ExecutiveDashboard
- Consistent empty states

## Pre-Session Checklist

1. Read `BUILD_HISTORY.md` — confirm Session 10 changes are merged
2. `cd frontend && npx tsc --noEmit` — verify clean build
3. `cd frontend && npx vitest run` — verify 381 tests passing
4. Review existing test patterns in `frontend/src/components/__tests__/` and `frontend/src/components/staff/__tests__/`

## Success Criteria

- RetirementApplication E2E tests covering the 7-stage workflow
- MemberPortal and EmployerPortal have basic component tests
- Error boundaries prevent cascade failures on dashboard
- Test count: 381 → ~420+
- Zero TypeScript errors, zero test regressions
