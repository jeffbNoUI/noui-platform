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
	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/casemanagement/models"
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

// serveWithTenant dispatches a request with a custom X-Tenant-ID header.
func serveWithTenant(h *Handler, method, path, tenantID string, body []byte) *httptest.ResponseRecorder {
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	var req *http.Request
	if body != nil {
		req = httptest.NewRequest(method, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	req.Header.Set("X-Tenant-ID", tenantID)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
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
	if body["service"] != "casemanagement" {
		t.Errorf("service = %q, want %q", body["service"], "casemanagement")
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

func TestTenantID_FallbackWithoutMiddleware(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := tenantID(req)
	if got != defaultTenantID {
		t.Errorf("tenantID(empty context) = %q, want %q", got, defaultTenantID)
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
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"key": "value"})

	if w.Code != http.StatusOK {
		t.Errorf("WriteJSON status = %d, want %d", w.Code, http.StatusOK)
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
	apiresponse.WriteSuccess(w, http.StatusOK, "casemanagement", map[string]string{"hello": "world"})

	if w.Code != http.StatusOK {
		t.Errorf("WriteSuccess status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body["data"] == nil {
		t.Error("WriteSuccess missing 'data' field")
	}
	meta, ok := body["meta"].(map[string]interface{})
	if !ok {
		t.Fatal("WriteSuccess missing 'meta' field")
	}
	if meta["requestId"] == nil || meta["requestId"] == "" {
		t.Error("meta.requestId should not be empty")
	}
	if meta["timestamp"] == nil || meta["timestamp"] == "" {
		t.Error("meta.timestamp should not be empty")
	}
	if meta["service"] != "casemanagement" {
		t.Errorf("meta.service = %q, want casemanagement", meta["service"])
	}
}

func TestWriteError(t *testing.T) {
	w := httptest.NewRecorder()
	apiresponse.WriteError(w, http.StatusBadRequest, "casemanagement", "INVALID", "bad input")

	if w.Code != http.StatusBadRequest {
		t.Errorf("WriteError status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	errObj, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatal("WriteError missing 'error' field")
	}
	if errObj["code"] != "INVALID" {
		t.Errorf("error.code = %q, want INVALID", errObj["code"])
	}
	if errObj["message"] != "bad input" {
		t.Errorf("error.message = %q, want %q", errObj["message"], "bad input")
	}
	if errObj["requestId"] == nil || errObj["requestId"] == "" {
		t.Error("error.requestId should not be empty")
	}
}

func TestWritePaginated(t *testing.T) {
	w := httptest.NewRecorder()
	apiresponse.WritePaginated(w, "casemanagement", []string{"a", "b"}, 10, 5, 0)

	if w.Code != http.StatusOK {
		t.Errorf("WritePaginated status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}

	pag, ok := body["pagination"].(map[string]interface{})
	if !ok {
		t.Fatal("WritePaginated missing 'pagination' field")
	}
	if pag["total"] != float64(10) {
		t.Errorf("pagination.total = %v, want 10", pag["total"])
	}
	if pag["limit"] != float64(5) {
		t.Errorf("pagination.limit = %v, want 5", pag["limit"])
	}
	if pag["offset"] != float64(0) {
		t.Errorf("pagination.offset = %v, want 0", pag["offset"])
	}
	// hasMore: 0+5 < 10 → true
	if pag["hasMore"] != true {
		t.Errorf("pagination.hasMore = %v, want true", pag["hasMore"])
	}
}

func TestWritePaginated_NoMore(t *testing.T) {
	w := httptest.NewRecorder()
	apiresponse.WritePaginated(w, "casemanagement", []string{"a"}, 3, 5, 0)

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	pag := body["pagination"].(map[string]interface{})
	// hasMore: 0+5 < 3 → false
	if pag["hasMore"] != false {
		t.Errorf("pagination.hasMore = %v, want false (offset+limit >= total)", pag["hasMore"])
	}
}

// --- Model Serialization ---

func TestRetirementCaseJSON(t *testing.T) {
	now := time.Now().UTC()
	c := models.RetirementCase{
		CaseID:          "case-001",
		TenantID:        "tenant-1",
		MemberID:        10001,
		CaseType:        "service",
		RetirementDate:  "2026-07-01",
		Priority:        "high",
		SLAStatus:       "on-track",
		CurrentStage:    "Application Intake",
		CurrentStageIdx: 0,
		AssignedTo:      "jsmith",
		DaysOpen:        15,
		Status:          "active",
		Flags:           []string{"dro", "purchased-service"},
		CreatedAt:       now,
		UpdatedAt:       now,
		Name:            "Robert Martinez",
		Tier:            1,
		Dept:            "Public Works",
	}

	data, err := json.Marshal(c)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	var decoded models.RetirementCase
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if decoded.CaseID != "case-001" {
		t.Errorf("CaseID = %q, want case-001", decoded.CaseID)
	}
	if decoded.MemberID != 10001 {
		t.Errorf("MemberID = %d, want 10001", decoded.MemberID)
	}
	if len(decoded.Flags) != 2 {
		t.Errorf("Flags len = %d, want 2", len(decoded.Flags))
	}
}

func TestStageTransitionJSON_NullableFields(t *testing.T) {
	// Initial transition has nil FromStageIdx and FromStage
	tr := models.StageTransition{
		ID:             1,
		CaseID:         "case-001",
		FromStageIdx:   nil,
		ToStageIdx:     0,
		FromStage:      nil,
		ToStage:        "Application Intake",
		TransitionedBy: "jsmith",
		Note:           "Case created",
		TransitionedAt: time.Now().UTC(),
	}

	data, err := json.Marshal(tr)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	var decoded models.StageTransition
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if decoded.FromStageIdx != nil {
		t.Errorf("FromStageIdx = %v, want nil (initial transition)", decoded.FromStageIdx)
	}
	if decoded.FromStage != nil {
		t.Errorf("FromStage = %v, want nil (initial transition)", decoded.FromStage)
	}
	if decoded.ToStage != "Application Intake" {
		t.Errorf("ToStage = %q, want Application Intake", decoded.ToStage)
	}
}

// --- DB-Dependent Handler Tests ---

// caseCols must match the SELECT in caseColumns + JOINed fields (20 columns including dro_id + SLA).
var caseCols = []string{
	"case_id", "tenant_id", "member_id", "case_type",
	"retirement_date", "priority", "sla_status",
	"current_stage", "current_stage_idx", "assigned_to",
	"days_open", "status", "dro_id",
	"sla_target_days", "sla_deadline_at",
	"created_at", "updated_at",
	"name", "tier", "dept",
}

// addCaseRow appends a case row to an existing Rows object.
func addCaseRow(rows *sqlmock.Rows, caseID string, memberID int, stageIdx int, stage string) *sqlmock.Rows {
	now := time.Now().UTC()
	deadline := now.AddDate(0, 0, 90)
	return rows.AddRow(
		caseID, defaultTenantID, memberID, "service",
		time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
		"standard", "on-track",
		stage, stageIdx, sql.NullString{String: "jsmith", Valid: true},
		15, "active", sql.NullInt64{Valid: false},
		90, deadline,
		now, now,
		"Robert Martinez", 1, "Public Works",
	)
}

// newCaseRows creates a Rows with a single case row.
func newCaseRows(caseID string, memberID int, stageIdx int, stage string) *sqlmock.Rows {
	return addCaseRow(sqlmock.NewRows(caseCols), caseID, memberID, stageIdx, stage)
}

// expectEnrichment adds NoteCount + DocumentCount mock expectations for GetCase enrichment.
func expectEnrichment(mock sqlmock.Sqlmock, caseID string, notes, docs int) {
	mock.ExpectQuery("SELECT COUNT").
		WithArgs(caseID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(notes))
	mock.ExpectQuery("SELECT COUNT").
		WithArgs(caseID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(docs))
}

// --- GetCase ---

func TestGetCase_NotFound(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WithArgs("nonexistent", defaultTenantID).
		WillReturnError(sql.ErrNoRows)

	w := serve(h, "GET", "/api/v1/cases/nonexistent", nil)

	if w.Code != http.StatusNotFound {
		t.Errorf("GetCase(nonexistent) status = %d, want %d", w.Code, http.StatusNotFound)
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	errObj := body["error"].(map[string]interface{})
	if errObj["code"] != "NOT_FOUND" {
		t.Errorf("error.code = %q, want NOT_FOUND", errObj["code"])
	}
}

func TestGetCase_Valid(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WithArgs("case-001", defaultTenantID).
		WillReturnRows(newCaseRows("case-001", 10001, 2, "Eligibility Verification"))

	// GetCase also calls GetCaseFlags
	flagRows := sqlmock.NewRows([]string{"flag_code"}).
		AddRow("dro").
		AddRow("purchased-service")
	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-001").
		WillReturnRows(flagRows)

	// GetCase enrichment: NoteCount + DocumentCount
	expectEnrichment(mock, "case-001", 3, 1)

	w := serve(h, "GET", "/api/v1/cases/case-001", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("GetCase status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data models.CaseDetail      `json:"data"`
		Meta map[string]interface{} `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.CaseID != "case-001" {
		t.Errorf("CaseID = %q, want case-001", body.Data.CaseID)
	}
	if body.Data.CurrentStageIdx != 2 {
		t.Errorf("CurrentStageIdx = %d, want 2", body.Data.CurrentStageIdx)
	}
	if body.Data.Name != "Robert Martinez" {
		t.Errorf("Name = %q, want Robert Martinez", body.Data.Name)
	}
	if len(body.Data.Flags) != 2 {
		t.Errorf("Flags len = %d, want 2", len(body.Data.Flags))
	}
	if body.Meta["requestId"] == nil || body.Meta["requestId"] == "" {
		t.Error("meta.requestId should not be empty")
	}
}

// --- ListStages ---

func TestListStages(t *testing.T) {
	h, mock := newTestHandler(t)

	rows := sqlmock.NewRows([]string{"stage_idx", "stage_name", "description", "sort_order"}).
		AddRow(0, "Application Intake", "Initial application", 0).
		AddRow(1, "Verify Employment", "Employment verification", 1).
		AddRow(2, "Eligibility Verification", "Eligibility check", 2)

	mock.ExpectQuery("SELECT stage_idx, stage_name").
		WillReturnRows(rows)

	w := serve(h, "GET", "/api/v1/stages", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListStages status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data []models.StageDefinition `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if len(body.Data) != 3 {
		t.Fatalf("expected 3 stages, got %d", len(body.Data))
	}
	if body.Data[0].StageName != "Application Intake" {
		t.Errorf("stage[0].StageName = %q, want Application Intake", body.Data[0].StageName)
	}
}

// --- ListCases ---

func TestListCases_Empty(t *testing.T) {
	h, mock := newTestHandler(t)

	// COUNT query
	mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	// Data query
	mock.ExpectQuery("SELECT").
		WillReturnRows(sqlmock.NewRows(caseCols))

	w := serve(h, "GET", "/api/v1/cases", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListCases status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
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

func TestListCases_WithResults(t *testing.T) {
	h, mock := newTestHandler(t)

	// COUNT query
	mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	// Data query — 2 cases
	dataRows := sqlmock.NewRows(caseCols)
	addCaseRow(dataRows, "case-001", 10001, 0, "Application Intake")
	addCaseRow(dataRows, "case-002", 10002, 2, "Eligibility Verification")
	mock.ExpectQuery("SELECT").
		WillReturnRows(dataRows)

	// GetCaseFlags called for each case
	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-001").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))
	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-002").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}).AddRow("dro"))

	w := serve(h, "GET", "/api/v1/cases?limit=25&offset=0", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListCases status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data       []models.RetirementCase `json:"data"`
		Pagination map[string]interface{}  `json:"pagination"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if len(body.Data) != 2 {
		t.Fatalf("expected 2 cases, got %d", len(body.Data))
	}
	if body.Data[0].CaseID != "case-001" {
		t.Errorf("case[0].CaseID = %q, want case-001", body.Data[0].CaseID)
	}
	if body.Pagination["total"] != float64(2) {
		t.Errorf("pagination.total = %v, want 2", body.Pagination["total"])
	}
}

// --- CreateCase ---

func TestCreateCase_MissingCaseID(t *testing.T) {
	h, _ := newTestHandler(t)

	reqBody, _ := json.Marshal(models.CreateCaseRequest{
		MemberID: 10001,
		CaseType: "service",
	})

	w := serve(h, "POST", "/api/v1/cases", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateCase(no caseId) status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	errObj := body["error"].(map[string]interface{})
	if errObj["code"] != "INVALID_REQUEST" {
		t.Errorf("error.code = %q, want INVALID_REQUEST", errObj["code"])
	}
}

func TestCreateCase_Valid(t *testing.T) {
	h, mock := newTestHandler(t)

	// GetStage(0) to look up initial stage name
	mock.ExpectQuery("SELECT stage_idx, stage_name").
		WithArgs(0).
		WillReturnRows(sqlmock.NewRows([]string{"stage_idx", "stage_name", "description", "sort_order"}).
			AddRow(0, "Application Intake", "Initial application", 0))

	// CreateCase transaction: BEGIN, INSERT case, INSERT flag, INSERT history, COMMIT
	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO retirement_case").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO case_flag").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO case_stage_history").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	// Re-fetch via GetCase
	mock.ExpectQuery("SELECT").
		WithArgs("case-new-001").
		WillReturnRows(newCaseRows("case-new-001", 10001, 0, "Application Intake"))

	// GetCaseFlags for the re-fetched case
	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-new-001").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}).AddRow("dro"))

	reqBody, _ := json.Marshal(models.CreateCaseRequest{
		CaseID:         "case-new-001",
		MemberID:       10001,
		CaseType:       "service",
		RetirementDate: "2026-07-01",
		Priority:       "high",
		AssignedTo:     "jsmith",
		Flags:          []string{"dro"},
	})

	w := serve(h, "POST", "/api/v1/cases", reqBody)

	if w.Code != http.StatusCreated {
		t.Fatalf("CreateCase status = %d, want %d\nbody: %s", w.Code, http.StatusCreated, w.Body.String())
	}

	var body struct {
		Data models.RetirementCase `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.CaseID != "case-new-001" {
		t.Errorf("CaseID = %q, want case-new-001", body.Data.CaseID)
	}
}

// --- UpdateCase ---

func TestUpdateCase_NotFound(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WithArgs("nonexistent", defaultTenantID).
		WillReturnError(sql.ErrNoRows)

	prio := "high"
	reqBody, _ := json.Marshal(models.UpdateCaseRequest{Priority: &prio})

	w := serve(h, "PUT", "/api/v1/cases/nonexistent", reqBody)

	if w.Code != http.StatusNotFound {
		t.Errorf("UpdateCase(nonexistent) status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestUpdateCase_Valid(t *testing.T) {
	h, mock := newTestHandler(t)

	// First: verify case exists (GetCase — now tenant-scoped)
	mock.ExpectQuery("SELECT").
		WithArgs("case-001", defaultTenantID).
		WillReturnRows(newCaseRows("case-001", 10001, 2, "Eligibility Verification"))
	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-001").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))

	// Then: UpdateCase exec (tenant-scoped)
	mock.ExpectExec("UPDATE retirement_case SET").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Then: re-fetch via GetCase (tenant-scoped)
	mock.ExpectQuery("SELECT").
		WithArgs("case-001", defaultTenantID).
		WillReturnRows(newCaseRows("case-001", 10001, 2, "Eligibility Verification"))
	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-001").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))

	prio := "high"
	reqBody, _ := json.Marshal(models.UpdateCaseRequest{Priority: &prio})

	w := serve(h, "PUT", "/api/v1/cases/case-001", reqBody)

	if w.Code != http.StatusOK {
		t.Fatalf("UpdateCase status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}
}

// --- AdvanceStage ---

func TestAdvanceStage_EmptyTransitionedBy(t *testing.T) {
	h, _ := newTestHandler(t)

	// Bug #3 regression test: transitionedBy must not be empty
	reqBody, _ := json.Marshal(models.AdvanceStageRequest{
		TransitionedBy: "",
		Note:           "should fail",
	})

	w := serve(h, "POST", "/api/v1/cases/case-001/advance", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("AdvanceStage(empty transitionedBy) status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	errObj := body["error"].(map[string]interface{})
	if errObj["code"] != "INVALID_REQUEST" {
		t.Errorf("error.code = %q, want INVALID_REQUEST", errObj["code"])
	}
}

func TestAdvanceStage_WhitespaceTransitionedBy(t *testing.T) {
	h, _ := newTestHandler(t)

	// Bug #3 edge case: whitespace-only transitionedBy should also be rejected
	reqBody, _ := json.Marshal(models.AdvanceStageRequest{
		TransitionedBy: "   ",
		Note:           "should fail",
	})

	w := serve(h, "POST", "/api/v1/cases/case-001/advance", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("AdvanceStage(whitespace transitionedBy) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestAdvanceStage_CaseNotFound(t *testing.T) {
	h, mock := newTestHandler(t)

	// AdvanceStage starts a transaction, then queries current_stage_idx
	mock.ExpectBegin()
	mock.ExpectQuery("SELECT current_stage_idx").
		WithArgs("nonexistent", defaultTenantID).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectRollback()

	reqBody, _ := json.Marshal(models.AdvanceStageRequest{
		TransitionedBy: "jsmith",
	})

	w := serve(h, "POST", "/api/v1/cases/nonexistent/advance", reqBody)

	if w.Code != http.StatusNotFound {
		t.Errorf("AdvanceStage(nonexistent) status = %d, want %d\nbody: %s",
			w.Code, http.StatusNotFound, w.Body.String())
	}
}

func TestAdvanceStage_Valid(t *testing.T) {
	h, mock := newTestHandler(t)

	// Transaction: get current stage (tenant-scoped), look up next stage, look up current stage name, update, record history
	mock.ExpectBegin()
	mock.ExpectQuery("SELECT current_stage_idx").
		WithArgs("case-001", defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"current_stage_idx"}).AddRow(1))

	// Look up next stage (idx=2)
	mock.ExpectQuery("SELECT stage_name FROM case_stage_definition").
		WithArgs(2).
		WillReturnRows(sqlmock.NewRows([]string{"stage_name"}).AddRow("Eligibility Verification"))

	// Look up current stage name (idx=1) for history
	mock.ExpectQuery("SELECT stage_name FROM case_stage_definition").
		WithArgs(1).
		WillReturnRows(sqlmock.NewRows([]string{"stage_name"}).AddRow("Verify Employment"))

	// Update case
	mock.ExpectExec("UPDATE retirement_case").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Insert history
	mock.ExpectExec("INSERT INTO case_stage_history").
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectCommit()

	// GetCase re-fetch after commit (tenant-scoped)
	mock.ExpectQuery("SELECT").
		WithArgs("case-001", defaultTenantID).
		WillReturnRows(newCaseRows("case-001", 10001, 2, "Eligibility Verification"))
	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-001").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))

	reqBody, _ := json.Marshal(models.AdvanceStageRequest{
		TransitionedBy: "jsmith",
		Note:           "Verified employment records",
	})

	w := serve(h, "POST", "/api/v1/cases/case-001/advance", reqBody)

	if w.Code != http.StatusOK {
		t.Fatalf("AdvanceStage status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data models.RetirementCase `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.CurrentStageIdx != 2 {
		t.Errorf("CurrentStageIdx = %d, want 2", body.Data.CurrentStageIdx)
	}
}

// --- GetStageHistory ---

func TestGetStageHistory_WithRecords(t *testing.T) {
	h, mock := newTestHandler(t)

	now := time.Now().UTC()
	fromIdx := 0
	fromStage := "Application Intake"

	rows := sqlmock.NewRows([]string{
		"id", "case_id", "from_stage_idx", "to_stage_idx",
		"from_stage", "to_stage", "transitioned_by", "note", "transitioned_at",
	}).
		AddRow(2, "case-001", &fromIdx, 1, &fromStage, "Verify Employment", "jsmith", "Reviewed docs", now).
		AddRow(1, "case-001", nil, 0, nil, "Application Intake", "jsmith", "Case created", now)

	mock.ExpectQuery("SELECT").
		WithArgs("case-001", defaultTenantID).
		WillReturnRows(rows)

	w := serve(h, "GET", "/api/v1/cases/case-001/history", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("GetStageHistory status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data []models.StageTransition `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if len(body.Data) != 2 {
		t.Fatalf("expected 2 history records, got %d", len(body.Data))
	}
	// First record (most recent) has from_stage
	if body.Data[0].ToStage != "Verify Employment" {
		t.Errorf("history[0].ToStage = %q, want Verify Employment", body.Data[0].ToStage)
	}
	// Second record (initial) has nil from_stage
	if body.Data[1].FromStage != nil {
		t.Errorf("history[1].FromStage = %v, want nil (initial transition)", body.Data[1].FromStage)
	}
}

// --- Edge Case Tests (Session 3) ---

func TestListCases_FilterCombination(t *testing.T) {
	h, mock := newTestHandler(t)

	// status=active + priority=high → 2 filter args + tenant = 3 WHERE args
	mock.ExpectQuery("SELECT COUNT").
		WithArgs(defaultTenantID, "active", "high").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	dataRows := sqlmock.NewRows(caseCols)
	addCaseRow(dataRows, "case-filtered", 10001, 1, "Verify Employment")
	mock.ExpectQuery("SELECT").
		WithArgs(defaultTenantID, "active", "high", 25, 0).
		WillReturnRows(dataRows)

	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-filtered").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))

	w := serve(h, "GET", "/api/v1/cases?status=active&priority=high", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListCases(status+priority) status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data       []models.RetirementCase `json:"data"`
		Pagination map[string]interface{}  `json:"pagination"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if len(body.Data) != 1 {
		t.Errorf("expected 1 case, got %d", len(body.Data))
	}
	if body.Data[0].CaseID != "case-filtered" {
		t.Errorf("CaseID = %q, want case-filtered", body.Data[0].CaseID)
	}
}

func TestAdvanceStage_FinalStage_HTTP(t *testing.T) {
	h, mock := newTestHandler(t)

	// Case is at stage 6 (final). AdvanceStage will try nextIdx=7, get ErrNoRows,
	// and return "case is already at the final stage" error.
	mock.ExpectBegin()
	mock.ExpectQuery("SELECT current_stage_idx").
		WithArgs("case-final", defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"current_stage_idx"}).AddRow(6))

	mock.ExpectQuery("SELECT stage_name FROM case_stage_definition").
		WithArgs(7).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectRollback()

	reqBody, _ := json.Marshal(models.AdvanceStageRequest{
		TransitionedBy: "jsmith",
		Note:           "try to advance past final",
	})

	w := serve(h, "POST", "/api/v1/cases/case-final/advance", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("AdvanceStage(final) status = %d, want %d\nbody: %s",
			w.Code, http.StatusBadRequest, w.Body.String())
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	errObj := body["error"].(map[string]interface{})
	if errObj["code"] != "ADVANCE_ERROR" {
		t.Errorf("error.code = %q, want ADVANCE_ERROR", errObj["code"])
	}
}

func TestGetCase_NullMemberJoin(t *testing.T) {
	h, mock := newTestHandler(t)

	// Member doesn't exist in member_master → COALESCE returns defaults
	now := time.Now().UTC()
	deadline := now.AddDate(0, 0, 90)
	rows := sqlmock.NewRows(caseCols).AddRow(
		"case-orphan", defaultTenantID, 99999, "service",
		time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
		"standard", "on-track",
		"Application Intake", 0, sql.NullString{Valid: false},
		5, "active", sql.NullInt64{Valid: false},
		90, deadline,
		now, now,
		"", 0, "", // COALESCE defaults
	)
	mock.ExpectQuery("SELECT").
		WithArgs("case-orphan", defaultTenantID).
		WillReturnRows(rows)

	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-orphan").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))

	// GetCase enrichment
	expectEnrichment(mock, "case-orphan", 0, 0)

	w := serve(h, "GET", "/api/v1/cases/case-orphan", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("GetCase(orphan) status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data models.CaseDetail `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.Name != "" {
		t.Errorf("Name = %q, want empty (COALESCE default)", body.Data.Name)
	}
	if body.Data.Tier != 0 {
		t.Errorf("Tier = %d, want 0 (COALESCE default)", body.Data.Tier)
	}
	if body.Data.AssignedTo != "" {
		t.Errorf("AssignedTo = %q, want empty (NULL)", body.Data.AssignedTo)
	}
}

func TestListCases_WithAssignedToFilter(t *testing.T) {
	h, mock := newTestHandler(t)

	// assigned_to=jsmith filter
	mock.ExpectQuery("SELECT COUNT").
		WithArgs(defaultTenantID, "jsmith").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	dataRows := sqlmock.NewRows(caseCols)
	addCaseRow(dataRows, "case-assigned", 10002, 3, "Marital Share Calculation")
	mock.ExpectQuery("SELECT").
		WithArgs(defaultTenantID, "jsmith", 25, 0).
		WillReturnRows(dataRows)

	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-assigned").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}).AddRow("dro"))

	w := serve(h, "GET", "/api/v1/cases?assigned_to=jsmith", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListCases(assigned_to) status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data []models.RetirementCase `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if len(body.Data) != 1 {
		t.Errorf("expected 1 case, got %d", len(body.Data))
	}
	if body.Data[0].CaseID != "case-assigned" {
		t.Errorf("CaseID = %q, want case-assigned", body.Data[0].CaseID)
	}
	if len(body.Data[0].Flags) != 1 || body.Data[0].Flags[0] != "dro" {
		t.Errorf("Flags = %v, want [dro]", body.Data[0].Flags)
	}
}

// --- Tenant Isolation + Edge Case Tests ---

func TestCreateCase_MalformedJSON(t *testing.T) {
	h, _ := newTestHandler(t)

	w := serve(h, "POST", "/api/v1/cases", []byte(`{invalid json`))

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateCase(malformed JSON) status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	errObj := body["error"].(map[string]interface{})
	if errObj["code"] != "INVALID_REQUEST" {
		t.Errorf("error.code = %q, want INVALID_REQUEST", errObj["code"])
	}
}

func TestGetCase_CrossTenant(t *testing.T) {
	h, mock := newTestHandler(t)

	// Without auth middleware, tenantID() falls back to defaultTenantID regardless
	// of X-Tenant-ID header. Cross-tenant isolation is enforced by JWT middleware
	// at the integration level. Here we verify the handler uses defaultTenantID
	// and returns NOT_FOUND when the case doesn't exist for that tenant.
	mock.ExpectQuery("SELECT").
		WithArgs("case-001", defaultTenantID).
		WillReturnError(sql.ErrNoRows)

	w := serveWithTenant(h, "GET", "/api/v1/cases/case-001", "other-tenant", nil)

	if w.Code != http.StatusNotFound {
		t.Errorf("GetCase(cross-tenant) status = %d, want %d", w.Code, http.StatusNotFound)
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	errObj := body["error"].(map[string]interface{})
	if errObj["code"] != "NOT_FOUND" {
		t.Errorf("error.code = %q, want NOT_FOUND", errObj["code"])
	}
}

func TestUpdateCase_EmptyBody(t *testing.T) {
	h, mock := newTestHandler(t)

	// Verify case exists (tenant-scoped)
	mock.ExpectQuery("SELECT").
		WithArgs("case-001", defaultTenantID).
		WillReturnRows(newCaseRows("case-001", 10001, 2, "Eligibility Verification"))
	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-001").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))

	// UpdateCase with no fields is a no-op (no UPDATE exec expected)

	// Re-fetch (tenant-scoped)
	mock.ExpectQuery("SELECT").
		WithArgs("case-001", defaultTenantID).
		WillReturnRows(newCaseRows("case-001", 10001, 2, "Eligibility Verification"))
	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-001").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))

	reqBody, _ := json.Marshal(models.UpdateCaseRequest{})

	w := serve(h, "PUT", "/api/v1/cases/case-001", reqBody)

	if w.Code != http.StatusOK {
		t.Fatalf("UpdateCase(empty body) status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data models.RetirementCase `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.CaseID != "case-001" {
		t.Errorf("CaseID = %q, want case-001", body.Data.CaseID)
	}
}

func TestListCases_WithStageFilter_HTTP(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs(defaultTenantID, "Eligibility Verification").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	dataRows := sqlmock.NewRows(caseCols)
	addCaseRow(dataRows, "case-elig", 10001, 2, "Eligibility Verification")
	mock.ExpectQuery("SELECT").
		WithArgs(defaultTenantID, "Eligibility Verification", 25, 0).
		WillReturnRows(dataRows)

	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-elig").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))

	w := serve(h, "GET", "/api/v1/cases?stage=Eligibility+Verification", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListCases(stage) HTTP status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data []models.RetirementCase `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if len(body.Data) != 1 {
		t.Errorf("expected 1 case, got %d", len(body.Data))
	}
}

func TestGetStageHistory_Empty(t *testing.T) {
	h, mock := newTestHandler(t)

	// Case exists but has no stage history records
	mock.ExpectQuery("SELECT").
		WithArgs("case-no-history", defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "case_id", "from_stage_idx", "to_stage_idx",
			"from_stage", "to_stage", "transitioned_by", "note", "transitioned_at",
		}))

	w := serve(h, "GET", "/api/v1/cases/case-no-history/history", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("GetStageHistory(empty) status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data []models.StageTransition `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	// Verify empty history returns empty array (not null)
	if body.Data == nil {
		t.Error("GetStageHistory(empty) returned nil, want empty slice")
	}
}

// --- GetCaseStats ---

func TestGetCaseStats_HTTP(t *testing.T) {
	h, mock := newTestHandler(t)

	// Query 1: CaseloadByStage
	mock.ExpectQuery("SELECT current_stage, current_stage_idx, COUNT").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"current_stage", "current_stage_idx", "count"}).
			AddRow("Application Intake", 0, 2))

	// Query 2: CasesByStatus
	mock.ExpectQuery("SELECT status, COUNT").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"status", "count"}).
			AddRow("active", 3))

	// Query 3: CasesByPriority
	mock.ExpectQuery("SELECT priority, COUNT").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"priority", "count"}).
			AddRow("standard", 3))

	// Query 4: CasesByAssignee
	mock.ExpectQuery("SELECT").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"assigned_to", "count", "avg_days_open"}).
			AddRow("Sarah Chen", 2, 10.0))

	// Query 5: Summary counts
	mock.ExpectQuery("SELECT").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"total_active", "completed_mtd", "at_risk_count"}).
			AddRow(3, 0, 1))

	w := serve(h, "GET", "/api/v1/cases/stats", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("GetCaseStats HTTP status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data models.CaseStats       `json:"data"`
		Meta map[string]interface{} `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.TotalActive != 3 {
		t.Errorf("TotalActive = %d, want 3", body.Data.TotalActive)
	}
	if len(body.Data.CaseloadByStage) != 1 {
		t.Errorf("CaseloadByStage len = %d, want 1", len(body.Data.CaseloadByStage))
	}
	if body.Data.CaseloadByStage[0].Stage != "Application Intake" {
		t.Errorf("stage[0] = %q, want Application Intake", body.Data.CaseloadByStage[0].Stage)
	}
	if body.Meta["requestId"] == nil || body.Meta["requestId"] == "" {
		t.Error("meta.requestId should not be empty")
	}
}

// --- GetSLAStats ---

func TestGetSLAStats_HTTP(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"on_track", "at_risk", "overdue", "avg_processing_days"}).
			AddRow(2, 1, 1, 18.5))

	w := serve(h, "GET", "/api/v1/cases/stats/sla", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("GetSLAStats HTTP status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data models.SLAStats        `json:"data"`
		Meta map[string]interface{} `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.OnTrack != 2 {
		t.Errorf("OnTrack = %d, want 2", body.Data.OnTrack)
	}
	if body.Data.AtRisk != 1 {
		t.Errorf("AtRisk = %d, want 1", body.Data.AtRisk)
	}
	if body.Data.Overdue != 1 {
		t.Errorf("Overdue = %d, want 1", body.Data.Overdue)
	}
	if body.Data.AvgProcessingDays != 18.5 {
		t.Errorf("AvgProcessingDays = %f, want 18.5", body.Data.AvgProcessingDays)
	}
	if body.Data.Thresholds.Urgent != 6 {
		t.Errorf("Thresholds.Urgent = %d, want 6", body.Data.Thresholds.Urgent)
	}
	if body.Data.Thresholds.High != 12 {
		t.Errorf("Thresholds.High = %d, want 12", body.Data.Thresholds.High)
	}
	if body.Data.Thresholds.Standard != 18 {
		t.Errorf("Thresholds.Standard = %d, want 18", body.Data.Thresholds.Standard)
	}
}
