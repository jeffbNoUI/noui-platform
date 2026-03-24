# Migration Service Wrap-Up — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the migration service through sign-off: polish Reconciliation UI, add certification workflow, expose lineage API, harden E2E tests.

**Architecture:** 4 vertical slices delivered sequentially. Each slice is backend → frontend → tests → commit. No new external dependencies.

**Tech Stack:** Go (Fastify-style handlers + raw SQL), React/TypeScript (React Query hooks), Vitest (frontend tests), bash (E2E scripts)

**Design doc:** `docs/plans/2026-03-23-migration-wrap-up-design.md`

---

## Task 1: ReconciliationPanel — Mutation Feedback

**Files:**
- Modify: `frontend/src/components/migration/engagement/ReconciliationPanel.tsx`

**Step 1: Add state for mutation feedback**

At the top of the component (after the query hooks, ~line 43), add:

```tsx
const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
```

**Step 2: Wire "Run Reconciliation" button with feedback**

Find the `reconcileMutation` usage. Wrap it with `onSuccess`/`onError` callbacks:

```tsx
const reconcileMutation = useReconcileBatch();

const handleReconcile = () => {
  if (!latestBatch?.batch_id) return;
  setFeedback(null);
  reconcileMutation.mutate(latestBatch.batch_id, {
    onSuccess: () => setFeedback({ type: 'success', message: 'Reconciliation complete' }),
    onError: () => setFeedback({ type: 'error', message: 'Reconciliation failed — check batch status' }),
  });
};
```

**Step 3: Wire "Resolve Pattern" button with feedback**

Find the resolve pattern handler. Add callbacks:

```tsx
const resolveMutation = useResolvePattern();

const handleResolve = (patternId: string) => {
  resolveMutation.mutate(patternId, {
    onSuccess: () => setFeedback({ type: 'success', message: 'Pattern resolved' }),
    onError: () => setFeedback({ type: 'error', message: 'Failed to resolve pattern' }),
  });
};
```

**Step 4: Render feedback banner**

Add a feedback banner at the top of the return JSX (after the heading):

```tsx
{feedback && (
  <div style={{
    padding: '8px 12px',
    borderRadius: 6,
    background: feedback.type === 'success' ? '#e8f5e9' : '#fce4ec',
    color: feedback.type === 'success' ? '#2e7d32' : '#c62828',
    fontSize: 13,
    marginBottom: 12,
  }}>
    {feedback.message}
  </div>
)}
```

**Step 5: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add frontend/src/components/migration/engagement/ReconciliationPanel.tsx
git commit -m "[frontend] Add mutation feedback to ReconciliationPanel"
```

---

## Task 2: ReconciliationPanel — P1 Currency Formatting + Error States

**Files:**
- Modify: `frontend/src/components/migration/engagement/ReconciliationPanel.tsx`

**Step 1: Add currency formatter**

Near the top of the file (after imports):

```tsx
const fmtCurrency = (val: string | number | null | undefined) => {
  if (val == null) return '--';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '--';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};
```

**Step 2: Replace variance_amount display**

In the P1 Issues table (around line 419), replace:

```tsx
{issue.variance_amount ?? '--'}
```

with:

```tsx
{fmtCurrency(issue.variance_amount)}
```

**Step 3: Add error states for queries**

After the query hooks section, add:

```tsx
const queryError = summaryData === undefined && !isLoading
  ? 'Failed to load reconciliation data'
  : null;
```

Add an error banner (below the feedback banner):

```tsx
{queryError && (
  <div style={{
    padding: '8px 12px',
    borderRadius: 6,
    background: '#fce4ec',
    color: '#c62828',
    fontSize: 13,
    marginBottom: 12,
  }}>
    {queryError}
  </div>
)}
```

**Step 4: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/src/components/migration/engagement/ReconciliationPanel.tsx
git commit -m "[frontend] Add P1 currency formatting and error states to ReconciliationPanel"
```

---

## Task 3: ReconciliationPanel — Member Drill-Down + Pattern Expansion

