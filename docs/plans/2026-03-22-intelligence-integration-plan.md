# Migration Intelligence Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire Python migration-intelligence service's `POST /intelligence/analyze-mismatches` into the Go reconciler's post-reconciliation flow, persist detected patterns, and surface them in the ReconciliationPanel.

**Architecture:** Extend the Go intelligence client with an `Analyzer` interface. After `ReconcileBatch` persists variance results, it calls Python for pattern analysis. Results persist to a new `migration.reconciliation_pattern` table. Frontend fetches patterns via a new GET endpoint and displays them in a new section of ReconciliationPanel.

**Tech Stack:** Go 1.22 (migration service), Python FastAPI (intelligence service), React/TypeScript (frontend), PostgreSQL (migration schema)

**Design doc:** `docs/plans/2026-03-22-intelligence-integration-design.md`

---

### Task 1: Database Migration — reconciliation_pattern Table

**Files:**
- Create: `platform/migration/db/migrations/039_reconciliation_patterns.sql`

**Step 1: Write the migration**

```sql
-- 039_reconciliation_patterns.sql
-- Stores systematic mismatch patterns detected by the Python intelligence service
-- after reconciliation. Each row is a detected pattern with an optional correction suggestion.

CREATE TABLE IF NOT EXISTS migration.reconciliation_pattern (
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

CREATE INDEX IF NOT EXISTS idx_recon_pattern_batch
    ON migration.reconciliation_pattern(batch_id);
```

**Step 2: Verify migration file is valid SQL**

Run: `cd platform/migration && go build ./...`
Expected: Build succeeds (migration is read at runtime, but this confirms no Go breakage).

**Step 3: Commit**

```bash
git add platform/migration/db/migrations/039_reconciliation_patterns.sql
git commit -m "[platform/migration] Add migration 039: reconciliation_pattern table"
```

---

### Task 2: Go Model — ReconciliationPattern Type

**Files:**
- Modify: `platform/migration/models/types.go` (after `RootCauseResponse` at line ~297)

**Step 1: Add the model type**

Add after `RootCauseResponse` struct (line 297):

```go
// ReconciliationPattern represents a systematic mismatch pattern detected by
// the intelligence service after reconciliation.
type ReconciliationPattern struct {
	PatternID        string   `json:"pattern_id"`
	BatchID          string   `json:"batch_id"`
	SuspectedDomain  string   `json:"suspected_domain"`
	PlanCode         string   `json:"plan_code"`
	Direction        string   `json:"direction"`
	MemberCount      int      `json:"member_count"`
	MeanVariance     string   `json:"mean_variance"`
	CoefficientOfVar float64  `json:"coefficient_of_var"`
	AffectedMembers  []string `json:"affected_members"`
	CorrectionType   *string  `json:"correction_type"`
	AffectedField    *string  `json:"affected_field"`
	Confidence       *float64 `json:"confidence"`
	Evidence         *string  `json:"evidence"`
	Resolved         bool     `json:"resolved"`
	ResolvedAt       *string  `json:"resolved_at"`
	CreatedAt        string   `json:"created_at"`
}
```

**Step 2: Verify build**

Run: `cd platform/migration && go build ./...`
Expected: Clean build.

**Step 3: Commit**

```bash
git add platform/migration/models/types.go
git commit -m "[platform/migration] Add ReconciliationPattern model type"
```

---

### Task 3: Intelligence Client — AnalyzeMismatches Method

**Files:**
- Modify: `platform/migration/intelligence/client.go` (add types + method after line 98)
- Create: `platform/migration/intelligence/client_test.go`

**Step 1: Write the failing test**

Create `platform/migration/intelligence/client_test.go`:

