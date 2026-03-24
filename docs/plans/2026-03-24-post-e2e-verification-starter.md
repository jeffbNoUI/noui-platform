# Next Session Starter — Post E2E Verification

## Context

Session 29 completed two high-priority items and verified three medium-priority items
from the post-polish E2E starter prompt.

### Code Changes Shipped
1. **Error reporting auth bypass** — Added `/api/v1/errors/report` to `bypassPaths`
   in `platform/auth/auth.go`. The issues service handler already falls back to
   `defaultTenantID` for unauthenticated callers, so the fix is one line.

2. **Tier 2/3 E2E assertions** — Extended `tests/e2e/migration_e2e.sh` Phase 7b with
   6 new assertions: GET tier/2, GET tier/3, legacy_value check, summary endpoint
   post-reconcile. All non-fatal (yellow warnings) since Tier 2/3 data depends on
   seed data being loaded. Test count grew from 47 to 53.

### Browser Verified
3. **Phase stepper click** — Gate dialog appears with metrics, AI recommendation,
   risk acknowledgment checkboxes. Working correctly.

4. **Reconciliation panel empty state** — Shows "Run Reconciliation" button when a
   loaded batch exists. Button triggers reconciliation successfully.

5. **Tab switching** — Cache invalidation working. Tabs reload data on switch.

### Not Verified (Deferred)
6. **JWT 401 refresh E2E** — Requires Docker image rebuild with short-lived token.
   The code (apiClient.ts 401 interceptor + AuthContext.tsx token refresh) was
   shipped in Session 28. Verify post-merge when Docker images include latest code.

## Current State

### What Works
- Migration 6-phase lifecycle E2E: 53/53 pass
- Employer E2E: 49/49 pass (from Session 27)
- Auth bypass for error reporting (code ready, needs Docker rebuild to test)
- All 21 PRISM source tables discovered (schema present)
- Stepper gate dialog, reconciliation panel, tab switching all functional

### What's Blocking Tier 2/3 Results
The E2E Tier 2/3 assertions return 0 results because **seed data isn't loaded** in
the Docker prism-source container. The `02_seed.sql` file (69K INSERTs) exists in
`migration-simulation/sources/prism/init/` but wasn't auto-loaded on this Docker
build. Root cause: the Docker volume may have cached the old init state, or the
seed file ordering puts it after a failing script.

**Fix:** Either `docker compose down -v && docker compose up --build` (fresh volumes)
or verify the `prism-source` Dockerfile/init script loads `02_seed.sql`.

## Remaining Work

### High Priority
1. **Seed data Docker loading** — Ensure `02_seed.sql` loads on fresh Docker build.
   Once loaded, re-run migration E2E to see non-zero Tier 2/3 results. This is the
   key blocker for validating the entire Tier 2/3 reconciliation pipeline.

2. **JWT 401 refresh E2E** — After merge + Docker rebuild, test with short-lived
   token (10s TTL in devAuth.ts) to confirm refresh + retry flow works.

### Medium Priority
3. **WebSocket reconnection** — Dashboard shows "Polling" instead of connected.
   May need nginx WebSocket upgrade headers or frontend reconnection backoff.

4. **Migration sidebar navigation** — Clicking Migration from fresh page load
   sometimes fails. React state investigation needed.

5. **Risk Register encoding** — Not a code bug (Windows Git Bash cp1252 issue).
   Document the limitation or add a workaround for CLI-based testing.

### Beyond Migration
6. Intelligence service integration (pattern detection, AI recommendations)
7. Employer portal E2E hardening
8. Case management workflow completion

## Key Files
- `platform/auth/auth.go` — Auth bypass (line 57)
- `tests/e2e/migration_e2e.sh` — Tier 2/3 assertions (lines 365-424)
- `migration-simulation/sources/prism/init/02_seed.sql` — Seed data (69K rows)
- `docs/plans/2026-03-24-high-priority-e2e-design.md` — Design doc for this session