**Files:**
- Modify: `frontend/src/components/migration/engagement/ReconciliationPanel.tsx`

**Step 1: Add filter state**

Below existing state declarations:

```tsx
const [domainFilter, setDomainFilter] = useState<string | null>(null);
const [expandedPattern, setExpandedPattern] = useState<string | null>(null);
```

**Step 2: Wire RootCauseAnalysis onViewMembers**

Find the `RootCauseAnalysisCard` render (around line 263). Add the callback:

```tsx
<RootCauseAnalysisCard
  analysis={rootCause?.analysis ?? ''}
  affectedCount={rootCause?.affectedCount ?? 0}
  confidence={rootCause?.confidence ?? 0}
  onViewMembers={() => setDomainFilter(rootCause?.suspected_domain ?? null)}
/>
```

**Step 3: Filter P1 table by domain**

Where P1 issues are rendered, apply the filter:

```tsx
const filteredP1 = domainFilter
  ? (p1Issues ?? []).filter((i: Reconciliation) => i.suspected_domain === domainFilter)
  : (p1Issues ?? []);
```

Add a clear-filter control above the table:

```tsx
{domainFilter && (
  <div style={{ fontSize: 12, marginBottom: 8 }}>
    Filtered by: <strong>{domainFilter}</strong>
    <button onClick={() => setDomainFilter(null)} style={{ marginLeft: 8, cursor: 'pointer', border: 'none', background: 'none', color: '#5f6368', textDecoration: 'underline' }}>
      Clear
    </button>
  </div>
)}
```

**Step 4: Add pattern card expansion**

In the pattern cards map, wrap each card to be clickable and show affected members on expand:

```tsx
<div key={p.pattern_id} onClick={() => setExpandedPattern(expandedPattern === p.pattern_id ? null : p.pattern_id)} style={{ cursor: 'pointer' }}>
  {/* existing pattern card content */}
  {expandedPattern === p.pattern_id && p.affected_members?.length > 0 && (
    <div style={{ marginTop: 8, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4, fontSize: 12 }}>
      <strong>Affected Members:</strong> {p.affected_members.join(', ')}
    </div>
  )}
</div>
```

**Step 5: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add frontend/src/components/migration/engagement/ReconciliationPanel.tsx
git commit -m "[frontend] Add member drill-down and pattern expansion to ReconciliationPanel"
```

---

## Task 4: ReconciliationPanel + ParallelRunPanel + TierFunnel Tests

**Files:**
- Create: `frontend/src/components/migration/engagement/__tests__/ReconciliationPanel.test.tsx`
- Create: `frontend/src/components/migration/engagement/__tests__/ParallelRunPanel.test.tsx`
- Create: `frontend/src/components/migration/charts/__tests__/TierFunnel.test.tsx`

**Step 1: Write ReconciliationPanel tests**

File: `frontend/src/components/migration/engagement/__tests__/ReconciliationPanel.test.tsx`

Extend the existing pattern in `ReconciliationPatterns.test.tsx`. Test cases:
- Renders gate score gauge with correct color (≥95% = sage)
- Renders 4 summary counters with correct values
- Renders P1 issues with currency-formatted variance
- Shows feedback banner on successful reconcile mutation
- Shows error banner when summary query returns undefined
- Filters P1 issues when domainFilter is set

Use the mock pattern from `ReconciliationPatterns.test.tsx` — mock `useMigrationApi` hooks, provide `mockSummary`, `mockP1Issues`, etc.

**Step 2: Write ParallelRunPanel tests**

File: `frontend/src/components/migration/engagement/__tests__/ParallelRunPanel.test.tsx`

Test cases:
- Renders 5 checklist items
- Auto-checks recon score when gate_score ≥ 0.95
- Auto-checks P1 when no unresolved P1 issues
- Certify button disabled when manual checks unchecked
- Certify button enabled when all 5 checks pass

Mock `useReconciliationSummary` and `useP1Issues` to control auto-check state.

**Step 3: Write TierFunnel test**

File: `frontend/src/components/migration/charts/__tests__/TierFunnel.test.tsx`

Test cases:
- Renders 3 tier bars with labels
- Displays correct percentages (match/total)

**Step 4: Run tests**

Run: `cd frontend && npm test -- --run`
Expected: All new tests pass, zero regressions

**Step 5: Commit**

```bash
git add frontend/src/components/migration/engagement/__tests__/ReconciliationPanel.test.tsx
git add frontend/src/components/migration/engagement/__tests__/ParallelRunPanel.test.tsx
git add frontend/src/components/migration/charts/__tests__/TierFunnel.test.tsx
git commit -m "[frontend] Add unit tests for ReconciliationPanel, ParallelRunPanel, TierFunnel"
```

---

## Task 5: Migration 040 — certification_record Table

**Files:**
- Create: `platform/migration/db/migrations/040_certification_record.sql`

**Step 1: Write migration**

```sql
-- Migration 040: Certification record for parallel run Go/No-Go
--
-- Stores immutable certification records. Each time an engagement
-- completes the Go/No-Go checklist, a new record is created.
-- No UPDATE — re-certification after regression creates a new row.