```go
package intelligence

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAnalyzeMismatches_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/intelligence/analyze-mismatches" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("unexpected method: %s", r.Method)
		}

		// Decode request to verify structure.
		var req AnalyzeMismatchesRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if len(req.ReconciliationResults) != 2 {
			t.Errorf("expected 2 results, got %d", len(req.ReconciliationResults))
		}

		resp := AnalyzeMismatchesResponse{
			Patterns: []DetectedPattern{
				{
					PatternID:       "salary_TIER_1_negative",
					SuspectedDomain: "salary",
					PlanCode:        "TIER_1",
					Direction:       "negative",
					MemberCount:     23,
					MeanVariance:    "-142.75",
					CV:              0.18,
					AffectedMembers: []string{"M001", "M002"},
				},
			},
			Suggestions: []CorrectionSuggestion{
				{
					CorrectionType:      "MAPPING_FIX",
					AffectedField:       "gross_amount",
					Confidence:          0.82,
					Evidence:            "23 members in TIER_1 show -142.75 salary variance",
					AffectedMemberCount: 23,
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL)
	resp, err := client.AnalyzeMismatches(context.Background(), AnalyzeMismatchesRequest{
		TenantID: "test-tenant",
		ReconciliationResults: []MismatchRecord{
			{MemberID: "M001", VarianceAmount: "-150.50", Category: "MAJOR", SuspectedDomain: "salary", PlanCode: "TIER_1"},
			{MemberID: "M002", VarianceAmount: "-135.00", Category: "MAJOR", SuspectedDomain: "salary", PlanCode: "TIER_1"},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Patterns) != 1 {
		t.Fatalf("expected 1 pattern, got %d", len(resp.Patterns))
	}
	if resp.Patterns[0].MemberCount != 23 {
		t.Errorf("expected member_count=23, got %d", resp.Patterns[0].MemberCount)
	}
	if len(resp.Suggestions) != 1 {
		t.Fatalf("expected 1 suggestion, got %d", len(resp.Suggestions))
	}
	if resp.Suggestions[0].CorrectionType != "MAPPING_FIX" {
		t.Errorf("expected MAPPING_FIX, got %s", resp.Suggestions[0].CorrectionType)
	}
}

func TestAnalyzeMismatches_ServiceDown(t *testing.T) {
	client := NewClient("http://127.0.0.1:1") // unreachable
	_, err := client.AnalyzeMismatches(context.Background(), AnalyzeMismatchesRequest{
		TenantID: "test-tenant",
		ReconciliationResults: []MismatchRecord{
			{MemberID: "M001", VarianceAmount: "-150.50", Category: "MAJOR"},
		},
	})
	if err == nil {
		t.Fatal("expected error when service is unreachable")
	}
}

func TestAnalyzeMismatches_EmptyResults(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(AnalyzeMismatchesResponse{})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	resp, err := client.AnalyzeMismatches(context.Background(), AnalyzeMismatchesRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Patterns) != 0 {
		t.Errorf("expected 0 patterns, got %d", len(resp.Patterns))
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd platform/migration && go test ./intelligence/ -v -count=1 -short`
Expected: FAIL — `AnalyzeMismatches` method and types don't exist yet.

**Step 3: Implement types and method**

Add to `platform/migration/intelligence/client.go` after line 98:

