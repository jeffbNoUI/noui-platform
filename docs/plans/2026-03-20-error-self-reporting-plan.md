# Error Self-Reporting Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a pipeline where user-facing runtime errors auto-report to the Issues service, deduplicate via fingerprinting, and surface at session start for Claude Code triage.

**Architecture:** Frontend error reporter (fire-and-forget POST) → Issues service error intake endpoint (fingerprint → create/update Issue + comment) → session-start skill reads open error-reports.

**Tech Stack:** TypeScript (frontend reporter), Go 1.22 (Issues service endpoint), SHA-256 fingerprinting, sqlmock tests.

**Design doc:** `docs/plans/2026-03-20-error-self-reporting-design.md`

---

## Task 1: Add `error-report` Category to Issues Service Models

**Files:**
- Modify: `platform/issues/models/types.go:85`

**Step 1: Update CategoryValues**

In `platform/issues/models/types.go`, change line 85 from:
```go
var CategoryValues = []string{"defect", "incident", "enhancement", "question"}
```
to:
```go
var CategoryValues = []string{"defect", "incident", "enhancement", "question", "error-report"}
```

**Step 2: Add ErrorReport request type**

Append to `platform/issues/models/types.go` after the `CreateCommentRequest` type (after line 79):

```go
// ErrorReport is the JSON body for the frontend error reporter.
type ErrorReport struct {
	RequestID      string `json:"requestId"`
	URL            string `json:"url"`
	HTTPStatus     int    `json:"httpStatus"`
	ErrorCode      string `json:"errorCode"`
	ErrorMessage   string `json:"errorMessage"`
	Portal         string `json:"portal"`
	Route          string `json:"route"`
	ComponentStack string `json:"componentStack,omitempty"`
}
```

**Step 3: Verify build**

Run: `cd platform/issues && go build ./...`
Expected: Clean build, no errors.

**Step 4: Commit**

```bash
git add platform/issues/models/types.go
git commit -m "[platform/issues] Add error-report category and ErrorReport type"
```

---

## Task 2: Add `FindByFingerprint` DB Method

**Files:**
- Modify: `platform/issues/db/issues.go` (add method after line 243)

**Step 1: Write the failing test**

Add to `platform/issues/db/issues_test.go`:

```go
func TestFindByFingerprint_Found(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	store := NewStore(db)

	fingerprint := "abc123def456"
	mock.ExpectQuery("SELECT id FROM issues").
		WithArgs(defaultTestTenantID, "error-report", "%fingerprint:"+fingerprint+"%").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(42))

	id, err := store.FindByFingerprint(context.Background(), defaultTestTenantID, fingerprint)
	if err != nil {
		t.Fatalf("FindByFingerprint error: %v", err)
	}
	if id != 42 {
		t.Errorf("id = %d, want 42", id)
	}
}

func TestFindByFingerprint_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	store := NewStore(db)

	fingerprint := "nonexistent"
	mock.ExpectQuery("SELECT id FROM issues").
		WithArgs(defaultTestTenantID, "error-report", "%fingerprint:"+fingerprint+"%").
		WillReturnError(sql.ErrNoRows)

	id, err := store.FindByFingerprint(context.Background(), defaultTestTenantID, fingerprint)
	if err != nil {
		t.Fatalf("FindByFingerprint error: %v", err)
	}
	if id != 0 {
		t.Errorf("id = %d, want 0 (not found)", id)
	}
}
```

Note: Check `issues_test.go` for the existing `defaultTestTenantID` constant — if it doesn't exist, use `"00000000-0000-0000-0000-000000000001"` and define it.

**Step 2: Run test to verify it fails**

Run: `cd platform/issues && go test ./db/ -run TestFindByFingerprint -v`
Expected: FAIL — `FindByFingerprint` not defined.

**Step 3: Write the implementation**

Add to `platform/issues/db/issues.go`:

