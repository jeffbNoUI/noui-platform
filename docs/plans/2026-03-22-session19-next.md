# Starter Prompt: Post Session 19 — Next Steps

## Context

Session 19 completed frontend polish and reconciliation UI enhancement. All changes
verified against live Docker backend with real reconciliation data.

**Branch:** `claude/interesting-hamilton` → merged to main

### What Was Done (Session 19)

1. **Phase 5g verification** — Confirmed all 3 bugs already fixed:
   - `dbcontext.go` has `defer tx.Rollback()` (stale connection fix)
   - `userIDOrDefault()` extracts from JWT `sub` claim (uploaded_by fix)
   - `parseFlexDate()` handles both date-only and RFC3339 (hireDate fix)

2. **Frontend polish** (2 fixes):
   - Title truncation on engagement cards (ellipsis overflow)
   - Phase stepper responsive (media query for narrow viewports)
   - Default tab for DISCOVERY already correct — no change needed

3. **Reconciliation UI enhancement:**
   - Tier score cards (T1/T2/T3 with color-coded thresholds)
   - Full variance detail table (collapsible) with legacy vs. recomputed side-by-side
   - Filter bar: category (ALL/MATCH/MINOR/MAJOR/ERROR), tier (All/T1/T2/T3), member ID search
   - Systematic flag indicator + resolved checkmark + suspected domain column

4. **Live verification:** Docker stack seeded, batches executed and reconciled via API.
   PRISM 39/39 MATCH (gate 1.0), PAS 26/26 MATCH (gate 1.0). ReconciliationPanel
   confirmed rendering with real data.

### Stats
- 4 files changed (+440 lines)
- Frontend: 231 test files, 1838 tests passing
- Migration Go: 11 packages passing

## Recommended Next Steps (in priority order)

### 1. Reconciliation Detail Table — Rate Limit Fix

The tier-specific reconciliation endpoint (`GET /reconciliation/tier/:n`) returns 429
when called 3 times in quick succession (T1, T2, T3). The `useReconciliation` hook
fetches all records in one call, so the detail table works, but the tier breakdown
sections don't populate.

**Fix:** Either increase the rate limit for reconciliation endpoints, or consolidate
the 3 tier calls into the single `useReconciliation` call and filter client-side.

### 2. Migration Intelligence Integration

The `migration-intelligence` Python service runs in Docker but isn't wired into the
reconciliation flow. Next step: have the Go reconciler call the Python service for
pattern detection on variance clusters.

**Key files:**
- `platform/migration/intelligence/` — Go client
- `migration-simulation/formula/benefit.py` — Python formula module
- Docker service: `migration-intelligence` on port 8101

### 3. Reconciliation Batch Trigger Button

The `reconcileBatch()` API function exists in `migrationApi.ts` but has no UI button.
Add a "Run Reconciliation" button to the TransformationPanel or BatchDetail after
batch execution completes.

### 4. Resolution Workflow

The `Reconciliation` type has `resolved`, `resolved_by`, `resolution_note` fields but
no UI for marking records as resolved. Add a resolution modal/inline action to the
detail table rows.

### 5. Migration Frontend — Remaining Polish

- Source connection test button on engagement creation
- Batch progress indicator during execution
- WebSocket reconnection (currently shows "Disconnected" dot)

## Key Files

### Modified in Session 19
- `frontend/src/components/migration/dashboard/EngagementList.tsx` — title truncation
- `frontend/src/components/migration/engagement/PhaseStepper.tsx` — responsive CSS
- `frontend/src/components/migration/engagement/ReconciliationPanel.tsx` — full enhancement

### Reconciliation Backend
- `platform/migration/reconciler/formula.go` — benefit recomputation
- `platform/migration/reconciler/planconfig.go` — YAML config loader
- `platform/migration/api/reconciliation_handlers.go` — API endpoints

### Reconciliation Frontend
- `frontend/src/hooks/useMigrationApi.ts` — React Query hooks
- `frontend/src/lib/migrationApi.ts` — API client functions
- `frontend/src/types/Migration.ts` — TypeScript types
