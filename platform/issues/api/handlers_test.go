package api

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/issues/models"
)

// --- Test Helpers ---

// newTestHandler creates a Handler backed by a sqlmock DB.
func newTestHandler(t *testing.T) (*Handler, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return NewHandler(db), mock
}

// serve dispatches a request through a real ServeMux so Go 1.22 path values are populated.
func serve(h *Handler, method, path string, body []byte) *httptest.ResponseRecorder {
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	var req *http.Request
	if body != nil {
		req = httptest.NewRequest(method, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
}

// issueCols must match the SELECT in issueColumns (16 columns).
var issueCols = []string{
	"id", "issue_id", "tenant_id", "title", "description",
	"severity", "category", "status", "affected_service",
	"reported_by", "assigned_to", "reported_at", "resolved_at",
	"resolution_note", "created_at", "updated_at",
}

// addIssueRow appends an issue row to an existing Rows object.
func addIssueRow(rows *sqlmock.Rows, id int, issueID string) *sqlmock.Rows {
	now := time.Now().UTC()
	return rows.AddRow(
		id, issueID, defaultTenantID, "Test issue", "Description here",
		"medium", "defect", "open", "dataaccess",
		"admin", sql.NullString{Valid: false}, now, sql.NullTime{Valid: false},
		sql.NullString{Valid: false}, now, now,
	)
}

// newIssueRows creates a Rows with a single issue row.
func newIssueRows(id int, issueID string) *sqlmock.Rows {
	return addIssueRow(sqlmock.NewRows(issueCols), id, issueID)
}

// --- HealthCheck ---

func TestHealthCheck(t *testing.T) {
	h, _ := newTestHandler(t)
	w := serve(h, "GET", "/healthz", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("HealthCheck status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("status = %q, want %q", body["status"], "ok")
	}
	if body["service"] != "issues" {
		t.Errorf("service = %q, want %q", body["service"], "issues")
	}
	if body["version"] != "0.1.0" {
		t.Errorf("version = %q, want %q", body["version"], "0.1.0")
	}
}

// --- Helper Function Tests ---

func TestTenantID_Default(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := tenantID(req)
	if got != defaultTenantID {
		t.Errorf("tenantID(no context) = %q, want %q", got, defaultTenantID)
	}
}

func TestIntParam_Valid(t *testing.T) {
	req := httptest.NewRequest("GET", "/?limit=50", nil)
	got := intParam(req, "limit", 25)
	if got != 50 {
		t.Errorf("intParam(limit=50) = %d, want 50", got)
	}
}

func TestIntParam_Missing(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := intParam(req, "limit", 25)
	if got != 25 {
		t.Errorf("intParam(missing) = %d, want 25 (default)", got)
	}
}

func TestIntParam_Invalid(t *testing.T) {
	req := httptest.NewRequest("GET", "/?limit=abc", nil)
	got := intParam(req, "limit", 25)
	if got != 25 {
		t.Errorf("intParam(abc) = %d, want 25 (default)", got)
	}
}

func TestDecodeJSON_NilBody(t *testing.T) {
	req := httptest.NewRequest("POST", "/", nil)
	req.Body = nil
	var v map[string]string
	err := decodeJSON(req, &v)
	if err == nil {
		t.Error("decodeJSON(nil body) should return error")
	}
}

// --- Response Helper Tests ---

func TestWriteJSON(t *testing.T) {
	w := httptest.NewRecorder()
	writeJSON(w, http.StatusOK, map[string]string{"key": "value"})

	if w.Code != http.StatusOK {
		t.Errorf("writeJSON status = %d, want %d", w.Code, http.StatusOK)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body["key"] != "value" {
		t.Errorf("body[key] = %q, want %q", body["key"], "value")
	}
}

func TestWriteSuccess(t *testing.T) {
	w := httptest.NewRecorder()
	writeSuccess(w, http.StatusOK, map[string]string{"hello": "world"})

	if w.Code != http.StatusOK {
		t.Errorf("writeSuccess status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body["data"] == nil {
		t.Error("writeSuccess missing 'data' field")
	}
	meta, ok := body["meta"].(map[string]interface{})
	if !ok {
		t.Fatal("writeSuccess missing 'meta' field")
	}
	if meta["request_id"] == nil || meta["request_id"] == "" {
		t.Error("meta.request_id should not be empty")
	}
	if meta["timestamp"] == nil || meta["timestamp"] == "" {
		t.Error("meta.timestamp should not be empty")
	}
	if meta["service"] != "issues" {
		t.Errorf("meta.service = %q, want issues", meta["service"])
	}
}

func TestWriteError(t *testing.T) {
	w := httptest.NewRecorder()
	writeError(w, http.StatusBadRequest, "INVALID", "bad input")

	if w.Code != http.StatusBadRequest {
		t.Errorf("writeError status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	errObj, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatal("writeError missing 'error' field")
	}
	if errObj["code"] != "INVALID" {
		t.Errorf("error.code = %q, want INVALID", errObj["code"])
	}
	if errObj["message"] != "bad input" {
		t.Errorf("error.message = %q, want %q", errObj["message"], "bad input")
	}
	if errObj["request_id"] == nil || errObj["request_id"] == "" {
		t.Error("error.request_id should not be empty")
	}
}

func TestWritePaginated(t *testing.T) {
	w := httptest.NewRecorder()
	writePaginated(w, []string{"a", "b"}, 10, 5, 0)

	if w.Code != http.StatusOK {
		t.Errorf("writePaginated status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}

	pag, ok := body["pagination"].(map[string]interface{})
	if !ok {
		t.Fatal("writePaginated missing 'pagination' field")
	}
	if pag["total"] != float64(10) {
		t.Errorf("pagination.total = %v, want 10", pag["total"])
	}
	if pag["limit"] != float64(5) {
		t.Errorf("pagination.limit = %v, want 5", pag["limit"])
	}
	if pag["hasMore"] != true {
		t.Errorf("pagination.hasMore = %v, want true", pag["hasMore"])
	}
}

func TestWritePaginated_NoMore(t *testing.T) {
	w := httptest.NewRecorder()
	writePaginated(w, []string{"a"}, 3, 5, 0)

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	pag := body["pagination"].(map[string]interface{})
	if pag["hasMore"] != false {
		t.Errorf("pagination.hasMore = %v, want false (offset+limit >= total)", pag["hasMore"])
	}
}

// --- Model Serialization ---

func TestIssueJSON(t *testing.T) {
	now := time.Now().UTC()
	assignee := "admin"
	iss := models.Issue{
		ID:              1,
		IssueID:         "ISS-001",
		TenantID:        "tenant-1",
		Title:           "Login broken",
		Description:     "Cannot log in",
		Severity:        "critical",
		Category:        "defect",
		Status:          "open",
		AffectedService: "auth",
		ReportedBy:      "user1",
		AssignedTo:      &assignee,
		ReportedAt:      now,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	data, err := json.Marshal(iss)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	var decoded models.Issue
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if decoded.IssueID != "ISS-001" {
		t.Errorf("IssueID = %q, want ISS-001", decoded.IssueID)
	}
	if decoded.AssignedTo == nil || *decoded.AssignedTo != "admin" {
		t.Errorf("AssignedTo = %v, want admin", decoded.AssignedTo)
	}
}

func TestIssueJSON_NullableFields(t *testing.T) {
	now := time.Now().UTC()
	iss := models.Issue{
		ID:         1,
		IssueID:    "ISS-001",
		TenantID:   "tenant-1",
		Title:      "Test",
		Severity:   "low",
		Category:   "question",
		Status:     "open",
		ReportedBy: "user1",
		ReportedAt: now,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	data, err := json.Marshal(iss)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	var decoded models.Issue
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if decoded.AssignedTo != nil {
		t.Errorf("AssignedTo = %v, want nil", decoded.AssignedTo)
	}
	if decoded.ResolvedAt != nil {
		t.Errorf("ResolvedAt = %v, want nil", decoded.ResolvedAt)
	}
	if decoded.ResolutionNote != nil {
		t.Errorf("ResolutionNote = %v, want nil", decoded.ResolutionNote)
	}
}

// --- GetIssue ---

func TestGetIssue_NotFound(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WithArgs(999, defaultTenantID).
		WillReturnError(sql.ErrNoRows)

	w := serve(h, "GET", "/api/v1/issues/999", nil)

	if w.Code != http.StatusNotFound {
		t.Errorf("GetIssue(nonexistent) status = %d, want %d", w.Code, http.StatusNotFound)
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	errObj := body["error"].(map[string]interface{})
	if errObj["code"] != "NOT_FOUND" {
		t.Errorf("error.code = %q, want NOT_FOUND", errObj["code"])
	}
}

func TestGetIssue_InvalidID(t *testing.T) {
	h, _ := newTestHandler(t)

	w := serve(h, "GET", "/api/v1/issues/abc", nil)

	if w.Code != http.StatusBadRequest {
		t.Errorf("GetIssue(abc) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestGetIssue_Valid(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WithArgs(1, defaultTenantID).
		WillReturnRows(newIssueRows(1, "ISS-001"))

	w := serve(h, "GET", "/api/v1/issues/1", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("GetIssue status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data models.Issue           `json:"data"`
		Meta map[string]interface{} `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.IssueID != "ISS-001" {
		t.Errorf("IssueID = %q, want ISS-001", body.Data.IssueID)
	}
	if body.Data.Title != "Test issue" {
		t.Errorf("Title = %q, want Test issue", body.Data.Title)
	}
	if body.Meta["request_id"] == nil || body.Meta["request_id"] == "" {
		t.Error("meta.request_id should not be empty")
	}
}

// --- ListIssues ---

func TestListIssues_Empty(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	mock.ExpectQuery("SELECT").
		WillReturnRows(sqlmock.NewRows(issueCols))

	w := serve(h, "GET", "/api/v1/issues", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListIssues status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	pag := body["pagination"].(map[string]interface{})
	if pag["total"] != float64(0) {
		t.Errorf("pagination.total = %v, want 0", pag["total"])
	}
	if pag["hasMore"] != false {
		t.Errorf("pagination.hasMore = %v, want false", pag["hasMore"])
	}
}

func TestListIssues_WithResults(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	dataRows := sqlmock.NewRows(issueCols)
	addIssueRow(dataRows, 1, "ISS-001")
	addIssueRow(dataRows, 2, "ISS-002")
	mock.ExpectQuery("SELECT").
		WillReturnRows(dataRows)

	w := serve(h, "GET", "/api/v1/issues?limit=25&offset=0", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListIssues status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data       []models.Issue         `json:"data"`
		Pagination map[string]interface{} `json:"pagination"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if len(body.Data) != 2 {
		t.Fatalf("expected 2 issues, got %d", len(body.Data))
	}
	if body.Data[0].IssueID != "ISS-001" {
		t.Errorf("issue[0].IssueID = %q, want ISS-001", body.Data[0].IssueID)
	}
	if body.Pagination["total"] != float64(2) {
		t.Errorf("pagination.total = %v, want 2", body.Pagination["total"])
	}
}

func TestListIssues_FilterCombination(t *testing.T) {
	h, mock := newTestHandler(t)

	// status=open + severity=critical
	mock.ExpectQuery("SELECT COUNT").
		WithArgs(defaultTenantID, "open", "critical").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	dataRows := sqlmock.NewRows(issueCols)
	addIssueRow(dataRows, 1, "ISS-001")
	mock.ExpectQuery("SELECT").
		WithArgs(defaultTenantID, "open", "critical", 25, 0).
		WillReturnRows(dataRows)

	w := serve(h, "GET", "/api/v1/issues?status=open&severity=critical", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListIssues(status+severity) status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data []models.Issue `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if len(body.Data) != 1 {
		t.Errorf("expected 1 issue, got %d", len(body.Data))
	}
}

// --- CreateIssue ---

func TestCreateIssue_MissingTitle(t *testing.T) {
	h, _ := newTestHandler(t)

	reqBody, _ := json.Marshal(models.CreateIssueRequest{
		ReportedBy: "admin",
	})

	w := serve(h, "POST", "/api/v1/issues", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateIssue(no title) status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	errObj := body["error"].(map[string]interface{})
	if errObj["code"] != "INVALID_REQUEST" {
		t.Errorf("error.code = %q, want INVALID_REQUEST", errObj["code"])
	}
}

func TestCreateIssue_MissingReportedBy(t *testing.T) {
	h, _ := newTestHandler(t)

	reqBody, _ := json.Marshal(models.CreateIssueRequest{
		Title: "A bug",
	})

	w := serve(h, "POST", "/api/v1/issues", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateIssue(no reportedBy) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateIssue_InvalidSeverity(t *testing.T) {
	h, _ := newTestHandler(t)

	reqBody, _ := json.Marshal(models.CreateIssueRequest{
		Title:      "A bug",
		ReportedBy: "admin",
		Severity:   "extreme",
	})

	w := serve(h, "POST", "/api/v1/issues", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateIssue(invalid severity) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateIssue_MalformedJSON(t *testing.T) {
	h, _ := newTestHandler(t)

	w := serve(h, "POST", "/api/v1/issues", []byte(`{invalid json`))

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateIssue(malformed JSON) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateIssue_Valid(t *testing.T) {
	h, mock := newTestHandler(t)

	// Transaction: BEGIN, INSERT (RETURNING id), UPDATE issue_id, COMMIT
	mock.ExpectBegin()
	mock.ExpectQuery("INSERT INTO issues").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(42))
	mock.ExpectExec("UPDATE issues SET issue_id").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	// Re-fetch after create
	mock.ExpectQuery("SELECT").
		WithArgs(42, defaultTenantID).
		WillReturnRows(newIssueRows(42, "ISS-042"))

	reqBody, _ := json.Marshal(models.CreateIssueRequest{
		Title:           "Login broken",
		Description:     "Cannot log in",
		Severity:        "critical",
		Category:        "defect",
		AffectedService: "auth",
		ReportedBy:      "admin",
	})

	w := serve(h, "POST", "/api/v1/issues", reqBody)

	if w.Code != http.StatusCreated {
		t.Fatalf("CreateIssue status = %d, want %d\nbody: %s", w.Code, http.StatusCreated, w.Body.String())
	}

	var body struct {
		Data models.Issue `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.IssueID != "ISS-042" {
		t.Errorf("IssueID = %q, want ISS-042", body.Data.IssueID)
	}
}

// --- UpdateIssue ---

func TestUpdateIssue_NotFound(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WithArgs(999, defaultTenantID).
		WillReturnError(sql.ErrNoRows)

	sev := "high"
	reqBody, _ := json.Marshal(models.UpdateIssueRequest{Severity: &sev})

	w := serve(h, "PUT", "/api/v1/issues/999", reqBody)

	if w.Code != http.StatusNotFound {
		t.Errorf("UpdateIssue(nonexistent) status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestUpdateIssue_InvalidSeverity(t *testing.T) {
	h, mock := newTestHandler(t)

	// Verify issue exists
	mock.ExpectQuery("SELECT").
		WithArgs(1, defaultTenantID).
		WillReturnRows(newIssueRows(1, "ISS-001"))

	sev := "extreme"
	reqBody, _ := json.Marshal(models.UpdateIssueRequest{Severity: &sev})

	w := serve(h, "PUT", "/api/v1/issues/1", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("UpdateIssue(invalid severity) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestUpdateIssue_Valid(t *testing.T) {
	h, mock := newTestHandler(t)

	// Verify issue exists
	mock.ExpectQuery("SELECT").
		WithArgs(1, defaultTenantID).
		WillReturnRows(newIssueRows(1, "ISS-001"))

	// Update exec
	mock.ExpectExec("UPDATE issues SET").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Re-fetch
	mock.ExpectQuery("SELECT").
		WithArgs(1, defaultTenantID).
		WillReturnRows(newIssueRows(1, "ISS-001"))

	sev := "high"
	reqBody, _ := json.Marshal(models.UpdateIssueRequest{Severity: &sev})

	w := serve(h, "PUT", "/api/v1/issues/1", reqBody)

	if w.Code != http.StatusOK {
		t.Fatalf("UpdateIssue status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}
}

func TestUpdateIssue_EmptyBody(t *testing.T) {
	h, mock := newTestHandler(t)

	// Verify issue exists
	mock.ExpectQuery("SELECT").
		WithArgs(1, defaultTenantID).
		WillReturnRows(newIssueRows(1, "ISS-001"))

	// No fields → no UPDATE exec, just re-fetch
	mock.ExpectQuery("SELECT").
		WithArgs(1, defaultTenantID).
		WillReturnRows(newIssueRows(1, "ISS-001"))

	reqBody, _ := json.Marshal(models.UpdateIssueRequest{})

	w := serve(h, "PUT", "/api/v1/issues/1", reqBody)

	if w.Code != http.StatusOK {
		t.Fatalf("UpdateIssue(empty) status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}
}

// --- ListComments ---

func TestListComments_Empty(t *testing.T) {
	h, mock := newTestHandler(t)

	// Tenant guard: GetIssueByID lookup
	mock.ExpectQuery("SELECT").
		WithArgs(1, defaultTenantID).
		WillReturnRows(newIssueRows(1, "ISS-001"))

	mock.ExpectQuery("SELECT").
		WithArgs(1).
		WillReturnRows(sqlmock.NewRows([]string{"id", "issue_id", "author", "content", "created_at"}))

	w := serve(h, "GET", "/api/v1/issues/1/comments", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListComments status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data []models.IssueComment `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	// Verify empty returns empty array (not null)
	if body.Data == nil {
		t.Error("ListComments(empty) returned nil, want empty slice")
	}
}

func TestListComments_WithResults(t *testing.T) {
	h, mock := newTestHandler(t)

	// Tenant guard: GetIssueByID lookup
	mock.ExpectQuery("SELECT").
		WithArgs(1, defaultTenantID).
		WillReturnRows(newIssueRows(1, "ISS-001"))

	now := time.Now().UTC()
	rows := sqlmock.NewRows([]string{"id", "issue_id", "author", "content", "created_at"}).
		AddRow(1, 1, "admin", "Looking into it", now).
		AddRow(2, 1, "dev", "Fixed in PR #42", now)

	mock.ExpectQuery("SELECT").
		WithArgs(1).
		WillReturnRows(rows)

	w := serve(h, "GET", "/api/v1/issues/1/comments", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListComments status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data []models.IssueComment `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if len(body.Data) != 2 {
		t.Fatalf("expected 2 comments, got %d", len(body.Data))
	}
	if body.Data[0].Author != "admin" {
		t.Errorf("comment[0].Author = %q, want admin", body.Data[0].Author)
	}
}

// --- CreateComment ---

func TestCreateComment_MissingFields(t *testing.T) {
	h, mock := newTestHandler(t)

	// Tenant guard: GetIssueByID lookup
	mock.ExpectQuery("SELECT").
		WithArgs(1, defaultTenantID).
		WillReturnRows(newIssueRows(1, "ISS-001"))

	reqBody, _ := json.Marshal(models.CreateCommentRequest{})

	w := serve(h, "POST", "/api/v1/issues/1/comments", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateComment(empty) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateComment_Valid(t *testing.T) {
	h, mock := newTestHandler(t)

	// Tenant guard: GetIssueByID lookup
	mock.ExpectQuery("SELECT").
		WithArgs(1, defaultTenantID).
		WillReturnRows(newIssueRows(1, "ISS-001"))

	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO issue_comments").
		WithArgs(1, "admin", "Looking into this").
		WillReturnRows(sqlmock.NewRows([]string{"id", "issue_id", "author", "content", "created_at"}).
			AddRow(1, 1, "admin", "Looking into this", now))

	reqBody, _ := json.Marshal(models.CreateCommentRequest{
		Author:  "admin",
		Content: "Looking into this",
	})

	w := serve(h, "POST", "/api/v1/issues/1/comments", reqBody)

	if w.Code != http.StatusCreated {
		t.Fatalf("CreateComment status = %d, want %d\nbody: %s",
			w.Code, http.StatusCreated, w.Body.String())
	}

	var body struct {
		Data models.IssueComment `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.Author != "admin" {
		t.Errorf("Author = %q, want admin", body.Data.Author)
	}
}

// --- GetIssueStats ---

func TestGetIssueStats(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"open_count", "critical_count", "avg_resolution", "resolved_count"}).
			AddRow(5, 2, 3.5, 10))

	w := serve(h, "GET", "/api/v1/issues/stats", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("GetIssueStats status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data models.IssueStats      `json:"data"`
		Meta map[string]interface{} `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.OpenCount != 5 {
		t.Errorf("OpenCount = %d, want 5", body.Data.OpenCount)
	}
	if body.Data.CriticalCount != 2 {
		t.Errorf("CriticalCount = %d, want 2", body.Data.CriticalCount)
	}
	if body.Data.AvgResolution != 3.5 {
		t.Errorf("AvgResolution = %f, want 3.5", body.Data.AvgResolution)
	}
	if body.Data.ResolvedCount != 10 {
		t.Errorf("ResolvedCount = %d, want 10", body.Data.ResolvedCount)
	}
	if body.Meta["request_id"] == nil || body.Meta["request_id"] == "" {
		t.Error("meta.request_id should not be empty")
	}
}
