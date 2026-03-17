# API Consistency Standardization + Final Regression

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate duplicated API response helpers across 7 platform services by extracting a shared `apiresponse` package, standardize JSON field naming (`requestId` camelCase everywhere), and run a final regression to confirm zero regressions from the full quality review.

**Architecture:** Create `platform/apiresponse/` as a shared Go package with `WriteSuccess`, `WriteError`, `WritePaginated`, and `WriteJSON` helpers. Wire all 7 services to use it, deleting ~30 lines of duplicated helper code per service (~210 lines total). Fix the `request_id` → `requestId` inconsistency in intelligence and dataaccess models. Update the frontend `APIResponse` type and test mocks to match the standardized field name.

**Tech Stack:** Go 1.22 (platform services), TypeScript/React (frontend), vitest (frontend tests)

---

## Task 1: Create Shared `platform/apiresponse` Package

**Files:**
- Create: `platform/apiresponse/go.mod`
- Create: `platform/apiresponse/apiresponse.go`
- Create: `platform/apiresponse/apiresponse_test.go`

**Step 1: Create go.mod**

Create `platform/apiresponse/go.mod`:

```
module github.com/noui/platform/apiresponse

go 1.22.0

require github.com/google/uuid v1.6.0
```

Run: `cd platform/apiresponse && go mod tidy`

**Step 2: Write the failing tests**

Create `platform/apiresponse/apiresponse_test.go`:

```go
package apiresponse

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteSuccess_Shape(t *testing.T) {
	w := httptest.NewRecorder()
	WriteSuccess(w, http.StatusOK, "testservice", map[string]string{"key": "value"})

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", ct)
	}

	var body map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}

	// Must have "data" and "meta"
	if _, ok := body["data"]; !ok {
		t.Fatal("missing 'data' key")
	}
	if _, ok := body["meta"]; !ok {
		t.Fatal("missing 'meta' key")
	}

	var meta map[string]string
	if err := json.Unmarshal(body["meta"], &meta); err != nil {
		t.Fatalf("meta parse error: %v", err)
	}
	if meta["requestId"] == "" {
		t.Error("meta.requestId is empty")
	}
	if meta["timestamp"] == "" {
		t.Error("meta.timestamp is empty")
	}
	if meta["service"] != "testservice" {
		t.Errorf("meta.service = %q, want %q", meta["service"], "testservice")
	}
	if meta["version"] != "v1" {
		t.Errorf("meta.version = %q, want %q", meta["version"], "v1")
	}
}

func TestWriteSuccess_CustomStatus(t *testing.T) {
	w := httptest.NewRecorder()
	WriteSuccess(w, http.StatusCreated, "crm", map[string]string{"id": "abc"})
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusCreated)
	}
}

func TestWriteError_Shape(t *testing.T) {
	w := httptest.NewRecorder()
	WriteError(w, http.StatusBadRequest, "INVALID_INPUT", "name is required")

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}

	if _, ok := body["error"]; !ok {
		t.Fatal("missing 'error' key")
	}

	var errObj map[string]string
	if err := json.Unmarshal(body["error"], &errObj); err != nil {
		t.Fatalf("error parse: %v", err)
	}
	if errObj["code"] != "INVALID_INPUT" {
		t.Errorf("error.code = %q, want INVALID_INPUT", errObj["code"])
	}
	if errObj["message"] != "name is required" {
		t.Errorf("error.message = %q, want 'name is required'", errObj["message"])
	}
	if errObj["requestId"] == "" {
		t.Error("error.requestId is empty")
	}
}

func TestWritePaginated_Shape(t *testing.T) {
	w := httptest.NewRecorder()
	items := []string{"a", "b", "c"}
	WritePaginated(w, "crm", items, 100, 25, 0)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}

	if _, ok := body["data"]; !ok {
		t.Fatal("missing 'data' key")
	}
	if _, ok := body["pagination"]; !ok {
		t.Fatal("missing 'pagination' key")
	}
	if _, ok := body["meta"]; !ok {
		t.Fatal("missing 'meta' key")
	}

	var pg map[string]interface{}
	if err := json.Unmarshal(body["pagination"], &pg); err != nil {
		t.Fatalf("pagination parse: %v", err)
	}
	if pg["total"] != float64(100) {
		t.Errorf("pagination.total = %v, want 100", pg["total"])
	}
	if pg["limit"] != float64(25) {
		t.Errorf("pagination.limit = %v, want 25", pg["limit"])
	}
	if pg["offset"] != float64(0) {
		t.Errorf("pagination.offset = %v, want 0", pg["offset"])
	}
	if pg["hasMore"] != true {
		t.Errorf("pagination.hasMore = %v, want true", pg["hasMore"])
	}
}

func TestWritePaginated_HasMoreFalse(t *testing.T) {
	w := httptest.NewRecorder()
	WritePaginated(w, "crm", []string{"a"}, 1, 25, 0)

	var body struct {
		Pagination struct {
			HasMore bool `json:"hasMore"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Pagination.HasMore {
		t.Error("expected hasMore=false when total <= offset+limit")
	}
}