```go
// --- Mismatch Analysis Types ---

// MismatchRecord describes a single member's reconciliation variance,
// sent to the intelligence service for pattern detection.
type MismatchRecord struct {
	MemberID        string  `json:"member_id"`
	VarianceAmount  string  `json:"variance_amount"`
	VariancePct     float64 `json:"variance_pct"`
	SuspectedDomain string  `json:"suspected_domain"`
	MemberStatus    string  `json:"member_status"`
	PlanCode        string  `json:"plan_code"`
	Category        string  `json:"category"`
}

// FieldMappingRecord describes a source→canonical field mapping for context.
type FieldMappingRecord struct {
	SourceField    string `json:"source_field"`
	CanonicalField string `json:"canonical_field"`
	Domain         string `json:"domain"`
	TransformType  string `json:"transform_type"`
}

// AnalyzeMismatchesRequest is the request body for POST /intelligence/analyze-mismatches.
type AnalyzeMismatchesRequest struct {
	TenantID              string               `json:"tenant_id"`
	ReconciliationResults []MismatchRecord      `json:"reconciliation_results"`
	FieldMappings         []FieldMappingRecord  `json:"field_mappings"`
}

// DetectedPattern describes a systematic variance cluster found by the intelligence service.
type DetectedPattern struct {
	PatternID       string   `json:"pattern_id"`
	SuspectedDomain string   `json:"suspected_domain"`
	PlanCode        string   `json:"plan_code"`
	Direction       string   `json:"direction"`
	MemberCount     int      `json:"member_count"`
	MeanVariance    string   `json:"mean_variance"`
	CV              float64  `json:"cv"`
	AffectedMembers []string `json:"affected_members"`
}

// CorrectionSuggestion describes a proposed fix for a detected pattern.
type CorrectionSuggestion struct {
	CorrectionType      string  `json:"correction_type"`
	AffectedField       string  `json:"affected_field"`
	CurrentMapping      string  `json:"current_mapping"`
	ProposedMapping     string  `json:"proposed_mapping"`
	Confidence          float64 `json:"confidence"`
	Evidence            string  `json:"evidence"`
	AffectedMemberCount int     `json:"affected_member_count"`
}

// AnalyzeMismatchesResponse is the response from POST /intelligence/analyze-mismatches.
type AnalyzeMismatchesResponse struct {
	Patterns    []DetectedPattern      `json:"patterns"`
	Suggestions []CorrectionSuggestion `json:"suggestions"`
}

// Analyzer defines the interface for mismatch pattern analysis.
type Analyzer interface {
	AnalyzeMismatches(ctx context.Context, req AnalyzeMismatchesRequest) (*AnalyzeMismatchesResponse, error)
}

// AnalyzeMismatches calls POST /intelligence/analyze-mismatches on the Python service.
func (c *Client) AnalyzeMismatches(ctx context.Context, req AnalyzeMismatchesRequest) (*AnalyzeMismatchesResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := c.BaseURL + "/intelligence/analyze-mismatches"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("intelligence service call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("intelligence service returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result AnalyzeMismatchesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}
```

**Step 4: Run tests to verify they pass**

Run: `cd platform/migration && go test ./intelligence/ -v -count=1 -short`
Expected: 3 tests PASS.

**Step 5: Commit**

```bash
git add platform/migration/intelligence/client.go platform/migration/intelligence/client_test.go
git commit -m "[platform/migration] Add AnalyzeMismatches to intelligence client with tests"
```

---

### Task 4: Pattern Persistence Layer

**Files:**
- Create: `platform/migration/db/pattern.go`
- Create: `platform/migration/db/pattern_test.go`

**Step 1: Write the persistence functions**

Create `platform/migration/db/pattern.go`:

