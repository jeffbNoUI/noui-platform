package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/intelligence"
)

// mockScorer implements intelligence.Scorer for testing.
type mockScorer struct {
	response *intelligence.ScoreColumnsResponse
	err      error
	lastReq  *intelligence.ScoreColumnsRequest
}

func (m *mockScorer) ScoreColumns(ctx context.Context, req intelligence.ScoreColumnsRequest) (*intelligence.ScoreColumnsResponse, error) {
	m.lastReq = &req
	return m.response, m.err
}

// mappingCols matches the 13-column SELECT used by ListMappings and UpdateMapping.
var mappingCols = []string{
	"mapping_id", "engagement_id", "mapping_version",
	"source_table", "source_column",
	"canonical_table", "canonical_column",
	"template_confidence", "signal_confidence",
	"agreement_status", "approval_status",
	"approved_by", "approved_at",
}

// newTestHandlerWithIntel creates a Handler with sqlmock + mock intelligence client.
func newTestHandlerWithIntel(t *testing.T, scorer intelligence.Scorer) (*Handler, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return NewHandlerWithIntel(db, scorer), mock
}

// serveMux dispatches a request through a real ServeMux so path values work.
func serveMux(h *Handler, method, path string, body []byte) *httptest.ResponseRecorder {
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

// --- GenerateMappings ---

func TestGenerateMappings_Success(t *testing.T) {
	scorer := &mockScorer{
		response: &intelligence.ScoreColumnsResponse{
			Mappings: []intelligence.ScoredMapping{
				{SourceColumn: "MBR_NBR", CanonicalColumn: "member_id", Confidence: 0.85, Signals: map[string]float64{"name": 0.7}},
				{SourceColumn: "BIRTH_DT", CanonicalColumn: "birth_date", Confidence: 0.90, Signals: map[string]float64{"name": 0.8}},
			},
		},
	}
	h, mock := newTestHandlerWithIntel(t, scorer)
	now := time.Now().UTC()
	approvedAt := now.Add(-time.Hour)

	// Expect engagement lookup — quality baseline approved.
	mock.ExpectQuery("SELECT .+ FROM migration.engagement").
		WithArgs("eng-001").
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			"eng-001", "tenant-1", "LegacyPAS", "1.0",
			"MAPPING", &approvedAt, nil, now, now,
		))

	// Transaction: BEGIN + INSERTs + COMMIT
	mock.ExpectBegin()
	// MBR_NBR → member_id: template pattern match (0.9) + signal (0.85) = AGREED
	mock.ExpectExec("INSERT INTO migration.field_mapping").
		WillReturnResult(sqlmock.NewResult(0, 1))
	// BIRTH_DT → birth_date: template pattern match (0.9) + signal (0.90) = AGREED
	mock.ExpectExec("INSERT INTO migration.field_mapping").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	body, _ := json.Marshal(GenerateMappingsRequest{
		Tables: []GenerateMappingsTable{
			{
				SourceTable: "PRISM_MEMBER",
				ConceptTag:  "employee-master",
				Columns: []GenerateMappingsColumn{
					{Name: "MBR_NBR", DataType: "INTEGER", IsNullable: false, IsKey: true},
					{Name: "BIRTH_DT", DataType: "VARCHAR(10)", IsNullable: false, IsKey: false},
				},
			},
		},
	})

	w := serveMux(h, "POST", "/api/v1/migration/engagements/eng-001/generate-mappings", body)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	data, ok := resp["data"].(map[string]any)
	if !ok {
		t.Fatal("response missing data field")
	}
	// Both columns should be AGREED (template pattern + signal both mapped).
	if data["agreed"].(float64) != 2 {
		t.Errorf("agreed = %v, want 2", data["agreed"])
	}
	if data["total_columns"].(float64) != 2 {
		t.Errorf("total_columns = %v, want 2", data["total_columns"])
	}

	// Verify the intelligence client received the right request.
	if scorer.lastReq == nil {
		t.Fatal("intelligence client was not called")
	}
	if scorer.lastReq.ConceptTag != "employee-master" {
		t.Errorf("intel concept_tag = %s, want employee-master", scorer.lastReq.ConceptTag)
	}
	if len(scorer.lastReq.Columns) != 2 {
		t.Errorf("intel columns count = %d, want 2", len(scorer.lastReq.Columns))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGenerateMappings_QualityGateNotApproved(t *testing.T) {
	h, mock := newTestHandlerWithIntel(t, nil)
	now := time.Now().UTC()

	// Engagement exists but quality_baseline_approved_at is NULL.
	mock.ExpectQuery("SELECT .+ FROM migration.engagement").
		WithArgs("eng-001").
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			"eng-001", "tenant-1", "LegacyPAS", "1.0",
			"PROFILING", nil, nil, now, now,
		))

	body, _ := json.Marshal(GenerateMappingsRequest{
		Tables: []GenerateMappingsTable{
			{SourceTable: "T", ConceptTag: "employee-master", Columns: []GenerateMappingsColumn{{Name: "X", DataType: "INT"}}},
		},
	})

	w := serveMux(h, "POST", "/api/v1/migration/engagements/eng-001/generate-mappings", body)

	if w.Code != http.StatusConflict {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusConflict, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	errObj, ok := resp["error"].(map[string]any)
	if !ok {
		t.Fatal("response missing error field")
	}
	if errObj["code"] != "QUALITY_GATE_FAILED" {
		t.Errorf("error code = %v, want QUALITY_GATE_FAILED", errObj["code"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGenerateMappings_EngagementNotFound(t *testing.T) {
	h, mock := newTestHandlerWithIntel(t, nil)

	mock.ExpectQuery("SELECT .+ FROM migration.engagement").
		WithArgs("eng-999").
		WillReturnRows(sqlmock.NewRows(engagementCols))

	body, _ := json.Marshal(GenerateMappingsRequest{
		Tables: []GenerateMappingsTable{
			{SourceTable: "T", ConceptTag: "employee-master", Columns: []GenerateMappingsColumn{{Name: "X", DataType: "INT"}}},
		},
	})

	w := serveMux(h, "POST", "/api/v1/migration/engagements/eng-999/generate-mappings", body)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestGenerateMappings_UnknownConceptTag(t *testing.T) {
	h, mock := newTestHandlerWithIntel(t, nil)
	now := time.Now().UTC()
	approvedAt := now.Add(-time.Hour)

	mock.ExpectQuery("SELECT .+ FROM migration.engagement").
		WithArgs("eng-001").
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			"eng-001", "tenant-1", "LegacyPAS", "1.0",
			"MAPPING", &approvedAt, nil, now, now,
		))

	// Transaction begins before table loop; rolled back on error.
	mock.ExpectBegin()
	mock.ExpectRollback()

	body, _ := json.Marshal(GenerateMappingsRequest{
		Tables: []GenerateMappingsTable{
			{SourceTable: "T", ConceptTag: "nonexistent-tag", Columns: []GenerateMappingsColumn{{Name: "X", DataType: "INT"}}},
		},
	})

	w := serveMux(h, "POST", "/api/v1/migration/engagements/eng-001/generate-mappings", body)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusBadRequest, w.Body.String())
	}
}

func TestGenerateMappings_NoIntelClient(t *testing.T) {
	// When IntelClient is nil, handler should still work with template-only matching.
	h, mock := newTestHandlerWithIntel(t, nil)
	now := time.Now().UTC()
	approvedAt := now.Add(-time.Hour)

	mock.ExpectQuery("SELECT .+ FROM migration.engagement").
		WithArgs("eng-001").
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			"eng-001", "tenant-1", "LegacyPAS", "1.0",
			"MAPPING", &approvedAt, nil, now, now,
		))

	// Transaction: BEGIN + INSERT + COMMIT
	mock.ExpectBegin()
	// MBR_NBR matches member_id via pattern → TEMPLATE_ONLY
	mock.ExpectExec("INSERT INTO migration.field_mapping").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	body, _ := json.Marshal(GenerateMappingsRequest{
		Tables: []GenerateMappingsTable{
			{
				SourceTable: "SRC",
				ConceptTag:  "employee-master",
				Columns:     []GenerateMappingsColumn{{Name: "MBR_NBR", DataType: "INTEGER", IsKey: true}},
			},
		},
	})

	w := serveMux(h, "POST", "/api/v1/migration/engagements/eng-001/generate-mappings", body)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]any)
	if data["template_only"].(float64) != 1 {
		t.Errorf("template_only = %v, want 1", data["template_only"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGenerateMappings_InvalidBody(t *testing.T) {
	h, mock := newTestHandlerWithIntel(t, nil)
	now := time.Now().UTC()
	approvedAt := now.Add(-time.Hour)

	mock.ExpectQuery("SELECT .+ FROM migration.engagement").
		WithArgs("eng-001").
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			"eng-001", "tenant-1", "LegacyPAS", "1.0",
			"MAPPING", &approvedAt, nil, now, now,
		))

	w := serveMux(h, "POST", "/api/v1/migration/engagements/eng-001/generate-mappings", []byte("{bad"))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ListMappings ---

func TestListMappings_Success(t *testing.T) {
	h, mock := newTestHandlerWithIntel(t, nil)

	tmplConf := 0.9
	sigConf := 0.85

	rows := sqlmock.NewRows(mappingCols).
		AddRow("map-001", "eng-001", "v1.0", "SRC_TABLE", "MBR_NBR",
			"member", "member_id", &tmplConf, &sigConf,
			"AGREED", "PROPOSED", nil, nil).
		AddRow("map-002", "eng-001", "v1.0", "SRC_TABLE", "BIRTH_DT",
			"member", "birth_date", &tmplConf, &sigConf,
			"AGREED", "APPROVED", stringPtr("analyst@example.com"), timePtr(time.Now().UTC()))

	mock.ExpectQuery("SELECT .+ FROM migration.field_mapping").
		WithArgs("eng-001").
		WillReturnRows(rows)

	w := serveMux(h, "GET", "/api/v1/migration/engagements/eng-001/mappings", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
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

func TestListMappings_WithStatusFilter(t *testing.T) {
	h, mock := newTestHandlerWithIntel(t, nil)

	tmplConf := 0.9
	rows := sqlmock.NewRows(mappingCols).
		AddRow("map-001", "eng-001", "v1.0", "SRC", "COL1",
			"member", "member_id", &tmplConf, nil,
			"AGREED", "PROPOSED", nil, nil)

	mock.ExpectQuery("SELECT .+ FROM migration.field_mapping .+ agreement_status").
		WithArgs("eng-001", "AGREED").
		WillReturnRows(rows)

	w := serveMux(h, "GET", "/api/v1/migration/engagements/eng-001/mappings?status=AGREED", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListMappings_WithApprovalFilter(t *testing.T) {
	h, mock := newTestHandlerWithIntel(t, nil)

	rows := sqlmock.NewRows(mappingCols)

	mock.ExpectQuery("SELECT .+ FROM migration.field_mapping .+ approval_status").
		WithArgs("eng-001", "PROPOSED").
		WillReturnRows(rows)

	w := serveMux(h, "GET", "/api/v1/migration/engagements/eng-001/mappings?approval=PROPOSED", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- UpdateMapping ---

func TestUpdateMapping_Approve(t *testing.T) {
	h, mock := newTestHandlerWithIntel(t, nil)

	tmplConf := 0.9
	sigConf := 0.85
	approvedBy := "analyst@example.com"

	mock.ExpectQuery("UPDATE migration.field_mapping").
		WithArgs("APPROVED", &approvedBy, sqlmock.AnyArg(), "map-001", "eng-001").
		WillReturnRows(sqlmock.NewRows(mappingCols).AddRow(
			"map-001", "eng-001", "v1.0", "SRC", "MBR_NBR",
			"member", "member_id", &tmplConf, &sigConf,
			"AGREED", "APPROVED", &approvedBy, timePtr(time.Now().UTC()),
		))

	body, _ := json.Marshal(UpdateMappingRequest{
		ApprovalStatus: "APPROVED",
		ApprovedBy:     "analyst@example.com",
	})

	w := serveMux(h, "PUT", "/api/v1/migration/engagements/eng-001/mappings/map-001", body)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]any)
	if data["approval_status"] != "APPROVED" {
		t.Errorf("approval_status = %v, want APPROVED", data["approval_status"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateMapping_Reject(t *testing.T) {
	h, mock := newTestHandlerWithIntel(t, nil)

	tmplConf := 0.9

	// Rejections now also record who rejected and when (audit trail).
	rejectedBy := ""
	mock.ExpectQuery("UPDATE migration.field_mapping").
		WithArgs("REJECTED", &rejectedBy, sqlmock.AnyArg(), "map-001", "eng-001").
		WillReturnRows(sqlmock.NewRows(mappingCols).AddRow(
			"map-001", "eng-001", "v1.0", "SRC", "MBR_NBR",
			"member", "member_id", &tmplConf, nil,
			"TEMPLATE_ONLY", "REJECTED", &rejectedBy, timePtr(time.Now().UTC()),
		))

	body, _ := json.Marshal(UpdateMappingRequest{
		ApprovalStatus: "REJECTED",
	})

	w := serveMux(h, "PUT", "/api/v1/migration/engagements/eng-001/mappings/map-001", body)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateMapping_InvalidStatus(t *testing.T) {
	h, _ := newTestHandlerWithIntel(t, nil)

	body, _ := json.Marshal(UpdateMappingRequest{
		ApprovalStatus: "INVALID",
	})

	w := serveMux(h, "PUT", "/api/v1/migration/engagements/eng-001/mappings/map-001", body)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusBadRequest, w.Body.String())
	}
}

func TestUpdateMapping_NotFound(t *testing.T) {
	h, mock := newTestHandlerWithIntel(t, nil)

	mock.ExpectQuery("UPDATE migration.field_mapping").
		WithArgs("APPROVED", sqlmock.AnyArg(), sqlmock.AnyArg(), "map-999", "eng-001").
		WillReturnRows(sqlmock.NewRows(mappingCols))

	body, _ := json.Marshal(UpdateMappingRequest{
		ApprovalStatus: "APPROVED",
		ApprovedBy:     "analyst@example.com",
	})

	w := serveMux(h, "PUT", "/api/v1/migration/engagements/eng-001/mappings/map-999", body)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusNotFound, w.Body.String())
	}
}

// --- helpers ---

func stringPtr(s string) *string     { return &s }
func timePtr(t time.Time) *time.Time { return &t }