func TestWriteJSON_RawOutput(t *testing.T) {
	w := httptest.NewRecorder()
	WriteJSON(w, http.StatusAccepted, map[string]string{"status": "logged"})

	if w.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusAccepted)
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body["status"] != "logged" {
		t.Errorf("status = %q, want logged", body["status"])
	}
}
```

**Step 3: Run tests to verify they fail**

Run: `cd platform/apiresponse && go test ./... -v -count=1`
Expected: FAIL — functions undefined

**Step 4: Write the implementation**

Create `platform/apiresponse/apiresponse.go`:

```go
// Package apiresponse provides standardized HTTP response helpers for all platform services.
// Every service MUST use these helpers to ensure consistent JSON response shapes.
//
// Success:   {"data": ..., "meta": {"requestId": "...", "timestamp": "...", "service": "...", "version": "v1"}}
// Error:     {"error": {"code": "...", "message": "...", "requestId": "..."}}
// Paginated: {"data": [...], "pagination": {"total": N, "limit": N, "offset": N, "hasMore": bool}, "meta": {...}}
package apiresponse

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// WriteSuccess writes a success response with the standard envelope.
func WriteSuccess(w http.ResponseWriter, status int, service string, data any) {
	resp := map[string]any{
		"data": data,
		"meta": map[string]any{
			"requestId": uuid.New().String(),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"service":   service,
			"version":   "v1",
		},
	}
	WriteJSON(w, status, resp)
}

// WriteError writes an error response with the standard envelope.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	resp := map[string]any{
		"error": map[string]any{
			"code":      code,
			"message":   message,
			"requestId": uuid.New().String(),
		},
	}
	WriteJSON(w, status, resp)
}

// WritePaginated writes a paginated list response with the standard envelope.
func WritePaginated(w http.ResponseWriter, service string, data any, total, limit, offset int) {
	resp := map[string]any{
		"data": data,
		"pagination": map[string]any{
			"total":   total,
			"limit":   limit,
			"offset":  offset,
			"hasMore": offset+limit < total,
		},
		"meta": map[string]any{
			"requestId": uuid.New().String(),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"service":   service,
			"version":   "v1",
		},
	}
	WriteJSON(w, http.StatusOK, resp)
}