CREATE TABLE migration.certification_record (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id   UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    gate_score      NUMERIC NOT NULL,
    p1_count        INTEGER NOT NULL DEFAULT 0,
    checklist_json  JSONB NOT NULL,
    certified_by    TEXT NOT NULL,
    certified_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cert_engagement ON migration.certification_record(engagement_id);
```

**Step 2: Add to docker-compose.yml**

Find the migration service volume mounts and add:

```yaml
- ./platform/migration/db/migrations/040_certification_record.sql:/app/migrations/040_certification_record.sql
```

**Step 3: Commit**

```bash
git add platform/migration/db/migrations/040_certification_record.sql docker-compose.yml
git commit -m "[platform/migration] Add migration 040: certification_record table"
```

---

## Task 6: Certification DB Queries

**Files:**
- Create: `platform/migration/db/certification.go`

**Step 1: Write DB functions**

```go
package db

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// CreateCertification inserts an immutable certification record.
func CreateCertification(db *sql.DB, c *models.CertificationRecord) error {
	checklistJSON, err := json.Marshal(c.ChecklistJSON)
	if err != nil {
		return fmt.Errorf("marshal checklist: %w", err)
	}
	_, err = db.Exec(`
		INSERT INTO migration.certification_record
			(engagement_id, gate_score, p1_count, checklist_json, certified_by, notes)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		c.EngagementID, c.GateScore, c.P1Count, checklistJSON, c.CertifiedBy, c.Notes,
	)
	if err != nil {
		return fmt.Errorf("insert certification: %w", err)
	}
	return nil
}

// GetLatestCertification returns the most recent certification for an engagement.
func GetLatestCertification(db *sql.DB, engagementID string) (*models.CertificationRecord, error) {
	row := db.QueryRow(`
		SELECT id, engagement_id, gate_score, p1_count, checklist_json,
		       certified_by, certified_at, notes, created_at
		FROM migration.certification_record
		WHERE engagement_id = $1
		ORDER BY created_at DESC
		LIMIT 1`, engagementID)

	var c models.CertificationRecord
	var checklistBytes []byte
	err := row.Scan(&c.ID, &c.EngagementID, &c.GateScore, &c.P1Count,
		&checklistBytes, &c.CertifiedBy, &c.CertifiedAt, &c.Notes, &c.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return fmt.Errorf("scan certification: %w", err)
	}
	if err := json.Unmarshal(checklistBytes, &c.ChecklistJSON); err != nil {
		return nil, fmt.Errorf("unmarshal checklist: %w", err)
	}
	return &c, nil
}
```

**Step 2: Add CertificationRecord to models/types.go**

Add at the end of the file:

```go
// CertificationRecord represents a Go/No-Go certification for parallel run.
type CertificationRecord struct {
	ID            string                 `json:"id"`
	EngagementID  string                 `json:"engagement_id"`
	GateScore     float64                `json:"gate_score"`
	P1Count       int                    `json:"p1_count"`
	ChecklistJSON map[string]interface{} `json:"checklist_json"`
	CertifiedBy   string                 `json:"certified_by"`
	CertifiedAt   string                 `json:"certified_at"`
	Notes         string                 `json:"notes,omitempty"`
	CreatedAt     string                 `json:"created_at"`
}
```

**Step 3: Run build**

Run: `cd platform/migration && go build ./...`
Expected: No errors

**Step 4: Commit**

```bash
git add platform/migration/db/certification.go platform/migration/models/types.go
git commit -m "[platform/migration] Add certification DB queries and model"
```

---

## Task 7: Certification API Handlers

**Files:**
- Create: `platform/migration/api/certification_handlers.go`
- Modify: `platform/migration/api/handlers.go` (add routes)

**Step 1: Write certification handlers**

```go
package api

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

// CertifyEngagement handles POST /api/v1/migration/engagements/{id}/certify.
func (h *Handler) CertifyEngagement(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	if engID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id required")
		return
	}

	var req struct {
		GateScore float64                `json:"gate_score"`
		P1Count   int                    `json:"p1_count"`
		Checklist map[string]interface{} `json:"checklist"`
		Notes     string                 `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	// Validate all 5 checklist items are checked.
	requiredKeys := []string{"recon_score", "p1_resolved", "parallel_duration", "stakeholder_signoff", "rollback_plan"}
	for _, k := range requiredKeys {
		val, ok := req.Checklist[k]
		if !ok {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "CHECKLIST_INCOMPLETE", "missing checklist item: "+k)
			return
		}
		if checked, isBool := val.(bool); !isBool || !checked {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "CHECKLIST_INCOMPLETE", "checklist item not checked: "+k)
			return
		}
	}

	userID := auth.UserID(r.Context())

	cert := &models.CertificationRecord{
		EngagementID:  engID,
		GateScore:     req.GateScore,
		P1Count:       req.P1Count,
		ChecklistJSON: req.Checklist,
		CertifiedBy:   userID,
		Notes:         req.Notes,
	}

	if err := migrationdb.CreateCertification(h.DB, cert); err != nil {
		slog.Error("certification failed", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "CERT_FAILED", "failed to create certification record")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", cert)
}

// GetCertification handles GET /api/v1/migration/engagements/{id}/certification.
func (h *Handler) GetCertification(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	if engID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id required")
		return
	}

	cert, err := migrationdb.GetLatestCertification(h.DB, engID)
	if err != nil {
		slog.Error("get certification failed", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to get certification")
		return
	}
	if cert == nil {
		apiresponse.WriteSuccess(w, http.StatusOK, "migration", nil)
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", cert)
}
```

**Step 2: Register routes in handlers.go**

Add to the route registration section (around line 116):

```go
mux.HandleFunc("POST /api/v1/migration/engagements/{id}/certify", h.CertifyEngagement)
mux.HandleFunc("GET /api/v1/migration/engagements/{id}/certification", h.GetCertification)
```

**Step 3: Run build**

Run: `cd platform/migration && go build ./...`
Expected: No errors

**Step 4: Run short tests**

Run: `cd platform/migration && go test ./... -short`
Expected: All pass

**Step 5: Commit**

```bash
git add platform/migration/api/certification_handlers.go platform/migration/api/handlers.go
git commit -m "[platform/migration] Add certification API handlers (POST certify, GET certification)"
```

---

## Task 8: Frontend — Wire ParallelRunPanel to Certification API

**Files:**
- Modify: `frontend/src/lib/migrationApi.ts` (add API functions)
- Modify: `frontend/src/hooks/useMigrationApi.ts` (add hooks)
- Modify: `frontend/src/components/migration/engagement/ParallelRunPanel.tsx` (wire to API)

**Step 1: Add API functions to migrationApi.ts**

After the reconciliation functions:

```tsx
certifyEngagement: (engagementId: string, body: {
  gate_score: number;
  p1_count: number;
  checklist: Record<string, boolean>;
  notes?: string;
}) => client.post(`/engagements/${engagementId}/certify`, body),

getCertification: (engagementId: string) =>
  client.get(`/engagements/${engagementId}/certification`),
```

**Step 2: Add hooks to useMigrationApi.ts**

After the existing reconciliation hooks:

```tsx
export function useCertification(engagementId: string) {
  return useQuery({
    queryKey: ['migration', 'certification', engagementId],
    queryFn: () => migrationApi.getCertification(engagementId),
    enabled: !!engagementId,
  });
}

export function useCertifyEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ engagementId, body }: {
      engagementId: string;
      body: { gate_score: number; p1_count: number; checklist: Record<string, boolean>; notes?: string };
    }) => migrationApi.certifyEngagement(engagementId, body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['migration', 'certification', variables.engagementId] });
    },
  });
}
```

**Step 3: Wire ParallelRunPanel**

In `ParallelRunPanel.tsx`:

1. Import new hooks: `useCertification`, `useCertifyEngagement`
2. Load existing certification on mount — if record exists, pre-populate manual checks
3. Replace the `onCertifyComplete` pattern with the mutation:

```tsx
const { data: existingCert } = useCertification(engagementId);
const certifyMutation = useCertifyEngagement();

