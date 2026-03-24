# Phase 5g: dbcontext + Employer Defect Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 3 bugs discovered during Phase 5f E2E tuning — stale DB connections, empty uploaded_by UUID, and hireDate timestamp parsing — then unskip E2E tests.

**Architecture:** All fixes are surgical (1-5 lines each). The dbcontext fix is systemic (affects all services); the other two are localized to employer-reporting and employer-terminations.

**Tech Stack:** Go 1.22, database/sql, time.Parse, platform/auth JWT extraction

---

### Task 1: Fix dbcontext Stale Connection Cascade

**Files:**
- Modify: `platform/dbcontext/dbcontext.go:165-197`

**Step 1: Add defer tx.Rollback() after BeginTx**

In `platform/dbcontext/dbcontext.go`, add one line after the transaction is opened (line 170, after the error check for BeginTx):

```go
// existing: line 165-170
tx, err := conn.BeginTx(r.Context(), nil)
if err != nil {
    slog.Error("dbcontext: failed to begin transaction", "error", err)
    writeInternalError(w)
    return
}
// ADD THIS LINE:
defer tx.Rollback() // no-op after successful Commit; cleans failed txns
```

This ensures the transaction is always rolled back if Commit is never called (handler panic, error response). After a successful `tx.Commit()` on line 195, the deferred Rollback is a harmless no-op.

**Step 2: Build to verify**

Run: `cd platform/dbcontext && go build ./...`
Expected: Clean build, no errors.

**Step 3: Run existing tests**

Run: `cd platform/dbcontext && go test ./... -short`
Expected: All existing tests pass (they test ScopedConn, not DBMiddleware).

**Step 4: Commit**

```bash
git add platform/dbcontext/dbcontext.go
git commit -m "[platform/dbcontext] Fix stale connection cascade — defer tx.Rollback after BeginTx"
```

---

### Task 2: Fix employer-reporting uploaded_by UUID

**Files:**
- Modify: `platform/employer-reporting/api/handlers.go` (lines 4-14, 168, 373, 513)

**Step 1: Add auth import**

Add `"github.com/noui/platform/auth"` to the import block in `platform/employer-reporting/api/handlers.go`:

```go
import (
    "database/sql"
    "encoding/json"
    "net/http"
    "strconv"

    "github.com/noui/platform/apiresponse"
    "github.com/noui/platform/auth"  // ADD THIS
    erdb "github.com/noui/platform/employer-reporting/db"
    "github.com/noui/platform/employer-reporting/domain"
    "github.com/noui/platform/validation"
)
```

**Step 2: Replace empty UploadedBy in ManualEntry (line 168)**

Change:
```go
UploadedBy:   "", // will be set from auth context in production
```
To:
```go
UploadedBy:   auth.UserID(r.Context()),
```

**Step 3: Replace empty resolved_by in ResolveException (line 373)**

Change:
```go
// Use a placeholder for resolved_by — in production this comes from auth context.
err := h.store.ResolveException(r.Context(), id, "", req.Note)
```
To:
```go
err := h.store.ResolveException(r.Context(), id, auth.UserID(r.Context()), req.Note)
```

**Step 4: Replace empty UploadedBy in SubmitCorrection (line 513)**

Change:
```go
UploadedBy:     "",
```
To:
```go
UploadedBy:     auth.UserID(r.Context()),
```

**Step 5: Build**

Run: `cd platform/employer-reporting && go build ./...`
Expected: Clean build.

**Step 6: Run tests**

Run: `cd platform/employer-reporting && go test ./... -short`
Expected: All tests pass.

**Step 7: Commit**

```bash
git add platform/employer-reporting/api/handlers.go
git commit -m "[platform/employer-reporting] Wire auth.UserID into uploaded_by and resolved_by fields"
```

---

### Task 3: Fix employer-terminations hireDate Parsing

**Files:**
- Modify: `platform/employer-terminations/domain/refund.go` (lines 58-66)

**Step 1: Add parseFlexDate helper**

Add this helper function at the bottom of `platform/employer-terminations/domain/refund.go`:

```go
// parseFlexDate parses a date string in either RFC3339 ("2020-01-15T00:00:00Z")
// or date-only ("2020-01-15") format. PostgreSQL timestamptz columns return the
// former; date columns return the latter.
func parseFlexDate(s string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02", s)
}
```

**Step 2: Replace date parsing in CalculateRefund**

Change lines 58-66:
```go
// Parse dates
hireDate, err := time.Parse("2006-01-02", input.HireDate)
if err != nil {
    return nil, fmt.Errorf("invalid hire date: %w", err)
}
termDate, err := time.Parse("2006-01-02", input.TerminationDate)
if err != nil {
    return nil, fmt.Errorf("invalid termination date: %w", err)
}
```