```go
// FindByFingerprint looks for an open error-report issue with a matching fingerprint.
// Returns the issue's integer ID, or 0 if not found.
func (s *Store) FindByFingerprint(ctx context.Context, tenantID, fingerprint string) (int, error) {
	var id int
	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `
		SELECT id FROM issues
		WHERE tenant_id = $1
		  AND category = $2
		  AND description LIKE $3
		  AND status NOT IN ('resolved', 'closed')
		LIMIT 1
	`, tenantID, "error-report", "%fingerprint:"+fingerprint+"%").Scan(&id)

	if err == sql.ErrNoRows {
		return 0, nil
	}
	return id, err
}
```

**Step 4: Run test to verify it passes**

Run: `cd platform/issues && go test ./db/ -run TestFindByFingerprint -v`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/issues/db/issues.go platform/issues/db/issues_test.go
git commit -m "[platform/issues] Add FindByFingerprint for error dedup"
```

---

## Task 3: Add `IncrementErrorOccurrence` DB Method

**Files:**
- Modify: `platform/issues/db/issues.go` (add method)

This method updates the title with an incremented occurrence count and adds a comment with the new occurrence details.

**Step 1: Write the failing test**

Add to `platform/issues/db/issues_test.go`:

```go
func TestIncrementErrorOccurrence(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	store := NewStore(db)

	// Expect: fetch current title
	mock.ExpectQuery("SELECT title FROM issues").
		WithArgs(42, defaultTestTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"title"}).AddRow("[Auto] DB_ERROR: GET /api/v1/members — 2 occurrences"))

	// Expect: update title with incremented count
	mock.ExpectExec("UPDATE issues SET title").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Expect: insert comment
	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO issue_comments").
		WillReturnRows(sqlmock.NewRows([]string{"id", "issue_id", "author", "content", "created_at"}).
			AddRow(1, 42, "system:error-reporter", "occurrence details", now))

	err = store.IncrementErrorOccurrence(context.Background(), defaultTestTenantID, 42, "req-123", "staff", "/members")
	if err != nil {
		t.Fatalf("IncrementErrorOccurrence error: %v", err)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd platform/issues && go test ./db/ -run TestIncrementErrorOccurrence -v`
Expected: FAIL — `IncrementErrorOccurrence` not defined.

**Step 3: Write the implementation**

Add to `platform/issues/db/issues.go`:

```go
// IncrementErrorOccurrence updates an existing error-report issue's title with an
// incremented occurrence count and adds a comment with occurrence details.
func (s *Store) IncrementErrorOccurrence(ctx context.Context, tenantID string, issueID int, requestID, portal, route string) error {
	// Fetch current title to parse occurrence count
	var title string
	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx,
		"SELECT title FROM issues WHERE id = $1 AND tenant_id = $2",
		issueID, tenantID,
	).Scan(&title)
	if err != nil {
		return err
	}

	// Parse current count from title (format: "... — N occurrences")
	count := 1
	if idx := strings.LastIndex(title, " — "); idx != -1 {
		part := title[idx+len(" — "):]
		if n, err := fmt.Sscanf(part, "%d occurrences", &count); n == 1 && err == nil {
			// parsed successfully
		}
		title = title[:idx]
	}
	count++

	newTitle := fmt.Sprintf("%s — %d occurrences", title, count)

	_, err = dbcontext.DB(ctx, s.DB).ExecContext(ctx,
		"UPDATE issues SET title = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3",
		newTitle, issueID, tenantID,
	)
	if err != nil {
		return err
	}

	// Add occurrence comment
	comment := fmt.Sprintf("Occurrence at %s\nRequest ID: %s\nPortal: %s\nRoute: %s",
		time.Now().UTC().Format(time.RFC3339), requestID, portal, route)

	_, err = s.CreateComment(ctx, issueID, models.CreateCommentRequest{
		Author:  "system:error-reporter",
		Content: comment,
	})
	return err
}
```

**Step 4: Run test to verify it passes**

Run: `cd platform/issues && go test ./db/ -run TestIncrementErrorOccurrence -v`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/issues/db/issues.go platform/issues/db/issues_test.go
git commit -m "[platform/issues] Add IncrementErrorOccurrence for dedup updates"
```

---

## Task 4: Add `ReportError` API Handler

