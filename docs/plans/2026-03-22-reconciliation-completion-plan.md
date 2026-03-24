# Reconciliation Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete 5 remaining reconciliation items in 2 waves — backend Go sweep then frontend React sweep.

**Architecture:** All backend changes touch the existing migration service (`platform/migration/`). Frontend changes are in `ReconciliationPanel.tsx` and supporting hooks/API files. No new services, no new migrations, no new dependencies.

**Tech Stack:** Go 1.22, React/TypeScript, TanStack Query

---

### Task 1: Enhanced Root Cause — Backend Enrichment

**Files:**
- Modify: `platform/migration/api/ai_handlers.go:190-229`
- Modify: `platform/migration/models/types.go:292-297`

**Step 1: Update RootCauseResponse model to include patterns**

In `platform/migration/models/types.go`, add a `Patterns` field:

```go
type RootCauseResponse struct {
	Analysis      string                  `json:"analysis"`
	AffectedCount int                     `json:"affected_count"`
	Confidence    float64                 `json:"confidence"`
	Patterns      []ReconciliationPattern `json:"patterns,omitempty"`
}
```

**Step 2: Enrich HandleGetRootCause with pattern data**

In `platform/migration/api/ai_handlers.go`, after building the deterministic analysis (line 222), add a pattern query before the response:

```go
	// Enrich with intelligence-detected patterns if available.
	patterns, pErr := migrationdb.GetPatternsByEngagement(h.DB, id)
	if pErr != nil {
		slog.Warn("failed to get patterns for root cause", "error", pErr, "engagement_id", id)
		// Non-fatal: return root cause without patterns.
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", models.RootCauseResponse{
		Analysis:      analysis,
		AffectedCount: totalMismatches,
		Confidence:    confidence,
		Patterns:      patterns,
	})
```