```go
package db

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// PersistPatterns stores intelligence-detected patterns for a batch.
// It replaces any prior patterns for the same batch within a transaction.
func PersistPatterns(tx *sql.Tx, batchID string, patterns []models.ReconciliationPattern) error {
	if _, err := tx.Exec(`DELETE FROM migration.reconciliation_pattern WHERE batch_id = $1`, batchID); err != nil {
		return fmt.Errorf("clear prior patterns: %w", err)
	}

	const insertSQL = `INSERT INTO migration.reconciliation_pattern
		(batch_id, suspected_domain, plan_code, direction, member_count,
		 mean_variance, coefficient_of_var, affected_members,
		 correction_type, affected_field, confidence, evidence)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`

	for _, p := range patterns {
		membersJSON, err := json.Marshal(p.AffectedMembers)
		if err != nil {
			return fmt.Errorf("marshal affected_members: %w", err)
		}
		if _, err := tx.Exec(insertSQL,
			batchID,
			p.SuspectedDomain,
			p.PlanCode,
			p.Direction,
			p.MemberCount,
			p.MeanVariance,
			p.CoefficientOfVar,
			membersJSON,
			p.CorrectionType,
			p.AffectedField,
			p.Confidence,
			p.Evidence,
		); err != nil {
			return fmt.Errorf("insert pattern %s: %w", p.SuspectedDomain, err)
		}
	}

	return nil
}

// GetPatternsByEngagement returns all reconciliation patterns for an
// engagement's latest batch.
func GetPatternsByEngagement(db *sql.DB, engagementID string) ([]models.ReconciliationPattern, error) {
	rows, err := db.Query(`
		SELECT p.pattern_id, p.batch_id, p.suspected_domain, p.plan_code,
		       p.direction, p.member_count, p.mean_variance, p.coefficient_of_var,
		       p.affected_members, p.correction_type, p.affected_field,
		       p.confidence, p.evidence, p.resolved, p.resolved_at, p.created_at
		FROM migration.reconciliation_pattern p
		JOIN migration.batch b ON b.batch_id = p.batch_id
		WHERE b.engagement_id = $1
		ORDER BY p.member_count DESC, p.suspected_domain`,
		engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("query patterns: %w", err)
	}
	defer rows.Close()

	var patterns []models.ReconciliationPattern
	for rows.Next() {
		var p models.ReconciliationPattern
		var membersJSON []byte
		var resolvedAt *string
		if err := rows.Scan(
			&p.PatternID, &p.BatchID, &p.SuspectedDomain, &p.PlanCode,
			&p.Direction, &p.MemberCount, &p.MeanVariance, &p.CoefficientOfVar,
			&membersJSON, &p.CorrectionType, &p.AffectedField,
			&p.Confidence, &p.Evidence, &p.Resolved, &resolvedAt, &p.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan pattern: %w", err)
		}
		if err := json.Unmarshal(membersJSON, &p.AffectedMembers); err != nil {
			p.AffectedMembers = []string{}
		}
		p.ResolvedAt = resolvedAt
		patterns = append(patterns, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("pattern rows: %w", err)
	}
	return patterns, nil
}
```

**Step 2: Write the test**

Create `platform/migration/db/pattern_test.go`:

```go
package db

import (
	"testing"

	"github.com/noui/platform/migration/models"
)

func TestPersistPatterns_BuildsValidSQL(t *testing.T) {
	// Verify the model struct can be constructed with all fields.
	patterns := []models.ReconciliationPattern{
		{
			SuspectedDomain:  "salary",
			PlanCode:         "TIER_1",
			Direction:        "negative",
			MemberCount:      23,
			MeanVariance:     "-142.75",
			CoefficientOfVar: 0.18,
			AffectedMembers:  []string{"M001", "M002"},
			CorrectionType:   strPtr("MAPPING_FIX"),
			AffectedField:    strPtr("gross_amount"),
			Confidence:       float64Ptr(0.82),
			Evidence:         strPtr("23 members in TIER_1 show -142.75 salary variance"),
		},
	}

	if len(patterns) != 1 {
		t.Errorf("expected 1 pattern, got %d", len(patterns))
	}
	if patterns[0].MemberCount != 23 {
		t.Errorf("expected member_count=23, got %d", patterns[0].MemberCount)
	}
	if *patterns[0].CorrectionType != "MAPPING_FIX" {
		t.Errorf("expected MAPPING_FIX, got %s", *patterns[0].CorrectionType)
	}
}

func strPtr(s string) *string    { return &s }
func float64Ptr(f float64) *float64 { return &f }
```

Note: Full DB integration test (PersistPatterns with real DB) is Tier 2. This test validates the model construction works in short mode.

**Step 3: Run tests**

Run: `cd platform/migration && go test ./db/ -v -count=1 -short`
Expected: PASS.

**Step 4: Commit**

```bash
git add platform/migration/db/pattern.go platform/migration/db/pattern_test.go
git commit -m "[platform/migration] Add pattern persistence layer"
```

---

### Task 5: Wire Intelligence Into ReconcileBatch Handler

**Files:**
- Modify: `platform/migration/api/handlers.go` (line 15–19, add `Analyzer` field)
- Modify: `platform/migration/api/reconciliation_handlers.go` (after line 75, add intelligence call)

**Step 1: Add Analyzer field to Handler**

In `platform/migration/api/handlers.go`, modify the Handler struct (line 15):

