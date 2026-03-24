# Next Session Starter — Post-Polish E2E Verification

## Context

Session 28 addressed the open items from the post-JWT/recon/polish starter prompt:

### Code Fixes Shipped
1. **Nginx error reporting route** — Added `/api/v1/errors` location block proxying to
   `issues:8092`. Previously fell through to SPA catch-all returning HTML.

2. **0-row profiling display** — PostgreSQL discovery now uses `pg_class.reltuples`
   (always populated) instead of `pg_stat_user_tables.n_live_tup` (requires ANALYZE).
   Falls back to `COUNT(*)` if `pg_class` fails. MSSQL fixed: uses `sql.Named("p1", ...)`
   with `sys.schemas`/`sys.tables` JOIN instead of broken `QUOTENAME(@p1)` + `OBJECT_ID()`.
   Silent error swallowing replaced with `slog.Warn`.

3. **ReconciliationPanel empty state** — Dead-end "No data" message replaced with
   context-aware UI: shows "Run Reconciliation" button when a LOADED batch exists,
   explains prerequisite when no batch loaded. 2 new tests added (1858 total).

4. **PgBouncer pool tuning** — `default_pool_size` 20→30, `query_wait_timeout` 10→30s,
   `reserve_pool_size` 5→10 to handle 16+ service startup thundering herd.

5. **Seed data generated** — Ran `prism_data_generator.py` to create `02_seed.sql`
   (69,160 INSERT statements across all 21 PRISM source tables). Future Docker builds
   auto-load this data.

### Investigated & Resolved
6. **Risk Register encoding** — NOT a code bug. Windows Git Bash sends command-line
   arguments in cp1252 (console code page), not UTF-8. Characters in the Latin-1
   supplement range (é, ñ, ü) get single-byte encoded instead of UTF-8 multi-byte.
   Browser `fetch()` sends proper UTF-8 — no production impact. Verified by sending
   UTF-8 payload from file: all characters stored and retrieved correctly.

### Verification
- Go migration: 11/11 packages pass
- Frontend: 235/235 test files, 1858/1858 tests pass, typecheck clean
- Docker: 24-container stack healthy after pgbouncer tuning
- API: Fresh engagement discovery returns correct row counts for all 21 tables
- Nginx: `/api/v1/errors/report` returns 401 (hits service) instead of HTML

### Commits (PR #TBD)
- `[multi] Nginx error route, row count fix, recon empty state, pgbouncer tuning, seed data`

## Current State

The migration module has:
- Full 6-phase lifecycle (Discovery → Certification) working E2E
- Tier 1 reconciliation verified with 100 real members (100% MATCH)
- Tier 2/3 reconciliation code complete + data loaders implemented (untested E2E)
- JWT auto-refresh + batch auto-polling for long-running operations
- All 21 PRISM source tables populated with seed data (auto-loaded on Docker build)
- Correct row counts in Discovery panel
- Actionable ReconciliationPanel empty state

## Remaining Work

### High Priority
1. **E2E Tier 2/3 reconciliation** — Run a full batch with the populated seed data
   (100 members, 44K salary periods, 20K contributions, 529 payments). Execute:
   Discovery → select tables → Profile → Map → Transform → Reconcile. Verify Tier 2
   payment matching (±2% tolerance) and Tier 3 salary outlier / contribution total /
   service credit span checks produce meaningful results.

2. **Error reporting auth bypass** — `POST /api/v1/errors/report` requires auth (401),
   but error reports should work even when JWT is expired (that's the whole point of
   the auth-free errorReporter.ts). The issues service handler needs to exempt
   `/api/v1/errors/report` from auth middleware.

### Medium Priority
3. **JWT 401 refresh E2E verification** — Test with an intentionally short-lived
   token (set TTL to 10s in devAuth.ts temporarily) to confirm the refresh + retry
   flow works end-to-end. Restore 24h TTL after verification.

4. **Phase stepper click E2E verification** — Create an engagement, advance through
   phases, switch tabs, click stepper circles to verify the gate dialog reliably
   triggers after the cache invalidation fix from Session 27.

5. **Reconciliation panel E2E** — Create engagement, load batch, navigate to
   Reconciliation tab, verify the "Run Reconciliation" button appears in the empty
   state and triggers reconciliation successfully.

### Low Priority
6. **WebSocket reconnection** — Dashboard shows "WebSocket: Polling" instead of
   connected. The WS endpoint may not be accessible through the current Docker
   networking setup, or the frontend needs a reconnection backoff.

7. **Migration module navigation from homepage** — Clicking the Migration sidebar
   button from a fresh page load sometimes fails to switch modules. May need a
   React state investigation.

## Key Files

- `frontend/nginx.conf` — New `/api/v1/errors` location block (line 96)
- `platform/migration/db/source.go` — pg_class.reltuples + MSSQL named params
- `frontend/src/components/migration/engagement/ReconciliationPanel.tsx` — New empty state
- `infrastructure/pgbouncer/pgbouncer.ini` — Tuned pool sizes and timeouts
- `migration-simulation/sources/prism/init/02_seed.sql` — Generated seed data (69K rows)
- `migration-simulation/sources/prism/prism_data_generator.py` — Seed data generator

## Beyond Migration

- Intelligence service integration (pattern detection, AI recommendations)
- Employer portal E2E hardening
- Case management workflow completion
- Full E2E suite with populated source data
