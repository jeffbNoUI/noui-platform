package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// --- EmployerMemberRoster ---

func TestEmployerMemberRoster_MissingOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/employer//members", nil)
	w := httptest.NewRecorder()

	h.EmployerMemberRoster(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("EmployerMemberRoster(empty orgId) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertErrorCode(t, w, "INVALID_ORG_ID")
}

func TestEmployerMemberRoster_InvalidOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/employer/not-a-uuid/members", nil)
	w := httptest.NewRecorder()

	h.EmployerMemberRoster(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("EmployerMemberRoster(bad uuid) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertErrorCode(t, w, "INVALID_ORG_ID")
}

// --- EmployerMemberSummary ---

func TestEmployerMemberSummary_MissingOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/employer//members/summary", nil)
	w := httptest.NewRecorder()

	h.EmployerMemberSummary(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("EmployerMemberSummary(empty orgId) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertErrorCode(t, w, "INVALID_ORG_ID")
}

func TestEmployerMemberSummary_InvalidOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/employer/bad-id/members/summary", nil)
	w := httptest.NewRecorder()

	h.EmployerMemberSummary(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("EmployerMemberSummary(bad uuid) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertErrorCode(t, w, "INVALID_ORG_ID")
}

// --- parsePathSegment ---

func TestParsePathSegment(t *testing.T) {
	tests := []struct {
		path string
		key  string
		want string
	}{
		{"/api/v1/employer/abc-123/members", "employer", "abc-123"},
		{"/api/v1/employer/abc-123/members/summary", "employer", "abc-123"},
		{"/api/v1/members/search", "employer", ""},
		{"/api/v1/employer", "employer", ""},
	}

	for _, tt := range tests {
		got := parsePathSegment(tt.path, tt.key)
		if got != tt.want {
			t.Errorf("parsePathSegment(%q, %q) = %q, want %q", tt.path, tt.key, got, tt.want)
		}
	}
}

// --- helpers ---

func assertErrorCode(t *testing.T, w *httptest.ResponseRecorder, expectedCode string) {
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
