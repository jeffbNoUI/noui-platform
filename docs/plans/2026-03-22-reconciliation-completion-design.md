# Reconciliation Completion — Design

## Overview

Five remaining reconciliation items, executed in 3 waves optimized for minimal
context switching: backend Go sweep, corpus learning client, frontend React sweep.

## Wave 1: Backend Sweep (Go)

### 1a. Enhanced Root Cause

Enrich `GetRootCauseAnalysis` response with pattern data from `reconciliation_pattern`
table. If patterns exist for the engagement's latest batch, include them in the
response payload alongside the existing deterministic analysis.

**File:** `platform/migration/api/reconciliation_handlers.go`

**Change:** In the root cause handler, after building the deterministic analysis,
query `GetPatternsByEngagement()` and append a `patterns` field to the response.
The frontend `RootCauseAnalysisCard` already handles rendering pattern data.

### 1b. Resolution Workflow (Backend)

Add PATCH endpoint for resolving reconciliation patterns.

**New function in `platform/migration/db/pattern.go`:**
```go
func ResolvePattern(db *sql.DB, patternID, userID string) error
```
Sets `resolved = TRUE`, `resolved_at = NOW()`, `resolved_by = userID`.

**New handler in `platform/migration/api/pattern_handlers.go`:**
- `PATCH /api/v1/migration/reconciliation/patterns/{id}/resolve`
- Extracts user ID from JWT claims (auth context)
- Returns updated pattern

**Route registration in `main.go`.**

### 1c. Corpus Learning Client

Add `RecordDecision()` method to `intelligence.Client`:

**File:** `platform/migration/intelligence/client.go`

```go
func (c *Client) RecordDecision(ctx context.Context, req RecordDecisionRequest) error
```

Calls `POST /intelligence/record-decision` on the Python service. Wire into the
mapping update handler — when an analyst confirms or rejects a field mapping,
fire-and-forget call to record the decision for corpus learning.

**Types:**
```go
type RecordDecisionRequest struct {
    TenantID       string `json:"tenant_id"`
    SourceColumn   string `json:"source_column"`
    CanonicalColumn string `json:"canonical_column"`
    Decision       string `json:"decision"` // "approve" | "reject"
    SourcePlatform string `json:"source_platform"`
}
```

## Wave 2: Frontend Sweep (React)

### 2a. Rate Limit Fix

Remove the 3 `useReconciliationByTier(engagementId, N)` calls from
`ReconciliationPanel.tsx`. Derive tier breakdowns from the existing
`useReconciliation` hook data by filtering client-side.

**File:** `frontend/src/components/migration/engagement/ReconciliationPanel.tsx`

### 2b. Resolution Workflow (UI)

Add inline resolve button on pattern cards in `ReconciliationPanel.tsx`.
On click, call new `resolvePattern(patternId)` API function, then invalidate
the patterns query.

**Files:**
- `frontend/src/lib/migrationApi.ts` — add `resolvePattern()`
- `frontend/src/hooks/useMigrationApi.ts` — add `useResolvePattern()` mutation
- `frontend/src/components/migration/engagement/ReconciliationPanel.tsx` — button

### 2c. Batch Trigger Button

Add "Run Reconciliation" button shown after batch execution completes.
Uses existing `reconcileBatch()` from `migrationApi.ts`.

**File:** `frontend/src/components/migration/engagement/ReconciliationPanel.tsx`
or `TransformationPanel.tsx` (wherever batch detail is rendered).

## Testing

- Go: `go test ./... -short` in `platform/migration/`
- Frontend: `npx tsc --noEmit && npm test -- --run`
- No new test files needed — extend existing test files for new endpoints

## Files Changed

| Wave | File | Change |
|------|------|--------|
| 1 | `platform/migration/api/reconciliation_handlers.go` | Root cause enrichment |
| 1 | `platform/migration/db/pattern.go` | `ResolvePattern()` |
| 1 | `platform/migration/api/pattern_handlers.go` | PATCH resolve handler |
| 1 | `platform/migration/main.go` | Route registration |
| 1 | `platform/migration/intelligence/client.go` | `RecordDecision()` |
| 1 | `platform/migration/api/mapping_handlers.go` | Wire corpus call |
| 2 | `frontend/src/components/.../ReconciliationPanel.tsx` | Rate fix + resolve UI + batch button |
| 2 | `frontend/src/lib/migrationApi.ts` | `resolvePattern()` |
| 2 | `frontend/src/hooks/useMigrationApi.ts` | `useResolvePattern()` mutation |