**Files:**
- Modify: `platform/issues/api/handlers.go` (add handler + register route)

**Step 1: Write the failing test**

Add to `platform/issues/api/handlers_test.go`:

```go
// --- ReportError ---

func TestReportError_NewError(t *testing.T) {
	h, mock := newTestHandler(t)

	report := models.ErrorReport{
		RequestID:    "req-abc-123",
		URL:          "/api/v1/members",
		HTTPStatus:   500,
		ErrorCode:    "DB_ERROR",
		ErrorMessage: "connection refused",
		Portal:       "staff",
		Route:        "/members",
	}
	reqBody, _ := json.Marshal(report)

	// FindByFingerprint: no existing issue
	mock.ExpectQuery("SELECT id FROM issues").
		WillReturnError(sql.ErrNoRows)

	// CreateIssue transaction: BEGIN, INSERT, UPDATE issue_id, COMMIT
	mock.ExpectBegin()
	mock.ExpectQuery("INSERT INTO issues").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectExec("UPDATE issues SET issue_id").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	// Re-fetch after create
	mock.ExpectQuery("SELECT").
		WithArgs(1, defaultTenantID).
		WillReturnRows(newIssueRows(1, "ISS-001"))

	w := serve(h, "POST", "/api/v1/errors/report", reqBody)

	if w.Code != http.StatusCreated {
		t.Fatalf("ReportError(new) status = %d, want %d\nbody: %s",
			w.Code, http.StatusCreated, w.Body.String())
	}
}

func TestReportError_ExistingError(t *testing.T) {
	h, mock := newTestHandler(t)

	report := models.ErrorReport{
		RequestID:    "req-abc-456",
		URL:          "/api/v1/members",
		HTTPStatus:   500,
		ErrorCode:    "DB_ERROR",
		ErrorMessage: "connection refused",
		Portal:       "staff",
		Route:        "/members",
	}
	reqBody, _ := json.Marshal(report)

	// FindByFingerprint: existing issue found
	mock.ExpectQuery("SELECT id FROM issues").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(42))

	// IncrementErrorOccurrence: fetch title
	mock.ExpectQuery("SELECT title FROM issues").
		WillReturnRows(sqlmock.NewRows([]string{"title"}).
			AddRow("[Auto] DB_ERROR: GET /api/v1/members"))

	// Update title
	mock.ExpectExec("UPDATE issues SET title").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Insert comment
	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO issue_comments").
		WillReturnRows(sqlmock.NewRows([]string{"id", "issue_id", "author", "content", "created_at"}).
			AddRow(1, 42, "system:error-reporter", "details", now))

	w := serve(h, "POST", "/api/v1/errors/report", reqBody)

	if w.Code != http.StatusOK {
		t.Fatalf("ReportError(existing) status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}
}

func TestReportError_MissingRequestID(t *testing.T) {
	h, _ := newTestHandler(t)

	report := models.ErrorReport{
		URL:        "/api/v1/members",
		HTTPStatus: 500,
	}
	reqBody, _ := json.Marshal(report)

	w := serve(h, "POST", "/api/v1/errors/report", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("ReportError(no requestId) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestReportError_ReactCrash(t *testing.T) {
	h, mock := newTestHandler(t)

	report := models.ErrorReport{
		RequestID:      "req-crash-001",
		URL:            "",
		HTTPStatus:     0,
		ErrorCode:      "REACT_CRASH",
		ErrorMessage:   "Cannot read properties of null",
		Portal:         "member",
		Route:          "/dashboard",
		ComponentStack: "at MemberDashboard\nat ErrorBoundary",
	}
	reqBody, _ := json.Marshal(report)

	// FindByFingerprint: no existing issue
	mock.ExpectQuery("SELECT id FROM issues").
		WillReturnError(sql.ErrNoRows)

	// CreateIssue transaction
	mock.ExpectBegin()
	mock.ExpectQuery("INSERT INTO issues").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(5))
	mock.ExpectExec("UPDATE issues SET issue_id").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	// Re-fetch
	mock.ExpectQuery("SELECT").
		WithArgs(5, defaultTenantID).
		WillReturnRows(newIssueRows(5, "ISS-005"))

	w := serve(h, "POST", "/api/v1/errors/report", reqBody)

	if w.Code != http.StatusCreated {
		t.Fatalf("ReportError(react crash) status = %d, want %d\nbody: %s",
			w.Code, http.StatusCreated, w.Body.String())
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd platform/issues && go test ./api/ -run TestReportError -v`
Expected: FAIL — route not registered, handler not defined.