To:
```go
// Parse dates — handle both "2006-01-02" and RFC3339 formats (timestamptz).
hireDate, err := parseFlexDate(input.HireDate)
if err != nil {
    return nil, fmt.Errorf("invalid hire date: %w", err)
}
termDate, err := parseFlexDate(input.TerminationDate)
if err != nil {
    return nil, fmt.Errorf("invalid termination date: %w", err)
}
```

**Step 3: Build**

Run: `cd platform/employer-terminations && go build ./...`
Expected: Clean build.

**Step 4: Run tests**

Run: `cd platform/employer-terminations && go test ./... -short`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add platform/employer-terminations/domain/refund.go
git commit -m "[platform/employer-terminations] Fix hireDate parsing — handle RFC3339 timestamps from DB"
```

---

### Task 4: Unskip Employer E2E Tests

**Files:**
- Modify: `tests/e2e/employer_e2e.sh` (lines 126-136, 188-202, 408-419)

**Step 1: Remove stale-conn skip for POST /employer/alerts (lines 126-136)**

Change:
```bash
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo -e "  ${GREEN}✓${NC} POST /employer/alerts (create) (HTTP $HTTP_CODE)"
  PASS_COUNT=$((PASS_COUNT + 1))
elif [ "$HTTP_CODE" = "500" ]; then
  # Transient: stale DB connection from prior failed txn (portal user duplicate)
  echo -e "  ${YELLOW}⊘${NC} POST /employer/alerts — skipped (stale DB conn, HTTP 500)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗${NC} POST /employer/alerts — expected 200/201, got $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
```

To:
```bash
assert_status_range "POST /employer/alerts (create)" "200 201" "$HTTP_CODE"
```

Wait — check if `assert_status_range` exists. If not, keep the simple if/else:

```bash
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo -e "  ${GREEN}✓${NC} POST /employer/alerts (create) (HTTP $HTTP_CODE)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗${NC} POST /employer/alerts — expected 200/201, got $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
```

**Step 2: Remove uploaded_by skip for POST /reporting/manual-entry (lines 188-202)**

Change the if block to remove the `elif [ "$HTTP_CODE" = "500" ]` branch:

```bash
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo -e "  ${GREEN}✓${NC} POST /reporting/manual-entry (HTTP $HTTP_CODE)"
  PASS_COUNT=$((PASS_COUNT + 1))
  FILE_ID=$(echo "$BODY" | jq -r '.data.id // .data.fileId // .id // .fileId // empty' 2>/dev/null || echo "")
else
  echo -e "  ${RED}✗${NC} POST /reporting/manual-entry — expected 200/201, got $HTTP_CODE"
  echo "  Response: $(echo "$BODY" | head -c 200)"
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FILE_ID=""
fi
```

**Step 3: Remove date-parse skip for POST /terminations/refunds/:id/calculate (lines 408-419)**

Change:
```bash
  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} POST /terminations/refunds/:id/calculate (HTTP $HTTP_CODE)"
    PASS_COUNT=$((PASS_COUNT + 1))
  elif [ "$HTTP_CODE" = "422" ]; then
    # Known issue: hireDate stored as timestamp, calculator expects date-only
    echo -e "  ${YELLOW}⊘${NC} POST /terminations/refunds/:id/calculate — skipped (date parse bug, HTTP 422)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗${NC} POST /terminations/refunds/:id/calculate — expected 200, got $HTTP_CODE"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
```

To:
```bash
  assert_status "POST /terminations/refunds/:id/calculate" "200" "$HTTP_CODE"
```

**Step 4: Commit**

```bash
git add tests/e2e/employer_e2e.sh
git commit -m "[tests/e2e] Remove skip tolerances for dbcontext, uploaded_by, and date-parse fixes"
```

---

### Task 5: Full E2E Verification (Docker)

**Step 1: Rebuild and run**

```bash
docker compose up --build -d
```

**Step 2: Run all 5 E2E suites**

```bash
./tests/e2e/workflows_e2e.sh --wait
./tests/e2e/services_hub_e2e.sh --wait
./tests/e2e/correspondence_e2e.sh --wait
./tests/e2e/migration_e2e.sh --wait
./tests/e2e/employer_e2e.sh --wait
```

Expected: 163/163 across all suites, zero skips (⊘), zero failures.

**Step 3: Update BUILD_HISTORY.md**

Add Phase 5g entry documenting the 3 defect fixes and E2E result.

**Step 4: Final commit**

```bash
git add BUILD_HISTORY.md
git commit -m "[docs] Update BUILD_HISTORY with Phase 5g defect fixes"
```

---

### Task 6: Create Starter Prompt for Phase 5h

**Step 1: Write starter prompt**

Create `docs/plans/2026-03-24-migration-phase5h-starter.md` with:
- What was done in 5g
- Stats (files changed, lines, E2E results)
- What the next logical phase is (check BUILD_HISTORY for the roadmap)

**Step 2: Commit**

```bash
git add docs/plans/2026-03-24-migration-phase5h-starter.md
git commit -m "[docs] Add Migration Phase 5h starter prompt"
```