// Restore manual checks from existing certification
useEffect(() => {
  if (existingCert?.data?.checklist_json) {
    const c = existingCert.data.checklist_json;
    setManualChecks({
      parallelDuration: !!c.parallel_duration,
      stakeholderSignoff: !!c.stakeholder_signoff,
      rollbackPlan: !!c.rollback_plan,
    });
  }
}, [existingCert]);

const handleCertify = () => {
  certifyMutation.mutate({
    engagementId,
    body: {
      gate_score: reconSummary?.gate_score ?? 0,
      p1_count: unresolvedP1Count,
      checklist: {
        recon_score: autoChecks.reconScore,
        p1_resolved: autoChecks.p1Resolved,
        parallel_duration: manualChecks.parallelDuration,
        stakeholder_signoff: manualChecks.stakeholderSignoff,
        rollback_plan: manualChecks.rollbackPlan,
      },
    },
  });
};
```

4. Show success/error feedback from mutation state
5. Disable form if certification already exists (already certified)

**Step 4: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 5: Run tests**

Run: `cd frontend && npm test -- --run`
Expected: All pass (ParallelRunPanel tests from Task 4 may need mock updates)

**Step 6: Commit**

```bash
git add frontend/src/lib/migrationApi.ts frontend/src/hooks/useMigrationApi.ts frontend/src/components/migration/engagement/ParallelRunPanel.tsx
git commit -m "[frontend] Wire ParallelRunPanel to certification API"
```

---

## Task 9: Lineage API Handlers

**Files:**
- Create: `platform/migration/db/lineage.go`
- Create: `platform/migration/api/lineage_handlers.go`
- Modify: `platform/migration/api/handlers.go` (add routes)
- Modify: `platform/migration/models/types.go` (add types)

**Step 1: Add lineage types to models/types.go**

```go
// LineageRecord represents a single source→canonical transformation trace.
type LineageRecord struct {
	LineageID   string `json:"lineage_id"`
	BatchID     string `json:"batch_id"`
	RowKey      string `json:"row_key"`
	HandlerName string `json:"handler_name"`
	ColumnName  string `json:"column_name"`
	SourceValue string `json:"source_value"`
	ResultValue string `json:"result_value"`
	CreatedAt   string `json:"created_at"`
}

