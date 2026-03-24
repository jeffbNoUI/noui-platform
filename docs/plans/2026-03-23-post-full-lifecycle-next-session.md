# Next Session Starter — Post Full Lifecycle Verification

## Context

Session 26 completed a full 6-phase migration lifecycle walkthrough through the
browser with real seed data (100 PRISM members). Two bugs were fixed:

1. **Exception table schema drift** — Migration 041 added 10 missing columns to
   `migration.exception` that the Go code expected but the DB didn't have.

2. **Scope-aware batch resolver** — `resolveSourceTable` now uses `scopeCanonicalHints`
   to match batch scopes (ACTIVE_MEMBERS, SALARY_HISTORY, etc.) to the correct
   source table instead of picking the first alphabetical mapping.

### Verification Results
- 100 members loaded, 39 Tier 1 reconciliation records (all MATCH)
- Gate score 100%, certification completed end-to-end through UI
- 11/11 Go packages pass, 6 new scope-matching tests

### Commits (PR #152, merged)
- `[platform/migration] Fix exception table schema drift — add missing columns`
- `[platform/migration] Scope-aware batch source table resolver`

## Current State

The migration module is functionally complete for the demo path:
- Discovery → Profiling → Mapping → Transformation → Reconciliation → Certification
- All 6 phases work end-to-end through the browser with real data
- E2E tests: 47/47 (baseline from Session 25)

## Remaining Work — Migration Polish

### High Priority
1. **Seed data for all source tables** — Only `prism_member` has data (100 rows).
   Tables like `prism_beneficiary`, `prism_svc_credit`, `prism_contrib_legacy` are
   empty. The data generator creates them but the seed SQL may need the full set.
   Run `prism_data_generator.py` and verify all 21 tables have data.

2. **Batch status polling after JWT expiry** — When the dev JWT expires, polling
   fails silently and batch status sticks at RUNNING. The user sees no indication.
   Options: auto-refresh token, show "session expired" toast, or extend dev token TTL.

3. **Reconciliation with Tier 2/3 data** — Current recon only produces Tier 1
   (benefit calculation) results. Tier 2 (payment history) and Tier 3 (demographic)
   need the source_loader to populate canonical tables with the right columns.

### Medium Priority
4. **Risk Register encoding** — Dashboard shows "Risk ◆" (garbled character) in
   risk register cards. Likely a Unicode/emoji encoding issue in the seed data.

5. **Error reporting endpoint** — `POST /api/v1/errors/report` returns 405. The
   frontend error boundary tries to report errors but the endpoint doesn't exist.

6. **Phase stepper click reliability** — Clicking stepper circles sometimes doesn't
   trigger the gate dialog if the engagement data hasn't been re-fetched after a
   tab switch. May need React Query invalidation on tab change.

### Low Priority
7. **0-row profiling display** — Tables show "0 rows" in Discovery even when they
   have data (row count query may be running before data is loaded, or using wrong schema).

8. **Reconciliation panel for 0 records** — Shows "no data" when total_records=0,
   which blocks certification on empty engagements. Consider showing gate score even
   with 0 records, or adding a "skip reconciliation" option for test engagements.

## Key Files

- `platform/migration/api/batch_handlers.go` — scope resolver + batch execution
- `platform/migration/db/migrations/041_exception_schema_align.sql` — schema fix
- `platform/migration/batch/source_loader.go` — reference data loading for recon
- `frontend/src/components/migration/engagement/ReconciliationPanel.tsx` — recon UI
- `frontend/src/components/migration/engagement/ParallelRunPanel.tsx` — certification
- `migration-simulation/sources/prism/prism_data_generator.py` — seed data generator

## Beyond Migration — Platform Next Steps

- Intelligence service integration (pattern detection, AI recommendations)
- Employer portal E2E hardening
- Case management workflow completion
- Full E2E suite with populated source data
