# Starter Prompt — Post WebSocket & Sidebar Nav Fixes

**Date:** 2026-03-24
**Previous session:** 31 (WebSocket reconnection + sidebar nav race condition)
**Branch:** `fix/ws-reconnect-sidebar-nav` (PR #164)

## Context

Session 31 fixed two medium-priority frontend bugs:

1. **WebSocket reconnection** (`useMigrationEvents.ts`): After exhausting 5 reconnect
   attempts, the hook permanently fell back to polling with no recovery. Now probes for
   WebSocket every 30s while in fallback mode + immediately on tab visibility change.
   Successful probe resets to full WebSocket mode.

2. **Sidebar nav race condition** (`EngagementDetail.tsx`): The `defaultTab` useEffect
   fired on every `engagement.status` refetch, overwriting user tab clicks. Now uses a
   `useRef` to track user intent — auto-select only fires on initial load or engagement
   navigation change.

Also created PR #163 for the `claude/affectionate-bell` branch (Tier 2/3 recon fixes,
JWT refresh tests, auth bypass, seed data gen).

## Open PRs to Check

| PR | Branch | Content |
|----|--------|---------|
| #163 | `claude/affectionate-bell` | Tier 2/3 recon + JWT + auth bypass |
| #164 | `fix/ws-reconnect-sidebar-nav` | WebSocket reconnect + sidebar nav |

Check if these have been merged. If not, review CI status and merge if green.

## Remaining Work (Priority Order)

### High Priority
1. **Risk Register encoding fix** — Deferred since session 28. Needs Docker stack + risk
   seed data. The risk register panel renders but data encoding may have issues with
   special characters.

### Medium Priority
2. **Seed data Docker auto-loading** — `02_seed.sql` is not auto-loading in Docker,
   causing 0 Tier 2/3 reconciliation results in E2E. The seed data exists (69K INSERTs
   across 21 tables) but the Docker init script doesn't pick it up.

3. **JWT 401 refresh E2E** — Unit tests pass (3 tests in `apiClient.test.ts`), but no
   Docker E2E verification with a short-lived token. Need to rebuild Docker with latest
   code and test the full flow.

### Lower Priority
4. **WebSocket server authentication** — `CheckOrigin` always returns `true` and no JWT
   validation on WebSocket upgrade. Security gap identified in session 31 exploration.
   The route is registered before the auth middleware chain in `migration/main.go`.

5. **WebSocket broadcast wiring** — The Hub infrastructure exists but no API handlers
   actually call `Hub.Broadcast()`. Events are never pushed to connected clients in
   production. The broadcast code exists in tests but not in handlers.

## Quick Verification

```bash
# Check PR status
gh pr list --state open

# Frontend health
cd frontend && npx tsc --noEmit && npm test -- --run

# Go health (migration service — most active)
cd platform/migration && go build ./... && go test ./... -short
```

## Files Modified in Session 31

| File | Change |
|------|--------|
| `frontend/src/hooks/useMigrationEvents.ts` | Periodic reconnect probe (30s) + visibility listener |
| `frontend/src/components/migration/engagement/EngagementDetail.tsx` | `useRef` for user tab intent, prevent defaultTab overwrite |