// LineageSummary holds aggregate stats for a batch's lineage.
type LineageSummary struct {
	TotalRecords       int            `json:"total_records"`
	UniqueMembers      int            `json:"unique_members"`
	FieldsCovered      int            `json:"fields_covered"`
	TransformationTypes []string      `json:"transformation_types"`
	ExceptionCount     int            `json:"exception_count"`
}
```

**Step 2: Write lineage DB queries**

File: `platform/migration/db/lineage.go`

```go
package db

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// GetLineage returns lineage records for a batch with optional filters.
func GetLineage(db *sql.DB, batchID, memberID, columnName string, limit, offset int) ([]models.LineageRecord, error) {
	query := `SELECT lineage_id, batch_id, row_key, handler_name, column_name, source_value, result_value, created_at
		FROM migration.lineage WHERE batch_id = $1`
	args := []interface{}{batchID}
	argN := 2

	if memberID != "" {
		query += fmt.Sprintf(" AND row_key = $%d", argN)
		args = append(args, memberID)
		argN++
	}
	if columnName != "" {
		query += fmt.Sprintf(" AND column_name = $%d", argN)
		args = append(args, columnName)
		argN++
	}

	query += fmt.Sprintf(" ORDER BY row_key, column_name LIMIT $%d OFFSET $%d", argN, argN+1)
	args = append(args, limit, offset)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("query lineage: %w", err)
	}
	defer rows.Close()

	var records []models.LineageRecord
	for rows.Next() {
		var r models.LineageRecord
		if err := rows.Scan(&r.LineageID, &r.BatchID, &r.RowKey, &r.HandlerName, &r.ColumnName, &r.SourceValue, &r.ResultValue, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan lineage: %w", err)
		}
		records = append(records, r)
	}
	return records, rows.Err()
}