// WriteJSON writes any value as JSON with the given status code.
// Use this for non-standard responses (e.g., health checks, fire-and-forget acknowledgments).
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("error encoding JSON response", "error", err)
	}
}
```

**Step 5: Run tests to verify they pass**

Run: `cd platform/apiresponse && go test ./... -v -count=1`
Expected: 6 PASS

**Step 6: Commit**

```bash
git add platform/apiresponse/
git commit -m "[platform/apiresponse] Create shared API response helpers for consistent JSON envelopes"
```

---

## Task 2: Wire `apiresponse` Into `dataaccess` + Delete `models/response.go`

**Files:**
- Modify: `platform/dataaccess/go.mod` — add apiresponse dependency
- Modify: `platform/dataaccess/api/handlers.go` — replace local helpers
- Modify: `platform/dataaccess/api/handlers_test.go` — remove models import for response types
- Delete: `platform/dataaccess/models/response.go` — superseded by shared package

**Step 1: Add dependency to go.mod**

Add to `platform/dataaccess/go.mod` requires:
```
github.com/noui/platform/apiresponse v0.0.0
```

Add to replace block:
```
github.com/noui/platform/apiresponse => ../apiresponse
```

Run: `cd platform/dataaccess && go mod tidy`

**Step 2: Replace local helpers in handlers.go**

Add import: `"github.com/noui/platform/apiresponse"`

Replace `writeJSON` function (lines 700-706) — delete entirely.

Replace `writePaginated` function (lines 708-715):

Delete entirely. Replace all call sites:
- `writePaginated(w, items, total, limit, offset)` → `apiresponse.WritePaginated(w, "dataaccess", items, total, limit, offset)`

But note: the current `writePaginated` wraps items in `models.PaginatedData{Items: items, Total: total, ...}` which nests them under `data.items`. The shared package puts items directly under `data`. This is actually correct — the frontend's `fetchPaginatedAPI` reads `body.data` and `body.pagination` as top-level keys. The current dataaccess approach nests pagination INSIDE data, which is inconsistent with the other 6 services. The shared package fixes this.

Replace `writeSuccess` function (lines 717-726):

Delete entirely. Replace all call sites:
- `writeSuccess(w, data)` → `apiresponse.WriteSuccess(w, http.StatusOK, "dataaccess", data)`

Replace `writeError` function (lines 728-737):

Delete entirely. Replace all call sites:
- `writeError(w, status, code, msg)` → `apiresponse.WriteError(w, status, code, msg)`

**Step 3: Fix paginated endpoint — service credit**

The service credit endpoint (around line 650-670) currently builds a custom struct with `Credits`, `Summary`, `Total`, `Limit`, `Offset` and passes it to `writeSuccess`. This should use `WritePaginated` instead:

```go
// Before:
result := struct {
    Credits []ServiceCreditRow `json:"credits"`
    Summary *ServiceCreditSummary `json:"summary"`
    Total   int `json:"total"`
    Limit   int `json:"limit"`
    Offset  int `json:"offset"`
}{...}
writeSuccess(w, result)

// After:
data := struct {
    Credits []ServiceCreditRow       `json:"credits"`
    Summary *ServiceCreditSummary    `json:"summary"`
}{Credits: credits, Summary: summary}
apiresponse.WritePaginated(w, "dataaccess", data, total, limit, offset)
```

**Step 4: Delete `models/response.go`**

```bash
rm platform/dataaccess/models/response.go
```

Remove the `models` import from `handlers_test.go` if it was only used for response types. Check if `models` is still needed for other types (it likely is — `models.MemberData`, etc.).

**Step 5: Update handlers_test.go**

The test file imports `models` for test data types. Check if `models.APIError`, `models.APIResponse`, etc. are used in assertions — if so, replace with raw JSON assertions like other services use.

**Step 6: Build and test**

Run: `cd platform/dataaccess && go build ./... && go test ./... -v -count=1`
Expected: clean build, all tests pass

**Step 7: Commit**

```bash
git add platform/dataaccess/
git commit -m "[platform/dataaccess] Wire shared apiresponse package, delete models/response.go"
```

---

## Task 3: Wire `apiresponse` Into `intelligence` (Fix `request_id` → `requestId`)

**Files:**
- Modify: `platform/intelligence/go.mod` — add apiresponse dependency
- Modify: `platform/intelligence/api/handlers.go` — replace local helpers

This service has two special cases:
1. `writeSuccess(w, data)` takes only 2 args (always 200) — change to `apiresponse.WriteSuccess(w, http.StatusOK, "intelligence", data)`
2. `LogSummary` uses raw `writeJSON` for non-standard responses — change to `apiresponse.WriteJSON`
3. `LogSummary` also uses `writeJSON` for error-like responses without the standard error shape — change to `apiresponse.WriteError` where appropriate, keep `apiresponse.WriteJSON` for `{"status": "logged"}`

**Step 1: Add dependency to go.mod**

Add to `platform/intelligence/go.mod` requires:
```
github.com/noui/platform/apiresponse v0.0.0
```

Add to replace block:
```
github.com/noui/platform/apiresponse => ../apiresponse
```

Run: `cd platform/intelligence && go mod tidy`

**Step 2: Replace local helpers in handlers.go**

Add import: `"github.com/noui/platform/apiresponse"`

Delete `writeJSON`, `writeSuccess`, `writeError` functions (lines 488-516).

Replace call sites:
- `writeSuccess(w, data)` → `apiresponse.WriteSuccess(w, http.StatusOK, "intelligence", data)`
- `writeError(w, status, code, msg)` → `apiresponse.WriteError(w, status, code, msg)`
- `writeJSON(w, status, data)` → `apiresponse.WriteJSON(w, status, data)`

In LogSummary (lines 327-328, 331-332, 336-337):
- `writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})` → `apiresponse.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid body")`
- `writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})` → `apiresponse.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON")`
- `writeJSON(w, http.StatusBadRequest, map[string]string{"error": "memberId and inputHash required"})` → `apiresponse.WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "memberId and inputHash required")`
- `writeJSON(w, http.StatusAccepted, map[string]string{"status": "logged"})` → `apiresponse.WriteJSON(w, http.StatusAccepted, map[string]string{"status": "logged"})`

