package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// --- HealthCheck ---

func TestHealthCheck(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()

	h.HealthCheck(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("HealthCheck status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("HealthCheck body parse error: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("HealthCheck status = %q, want %q", body["status"], "ok")
	}
	if body["service"] != "employer-enrollment" {
		t.Errorf("HealthCheck service = %q, want %q", body["service"], "employer-enrollment")
	}
	if body["version"] != "0.1.0" {
		t.Errorf("HealthCheck version = %q, want %q", body["version"], "0.1.0")
	}
}

// --- CreateSubmission: invalid JSON ---

func TestCreateSubmission_InvalidJSON(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("POST", "/api/v1/enrollment/submissions",
		strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.CreateSubmission(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("CreateSubmission status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- CreateSubmission: missing mandatory fields ---

func TestCreateSubmission_MissingFields(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("POST", "/api/v1/enrollment/submissions",
		strings.NewReader(`{"enrollmentType":"EMPLOYER_INITIATED"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.CreateSubmission(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("CreateSubmission status = %d, want %d", w.Code, http.StatusUnprocessableEntity)
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	if body["error"] != "VALIDATION_FAILED" {
		t.Errorf("error = %v, want VALIDATION_FAILED", body["error"])
	}
	errs, ok := body["validationErrors"].([]interface{})
	if !ok || len(errs) == 0 {
		t.Error("expected validationErrors array with entries")
	}
}

// --- CreateSubmission: invalid enrollment type ---

func TestCreateSubmission_InvalidEnrollmentType(t *testing.T) {
	h := &Handler{}
	body := `{
		"enrollmentType": "INVALID",
		"ssnHash": "abc123",
		"firstName": "Jane",
		"lastName": "Doe",
		"dateOfBirth": "1985-03-15",
		"hireDate": "2020-06-01",
		"planCode": "DB",
		"divisionCode": "SD"
	}`
	req := httptest.NewRequest("POST", "/api/v1/enrollment/submissions",
		strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.CreateSubmission(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("CreateSubmission status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ListSubmissions: missing org_id ---

func TestListSubmissions_MissingOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/enrollment/submissions", nil)
	w := httptest.NewRecorder()

	h.ListSubmissions(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ListSubmissions status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ListPendingDuplicates: missing org_id ---

func TestListPendingDuplicates_MissingOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/enrollment/duplicates", nil)
	w := httptest.NewRecorder()

	h.ListPendingDuplicates(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ListPendingDuplicates status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ResolveDuplicate: invalid resolution ---

func TestResolveDuplicate_InvalidResolution(t *testing.T) {
	h := &Handler{}
	body := `{"resolution": "INVALID", "note": "test"}`
	req := httptest.NewRequest("PUT", "/api/v1/enrollment/duplicates/some-id/resolve",
		strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ResolveDuplicate(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ResolveDuplicate status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ResolveDuplicate: invalid JSON ---

func TestResolveDuplicate_InvalidJSON(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("PUT", "/api/v1/enrollment/duplicates/some-id/resolve",
		strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ResolveDuplicate(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ResolveDuplicate status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ListPERAChoicePending: missing org_id ---

func TestListPERAChoicePending_MissingOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/enrollment/perachoice", nil)
	w := httptest.NewRecorder()

	h.ListPERAChoicePending(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ListPERAChoicePending status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ElectPERAChoice: invalid plan ---

func TestElectPERAChoice_InvalidPlan(t *testing.T) {
	h := &Handler{}
	body := `{"plan": "INVALID"}`
	req := httptest.NewRequest("PUT", "/api/v1/enrollment/perachoice/some-id/elect",
		strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ElectPERAChoice(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ElectPERAChoice status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ElectPERAChoice: invalid JSON ---

func TestElectPERAChoice_InvalidJSON(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("PUT", "/api/v1/enrollment/perachoice/some-id/elect",
		strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ElectPERAChoice(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ElectPERAChoice status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- RejectSubmission: missing reason ---

func TestRejectSubmission_MissingReason(t *testing.T) {
	h := &Handler{}
	body := `{"reason": ""}`
	req := httptest.NewRequest("PUT", "/api/v1/enrollment/submissions/some-id/reject",
		strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.RejectSubmission(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("RejectSubmission status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- RejectSubmission: invalid JSON ---

func TestRejectSubmission_InvalidJSON(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("PUT", "/api/v1/enrollment/submissions/some-id/reject",
		strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.RejectSubmission(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("RejectSubmission status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- CreateSubmission: validation catches bad dates ---

func TestCreateSubmission_BadDateFormat(t *testing.T) {
	h := &Handler{}
	body := `{
		"enrollmentType": "EMPLOYER_INITIATED",
		"ssnHash": "abc123",
		"firstName": "Jane",
		"lastName": "Doe",
		"dateOfBirth": "03/15/1985",
		"hireDate": "June 1 2020",
		"planCode": "DB",
		"divisionCode": "SD"
	}`
	req := httptest.NewRequest("POST", "/api/v1/enrollment/submissions",
		strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.CreateSubmission(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("CreateSubmission status = %d, want %d", w.Code, http.StatusUnprocessableEntity)
	}
}

// --- CreateSubmission: invalid plan code rejected ---

func TestCreateSubmission_InvalidPlanCode(t *testing.T) {
	h := &Handler{}
	body := `{
		"enrollmentType": "EMPLOYER_INITIATED",
		"ssnHash": "abc123",
		"firstName": "Jane",
		"lastName": "Doe",
		"dateOfBirth": "1985-03-15",
		"hireDate": "2020-06-01",
		"planCode": "INVALID",
		"divisionCode": "SD"
	}`
	req := httptest.NewRequest("POST", "/api/v1/enrollment/submissions",
		strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.CreateSubmission(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("CreateSubmission status = %d, want %d", w.Code, http.StatusUnprocessableEntity)
	}
}

// --- CreateSubmission: invalid division code rejected ---

func TestCreateSubmission_InvalidDivisionCode(t *testing.T) {
	h := &Handler{}
	body := `{
		"enrollmentType": "EMPLOYER_INITIATED",
		"ssnHash": "abc123",
		"firstName": "Jane",
		"lastName": "Doe",
		"dateOfBirth": "1985-03-15",
		"hireDate": "2020-06-01",
		"planCode": "DB",
		"divisionCode": "INVALID"
	}`
	req := httptest.NewRequest("POST", "/api/v1/enrollment/submissions",
		strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.CreateSubmission(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("CreateSubmission status = %d, want %d", w.Code, http.StatusUnprocessableEntity)
	}
}