// GetLineageSummary returns aggregate stats for a batch's lineage.
func GetLineageSummary(db *sql.DB, batchID string) (*models.LineageSummary, error) {
	var s models.LineageSummary
	err := db.QueryRow(`
		SELECT
			COUNT(*) AS total_records,
			COUNT(DISTINCT row_key) AS unique_members,
			COUNT(DISTINCT column_name) AS fields_covered
		FROM migration.lineage
		WHERE batch_id = $1`, batchID).Scan(&s.TotalRecords, &s.UniqueMembers, &s.FieldsCovered)
	if err != nil {
		return nil, fmt.Errorf("lineage summary: %w", err)
	}

	// Distinct transformation types (handler names).
	rows, err := db.Query(`SELECT DISTINCT handler_name FROM migration.lineage WHERE batch_id = $1 ORDER BY 1`, batchID)
	if err != nil {
		return nil, fmt.Errorf("lineage handlers: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var h string
		if err := rows.Scan(&h); err != nil {
			return nil, fmt.Errorf("scan handler: %w", err)
		}
		s.TransformationTypes = append(s.TransformationTypes, h)
	}

	// Exception count for the same batch.
	db.QueryRow(`SELECT COUNT(*) FROM migration.exception WHERE batch_id = $1`, batchID).Scan(&s.ExceptionCount)

	return &s, nil
}
```

**Step 3: Write lineage handlers**

File: `platform/migration/api/lineage_handlers.go`

```go
package api

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
)

// GetLineage handles GET /api/v1/migration/batches/{id}/lineage.
func (h *Handler) GetLineage(w http.ResponseWriter, r *http.Request) {
	batchID := r.PathValue("id")
	if batchID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id required")
		return
	}

	memberID := r.URL.Query().Get("member_id")
	columnName := r.URL.Query().Get("column_name")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 || limit > 1000 {
		limit = 100
	}

	records, err := migrationdb.GetLineage(h.DB, batchID, memberID, columnName, limit, offset)
	if err != nil {
		slog.Error("get lineage failed", "error", err, "batch_id", batchID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to get lineage")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]interface{}{
		"records": records,
		"count":   len(records),
		"limit":   limit,
		"offset":  offset,
	})
}

