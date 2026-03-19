package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/noui/platform/correspondence/models"
)

// --- GenerateEmployer ---

func TestGenerateEmployer_MissingTemplateID(t *testing.T) {
	h := &Handler{}
	body := `{"orgId":"550e8400-e29b-41d4-a716-446655440000"}`
	req := httptest.NewRequest("POST", "/api/v1/correspondence/generate/employer", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.GenerateEmployer(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("GenerateEmployer(no template) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertCorrErrorCode(t, w, "INVALID_REQUEST")
}

func TestGenerateEmployer_MissingOrgID(t *testing.T) {
	h := &Handler{}
	body := `{"templateId":"tmpl-123"}`
	req := httptest.NewRequest("POST", "/api/v1/correspondence/generate/employer", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.GenerateEmployer(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("GenerateEmployer(no org) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertCorrErrorCode(t, w, "INVALID_REQUEST")
}

func TestGenerateEmployer_InvalidOrgUUID(t *testing.T) {
	h := &Handler{}
	body := `{"templateId":"tmpl-123","orgId":"not-a-uuid"}`
	req := httptest.NewRequest("POST", "/api/v1/correspondence/generate/employer", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.GenerateEmployer(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("GenerateEmployer(bad uuid) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertCorrErrorCode(t, w, "INVALID_REQUEST")
}

func TestGenerateEmployer_EmptyBody(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("POST", "/api/v1/correspondence/generate/employer", nil)
	w := httptest.NewRecorder()

	h.GenerateEmployer(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("GenerateEmployer(empty) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- EmployerMergeFields constant ---

func TestEmployerMergeFieldsContainsExpectedKeys(t *testing.T) {
	expected := []string{"org_name", "ein", "division_code", "division_name",
		"primary_contact_name", "primary_contact_email", "reporting_frequency"}
	if len(models.EmployerMergeFields) != len(expected) {
		t.Errorf("EmployerMergeFields has %d fields, want %d", len(models.EmployerMergeFields), len(expected))
	}
	for i, field := range expected {
		if models.EmployerMergeFields[i] != field {
			t.Errorf("EmployerMergeFields[%d] = %q, want %q", i, models.EmployerMergeFields[i], field)
		}
	}
}

// --- helpers ---

func assertCorrErrorCode(t *testing.T, w *httptest.ResponseRecorder, expectedCode string) {
	t.Helper()
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response body parse error: %v", err)
	}
	errObj, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatal("response missing 'error' field")
	}
	if errObj["code"] != expectedCode {
		t.Errorf("error.code = %q, want %q", errObj["code"], expectedCode)
	}
}