**Step 3: Build and test**

Run: `cd platform/intelligence && go build ./... && go test ./... -v -count=1`
Expected: clean build, all tests pass

**Step 4: Commit**

```bash
git add platform/intelligence/
git commit -m "[platform/intelligence] Wire shared apiresponse package, fix request_id to requestId"
```

---

## Task 4: Wire `apiresponse` Into Remaining 5 Services

**Files (per service):**
- Modify: `platform/{service}/go.mod`
- Modify: `platform/{service}/api/handlers.go`

Services: `crm`, `correspondence`, `dataquality`, `knowledgebase`, `casemanagement`

These 5 services all have the same pattern — nearly identical local `writeSuccess`, `writeError`, `writePaginated`, `writeJSON` functions. The replacement is mechanical.

**Pattern for each service:**

1. Add to go.mod requires: `github.com/noui/platform/apiresponse v0.0.0`
2. Add to replace block: `github.com/noui/platform/apiresponse => ../apiresponse`
3. Run: `cd platform/{service} && go mod tidy`
4. Add import: `"github.com/noui/platform/apiresponse"`
5. Delete local `writeJSON`, `writeSuccess`, `writeError`, `writePaginated` functions
6. Replace call sites:
   - `writeSuccess(w, status, data)` → `apiresponse.WriteSuccess(w, status, "{service}", data)`
   - `writeError(w, status, code, msg)` → `apiresponse.WriteError(w, status, code, msg)`
   - `writePaginated(w, data, total, limit, offset)` → `apiresponse.WritePaginated(w, "{service}", data, total, limit, offset)`
   - `writeJSON(w, status, data)` → `apiresponse.WriteJSON(w, status, data)` (health checks, etc.)
7. Build and test: `cd platform/{service} && go build ./... && go test ./... -v -count=1`

**Service-specific notes:**

- **casemanagement**: Also has `writeJSON` calls for `{"status": "deleted"}` responses — use `apiresponse.WriteJSON`
- **crm**: `writeSuccess` takes `(w, status, data)` — maps directly to `apiresponse.WriteSuccess(w, status, "crm", data)`
- **knowledgebase**: Has `Cache-Control` and `X-Cache` headers set before response helpers — these must remain. The shared package only sets `Content-Type`, so service-specific headers set before the write call are preserved.

**Step 1: Wire all 5 services following the pattern above**

**Step 2: Build and test each service**

Run for each:
```bash
cd platform/crm && go build ./... && go test ./... -count=1
cd ../correspondence && go build ./... && go test ./... -count=1
cd ../dataquality && go build ./... && go test ./... -count=1
cd ../knowledgebase && go build ./... && go test ./... -count=1
cd ../casemanagement && go build ./... && go test ./... -count=1
```
Expected: all clean