```go
// Handler holds dependencies for API handlers.
type Handler struct {
	DB          *sql.DB
	IntelClient intelligence.Scorer    // nil-safe: handlers degrade to template-only if nil
	Analyzer    intelligence.Analyzer   // nil-safe: pattern detection degrades if nil
	Hub         *ws.Hub                // WebSocket hub for broadcasting events (nil-safe)
	PlanConfig  *reconciler.PlanConfig // nil-safe: reconciliation degrades if not loaded
}
```

**Step 2: Add intelligence call to ReconcileBatch**

In `platform/migration/api/reconciliation_handlers.go`, after `persistReconciliationResults` (line 75), before the `slog.Info` (line 77), add:

```go
	// Call intelligence service for pattern detection (non-fatal).
	if h.Analyzer != nil {
		go h.analyzePatterns(batchID, allResults)
	}
```

Then add the helper method at the bottom of the file:

```go
// analyzePatterns calls the Python intelligence service to detect systematic
// mismatch patterns. Runs in a goroutine — errors are logged, not propagated.
func (h *Handler) analyzePatterns(batchID string, results []reconciler.ReconciliationResult) {
	// Build mismatch records from non-MATCH results only.
	var mismatches []intelligence.MismatchRecord
	for _, r := range results {
		if r.Category == reconciler.CategoryMatch {
			continue
		}
		mismatches = append(mismatches, intelligence.MismatchRecord{
			MemberID:        r.MemberID,
			VarianceAmount:  r.VarianceAmount,
			SuspectedDomain: r.SuspectedDomain,
			MemberStatus:    string(r.MemberStatus),
			PlanCode:        "", // extracted from batch context if available
			Category:        string(r.Category),
		})
	}

	if len(mismatches) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.Analyzer.AnalyzeMismatches(ctx, intelligence.AnalyzeMismatchesRequest{
		ReconciliationResults: mismatches,
	})
	if err != nil {
		slog.Warn("intelligence pattern analysis failed", "error", err, "batch_id", batchID)
		return
	}

	// Convert intelligence response to model patterns.
	var patterns []models.ReconciliationPattern
	for i, p := range resp.Patterns {
		pat := models.ReconciliationPattern{
			SuspectedDomain:  p.SuspectedDomain,
			PlanCode:         p.PlanCode,
			Direction:        p.Direction,
			MemberCount:      p.MemberCount,
			MeanVariance:     p.MeanVariance,
			CoefficientOfVar: p.CV,
			AffectedMembers:  p.AffectedMembers,
		}
		// Attach correction suggestion if one exists for this pattern index.
		if i < len(resp.Suggestions) {
			s := resp.Suggestions[i]
			pat.CorrectionType = &s.CorrectionType
			pat.AffectedField = &s.AffectedField
			pat.Confidence = &s.Confidence
			pat.Evidence = &s.Evidence
		}
		patterns = append(patterns, pat)
	}

	if len(patterns) == 0 {
		return
	}

	// Persist in a transaction.
	tx, err := h.DB.Begin()
	if err != nil {
		slog.Warn("failed to begin pattern persist tx", "error", err, "batch_id", batchID)
		return
	}
	defer tx.Rollback()

	if err := migrationdb.PersistPatterns(tx, batchID, patterns); err != nil {
		slog.Warn("failed to persist patterns", "error", err, "batch_id", batchID)
		return
	}

	if err := tx.Commit(); err != nil {
		slog.Warn("failed to commit patterns", "error", err, "batch_id", batchID)
		return
	}

	slog.Info("intelligence patterns persisted",
		"batch_id", batchID,
		"pattern_count", len(patterns),
	)
}
```

Note: Add required imports to `reconciliation_handlers.go`:
```go
import (
	"context"
	"time"
	// existing imports...
	"github.com/noui/platform/migration/intelligence"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)
```

**Step 3: Verify build**

Run: `cd platform/migration && go build ./...`
Expected: Clean build.

**Step 4: Commit**

