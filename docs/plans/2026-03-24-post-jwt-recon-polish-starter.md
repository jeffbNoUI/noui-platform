# Next Session Starter — Post JWT + Tier 2/3 Loaders + Polish

## Context

Session 27 addressed three priority areas from the post-lifecycle starter:

### 1. JWT Expiry Silent Failure — Fixed
- `apiClient.ts`: 401 interceptor attempts token refresh via callback, retries once
  with fresh token. Auth header re-applied on retry iteration.
- `AuthContext.tsx`: Registers `refreshToken` callback with apiClient on mount
  (decoupled via module-level function to avoid circular imports).
- `devAuth.ts`: TTL increased from 1h → 24h for dev mode.
- `useMigrationApi.ts`: `useBatch` auto-polls every 5s while status is
  PENDING or RUNNING via `refetchInterval` function.

### 2. Tier 2/3 Reconciliation Data Loaders — Implemented
Six new loaders in `source_loader.go`:

| Loader | Source → Target | Tier |
|--------|----------------|------|
| `loadPRISMSalaryHistory` | `prism_sal_annual` + `prism_sal_period` → `canonical_salaries` | 3a |
| `loadPASSalaryHistory` | `salary_history` → `canonical_salaries` | 3a |
| `loadPRISMContributions` | `prism_contrib_legacy` + `prism_contrib_hist` → `canonical_contributions` | 3b |
| `loadPASContributions` | `contribution_history` → `canonical_contributions` | 3b |
| `loadPRISMServiceCredit` | `prism_svc_credit` + `prism_member` → updates `canonical_members` | 3c |
| `loadPASServiceCredit` | `service_credit_history` + `employment_segment` → updates `canonical_members` | 3c |

Key design decisions:
- PRISM salary: UNION of pre-1998 annual (`PRISM_SAL_ANNUAL`) + post-1998 period
  aggregated by year (`PRISM_SAL_PERIOD`). Uses `PENSION_EARN`/`PENSION_PAY` with
  `GROSS_EARN`/`GROSS_PAY` fallback.
- PRISM contributions: Uses `PRISM_CONTRIB_LEGACY` + `PRISM_CONTRIB_HIST` only —
  NOT `PRISM_SAL_ANNUAL.CONTRIB_AMT` (double-counting per schema docs [P-09]).
- PRISM dates: `parsePRISMDate()` handles mixed VARCHAR formats (YYYYMMDD,
  MMDDYYYY, ISO, US slash).
- PAS service credit: Excludes purchased service (`purchased_flag = false`).
- All loaders called from `LoadSourceReferenceData` after existing calc/payment loaders.

### 3. Polish Items — 2 of 3 Fixed
- **Stepper click reliability**: Added `useQueryClient` + `handleTabChange` in
  `EngagementDetail.tsx` — invalidates `gate-status` and `engagement` queries on
  tab switch.
- **Error reporting**: `errorReporter.ts` now uses raw `fetch` instead of `postAPI`,
  so error reports work even when JWT is expired. Tests updated to mock `fetch`.
- **Risk Register encoding**: NOT fixed — needs Docker + seed data with risk entries
  to reproduce the garbled "Risk ◆" character.

### Verification
- Go migration: 11/11 packages pass
- Frontend: 235/235 test files, 1856/1856 tests pass, typecheck clean
- Docker: Full 24-container stack, Migration dashboard loads with 0 console errors
- All API calls returning 200 with proper auth

### Commits (PR #157)
- `[multi] JWT expiry recovery, Tier 2/3 recon loaders, stepper + error reporter polish`

## Current State

The migration module has:
- Full 6-phase lifecycle (Discovery → Certification) working E2E
- Tier 1 reconciliation verified with 100 real members (100% MATCH)
- Tier 2/3 reconciliation code complete + data loaders implemented (untested E2E)
- JWT auto-refresh + batch auto-polling for long-running operations

## Remaining Work

### High Priority
1. **E2E Tier 2/3 reconciliation** — Run a full batch with populated salary,
   contribution, and service credit data. Verify Tier 2 payment matching (±2%
   tolerance) and Tier 3 salary outlier / contribution total / service credit
   span checks produce meaningful results.

2. **Seed data for all 21 source tables** — Only `prism_member` has data (100 rows).
   Run `prism_data_generator.py` and verify all tables are populated. The Tier 2/3
   loaders need `prism_sal_annual`, `prism_sal_period`, `prism_contrib_legacy`,
   `prism_contrib_hist`, `prism_svc_credit`, and `prism_pmt_hist` to have rows.

3. **Risk Register encoding** — Dashboard shows garbled character in risk register
   cards when risks exist. Reproduce by adding a risk via "+ Add" button or
   loading seed data with risk entries. Likely a Unicode issue in the seed SQL or
   a font rendering issue.

### Medium Priority
4. **JWT 401 refresh E2E verification** — Test with an intentionally short-lived
   token (set TTL to 10s in devAuth.ts temporarily) to confirm the refresh +
   retry flow works end-to-end. Restore 24h TTL after verification.

5. **Error reporting endpoint routing** — `POST /api/v1/errors/report` returns 404
   via nginx even though the issues service handler exists. Check nginx proxy
   config for the `/api/v1/errors/` path — it may not be routed to the issues
   service (port 8092).

6. **Phase stepper click E2E verification** — Create an engagement, advance through
   phases, switch tabs, click stepper circles to verify the gate dialog now
   reliably triggers after cache invalidation fix.

### Low Priority
7. **0-row profiling display** — Tables show "0 rows" in Discovery even when they
   have data.
8. **Reconciliation panel for 0 records** — Consider gate score display with 0
   records or "skip reconciliation" option.

## Key Files

- `frontend/src/lib/apiClient.ts` — 401 handler + token refresh callback
- `frontend/src/contexts/AuthContext.tsx` — refreshToken registration
- `frontend/src/hooks/useMigrationApi.ts` — batch auto-polling
- `frontend/src/lib/errorReporter.ts` — auth-free error reporting
- `frontend/src/components/migration/engagement/EngagementDetail.tsx` — tab cache invalidation
- `platform/migration/batch/source_loader.go` — all 6 new Tier 2/3 loaders
- `migration-simulation/sources/prism/prism_data_generator.py` — seed data generator

## Beyond Migration

- Intelligence service integration (pattern detection, AI recommendations)
- Employer portal E2E hardening
- Case management workflow completion
- Full E2E suite with populated source data
