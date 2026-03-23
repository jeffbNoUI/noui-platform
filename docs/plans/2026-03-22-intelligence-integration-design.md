# Migration Intelligence Integration — Design

**Date:** 2026-03-22
**Status:** Approved
**Branch:** claude/exciting-jang

## Summary

Wire the Python migration-intelligence service (`POST /intelligence/analyze-mismatches`)
into the Go reconciler's post-reconciliation flow. Persist detected patterns to a new
`migration.reconciliation_pattern` table. Surface patterns in the ReconciliationPanel
frontend via a new GET endpoint.

## Context

The Two-Source Proof is 30/30 passing. The Python intelligence service (port 8101) already
implements `POST /intelligence/analyze-mismatches` — it clusters variance records by
(domain, plan_code, direction) and suggests corrections. The Go side has an `intelligence.Scorer`
interface but only wraps `score-columns`. The frontend has all UI components, hooks, and types
ready (RootCauseAnalysisCard, AIRecommendationCard, CorpusIndicator). The gap is the Go
middle layer.

## Trigger Mode

**Auto after reconcile.** The Go reconciler calls the Python service immediately after
`persistReconciliationResults()`. If the Python service is down, reconciliation still
succeeds — patterns are an enhancement, not a requirement.

## Data Model

New migration: `039_reconciliation_patterns.sql`

```sql
CREATE TABLE migration.reconciliation_pattern (
    pattern_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id            UUID NOT NULL REFERENCES migration.batch(batch_id),
    suspected_domain    VARCHAR(30) NOT NULL,
    plan_code           VARCHAR(20) NOT NULL,
    direction           VARCHAR(10) NOT NULL,
    member_count        INTEGER NOT NULL,
    mean_variance       TEXT NOT NULL,
    coefficient_of_var  NUMERIC(6,4) NOT NULL,
    affected_members    JSONB NOT NULL DEFAULT '[]',
    correction_type     VARCHAR(20),
    affected_field      VARCHAR(100),
    confidence          NUMERIC(5,4),
    evidence            TEXT,
    resolved            BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at         TIMESTAMPTZ,
    resolved_by         VARCHAR(200),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recon_pattern_batch ON migration.reconciliation_pattern(batch_id);
```

Merges Python's `Pattern` + `Correction` into one row — each pattern has an optional
correction suggestion attached.

## Go Integration Layer

### Intelligence Client Extension

Add `AnalyzeMismatches()` to `intelligence/client.go`:

```go
type AnalyzeMismatchesRequest struct {
    TenantID              string           `json:"tenant_id"`
    ReconciliationResults []MismatchRecord `json:"reconciliation_results"`
    FieldMappings         []FieldMappingRecord `json:"field_mappings"`
}

type MismatchRecord struct {
    MemberID        string  `json:"member_id"`
    VarianceAmount  string  `json:"variance_amount"`
    VariancePct     float64 `json:"variance_pct"`
    SuspectedDomain string  `json:"suspected_domain"`
    MemberStatus    string  `json:"member_status"`
    PlanCode        string  `json:"plan_code"`
    Category        string  `json:"category"`
}

type AnalyzeMismatchesResponse struct {
    Patterns    []DetectedPattern      `json:"patterns"`
    Suggestions []CorrectionSuggestion `json:"suggestions"`
}
```

### New Interface

```go
type Analyzer interface {
    AnalyzeMismatches(ctx context.Context, req AnalyzeMismatchesRequest) (*AnalyzeMismatchesResponse, error)
}
```

### Reconciliation Flow

In `ReconcileBatch` handler, after `persistReconciliationResults()`:

1. Build `MismatchRecord[]` from non-MATCH results
2. If `intelligenceClient != nil && len(mismatches) > 0`:
   call `AnalyzeMismatches()` with 5s timeout
3. If patterns returned: persist to `migration.reconciliation_pattern`
   (DELETE old for batch + INSERT new, in transaction)
4. If call fails: log warning, continue — GateResult still returned

### New API Endpoint

```
GET /api/v1/migration/engagements/{id}/reconciliation/patterns
```

Returns persisted patterns for the engagement's latest batch.

## Frontend

### New API method in `migrationApi.ts`

```typescript
getReconciliationPatterns: (engagementId: string) =>
  fetchAPI<ReconciliationPattern[]>(
    `${BASE}/engagements/${engagementId}/reconciliation/patterns`
  ),
```

### New type in `Migration.ts`

```typescript
export interface ReconciliationPattern {
    pattern_id: string;
    batch_id: string;
    suspected_domain: string;
    plan_code: string;
    direction: string;
    member_count: number;
    mean_variance: string;
    coefficient_of_var: number;
    affected_members: string[];
    correction_type: string | null;
    affected_field: string | null;
    confidence: number | null;
    evidence: string | null;
    resolved: boolean;
    resolved_at: string | null;
    created_at: string;
}
```

### New hook in `useMigrationApi.ts`

```typescript
export function useReconciliationPatterns(engagementId: string | undefined)
```

### ReconciliationPanel Enhancement

Add **"Systematic Patterns"** section between gate score summary and P1 issues table:
- Domain + plan code + direction label
- Member count and mean variance
- Correction suggestion with confidence badge
- "View affected members" link that filters the detail table
- Resolution toggle

Existing `RootCauseAnalysisCard` reused for top-level summary. Pattern cards below for
drill-down. Deterministic `/reconciliation/root-cause` continues as fallback.

## Testing

### Go (Tier 1 — short mode)

1. Intelligence client `AnalyzeMismatches()` — httptest mock
2. Pattern persistence — verify INSERT/DELETE SQL
3. Graceful degradation — reconcile succeeds when client nil or errors
4. Request building — only non-MATCH results mapped to MismatchRecord

### Frontend

5. `useReconciliationPatterns` hook — fetch-mock
6. ReconciliationPanel with patterns — verify cards render
7. Empty state — section hidden when no patterns

### Integration (Tier 2)

8. E2E reconcile with intelligence service running — patterns persisted and returned

## Files to Change

### New Files
- `platform/migration/db/migrations/039_reconciliation_patterns.sql`
- `platform/migration/db/pattern.go` — persistence functions
- `platform/migration/db/pattern_test.go`
- `platform/migration/intelligence/client_test.go` — AnalyzeMismatches tests

### Modified Files
- `platform/migration/intelligence/client.go` — add Analyzer interface + AnalyzeMismatches()
- `platform/migration/api/reconciliation_handlers.go` — call intelligence after persist
- `platform/migration/api/reconciliation_handlers_test.go` — degradation test
- `platform/migration/api/routes.go` — register GET .../patterns
- `frontend/src/types/Migration.ts` — ReconciliationPattern type
- `frontend/src/lib/migrationApi.ts` — getReconciliationPatterns
- `frontend/src/hooks/useMigrationApi.ts` — useReconciliationPatterns
- `frontend/src/components/migration/engagement/ReconciliationPanel.tsx` — patterns section
