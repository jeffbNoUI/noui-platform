# Next Session Starter

## Current State (as of 2026-03-23)

**Migration module is functionally complete** — all 6 phases work end-to-end
through the browser with real data (100 PRISM members).

**Docker E2E: 166/166 across 5 suites** — connector, dataaccess, intelligence,
employer, case-management. Zero skips, zero failures.

### Recent Sessions (23–26)

| Session | What |
|---------|------|
| 23 | Migration wrap-up: certification, lineage, UI fixes, E2E hardening |
| 24 | Migration UI walkthrough: 6 phases, 5 bugs fixed |
| 25 | Migration pipeline fixes: batch scope + NaN guard |
| 26 | Migration full lifecycle: exception schema + scope-aware resolver |
| 26b | E2E hardening: dbcontext stale conn, employer auth/date bugs (PR #155) |

### Open PR

- **PR #155** — E2E hardening: tests, seed data, assert/JWT helpers, PgBouncer timeout
  - Supplements PR #134 (already merged) with additional test coverage
  - 7 files: new unit tests, employer seed SQL, multi-code assert_status, UUID JWT sub

## Recommended Next Steps (priority order)

### High Priority
1. **Seed data for all 21 source tables** — Only `prism_member` has data (100 rows).
   Run `prism_data_generator.py` and verify all 21 tables populate.
2. **Batch status polling after JWT expiry** — Polling fails silently, batch stuck
   at RUNNING. Options: auto-refresh, "session expired" toast, or extend dev TTL.
3. **Reconciliation with Tier 2/3 data** — Current recon is Tier 1 only (benefit calc).
   Needs source_loader to populate canonical tables for payment history + demographics.

### Medium Priority
4. **Risk Register encoding** — Dashboard shows garbled Unicode in risk register cards.
5. **Error reporting endpoint** — `POST /api/v1/errors/report` returns 405.
6. **Phase stepper click reliability** — Gate dialog sometimes doesn't trigger after tab switch.

### Low Priority
7. **0-row profiling display** — Tables show "0 rows" even when they have data.
8. **Reconciliation panel for 0 records** — Blocks certification on empty engagements.

### Pre-existing Code Quality
9. **`sumAmounts` uses float64** in `platform/employer-reporting/api/handlers.go` —
   violates fiduciary rule ("Use big.Rat or scaled integers, never float64").

## Detailed Starter Prompt

For full context including key files, verification results, and beyond-migration
platform next steps, see: `docs/plans/2026-03-23-post-full-lifecycle-next-session.md`
