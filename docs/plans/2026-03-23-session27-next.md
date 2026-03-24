# Next Session Starter — Post Migration Polish

## Context

Session 27 (PR #153) completed all 8 items from the migration polish list:
- All 21 PRISM source tables now have seed data (69K INSERTs)
- Toast notification system for 401/session expiry
- Tier 3 demographic reconciliation (migration 042 + PRISM/PAS loaders)
- Error reporting nginx proxy route fix
- 0-row profiling COUNT(*) fallback
- ReconciliationPanel actionable 0-record state
- Phase stepper tab-change refetch

## Current State

- Migration module: all 6 phases work E2E through browser
- Seed data: PRISM (15MB, 21 tables), PAS (123MB, 31 tables)
- Reconciliation: Tier 1 (benefit calc), Tier 2 (payments), Tier 3 (demographics)
- Go tests: 11/11 packages pass
- Frontend: 235 test files, 1856 tests pass
- CI: Pre-existing failures on main (lint warning count, healthagg timeout)

## Recommended Next Steps

### Docker E2E Verification (High Priority)
1. Rebuild Docker stack with new seed data
2. Verify all 21 PRISM tables show correct row counts in Discovery (tests 0-row fix)
3. Verify error reporting reaches issues service (tests nginx proxy fix)
4. Run full lifecycle with Tier 3 reconciliation
5. Check Risk Register for garbled characters (data-level fix needed)

### CI Fixes (Medium Priority)
6. Fix Frontend lint — 75 warnings causing exit code 1. Most are pre-existing:
   - `react-refresh/only-export-components` in shared.tsx, AuthContext.tsx
   - `react-hooks/set-state-in-effect` in DemoCases.tsx
   - Unused eslint-disable directives in useMigrationApi.ts
   Options: raise `--max-warnings` threshold or fix the warnings
7. E2E healthagg timeout — likely Docker networking in CI runner

### Beyond Migration
8. Intelligence service integration (pattern detection, AI recommendations)
9. Employer portal E2E hardening
10. Case management workflow completion

## Key Files

- `frontend/src/components/Toast.tsx` — New toast notification system
- `platform/migration/batch/source_loader.go` — Tier 1/2/3 loaders
- `platform/migration/db/migrations/042_demographic_snapshot.sql` — Tier 3 table
- `platform/migration/db/source.go` — Discovery row count fix
- `migration-simulation/sources/prism/prism_data_generator.py` — Full 21-table generator