Add `migrationdb "github.com/noui/platform/migration/db"` to the import block (it's not there yet — check first, the existing imports are `"github.com/noui/platform/apiresponse"` and `migrationdb "github.com/noui/platform/migration/db"`).

**Step 3: Run tests**

Run: `cd platform/migration && go build ./... && go test ./... -short -count=1 2>&1 | tail -20`
Expected: All packages pass.

**Step 4: Commit**

```bash
git add platform/migration/api/ai_handlers.go platform/migration/models/types.go
git commit -m "[platform/migration] Enrich root cause with intelligence patterns"
```

---

### Task 2: Resolution Workflow — Backend

**Files:**
- Modify: `platform/migration/db/pattern.go`
- Modify: `platform/migration/api/pattern_handlers.go`
- Modify: `platform/migration/api/handlers.go` (route registration)

**Step 1: Add ResolvePattern function in db/pattern.go**

Append to `platform/migration/db/pattern.go`:

```go
// ResolvePattern marks a pattern as resolved by the given user.
func ResolvePattern(db *sql.DB, patternID, userID string) (*models.ReconciliationPattern, error) {
	var p models.ReconciliationPattern
	var membersJSON []byte
	var resolvedAt *string
	err := db.QueryRow(`
		UPDATE migration.reconciliation_pattern
		SET resolved = TRUE, resolved_at = NOW(), resolved_by = $2
		WHERE pattern_id = $1
		RETURNING pattern_id, batch_id, suspected_domain, plan_code,
		          direction, member_count, mean_variance, coefficient_of_var,
		          affected_members, correction_type, affected_field,
		          confidence, evidence, resolved, resolved_at, created_at`,
		patternID, userID,
	).Scan(
		&p.PatternID, &p.BatchID, &p.SuspectedDomain, &p.PlanCode,
		&p.Direction, &p.MemberCount, &p.MeanVariance, &p.CoefficientOfVar,
		&membersJSON, &p.CorrectionType, &p.AffectedField,
		&p.Confidence, &p.Evidence, &p.Resolved, &resolvedAt, &p.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("resolve pattern: %w", err)
	}
	if err := json.Unmarshal(membersJSON, &p.AffectedMembers); err != nil {
		p.AffectedMembers = []string{}
	}
	p.ResolvedAt = resolvedAt
	return &p, nil
}
```

**Step 2: Add PATCH handler in pattern_handlers.go**

Append to `platform/migration/api/pattern_handlers.go`:

```go
// ResolvePattern handles PATCH /api/v1/migration/reconciliation/patterns/{id}/resolve.
func (h *Handler) ResolvePattern(w http.ResponseWriter, r *http.Request) {
	patternID := r.PathValue("id")
	if patternID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "pattern id is required")
		return
	}

	// Extract user identity from auth context.
	userID := r.Header.Get("X-User-ID") // fallback; prefer auth.UserID(r.Context()) when wired
	if uid := auth.UserID(r.Context()); uid != "" {
		userID = uid
	}
	if userID == "" {
		userID = "system"
	}

	pattern, err := migrationdb.ResolvePattern(h.DB, patternID, userID)
	if err != nil {
		slog.Error("failed to resolve pattern", "error", err, "pattern_id", patternID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "RESOLVE_FAILED", "failed to resolve pattern")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", pattern)
}
```

Add to the import block: `"github.com/noui/platform/auth"`.

**Step 3: Register route in handlers.go**

In `platform/migration/api/handlers.go`, add after the patterns GET route (line 71):

```go
	mux.HandleFunc("PATCH /api/v1/migration/reconciliation/patterns/{id}/resolve", h.ResolvePattern)
```

**Step 4: Run tests**

Run: `cd platform/migration && go build ./... && go test ./... -short -count=1 2>&1 | tail -20`
Expected: All packages pass.

**Step 5: Commit**

```bash
git add platform/migration/db/pattern.go platform/migration/api/pattern_handlers.go platform/migration/api/handlers.go
git commit -m "[platform/migration] Add PATCH resolve endpoint for reconciliation patterns"
```

---

### Task 3: Corpus Learning — Go Client

**Files:**
- Modify: `platform/migration/intelligence/client.go`
- Modify: `platform/migration/intelligence/client_test.go`
- Modify: `platform/migration/api/mapping_handlers.go:307-362`

**Step 1: Add RecordDecision types and method to client.go**

Append to `platform/migration/intelligence/client.go`:

```go
// --- Corpus Learning Types ---

// RecordDecisionRequest is the request body for POST /intelligence/record-decision.
type RecordDecisionRequest struct {
	TenantID        string `json:"tenant_id"`
	SourceColumn    string `json:"source_column"`
	CanonicalColumn string `json:"canonical_column"`
	Decision        string `json:"decision"` // "approve" or "reject"
	SourcePlatform  string `json:"source_platform"`
}

// CorpusRecorder defines the interface for recording mapping decisions.
type CorpusRecorder interface {
	RecordDecision(ctx context.Context, req RecordDecisionRequest) error
}

// RecordDecision calls POST /intelligence/record-decision on the Python service.
// Fire-and-forget: errors are logged but not propagated.
func (c *Client) RecordDecision(ctx context.Context, req RecordDecisionRequest) error {
	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	url := c.BaseURL + "/intelligence/record-decision"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("intelligence service call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("intelligence service returned %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}
```

**Step 2: Add test for RecordDecision**

Append to `platform/migration/intelligence/client_test.go`:

```go
func TestRecordDecision_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/intelligence/record-decision" {
			t.Errorf("expected /intelligence/record-decision, got %s", r.URL.Path)
		}

		var req RecordDecisionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request: %v", err)
		}
		if req.Decision != "approve" {
			t.Errorf("expected decision=approve, got %s", req.Decision)
		}
		if req.SourceColumn != "MBR_NBR" {
			t.Errorf("expected source_column=MBR_NBR, got %s", req.SourceColumn)
		}

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewClient(server.URL)
	err := client.RecordDecision(context.Background(), RecordDecisionRequest{
		TenantID:        "test-tenant",
		SourceColumn:    "MBR_NBR",
		CanonicalColumn: "member_id",
		Decision:        "approve",
		SourcePlatform:  "PRISM",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestRecordDecision_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal error"))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	err := client.RecordDecision(context.Background(), RecordDecisionRequest{
		TenantID:     "test-tenant",
		SourceColumn: "MBR_NBR",
		Decision:     "approve",
	})
	if err == nil {
		t.Fatal("expected error for 500 response")
	}
}
```

**Step 3: Wire into UpdateMapping handler**

In `platform/migration/api/mapping_handlers.go`, after the successful `apiresponse.WriteSuccess` call at the end of `UpdateMapping` (around line 361), add a fire-and-forget corpus call:

```go
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", m)

	// Record mapping decision for corpus learning (fire-and-forget).
	if h.Analyzer != nil {
		if recorder, ok := h.Analyzer.(intelligence.CorpusRecorder); ok {
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
				defer cancel()
				if err := recorder.RecordDecision(ctx, intelligence.RecordDecisionRequest{
					TenantID:        auth.TenantID(r.Context()),
					SourceColumn:    m.SourceColumn,
					CanonicalColumn: m.CanonicalColumn,
					Decision:        strings.ToLower(req.ApprovalStatus),
				}); err != nil {
					slog.Warn("failed to record mapping decision", "error", err, "mapping_id", mappingID)
				}
			}()
		}
	}
```

Add `"context"`, `"strings"`, `"time"`, `"github.com/noui/platform/auth"`, and `"github.com/noui/platform/migration/intelligence"` to the imports if not already present.

**Step 4: Run tests**

Run: `cd platform/migration && go build ./... && go test ./... -short -count=1 2>&1 | tail -20`
Expected: All packages pass.

**Step 5: Commit**

```bash
git add platform/migration/intelligence/client.go platform/migration/intelligence/client_test.go platform/migration/api/mapping_handlers.go
git commit -m "[platform/migration] Add corpus learning client + wire into mapping approval"
```

---

### Task 4: Rate Limit Fix — Frontend

**Files:**
- Modify: `frontend/src/components/migration/engagement/ReconciliationPanel.tsx`
- Modify: `frontend/src/components/migration/engagement/__tests__/ReconciliationPatterns.test.tsx`

**Step 1: Remove useReconciliationByTier calls and derive from allRecords**

In `ReconciliationPanel.tsx`, replace the three `useReconciliationByTier` calls (lines 42-44):

```typescript
// REMOVE these three lines:
// const { data: tier1 } = useReconciliationByTier(engagementId, 1);
// const { data: tier2 } = useReconciliationByTier(engagementId, 2);
// const { data: tier3 } = useReconciliationByTier(engagementId, 3);
```

Replace with derived data from `allRecords`:

```typescript
  const tier1 = useMemo(() => allRecords?.filter((r) => r.tier === 1), [allRecords]);
  const tier2 = useMemo(() => allRecords?.filter((r) => r.tier === 2), [allRecords]);
  const tier3 = useMemo(() => allRecords?.filter((r) => r.tier === 3), [allRecords]);
```

Remove `useReconciliationByTier` from the import statement at line 6.

**Step 2: Update test mock**

In `__tests__/ReconciliationPatterns.test.tsx`, remove `useReconciliationByTier` from the mock and its `mockReturnValue` calls (line 12, 22, 79). The tier data now derives from `useReconciliation`.

**Step 3: Run typecheck and tests**

Run: `cd frontend && npx tsc --noEmit && npm test -- --run 2>&1 | tail -10`
Expected: Typecheck clean, all tests pass.

**Step 4: Commit**

```bash
git add frontend/src/components/migration/engagement/ReconciliationPanel.tsx frontend/src/components/migration/engagement/__tests__/ReconciliationPatterns.test.tsx
git commit -m "[frontend] Fix reconciliation 429: derive tier data from single query"
```

---

### Task 5: Resolution Workflow — Frontend

**Files:**
- Modify: `frontend/src/lib/migrationApi.ts`
- Modify: `frontend/src/hooks/useMigrationApi.ts`
- Modify: `frontend/src/components/migration/engagement/ReconciliationPanel.tsx`

**Step 1: Add resolvePattern API function**

In `frontend/src/lib/migrationApi.ts`, in the reconciliation section (after `getReconciliationPatterns`), add:

```typescript
  resolvePattern: (patternId: string) =>
    patchAPI<ReconciliationPattern>(
      `${BASE}/reconciliation/patterns/${patternId}/resolve`,
      {},
      RAW,
    ),
```

Import `ReconciliationPattern` in the type imports if not already present.

**Step 2: Add useResolvePattern mutation hook**

In `frontend/src/hooks/useMigrationApi.ts`, after `useReconciliationPatterns`, add:

```typescript
export function useResolvePattern() {
  const queryClient = useQueryClient();
  return useMutation<ReconciliationPattern, Error, string>({
    mutationFn: (patternId) => migrationAPI.resolvePattern(patternId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'patterns'] });
    },
  });
}
```

Import `ReconciliationPattern` in the type imports if not already present.

**Step 3: Add resolve button to pattern cards in ReconciliationPanel**

In `ReconciliationPanel.tsx`, in the Systematic Patterns section where pattern cards are rendered, add a resolve button to each card. The pattern cards currently show domain badges and correction info. Add:

```typescript
const resolvePattern = useResolvePattern();
```

Then in each pattern card, add a button:

```tsx
{!pattern.resolved && (
  <button
    onClick={() => resolvePattern.mutate(pattern.pattern_id)}
    disabled={resolvePattern.isPending}
    style={{
      background: 'none', border: `1px solid ${C.sage}`, borderRadius: 4,
      padding: '2px 8px', cursor: 'pointer', ...MONO, fontSize: 11,
      color: C.sage,
    }}
  >
    {resolvePattern.isPending ? 'Resolving...' : 'Resolve'}
  </button>
)}
{pattern.resolved && (
  <span style={{ ...MONO, fontSize: 11, color: C.sage }}>Resolved</span>
)}
```

Import `useResolvePattern` from the hooks file.

**Step 4: Run typecheck and tests**

Run: `cd frontend && npx tsc --noEmit && npm test -- --run 2>&1 | tail -10`
Expected: Typecheck clean, all tests pass.

**Step 5: Commit**

```bash
git add frontend/src/lib/migrationApi.ts frontend/src/hooks/useMigrationApi.ts frontend/src/components/migration/engagement/ReconciliationPanel.tsx
git commit -m "[frontend] Add pattern resolution workflow UI"
```

---

### Task 6: Batch Trigger Button — Frontend

**Files:**
- Modify: `frontend/src/components/migration/engagement/ReconciliationPanel.tsx`

**Step 1: Add reconcile button to ReconciliationPanel**

The `useReconcileBatch` hook already exists (useMigrationApi.ts:310-318). Import it and add a button near the top of the panel (before the summary section), visible when there's no reconciliation data yet or when the user wants to re-run:

```typescript
const reconcileBatch = useReconcileBatch();
const { data: batches } = useBatches(engagementId);
const latestBatch = batches?.[batches.length - 1];
```

Add a "Run Reconciliation" button:

```tsx
{latestBatch && latestBatch.status === 'COMPLETED' && (
  <button
    onClick={() => reconcileBatch.mutate(latestBatch.batch_id)}
    disabled={reconcileBatch.isPending}
    style={{
      background: C.sage, color: '#fff', border: 'none', borderRadius: 6,
      padding: '6px 16px', cursor: 'pointer', ...BODY, fontWeight: 600,
    }}
  >
    {reconcileBatch.isPending ? 'Reconciling...' : 'Run Reconciliation'}
  </button>
)}
```

Import `useReconcileBatch` and `useBatches` from the hooks file.

**Step 2: Run typecheck and tests**

Run: `cd frontend && npx tsc --noEmit && npm test -- --run 2>&1 | tail -10`
Expected: Typecheck clean, all tests pass.

**Step 3: Commit**

```bash
git add frontend/src/components/migration/engagement/ReconciliationPanel.tsx
git commit -m "[frontend] Add reconciliation trigger button for completed batches"
```

---

### Task 7: Final Verification

**Step 1: Run full Go test suite**

Run: `cd platform/migration && go test ./... -short -count=1 -v 2>&1 | tail -30`
Expected: 11+ packages, all pass.

**Step 2: Run full frontend test suite**

Run: `cd frontend && npx tsc --noEmit && npm test -- --run 2>&1 | tail -10`
Expected: 232+ test files, 1840+ tests pass.

**Step 3: Update BUILD_HISTORY.md**

Add Session 21 entry documenting all 5 items completed.

**Step 4: Final commit**

```bash
git add BUILD_HISTORY.md
git commit -m "[docs] Update BUILD_HISTORY with reconciliation completion session"
```