**Step 3: Write the handler**

Add to `platform/issues/api/handlers.go` before the `--- Helper Functions ---` section (before line 295):

```go
// --- Error Reporting ---

// ReportError receives frontend error reports, deduplicates via fingerprint,
// and creates or updates an Issue.
func (h *Handler) ReportError(w http.ResponseWriter, r *http.Request) {
	var report models.ErrorReport
	if err := decodeJSON(r, &report); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "issues", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("requestId", report.RequestID)
	if report.ErrorCode != "REACT_CRASH" {
		errs.Required("url", report.URL)
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "issues", "INVALID_REQUEST", errs.Error())
		return
	}

	tenantID := tenantID(r)

	// Generate fingerprint for dedup
	fingerprint := errorFingerprint(report.ErrorCode, report.URL, report.HTTPStatus)

	// Check for existing open issue with same fingerprint
	existingID, err := h.store.FindByFingerprint(r.Context(), tenantID, fingerprint)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	if existingID > 0 {
		// Update existing issue
		if err := h.store.IncrementErrorOccurrence(r.Context(), tenantID, existingID, report.RequestID, report.Portal, report.Route); err != nil {
			apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
			return
		}
		apiresponse.WriteSuccess(w, http.StatusOK, "issues", map[string]any{
			"action":  "updated",
			"issueId": existingID,
		})
		return
	}

	// Create new issue
	severity := "medium"
	if report.HTTPStatus >= 500 {
		severity = "high"
	}
	if report.ErrorCode == "REACT_CRASH" {
		severity = "critical"
	}

	// Build description with fingerprint tag
	description := fmt.Sprintf(
		"Error Code: %s\nHTTP Status: %d\nURL: %s\nMessage: %s\nPortal: %s\nRoute: %s\nRequest ID: %s\nfingerprint:%s",
		report.ErrorCode, report.HTTPStatus, report.URL, report.ErrorMessage,
		report.Portal, report.Route, report.RequestID, fingerprint,
	)
	if report.ComponentStack != "" {
		description += fmt.Sprintf("\n\nComponent Stack:\n%s", report.ComponentStack)
	}

	// Parse method and path from URL for title
	title := fmt.Sprintf("[Auto] %s: %s", report.ErrorCode, report.URL)
	if len(title) > 500 {
		title = title[:497] + "..."
	}

	issue, err := h.store.CreateIssue(r.Context(), tenantID, models.CreateIssueRequest{
		Title:           title,
		Description:     description,
		Severity:        severity,
		Category:        "error-report",
		AffectedService: parseServiceFromURL(report.URL),
		ReportedBy:      "system:error-reporter",
	})
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "issues", issue)
}
```

**Step 4: Add helper functions**

Add to `platform/issues/api/handlers.go` in the helper functions section:

```go
// errorFingerprint generates a dedup key from error attributes.
func errorFingerprint(errorCode, url string, httpStatus int) string {
	raw := fmt.Sprintf("%s:%s:%d", errorCode, url, httpStatus)
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:16]) // 32-char hex string
}

// parseServiceFromURL extracts a service name from a URL path.
// e.g., "/api/v1/members" → "dataaccess", "/api/v1/crm/contacts" → "crm"
func parseServiceFromURL(url string) string {
	serviceMap := map[string]string{
		"members": "dataaccess", "salary": "dataaccess", "employment": "dataaccess",
		"crm": "crm", "organizations": "crm", "contacts": "crm",
		"correspondence": "correspondence", "templates": "correspondence",
		"dataquality": "dataquality", "dq": "dataquality",
		"knowledgebase": "knowledgebase", "articles": "knowledgebase",
		"cases": "casemanagement",
		"issues": "issues",
		"employer": "crm",
	}

	parts := strings.Split(strings.TrimPrefix(url, "/"), "/")
	// Skip "api" and "v1" prefixes
	for _, part := range parts {
		if part == "api" || part == "v1" || part == "" {
			continue
		}
		if svc, ok := serviceMap[part]; ok {
			return svc
		}
		return part // fallback to the first path segment
	}
	return "unknown"
}
```

