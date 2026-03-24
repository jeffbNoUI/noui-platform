# Next Session Starter — Migration Data Pipeline End-to-End

## Context

Session 24 completed the migration UI walkthrough (all 6 phases render correctly)
and fixed 5 bugs (PR pending merge). The UI works but the **data pipeline** hasn't
been tested end-to-end through the browser:

- Batch execution returned 202 but failed because `ACTIVE_MEMBERS` scope doesn't
  map to a real source table
- Reconciliation panel renders empty state correctly but has no data to display
- Certification checklist renders but can't complete without recon gate score > 0

## Goal: Complete Data Pipeline Through the UI

Test the full data flow: batch execute → loaded rows → reconciliation scores →
certification. This requires a batch with a valid source scope.

### Step 1: Fix Batch Scope → Source Table Mapping

The batch executor treats `batch_scope` as a literal table name to query. Options:

**Option A** — Create a batch with scope = `src_prism.prism_member` (the actual table)
**Option B** — Add scope-to-table mapping in the batch executor so `ACTIVE_MEMBERS`
resolves to `src_prism.prism_member`

Option A is faster for testing; Option B is the production design.

Key files:
- `platform/migration/batch/batch.go` — `ExecuteBatch()` function
- `platform/migration/loader/loader.go` — `LoadBatchRows()` source query
- `platform/migration/api/batch_handlers.go` — `ExecuteBatchHandler`

### Step 2: Verify Batch Execution Results

After a successful batch execution:
- [ ] Batch status changes from PENDING → RUNNING → LOADED (or FAILED with exceptions)
- [ ] Source Rows, Loaded, Exceptions, Error Rate populate on BatchDetail
- [ ] Exception clusters appear if there are transformation errors
- [ ] Transformation tab shows batch status correctly

### Step 3: Run Reconciliation on Loaded Batch

- [ ] Click "Reconcile Batch" on the batch detail page
- [ ] Verify gate score gauge renders (ReconciliationPanel)
- [ ] Verify tier funnel chart shows T1/T2/T3 breakdown
- [ ] Check root cause analysis section
- [ ] Check P1 issues list (if any exist)
- [ ] Verify pattern detection cards

### Step 4: Complete Certification

- [ ] Advance engagement to RECONCILING → PARALLEL_RUN phases
- [ ] Verify Go/No-Go checklist auto-checks update based on real recon data
- [ ] Check all 5 checkboxes (if gate score qualifies)
- [ ] Click "Certify Complete"
- [ ] Verify certification record persists on page reload
- [ ] Verify "Already Certified" state renders

### Step 5: Minor UI Fixes

- [ ] AI Recommendation shows "NaN%" on Transformation tab — investigate and fix
- [ ] Dashboard engagement list: verify status badges are consistently uppercase (Bug 3 fix)

## Key Files

- `platform/migration/batch/batch.go` — batch execution pipeline
- `platform/migration/loader/loader.go` — source data loading
- `platform/migration/reconciler/` — 3-tier reconciliation engine
- `frontend/src/components/migration/engagement/` — all UI panels
- `frontend/src/hooks/useMigrationApi.ts` — react-query hooks
- `frontend/src/lib/apiClient.ts` — API client (normalizeEnums removed in Session 24)
- `tests/e2e/migration_e2e.sh` — 46 E2E assertions for reference

## Docker Setup

All services run via `docker compose -p lucid-colden`. Key services:
- `migration` (port 8100) — migration API
- `migration-intelligence` (port 8101) — pattern detection
- `prism-source` — source PostgreSQL with 100 seed members
- `frontend` (port 3000) — React app served via nginx reverse proxy

**Important:** When rebuilding the frontend Docker image from a worktree, use:
```bash
DOCKER_BUILDKIT=0 docker compose -p <project> --project-directory . build --no-cache frontend
```
BuildKit caching can serve stale builds if the project directory isn't explicit.
