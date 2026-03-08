# Phase 5: Full Stack Verification & Cleanup

## Goal

Verify the complete integrated stack works end-to-end. Clean up demo data. Run all tests. Update documentation.

## Context

Read `docs/INTEGRATION_PLAN.md` for the full plan. This is Phase 5 of 5.

## Entry Criteria

- Phases 1-4 complete: all services running on real APIs

## Tasks

1. Run `/session-start`
2. `docker compose up` — all services running
3. Full UI walkthrough:
   - Staff portal → select member 10001 (Robert Martinez) → verify all dashboard cards
   - Switch to member 10002 (Jennifer Kim) → verify data changes correctly
   - Switch to member 10003 (David Washington) → verify data
   - Check each card: Summary, Details, Service Credit, Beneficiary, Active Work, Interaction History, Correspondence, Data Quality
4. Run all frontend tests: `cd frontend && npm test -- --run`
5. Run all Go service tests:
   - `cd platform/dataaccess && go test ./...`
   - `cd platform/intelligence && go test ./...`
   - `cd platform/crm && go test ./...`
   - `cd platform/correspondence && go test ./...`
   - `cd platform/dataquality && go test ./...`
   - `cd platform/knowledgebase && go test ./...`
6. Clean up demo data:
   - Decide: delete `crmDemoData.ts` or keep as dev fallback?
   - Remove unused demo arrays from `demoData.ts` (keep WORK_QUEUE)
   - Add comments to any remaining demo files explaining their purpose
7. Update `docs/INTEGRATION_PLAN.md` — mark all phases complete
8. Update `BUILD_HISTORY.md` with full integration milestone entry
9. Commit all changes from Phases 1-5 (or verify all were committed per-phase)
10. Push and verify CI passes

## Exit Criteria

- All 8 dashboard cards show real data (except work queue = demo)
- All frontend tests pass
- All Go service tests pass
- BUILD_HISTORY.md updated
- CI green