**Step 5: Add imports**

Add `"crypto/sha256"` and `"encoding/hex"` to the import block in `handlers.go`.

**Step 6: Register the route**

In `RegisterRoutes`, add before the `// Issues` comment (after line 32):

```go
	// Error reporting (before issues CRUD routes)
	mux.HandleFunc("POST /api/v1/errors/report", h.ReportError)
```

**Step 7: Run tests**

Run: `cd platform/issues && go test ./... -v -count=1`
Expected: All existing tests PASS + 4 new ReportError tests PASS.

**Step 8: Commit**

```bash
git add platform/issues/api/handlers.go platform/issues/api/handlers_test.go
git commit -m "[platform/issues] Add POST /api/v1/errors/report endpoint with fingerprint dedup"
```

---

## Task 5: Add `GET /api/v1/errors/recent` Query Endpoint

**Files:**
- Modify: `platform/issues/api/handlers.go` (add handler + route)

**Step 1: Write the failing test**

Add to `platform/issues/api/handlers_test.go`:

```go
func TestListRecentErrors_Empty(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT").
		WillReturnRows(sqlmock.NewRows(issueCols))

	w := serve(h, "GET", "/api/v1/errors/recent", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListRecentErrors status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}
}

func TestListRecentErrors_WithSinceParam(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	dataRows := sqlmock.NewRows(issueCols)
	addIssueRow(dataRows, 1, "ISS-001")
	mock.ExpectQuery("SELECT").
		WillReturnRows(dataRows)

	w := serve(h, "GET", "/api/v1/errors/recent?since=2026-03-01T00:00:00Z", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListRecentErrors(since) status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd platform/issues && go test ./api/ -run TestListRecentErrors -v`
Expected: FAIL — route not found.

**Step 3: Write the handler**

The handler is a thin wrapper around `ListIssues` with `category=error-report` forced. Add to `handlers.go`:

```go
// ListRecentErrors returns error-report issues, optionally filtered by a since timestamp.
// This is a convenience endpoint for the session-start integration.
func (h *Handler) ListRecentErrors(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)

	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	filter := models.IssueFilter{
		Status:   r.URL.Query().Get("status"),
		Category: "error-report",
		Limit:    limit,
		Offset:   offset,
	}
	if filter.Status == "" {
		filter.Status = "open"
	}

	issues, total, err := h.store.ListIssues(r.Context(), tenantID, filter)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	// If 'since' param provided, filter in-memory (simpler than adding to SQL builder)
	if since := r.URL.Query().Get("since"); since != "" {
		if sinceTime, err := time.Parse(time.RFC3339, since); err == nil {
			var filtered []models.Issue
			for _, iss := range issues {
				if iss.ReportedAt.After(sinceTime) {
					filtered = append(filtered, iss)
				}
			}
			issues = filtered
			total = len(filtered)
		}
	}

	apiresponse.WritePaginated(w, "issues", issues, total, filter.Limit, filter.Offset)
}
```

Add `"time"` to imports if not already present.

**Step 4: Register the route**

In `RegisterRoutes`, add after the error report route:

```go
	mux.HandleFunc("GET /api/v1/errors/recent", h.ListRecentErrors)
```

**Step 5: Run tests**

Run: `cd platform/issues && go test ./... -v -count=1`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add platform/issues/api/handlers.go platform/issues/api/handlers_test.go
git commit -m "[platform/issues] Add GET /api/v1/errors/recent for session-start triage"
```

---

## Task 6: Create Frontend Error Reporter Module

**Files:**
- Create: `frontend/src/lib/errorReporter.ts`

**Step 1: Write the test**

Create `frontend/src/lib/__tests__/errorReporter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must mock apiClient before importing errorReporter
vi.mock('../apiClient', () => ({
  postAPI: vi.fn().mockResolvedValue({}),
}));

