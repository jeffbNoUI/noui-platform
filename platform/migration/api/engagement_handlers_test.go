package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

// engagementCols matches the 11-column RETURNING clause used by engagement queries.
var engagementCols = []string{
	"engagement_id", "tenant_id", "source_system_name", "canonical_schema_version",
	"status", "source_platform_type", "quality_baseline_approved_at", "source_connection",
	"contribution_model", "created_at", "updated_at",
}

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

// --- CreateEngagement ---

func TestCreateEngagement_Success(t *testing.T) {
	h, mock := newTestHandler(t)
	now := time.Now().UTC()

	mock.ExpectQuery("INSERT INTO migration.engagement").
		WithArgs(defaultTenantID, "LegacyPAS", nil, "standard").
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			"eng-001", defaultTenantID, "LegacyPAS", "1.0",
			"PROFILING", nil, nil, nil, "standard", now, now,
		))

	body, _ := json.Marshal(map[string]string{"source_system_name": "LegacyPAS"})
	w := serve(h, "POST", "/api/v1/migration/engagements", body)

	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusCreated, w.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	data, ok := resp["data"].(map[string]any)
	if !ok {
		t.Fatal("response missing data field")
	}
	if data["engagement_id"] != "eng-001" {
		t.Errorf("engagement_id = %v, want eng-001", data["engagement_id"])
	}
	if data["status"] != "PROFILING" {
		t.Errorf("status = %v, want PROFILING", data["status"])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCreateEngagement_MissingSourceSystem(t *testing.T) {
	h, _ := newTestHandler(t)

	body, _ := json.Marshal(map[string]string{"source_system_name": ""})
	w := serve(h, "POST", "/api/v1/migration/engagements", body)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusBadRequest, w.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	errObj, ok := resp["error"].(map[string]any)
	if !ok {
		t.Fatal("response missing error field")
	}
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Errorf("error code = %v, want VALIDATION_ERROR", errObj["code"])
	}
}

func TestCreateEngagement_InvalidJSON(t *testing.T) {
	h, _ := newTestHandler(t)

	w := serve(h, "POST", "/api/v1/migration/engagements", []byte("{bad json"))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- GetEngagement ---

func TestGetEngagement_Success(t *testing.T) {
	h, mock := newTestHandler(t)
	now := time.Now().UTC()

	mock.ExpectQuery("SELECT .+ FROM migration.engagement").
		WithArgs("eng-001").
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			"eng-001", "tenant-1", "LegacyPAS", "1.0",
			"PROFILING", nil, nil, nil, "standard", now, now,
		))

	w := serve(h, "GET", "/api/v1/migration/engagements/eng-001", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetEngagement_NotFound(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT .+ FROM migration.engagement").
		WithArgs("eng-999").
		WillReturnRows(sqlmock.NewRows(engagementCols))

	w := serve(h, "GET", "/api/v1/migration/engagements/eng-999", nil)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- UpdateEngagement ---

func TestUpdateEngagement_ContributionModelSuccess(t *testing.T) {
	h, mock := newTestHandler(t)
	now := time.Now().UTC()

	cm := "DEFINED_BENEFIT"
	mock.ExpectQuery("UPDATE migration.engagement").
		WithArgs("eng-001", cm).
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			"eng-001", "tenant-1", "LegacyPAS", "1.0",
			"PROFILING", nil, nil, nil, cm, now, now,
		))

	body, _ := json.Marshal(map[string]any{"contribution_model": cm})
	w := serve(h, "PATCH", "/api/v1/migration/engagements/eng-001", body)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateEngagement_StatusFieldReturns400(t *testing.T) {
	h, _ := newTestHandler(t)

	// Sending only status (no contribution_model) must be rejected.
	body, _ := json.Marshal(map[string]string{"status": "PARALLEL_RUN"})
	w := serve(h, "PATCH", "/api/v1/migration/engagements/eng-001", body)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusBadRequest, w.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	errObj, ok := resp["error"].(map[string]any)
	if !ok {
		t.Fatal("response missing error field")
	}
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Errorf("error code = %v, want VALIDATION_ERROR", errObj["code"])
	}
}

func TestUpdateEngagement_MissingContributionModel(t *testing.T) {
	h, _ := newTestHandler(t)

	body, _ := json.Marshal(map[string]string{})
	w := serve(h, "PATCH", "/api/v1/migration/engagements/eng-001", body)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ListEngagements ---

func TestListEngagements_Success(t *testing.T) {
	h, mock := newTestHandler(t)
	now := time.Now().UTC()

	rows := sqlmock.NewRows(engagementCols).
		AddRow("eng-002", defaultTenantID, "SystemB", "1.0", "PROFILING", nil, nil, nil, "standard", now, now).
		AddRow("eng-001", defaultTenantID, "SystemA", "1.0", "MAPPING", nil, nil, nil, "standard", now.Add(-time.Hour), now)

	mock.ExpectQuery("SELECT .+ FROM migration.engagement").
		WithArgs(defaultTenantID).
		WillReturnRows(rows)

	w := serve(h, "GET", "/api/v1/migration/engagements", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	data, ok := resp["data"].([]any)
	if !ok {
		t.Fatal("response data is not an array")
	}
	if len(data) != 2 {
		t.Errorf("len(data) = %d, want 2", len(data))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}