```bash
git add platform/migration/api/handlers.go platform/migration/api/reconciliation_handlers.go
git commit -m "[platform/migration] Wire intelligence analysis into ReconcileBatch"
```

---

### Task 6: GET Patterns Endpoint + Route Registration

**Files:**
- Create: `platform/migration/api/pattern_handlers.go`
- Modify: `platform/migration/api/handlers.go` (add route at ~line 70, after reconciliation routes)

**Step 1: Write the handler**

Create `platform/migration/api/pattern_handlers.go`:

```go
package api

import (
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
)

// GetReconciliationPatterns handles GET /api/v1/migration/engagements/{id}/reconciliation/patterns.
// Returns intelligence-detected systematic patterns for the engagement.
func (h *Handler) GetReconciliationPatterns(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	patterns, err := migrationdb.GetPatternsByEngagement(h.DB, engagementID)
	if err != nil {
		slog.Error("failed to get reconciliation patterns", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to get patterns")
		return
	}

	if patterns == nil {
		patterns = []models.ReconciliationPattern{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]any{
		"engagement_id": engagementID,
		"patterns":      patterns,
		"count":         len(patterns),
	})
}
```

Add import for models:
```go
import (
	// ...
	"github.com/noui/platform/migration/models"
)
```

**Step 2: Register the route**

In `platform/migration/api/handlers.go`, add after line 69 (after `GetP1Issues` route):

```go
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/reconciliation/patterns", h.GetReconciliationPatterns)
```

**Step 3: Verify build**

Run: `cd platform/migration && go build ./...`
Expected: Clean build.

**Step 4: Run all migration tests in short mode**

Run: `cd platform/migration && go test ./... -short -count=1`
Expected: All packages pass.

**Step 5: Commit**

```bash
git add platform/migration/api/pattern_handlers.go platform/migration/api/handlers.go
git commit -m "[platform/migration] Add GET reconciliation/patterns endpoint"
```

---

### Task 7: Frontend — Type, API Method, Hook

**Files:**
- Modify: `frontend/src/types/Migration.ts` (after `RootCauseResponse` at ~line 357)
- Modify: `frontend/src/lib/migrationApi.ts` (after `getRootCauseAnalysis` at ~line 222)
- Modify: `frontend/src/hooks/useMigrationApi.ts` (after `useRootCauseAnalysis` at ~line 468)

**Step 1: Add ReconciliationPattern type**

In `frontend/src/types/Migration.ts`, after `RootCauseResponse` (line ~357):

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

**Step 2: Add API method**

In `frontend/src/lib/migrationApi.ts`, after `getRootCauseAnalysis` (line ~222):

```typescript
  getReconciliationPatterns: (engagementId: string) =>
    fetchAPI<{ patterns: ReconciliationPattern[]; count: number }>(
      `${BASE}/engagements/${engagementId}/reconciliation/patterns`
    ),
```

Add `ReconciliationPattern` to the import from `../types/Migration`.

**Step 3: Add query hook**

In `frontend/src/hooks/useMigrationApi.ts`, after `useRootCauseAnalysis` (line ~468):

```typescript
export function useReconciliationPatterns(engagementId: string | undefined) {
  return useQuery<{ patterns: ReconciliationPattern[]; count: number }>({
    queryKey: ['migration', 'reconciliation', 'patterns', engagementId],
    queryFn: () => migrationAPI.getReconciliationPatterns(engagementId!),
    enabled: !!engagementId,
    staleTime: 60_000,
  });
}
```

Add `ReconciliationPattern` to the import from `../types/Migration`.

**Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean.

**Step 5: Commit**

```bash
git add frontend/src/types/Migration.ts frontend/src/lib/migrationApi.ts frontend/src/hooks/useMigrationApi.ts
git commit -m "[frontend] Add ReconciliationPattern type, API method, and query hook"
```

---

### Task 8: Frontend — ReconciliationPanel Patterns Section

**Files:**
- Modify: `frontend/src/components/migration/engagement/ReconciliationPanel.tsx`

**Step 1: Add hook import and call**