import { reportError, _resetForTesting } from '../errorReporter';
import { postAPI } from '../apiClient';

const mockedPostAPI = vi.mocked(postAPI);

describe('errorReporter', () => {
  beforeEach(() => {
    _resetForTesting();
    mockedPostAPI.mockClear();
  });

  it('sends error report via postAPI', async () => {
    reportError({
      requestId: 'req-123',
      url: '/api/v1/members',
      httpStatus: 500,
      errorCode: 'DB_ERROR',
      errorMessage: 'connection refused',
      portal: 'staff',
      route: '/members',
    });

    // Fire-and-forget but give microtask a chance
    await new Promise((r) => setTimeout(r, 10));

    expect(mockedPostAPI).toHaveBeenCalledTimes(1);
    expect(mockedPostAPI).toHaveBeenCalledWith(
      expect.stringContaining('/v1/errors/report'),
      expect.objectContaining({
        requestId: 'req-123',
        errorCode: 'DB_ERROR',
      }),
    );
  });

  it('skips reporting if URL is the error report endpoint', async () => {
    reportError({
      requestId: 'req-456',
      url: '/api/v1/errors/report',
      httpStatus: 500,
      errorCode: 'DB_ERROR',
      errorMessage: 'meta failure',
      portal: 'staff',
      route: '/members',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(mockedPostAPI).not.toHaveBeenCalled();
  });

  it('does not throw even if postAPI fails', async () => {
    mockedPostAPI.mockRejectedValueOnce(new Error('network down'));

    // Should not throw
    expect(() => {
      reportError({
        requestId: 'req-789',
        url: '/api/v1/members',
        httpStatus: 502,
        errorCode: 'GATEWAY_ERROR',
        errorMessage: 'bad gateway',
        portal: 'staff',
        route: '/members',
      });
    }).not.toThrow();

    await new Promise((r) => setTimeout(r, 10));
  });

  it('includes componentStack when provided', async () => {
    reportError({
      requestId: 'req-crash',
      url: '',
      httpStatus: 0,
      errorCode: 'REACT_CRASH',
      errorMessage: 'null ref',
      portal: 'member',
      route: '/dashboard',
      componentStack: 'at Dashboard\nat ErrorBoundary',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(mockedPostAPI).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        errorCode: 'REACT_CRASH',
        componentStack: 'at Dashboard\nat ErrorBoundary',
      }),
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/__tests__/errorReporter.test.ts`
Expected: FAIL — module not found.

**Step 3: Create the module**

Create `frontend/src/lib/errorReporter.ts`:

```typescript
// ─── Error Self-Reporter ────────────────────────────────────────────────────
// Fire-and-forget error reporting to the Issues service.
// Never blocks the user. Never throws its own errors.
// ────────────────────────────────────────────────────────────────────────────

import { postAPI } from './apiClient';

const ISSUES_URL = import.meta.env.VITE_ISSUES_URL || '/api';
const REPORT_ENDPOINT = `${ISSUES_URL}/v1/errors/report`;

export interface ErrorReportPayload {
  requestId: string;
  url: string;
  httpStatus: number;
  errorCode: string;
  errorMessage: string;
  portal: string;
  route: string;
  componentStack?: string;
}

// Prevent duplicate reports for the same error within a short window
const recentFingerprints = new Set<string>();
const DEDUP_WINDOW_MS = 60_000; // 1 minute

function fingerprint(report: ErrorReportPayload): string {
  return `${report.errorCode}:${report.url}:${report.httpStatus}`;
}

/**
 * Report a user-facing error to the Issues service.
 * Fire-and-forget: never awaited, never throws.
 */
export function reportError(report: ErrorReportPayload): void {
  try {
    // Don't report errors from the error reporter itself
    if (report.url.includes('/errors/report')) return;

    // Client-side dedup: skip if we already reported this exact error recently
    const fp = fingerprint(report);
    if (recentFingerprints.has(fp)) return;
    recentFingerprints.add(fp);
    setTimeout(() => recentFingerprints.delete(fp), DEDUP_WINDOW_MS);

    // Fire and forget
    postAPI(REPORT_ENDPOINT, report).catch(() => {
      // Silently swallow — error reporting must never impact the user
    });
  } catch {
    // Defensive: catch any synchronous errors too
  }
}

/** Test-only: reset dedup state */
export function _resetForTesting(): void {
  recentFingerprints.clear();
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/__tests__/errorReporter.test.ts`
Expected: PASS

**Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean.

**Step 6: Commit**

```bash
git add frontend/src/lib/errorReporter.ts frontend/src/lib/__tests__/errorReporter.test.ts
git commit -m "[frontend] Add errorReporter module for fire-and-forget error reporting"
```

---

## Task 7: Integrate Error Reporter into apiClient.ts

**Files:**
- Modify: `frontend/src/lib/apiClient.ts:126-141` (after retry exhaustion throws APIError)

**Step 1: Write the test**

Add to `frontend/src/lib/__tests__/errorReporter.test.ts` (or create a new integration test if preferred):

This is tested indirectly — the existing apiClient tests confirm error throwing behavior, and the errorReporter tests confirm it sends reports. The integration is a one-line call.

**Step 2: Add the integration**

In `frontend/src/lib/apiClient.ts`, add the import at top:

```typescript
import { reportError } from './errorReporter';
```

In the `rawRequest` function, right before the APIError is thrown on a non-OK response (around line 135-141), add the reportError call. The modified block should look like:

```typescript
        const errBody = await res.json().catch(() => ({ error: { message: res.statusText } }));
        const message = errBody.error?.message || `API error: ${res.status}`;
        const errorCode = errBody.error?.code || `HTTP_${res.status}`;
        const apiError = new APIError(message, res.status, requestId, url);
        console.error(`[api] ${init.method ?? 'GET'} ${url} → ${res.status}`, {
          requestId,
          status: res.status,
          message,
        });
        reportError({
          requestId,
          url,
          httpStatus: res.status,
          errorCode,
          errorMessage: message,
          portal: detectPortal(),
          route: typeof window !== 'undefined' ? window.location.pathname : '',
        });
        throw apiError;
```

Add the `detectPortal` helper at the bottom of `apiClient.ts`:

```typescript
function detectPortal(): string {
  if (typeof window === 'undefined') return 'unknown';
  const path = window.location.pathname;
  if (path.startsWith('/employer')) return 'employer';
  if (path.startsWith('/member')) return 'member';
  if (path.startsWith('/retirement')) return 'retirement';
  return 'staff';
}
```

**Step 3: Typecheck and test**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All tests PASS, no type errors.

**Step 4: Commit**

```bash
git add frontend/src/lib/apiClient.ts
git commit -m "[frontend] Wire errorReporter into apiClient for automatic error reporting"
```

---

## Task 8: Integrate Error Reporter into ErrorBoundary

**Files:**
- Modify: `frontend/src/components/ErrorBoundary.tsx:21-27`

**Step 1: Add the integration**

In `ErrorBoundary.tsx`, add the import:

```typescript
import { reportError } from '@/lib/errorReporter';
```

Update `componentDidCatch` to call reportError:

```typescript
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.portalName ? `:${this.props.portalName}` : ''}]`,
      error,
      info.componentStack,
    );
    reportError({
      requestId: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      url: '',
      httpStatus: 0,
      errorCode: 'REACT_CRASH',
      errorMessage: error.message,
      portal: this.props.portalName?.toLowerCase() || 'unknown',
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      componentStack: info.componentStack || '',
    });
  }
```

**Step 2: Typecheck and test**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All tests PASS.

**Step 3: Commit**

```bash
git add frontend/src/components/ErrorBoundary.tsx
git commit -m "[frontend] Wire errorReporter into ErrorBoundary for React crash reporting"
```

---

## Task 9: Update Frontend Issue Types for `error-report` Category

**Files:**
- Modify: `frontend/src/lib/issuesApi.ts:17` (add `error-report` to category union)

**Step 1: Update the type**

In `frontend/src/lib/issuesApi.ts`, change line 17:

```typescript
  category: 'defect' | 'incident' | 'enhancement' | 'question' | 'error-report';
```

**Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean.

**Step 3: Commit**

```bash
git add frontend/src/lib/issuesApi.ts
git commit -m "[frontend] Add error-report category to Issue type"
```

---

## Task 10: Update Session-Start Command

**Files:**
- Modify: `.claude/commands/session-start.md`

**Step 1: Add error review step**

Update `.claude/commands/session-start.md` to add an error review step after the build check:

```markdown
# Session Start

Read these files in order to understand the current state before writing any code:

1. Read `BUILD_HISTORY.md` — understand current state, last changes, any open issues
2. Read `docs/INTEGRATION_PLAN.md` if it exists — understand what phase we're in
3. Check for any `.claude/prompts/` files relevant to the current task

Then verify the build is healthy:

```bash
# Check git status
git status --short
git log --oneline -5

# Quick build check for the layers we're likely to touch
cd connector && go build ./... 2>&1 | tail -5
cd ../platform/dataaccess && go build ./... 2>&1 | tail -5
cd ../platform/intelligence && go build ./... 2>&1 | tail -5
cd ../../frontend && npx tsc --noEmit 2>&1 | tail -5
```

Then check for unresolved error reports (skip silently if the Issues service is not reachable):

```bash
# Check for auto-reported errors (Issues service on port 8092)
curl -sf http://localhost:8092/api/v1/errors/recent?status=open 2>/dev/null || true
```

If error reports are found, display them in a table:

```
## Unresolved Error Reports
| Issue | Error | Service | First Seen |
|-------|-------|---------|------------|
| ISS-XX | ERROR_CODE: /api/path | service | date |

Want me to investigate any of these?
```

Report:
- What the last session accomplished
- Whether builds are clean or broken
- Any uncommitted changes from a prior session
- Any open error reports from the Issues service
- What the logical next task is

Then ask the user: "What are we working on today?" and wait for direction before writing any code.
```

**Step 2: Commit**

```bash
git add .claude/commands/session-start.md
git commit -m "[claude] Add error report triage to session-start command"
```

---

## Task 11: Full Verification

**Step 1: Run all Go tests**

```bash
cd platform/issues && go test ./... -v -count=1
```
Expected: All existing + new tests PASS.

**Step 2: Run all frontend tests**

```bash
cd frontend && npx tsc --noEmit && npx vitest run
```
Expected: All tests PASS, no type errors.

**Step 3: Build check**

```bash
cd platform/issues && go build ./...
cd ../frontend && npm run build
```
Expected: Clean builds.

**Step 4: Review diff**

```bash
git diff --stat main
```

**Step 5: Final commit if any loose changes**

Verify clean working tree. If everything is committed, done.

---

## Summary of Changes

| File | Action | Lines |
|------|--------|-------|
| `platform/issues/models/types.go` | Modify | +12 (ErrorReport type, category enum) |
| `platform/issues/db/issues.go` | Modify | +40 (FindByFingerprint, IncrementErrorOccurrence) |
| `platform/issues/db/issues_test.go` | Modify | +50 (3 DB tests) |
| `platform/issues/api/handlers.go` | Modify | +90 (ReportError, ListRecentErrors, helpers) |
| `platform/issues/api/handlers_test.go` | Modify | +100 (6 handler tests) |
| `frontend/src/lib/errorReporter.ts` | Create | ~50 |
| `frontend/src/lib/__tests__/errorReporter.test.ts` | Create | ~80 |
| `frontend/src/lib/apiClient.ts` | Modify | +15 (reportError integration) |
| `frontend/src/components/ErrorBoundary.tsx` | Modify | +12 (reportError call) |
| `frontend/src/lib/issuesApi.ts` | Modify | +1 (category type) |
| `.claude/commands/session-start.md` | Modify | +15 (error review step) |