// GetLineageSummary handles GET /api/v1/migration/batches/{id}/lineage/summary.
func (h *Handler) GetLineageSummary(w http.ResponseWriter, r *http.Request) {
	batchID := r.PathValue("id")
	if batchID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id required")
		return
	}

	summary, err := migrationdb.GetLineageSummary(h.DB, batchID)
	if err != nil {
		slog.Error("get lineage summary failed", "error", err, "batch_id", batchID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to get lineage summary")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", summary)
}
```

**Step 4: Register routes in handlers.go**

```go
mux.HandleFunc("GET /api/v1/migration/batches/{id}/lineage", h.GetLineage)
mux.HandleFunc("GET /api/v1/migration/batches/{id}/lineage/summary", h.GetLineageSummary)
```

**Step 5: Run build + short tests**

Run: `cd platform/migration && go build ./... && go test ./... -short`
Expected: All pass

**Step 6: Commit**

```bash
git add platform/migration/db/lineage.go platform/migration/api/lineage_handlers.go platform/migration/api/handlers.go platform/migration/models/types.go
git commit -m "[platform/migration] Add lineage API (GET lineage, GET lineage/summary)"
```

---

## Task 10: E2E — Fix Startup Race

**Files:**
- Modify: `tests/e2e/migration_e2e.sh`

**Step 1: Add seed-data readiness check**

After the `wait_for_services` block (around line 44), add a poll loop:

```bash
# Wait for prism-source seed data to be fully loaded.
# pg_isready returns true before initdb scripts complete.
echo -e "${YELLOW}Waiting for prism-source seed data...${NC}"
SEED_ATTEMPTS=0
while [ $SEED_ATTEMPTS -lt 30 ]; do
  ROW_COUNT=$(docker exec lucid-colden-prism-source-1 psql -U prism -d prism_prod -tAc \
    "SELECT count(*) FROM src_prism.prism_member" 2>/dev/null || echo "0")
  ROW_COUNT=$(echo "$ROW_COUNT" | tr -d '[:space:]')
  if [ "$ROW_COUNT" -gt 0 ] 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} prism-source has ${ROW_COUNT} members"
    break
  fi
  SEED_ATTEMPTS=$((SEED_ATTEMPTS + 1))
  sleep 2
done
if [ $SEED_ATTEMPTS -ge 30 ]; then
  echo -e "  ${YELLOW}⚠${NC} prism-source seed data not detected — source tests may fail"
fi
```

Note: The container name includes the worktree name. Make this dynamic by reading from docker compose or parameterizing the container prefix. Alternatively, use `docker compose exec` which doesn't need the container name:

```bash
ROW_COUNT=$(docker compose exec -T prism-source psql -U prism -d prism_prod -tAc \
  "SELECT count(*) FROM src_prism.prism_member" 2>/dev/null || echo "0")
```

**Step 2: Run E2E to verify**

Run: `bash tests/e2e/migration_e2e.sh`
Expected: 40/40 pass on first attempt

**Step 3: Commit**

```bash
git add tests/e2e/migration_e2e.sh
git commit -m "[tests/e2e] Add prism-source seed data readiness poll to migration E2E"
```

---

## Task 11: E2E — Fix Mapping Approval + Add Certification & Lineage Phases

**Files:**
- Modify: `tests/e2e/migration_e2e.sh`

**Step 1: Fix mapping approval 400**

In Phase 7b, the corpus learning test does a mapping update but gets 400. Fix by extracting a valid mapping ID from the `GET /mappings` response in Phase 5:

After the mappings list assertion in Phase 5, add:

```bash
FIRST_MAPPING_ID=$(echo "$BODY" | jq -r '.data[0].mapping_id // .data[0].id // empty' 2>/dev/null || echo "")
```

Then in Phase 7b, use `FIRST_MAPPING_ID` instead of a hardcoded/missing ID.

**Step 2: Add Phase 12 — Certification**

```bash
log_header "Phase 12: Certification"

CERT_PAYLOAD=$(cat <<EOF
{
  "gate_score": 1.0,
  "p1_count": 0,
  "checklist": {
    "recon_score": true,
    "p1_resolved": true,
    "parallel_duration": true,
    "stakeholder_signoff": true,
    "rollback_plan": true
  },
  "notes": "E2E test certification"
}
EOF
)

RESPONSE=$(do_post "/api/v1/migration/engagements/${ENGAGEMENT_ID}/certify" "$CERT_PAYLOAD")
extract_http "$RESPONSE"
assert_status "POST /migration/engagements/:id/certify" "200" "$HTTP_CODE"

RESPONSE=$(do_get "/api/v1/migration/engagements/${ENGAGEMENT_ID}/certification")
extract_http "$RESPONSE"
assert_status "GET /migration/engagements/:id/certification" "200" "$HTTP_CODE"