**Step 3: Commit all 5 together**

```bash
git add platform/crm/ platform/correspondence/ platform/dataquality/ platform/knowledgebase/ platform/casemanagement/
git commit -m "[platform/*] Wire shared apiresponse package into 5 remaining services"
```

---

## Task 5: Update Frontend `APIResponse` Type and Test Mocks

**Files:**
- Modify: `frontend/src/lib/apiClient.ts:59` — fix `request_id` → `requestId` in type
- Modify: `frontend/src/lib/__tests__/apiClient.test.ts` — update mock meta field names
- Modify: `frontend/src/lib/__tests__/api.test.ts` — update mock meta
- Modify: `frontend/src/lib/__tests__/caseApi.test.ts` — update mock meta
- Modify: `frontend/src/lib/__tests__/correspondenceApi.test.ts` — update mock meta
- Modify: `frontend/src/lib/__tests__/crmApi.test.ts` — update mock meta
- Modify: `frontend/src/lib/__tests__/dqApi.test.ts` — update mock meta
- Modify: `frontend/src/lib/__tests__/kbApi.test.ts` — update mock meta
- Modify: `frontend/src/lib/__tests__/memberSearchApi.test.ts` — update mock meta

**Step 1: Update APIResponse type**

In `frontend/src/lib/apiClient.ts` line 59, change:

```typescript
// Before:
meta: { request_id: string; timestamp: string };

// After:
meta: { requestId: string; timestamp: string };
```

**Step 2: Update all test mocks**

In every test file that mocks API responses, replace:
```typescript
meta: { request_id: 'test', timestamp: '2026-01-01T00:00:00Z' }
// or
meta: { request_id: 'r1', timestamp: '2026-01-01T00:00:00Z' }
```

With:
```typescript
meta: { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' }
// or
meta: { requestId: 'r1', timestamp: '2026-01-01T00:00:00Z' }
```

This is a global find-and-replace of `request_id` → `requestId` in all test mock meta objects.

**Step 3: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean

**Step 4: Run full test suite**

Run: `cd frontend && npx vitest run`
Expected: 869 tests pass

**Step 5: Commit**

```bash
git add frontend/src/lib/apiClient.ts frontend/src/lib/__tests__/
git commit -m "[frontend] Standardize APIResponse meta field to requestId (camelCase)"
```

---

## Task 6: Final Regression Suite

**Step 1: Build all Go modules**

```bash
cd platform/apiresponse && go build ./...
cd ../dataaccess && go build ./...
cd ../intelligence && go build ./...
cd ../crm && go build ./...
cd ../correspondence && go build ./...
cd ../dataquality && go build ./...
cd ../knowledgebase && go build ./...
cd ../casemanagement && go build ./...
cd ../../connector && go build ./...
```

Expected: all clean

**Step 2: Test all Go modules**

```bash
cd platform/apiresponse && go test ./... -count=1
cd ../dataaccess && go test ./... -count=1
cd ../intelligence && go test ./... -count=1
cd ../crm && go test ./... -count=1
cd ../correspondence && go test ./... -count=1
cd ../dataquality && go test ./... -count=1
cd ../knowledgebase && go test ./... -count=1
cd ../casemanagement && go test ./... -count=1
```

Expected: all pass

**Step 3: Frontend typecheck + tests**

```bash
cd frontend && npx tsc --noEmit && npx vitest run
```

Expected: clean typecheck, 869 tests pass

**Step 4: Verify zero duplicated response helpers remain**

```bash
grep -rn "func writeSuccess\|func writeError\|func writePaginated\|func writeJSON" platform/*/api/handlers.go
```

Expected: zero matches (all deleted, replaced by apiresponse package calls)

**Step 5: Verify consistent `requestId` field**

```bash
grep -rn "request_id" platform/*/api/handlers.go
```

Expected: zero matches (all standardized to `requestId` via shared package)

**Step 6: Commit final verification**

No code changes — if all passes, the previous commits are sufficient.

---

*Plan v1.0 — 2026-03-16 — Quality Review Close-Out (Tasks 30-32)*
