# Migration Phase 5: Panel Wiring Design

## Scope

Wire real API data into two migration panels that currently have UI but no data connection:
1. **Quality Profile Panel** — fetch/display profiling results, approve baseline
2. **Transformation Panel** — full batch management lifecycle + BatchDetail view

Mappings and Reconciliation panels are already wired and out of scope.

## Workstream 1: Quality Profile Panel

### Problem
QualityProfilePanel has a complete UI (radar chart, per-table scores, AI recommendations) but
`profiles` is hardcoded to `[]`. The POST mutation runs profiling but results aren't persisted
or fetchable.

### Solution

**Backend (Go):**
- Add `GET /api/v1/migration/engagements/{id}/profiles` endpoint
- Store profile results in a `quality_profile` table (one row per table per engagement)
- POST `/profile` already runs profiling; update it to persist results before returning
- Add `PATCH /engagements/{id}/approve-baseline` to set `quality_baseline_approved_at`

**Frontend:**
- Add `listProfiles(engagementId)` to `migrationApi.ts`
- Add `useProfiles(engagementId)` query hook to `useMigrationApi.ts`
- Wire hook into QualityProfilePanel replacing hardcoded empty array
- POST mutation `onSuccess` invalidates profiles query key
- Add "Approve Baseline" button (visible when profiles exist, baseline not yet approved)

### Data Flow
```
RunProfileDialog → POST /profile → stores results → returns TableProfile[]
                                                   → invalidates useProfiles query
QualityProfilePanel → useProfiles(engagementId) → GET /profiles → radar chart + table
                    → "Approve Baseline" → PATCH /approve-baseline → updates engagement
```

## Workstream 2: Transformation Panel + BatchDetail

### Problem
TransformationPanel is a stub showing "No batches created yet." BatchDetail view in
MigrationManagementUI is a placeholder div. Missing: list/create/detail batch endpoints,
batch list UI, batch detail with exception triage.

### Solution

**Backend (Go) — 4 new endpoints:**

| Method | Path | Purpose | Returns |
|--------|------|---------|---------|
| GET | `/engagements/{id}/batches` | List batches | `[]MigrationBatch` |
| POST | `/engagements/{id}/batches` | Create batch | `MigrationBatch` |
| GET | `/batches/{id}` | Batch detail | `MigrationBatch` |
| GET | `/batches/{id}/exceptions` | Paginated exceptions | `[]MigrationException` |

Uses existing `migration_batch` and `migration_exception` tables from migration 033.

**Frontend API + Hooks:**
- 4 new API functions in `migrationApi.ts`
- 4 new hooks: `useBatches`, `useBatch`, `useCreateBatch`, `useExceptions`

**UI Components:**

1. **TransformationPanel rewrite** — Replace stub content:
   - AI batch sizing recommendation card (already exists, keep)
   - "Create Batch" button opening CreateBatchDialog
   - Batch list table: status badge, scope, row counts, error rate, progress bar
   - Click row → `onSelectBatch(batchId)` (callback already passed from parent)

2. **CreateBatchDialog** (new) — Simple form:
   - Batch scope selector (from mapped tables)
   - Optional: mapping version (defaults to latest)
   - Submit → `useCreateBatch` mutation

3. **BatchDetail** (new) — Replaces placeholder in MigrationManagementUI:
   - Back button → return to engagement detail
   - Header: batch ID, status badge, timing, row counts (source/loaded/exception)
   - Error rate bar (visual)
   - Exception clusters section (using existing `useExceptionClusters` hook)
   - Exception list table with disposition column and action buttons
   - Action bar: Retransform / Reconcile Batch buttons (hooks exist)

**Navigation:** Already wired — `MigrationManagementUI` has `view='batch'` routing and
`navigateToBatch()`. Render `<BatchDetail>` instead of the placeholder.

### Data Flow
```
TransformationPanel → useBatches(engagementId) → GET /batches → batch list table
                    → CreateBatchDialog → POST /batches → invalidates batch list
                    → click row → navigateToBatch(batchId)

BatchDetail → useBatch(batchId) → GET /batches/{id} → header + counts
            → useExceptionClusters(batchId) → GET /exception-clusters → cluster cards
            → useExceptions(batchId) → GET /exceptions → exception table
            → Retransform → useRetransformBatch → POST /retransform → invalidates
            → Reconcile → useReconcileBatch → POST /reconcile → invalidates
```

## Files Changed

### Backend (Go)
- `platform/migration/api/handlers.go` — register 5 new routes
- `platform/migration/api/batch_handlers.go` — new file, 4 batch handlers
- `platform/migration/api/profile_handler.go` — persist results, add GET + approve-baseline

### Frontend
- `frontend/src/lib/migrationApi.ts` — 5 new API functions
- `frontend/src/hooks/useMigrationApi.ts` — 5 new hooks
- `frontend/src/components/migration/engagement/QualityProfilePanel.tsx` — wire useProfiles
- `frontend/src/components/migration/engagement/TransformationPanel.tsx` — rewrite with batch list
- `frontend/src/components/migration/dialogs/CreateBatchDialog.tsx` — new
- `frontend/src/components/migration/engagement/BatchDetail.tsx` — new
- `frontend/src/components/migration/MigrationManagementUI.tsx` — render BatchDetail

## Out of Scope
- Mappings panel polish (CorpusIndicator, Generate button, code mapping edit)
- Reconciliation panel polish (TierFunnel integration)
- WebSocket real-time batch progress updates (use polling via React Query refetchInterval)
- Exception bulk actions beyond single-row disposition