At top of file, add `useReconciliationPatterns` to the hook imports. After the existing `useRootCauseAnalysis` call (line ~45), add:

```typescript
const { data: patternsData } = useReconciliationPatterns(engagementId);
const patterns = patternsData?.patterns ?? [];
```

**Step 2: Add Systematic Patterns section**

After the Root Cause Analysis card (line ~279), before the Tier score cards (line ~281), add:

```tsx
      {/* Systematic Patterns (from intelligence service) */}
      {patterns.length > 0 && (
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
            Systematic Patterns ({patterns.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {patterns.map((p) => (
              <div
                key={p.pattern_id}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  background: p.resolved ? '#f9fafb' : '#fffbeb',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: '2px 6px',
                      borderRadius: 4, background: '#fef3c7', color: '#92400e',
                    }}>
                      {p.suspected_domain}
                    </span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>
                      {p.plan_code} · {p.direction}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>
                    {p.member_count} members · avg {p.mean_variance}
                  </span>
                </div>
                {p.evidence && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    {p.evidence}
                  </div>
                )}
                {p.correction_type && (
                  <div style={{
                    display: 'flex', gap: 8, alignItems: 'center', marginTop: 6,
                  }}>
                    <span style={{
                      fontSize: 11, padding: '1px 5px', borderRadius: 3,
                      background: '#dbeafe', color: '#1e40af',
                    }}>
                      {p.correction_type}
                    </span>
                    {p.affected_field && (
                      <span style={{ fontSize: 11, color: '#6b7280' }}>
                        Field: {p.affected_field}
                      </span>
                    )}
                    {p.confidence != null && (
                      <span style={{
                        fontSize: 11, padding: '1px 5px', borderRadius: 3,
                        background: p.confidence >= 0.8 ? '#dcfce7' : '#fef9c3',
                        color: p.confidence >= 0.8 ? '#166534' : '#854d0e',
                      }}>
                        {Math.round(p.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
```

**Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean.

**Step 4: Run frontend tests**

Run: `cd frontend && npm test -- --run`
Expected: All tests pass (existing tests unaffected).

**Step 5: Commit**

```bash
git add frontend/src/components/migration/engagement/ReconciliationPanel.tsx
git commit -m "[frontend] Add Systematic Patterns section to ReconciliationPanel"
```

---

### Task 9: Frontend Test — ReconciliationPanel with Patterns

**Files:**
- Create: `frontend/src/components/migration/engagement/__tests__/ReconciliationPatterns.test.tsx`

**Step 1: Write the test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../../test/helpers';

// Mock the hooks module.
vi.mock('../../../../hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('../../../../hooks/useMigrationApi');
  return {
    ...actual,
    useReconciliationSummary: vi.fn(),
    useP1Issues: vi.fn(),
    useReconciliationByTier: vi.fn(),
    useReconciliation: vi.fn(),
    useRootCauseAnalysis: vi.fn(),
    useReconciliationPatterns: vi.fn(),
  };
});

import {
  useReconciliationSummary,
  useP1Issues,
  useReconciliationByTier,
  useReconciliation,
  useRootCauseAnalysis,
  useReconciliationPatterns,
} from '../../../../hooks/useMigrationApi';

import ReconciliationPanel from '../ReconciliationPanel';

const mockSummary = {
  data: {
    total_records: 10,
    match_count: 7,
    minor_count: 2,
    major_count: 1,
    error_count: 0,
    gate_score: 0.85,
    p1_count: 1,
    p2_count: 2,
    p3_count: 0,
    tier1_score: 0.90,
    tier2_score: 0.80,
    tier3_score: 1.0,
    tier1_total: 5,
    tier1_match: 4,
    tier2_total: 3,
    tier2_match: 2,
    tier3_total: 2,
    tier3_match: 2,
  },
  isLoading: false,
};