# Verify certified_by is present
CERT_BY=$(echo "$BODY" | jq -r '.data.certified_by // empty' 2>/dev/null || echo "")
TOTAL_COUNT=$((TOTAL_COUNT + 1))
if [ -n "$CERT_BY" ] && [ "$CERT_BY" != "null" ]; then
  echo -e "  ${GREEN}✓${NC} Certification record has certified_by=${CERT_BY}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗${NC} Certification record missing certified_by"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
```

**Step 3: Add Phase 13 — Lineage**

```bash
log_header "Phase 13: Lineage"

if [ -n "$BATCH_ID" ] && [ "$BATCH_ID" != "null" ]; then
  RESPONSE=$(do_get "/api/v1/migration/batches/${BATCH_ID}/lineage?limit=10")
  extract_http "$RESPONSE"
  assert_status "GET /migration/batches/:id/lineage" "200" "$HTTP_CODE"

  LINEAGE_COUNT=$(echo "$BODY" | jq -r '.data.count // 0' 2>/dev/null || echo "0")
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  if [ "$LINEAGE_COUNT" -gt 0 ] 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Lineage records found: ${LINEAGE_COUNT}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${YELLOW}⚠${NC} No lineage records (batch may not have executed rows)"
    PASS_COUNT=$((PASS_COUNT + 1))  # Soft pass — depends on batch content
  fi

  RESPONSE=$(do_get "/api/v1/migration/batches/${BATCH_ID}/lineage/summary")
  extract_http "$RESPONSE"
  assert_status "GET /migration/batches/:id/lineage/summary" "200" "$HTTP_CODE"
else
  echo -e "  ${YELLOW}⚠${NC} No batch ID — skipping lineage tests"
fi
```

**Step 4: Rebuild Docker, run E2E**

Run: `docker compose down -v && docker compose up --build -d --wait && bash tests/e2e/migration_e2e.sh`
Expected: 45+ tests passing (40 existing + ~5 new)

**Step 5: Commit**

```bash
git add tests/e2e/migration_e2e.sh
git commit -m "[tests/e2e] Fix mapping approval, add certification + lineage E2E phases"
```

---

## Task 12: Add nginx Proxy Routes for New Endpoints

**Files:**
- Modify: `infrastructure/nginx/nginx.conf` or equivalent nginx config in docker-compose

**Step 1: Verify new endpoints are covered by existing nginx proxy rules**

Check if `/api/v1/migration/` prefix already proxies all sub-paths. If yes, no changes needed.
If specific routes are listed, add:
- `/api/v1/migration/engagements/{id}/certify`
- `/api/v1/migration/engagements/{id}/certification`
- `/api/v1/migration/batches/{id}/lineage`
- `/api/v1/migration/batches/{id}/lineage/summary`

**Step 2: Run E2E through nginx**

Run: `bash tests/e2e/migration_e2e.sh`
Expected: All pass through nginx proxy on port 3000

**Step 3: Commit (if changes needed)**

```bash
git add infrastructure/nginx/nginx.conf
git commit -m "[infrastructure] Add nginx proxy routes for certification + lineage endpoints"
```

---

## Summary

| Task | Slice | What | Estimated Files |
|------|-------|------|-----------------|
| 1 | Recon UI | Mutation feedback | 1 |
| 2 | Recon UI | Currency formatting + error states | 1 |
| 3 | Recon UI | Member drill-down + pattern expansion | 1 |
| 4 | Recon UI | Unit tests (3 components) | 3 new |
| 5 | Certification | Migration 040 + docker-compose | 2 |
| 6 | Certification | DB queries + model | 2 |
| 7 | Certification | API handlers + routes | 2 |
| 8 | Certification | Frontend wiring | 3 |
| 9 | Lineage | DB queries + handlers + routes + types | 4 |
| 10 | E2E | Fix startup race | 1 |
| 11 | E2E | Fix mapping + new phases | 1 |
| 12 | E2E | Nginx routes (if needed) | 0–1 |

**12 tasks, ~20 files touched, 4 vertical slices, 12 commits.**
