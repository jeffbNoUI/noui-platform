package api

import (
	"encoding/json"
	"net/http"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

// codeMappingCols matches the 8-column SELECT used by code mapping queries.
var codeMappingCols = []string{
	"code_mapping_id", "engagement_id", "source_table", "source_column",
	"source_value", "canonical_value", "approved_by", "approved_at",
}

func TestListCodeMappings_Success(t *testing.T) {
	h, mock := newTestHandler(t)

	approvedBy := "analyst@example.com"
	approvedAt := "2026-03-21T10:00:00Z"

	mock.ExpectQuery("SELECT .+ FROM migration.code_mapping").
		WithArgs("eng-001").
		WillReturnRows(sqlmock.NewRows(codeMappingCols).
			AddRow("cm-001", "eng-001", "MEMBERS", "STATUS_CD", "A", "ACTIVE", &approvedBy, &approvedAt).
			AddRow("cm-002", "eng-001", "MEMBERS", "STATUS_CD", "R", "RETIRED", nil, nil))

	w := serveMux(h, "GET", "/api/v1/migration/engagements/eng-001/code-mappings", nil)

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
	mappings, ok := data["mappings"].([]any)
	if !ok {
		t.Fatal("response missing mappings array")
	}
	if len(mappings) != 2 {
		t.Errorf("len(mappings) = %d, want 2", len(mappings))
	}

	// Verify first mapping values.
	first := mappings[0].(map[string]any)
	if first["source_value"] != "A" {
		t.Errorf("source_value = %v, want A", first["source_value"])
	}
	if first["canonical_value"] != "ACTIVE" {
		t.Errorf("canonical_value = %v, want ACTIVE", first["canonical_value"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListCodeMappings_Empty(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT .+ FROM migration.code_mapping").
		WithArgs("eng-001").
		WillReturnRows(sqlmock.NewRows(codeMappingCols))

	w := serveMux(h, "GET", "/api/v1/migration/engagements/eng-001/code-mappings", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]any)
	mappings := data["mappings"].([]any)
	if len(mappings) != 0 {
		t.Errorf("len(mappings) = %d, want 0", len(mappings))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateCodeMapping_Success(t *testing.T) {
	h, mock := newTestHandler(t)

	approvedBy := "analyst@example.com"
	approvedAt := "2026-03-21T10:00:00Z"

	mock.ExpectQuery("UPDATE migration.code_mapping").
		WithArgs("ACTIVE", "analyst@example.com", "cm-001", "eng-001").
		WillReturnRows(sqlmock.NewRows(codeMappingCols).
			AddRow("cm-001", "eng-001", "MEMBERS", "STATUS_CD", "A", "ACTIVE", &approvedBy, &approvedAt))

	body, _ := json.Marshal(UpdateCodeMappingRequest{
		CanonicalValue: "ACTIVE",
		ApprovedBy:     "analyst@example.com",
	})

	w := serveMux(h, "PUT", "/api/v1/migration/engagements/eng-001/code-mappings/cm-001", body)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]any)
	if data["canonical_value"] != "ACTIVE" {
		t.Errorf("canonical_value = %v, want ACTIVE", data["canonical_value"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateCodeMapping_NotFound(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("UPDATE migration.code_mapping").
		WithArgs("ACTIVE", "analyst@example.com", "cm-999", "eng-001").
		WillReturnRows(sqlmock.NewRows(codeMappingCols))

	body, _ := json.Marshal(UpdateCodeMappingRequest{
		CanonicalValue: "ACTIVE",
		ApprovedBy:     "analyst@example.com",
	})

	w := serveMux(h, "PUT", "/api/v1/migration/engagements/eng-001/code-mappings/cm-999", body)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusNotFound, w.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateCodeMapping_MissingCanonicalValue(t *testing.T) {
	h, _ := newTestHandler(t)

	body, _ := json.Marshal(UpdateCodeMappingRequest{
		CanonicalValue: "",
		ApprovedBy:     "analyst@example.com",
	})

	w := serveMux(h, "PUT", "/api/v1/migration/engagements/eng-001/code-mappings/cm-001", body)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusBadRequest, w.Body.String())
	}
}

func TestUpdateCodeMapping_InvalidBody(t *testing.T) {
	h, _ := newTestHandler(t)

	w := serveMux(h, "PUT", "/api/v1/migration/engagements/eng-001/code-mappings/cm-001", []byte("{bad"))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusBadRequest, w.Body.String())
	}
}