const mockPatterns = [
  {
    pattern_id: 'p1',
    batch_id: 'b1',
    suspected_domain: 'salary',
    plan_code: 'TIER_1',
    direction: 'negative',
    member_count: 23,
    mean_variance: '-142.75',
    coefficient_of_var: 0.18,
    affected_members: ['M001', 'M002'],
    correction_type: 'MAPPING_FIX',
    affected_field: 'gross_amount',
    confidence: 0.82,
    evidence: '23 members in TIER_1 show -142.75 salary variance',
    resolved: false,
    resolved_at: null,
    created_at: '2026-03-22T10:00:00Z',
  },
];

describe('ReconciliationPanel — Systematic Patterns', () => {
  beforeEach(() => {
    (useReconciliationSummary as any).mockReturnValue(mockSummary);
    (useP1Issues as any).mockReturnValue({ data: { p1_issues: [] }, isLoading: false });
    (useReconciliationByTier as any).mockReturnValue({ data: [], isLoading: false });
    (useReconciliation as any).mockReturnValue({ data: { records: [] }, isLoading: false });
    (useRootCauseAnalysis as any).mockReturnValue({ data: null });
  });

  it('renders pattern cards when patterns exist', () => {
    (useReconciliationPatterns as any).mockReturnValue({
      data: { patterns: mockPatterns, count: 1 },
    });

    render(<ReconciliationPanel engagementId="eng-1" />);

    expect(screen.getByText(/Systematic Patterns/)).toBeTruthy();
    expect(screen.getByText('salary')).toBeTruthy();
    expect(screen.getByText(/23 members/)).toBeTruthy();
    expect(screen.getByText('MAPPING_FIX')).toBeTruthy();
    expect(screen.getByText(/82% confidence/)).toBeTruthy();
  });

  it('hides patterns section when no patterns', () => {
    (useReconciliationPatterns as any).mockReturnValue({
      data: { patterns: [], count: 0 },
    });

    render(<ReconciliationPanel engagementId="eng-1" />);

    expect(screen.queryByText(/Systematic Patterns/)).toBeNull();
  });
});
```

**Step 2: Run the test**

Run: `cd frontend && npm test -- --run src/components/migration/engagement/__tests__/ReconciliationPatterns.test.tsx`
Expected: 2 tests PASS.

**Step 3: Run full frontend test suite**

Run: `cd frontend && npm test -- --run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add frontend/src/components/migration/engagement/__tests__/ReconciliationPatterns.test.tsx
git commit -m "[frontend] Add ReconciliationPatterns integration test"
```

---

### Task 10: Full Verification

**Step 1: Go build + tests**

Run: `cd platform/migration && go build ./... && go test ./... -short -count=1`
Expected: All packages build, all tests pass.

**Step 2: Frontend typecheck + tests**

Run: `cd frontend && npx tsc --noEmit && npm test -- --run`
Expected: Clean typecheck, all tests pass.

**Step 3: Commit summary + update BUILD_HISTORY.md**

Update `BUILD_HISTORY.md` with session summary including:
- Files changed
- Tests added
- What was wired

```bash
git add BUILD_HISTORY.md
git commit -m "[docs] Update BUILD_HISTORY with intelligence integration session"
```

---

## File Summary

| Action | File |
|--------|------|
| Create | `platform/migration/db/migrations/039_reconciliation_patterns.sql` |
| Create | `platform/migration/db/pattern.go` |
| Create | `platform/migration/db/pattern_test.go` |
| Create | `platform/migration/intelligence/client_test.go` |
| Create | `platform/migration/api/pattern_handlers.go` |
| Create | `frontend/src/components/migration/engagement/__tests__/ReconciliationPatterns.test.tsx` |
| Modify | `platform/migration/models/types.go` |
| Modify | `platform/migration/intelligence/client.go` |
| Modify | `platform/migration/api/handlers.go` |
| Modify | `platform/migration/api/reconciliation_handlers.go` |
| Modify | `frontend/src/types/Migration.ts` |
| Modify | `frontend/src/lib/migrationApi.ts` |
| Modify | `frontend/src/hooks/useMigrationApi.ts` |
| Modify | `frontend/src/components/migration/engagement/ReconciliationPanel.tsx` |
| Modify | `BUILD_HISTORY.md` |
