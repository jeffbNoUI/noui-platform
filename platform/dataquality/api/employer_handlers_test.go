package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/noui/platform/dataquality/models"
)

// --- GetEmployerScore ---

func TestGetEmployerScore_MissingOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/dq/employer//score", nil)
	w := httptest.NewRecorder()

	h.GetEmployerScore(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("GetEmployerScore(no org) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertDQErrorCode(t, w, "INVALID_ORG_ID")
}

func TestGetEmployerScore_InvalidUUID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/dq/employer/not-a-uuid/score", nil)
	req.SetPathValue("orgId", "not-a-uuid")
	w := httptest.NewRecorder()

	h.GetEmployerScore(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("GetEmployerScore(bad uuid) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertDQErrorCode(t, w, "INVALID_ORG_ID")
}

// --- ListEmployerIssues ---

func TestListEmployerIssues_MissingOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/dq/employer//issues", nil)
	w := httptest.NewRecorder()

	h.ListEmployerIssues(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("ListEmployerIssues(no org) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertDQErrorCode(t, w, "INVALID_ORG_ID")
}

func TestListEmployerIssues_InvalidUUID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/dq/employer/bad-id/issues", nil)
	req.SetPathValue("orgId", "bad-id")
	w := httptest.NewRecorder()

	h.ListEmployerIssues(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("ListEmployerIssues(bad uuid) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertDQErrorCode(t, w, "INVALID_ORG_ID")
}

// --- ListEmployerChecks ---

func TestListEmployerChecks_MissingOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/dq/employer//checks", nil)
	w := httptest.NewRecorder()

	h.ListEmployerChecks(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("ListEmployerChecks(no org) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertDQErrorCode(t, w, "INVALID_ORG_ID")
}

func TestListEmployerChecks_InvalidUUID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/dq/employer/xyz/checks", nil)
	req.SetPathValue("orgId", "xyz")
	w := httptest.NewRecorder()

	h.ListEmployerChecks(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("ListEmployerChecks(bad uuid) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertDQErrorCode(t, w, "INVALID_ORG_ID")
}

// --- parsePathSegment ---

func TestParsePathSegment_Found(t *testing.T) {
	got := parsePathSegment("/api/v1/dq/employer/abc-123/score", "employer")
	if got != "abc-123" {
		t.Errorf("parsePathSegment = %q, want %q", got, "abc-123")
	}
}

func TestParsePathSegment_NotFound(t *testing.T) {
	got := parsePathSegment("/api/v1/dq/checks", "employer")
	if got != "" {
		t.Errorf("parsePathSegment(not found) = %q, want empty", got)
	}
}

func TestParsePathSegment_KeyAtEnd(t *testing.T) {
	got := parsePathSegment("/api/v1/dq/employer", "employer")
	if got != "" {
		t.Errorf("parsePathSegment(key at end) = %q, want empty", got)
	}
}

// --- EmployerTargetTables ---

func TestEmployerTargetTablesContainsExpectedTables(t *testing.T) {
	expected := []string{
		"contribution_file", "contribution_record", "contribution_exception",
		"enrollment_submission", "termination_certification", "certification_hold",
	}
	if len(models.EmployerTargetTables) != len(expected) {
		t.Fatalf("EmployerTargetTables has %d entries, want %d", len(models.EmployerTargetTables), len(expected))
	}
	for i, table := range expected {
		if models.EmployerTargetTables[i] != table {
			t.Errorf("EmployerTargetTables[%d] = %q, want %q", i, models.EmployerTargetTables[i], table)
		}
	}
}

// --- EmployerDQSummary serialization ---

func TestEmployerDQSummaryJSON(t *testing.T) {
	summary := models.EmployerDQSummary{
		OrgID:          "550e8400-e29b-41d4-a716-446655440000",
		OverallScore:   87.5,
		TotalChecks:    8,
		PassingChecks:  7,
		OpenIssues:     3,
		CriticalIssues: 1,
	}

	data, err := json.Marshal(summary)
	if err != nil {
		t.Fatalf("Marshal EmployerDQSummary: %v", err)
	}

	var decoded models.EmployerDQSummary
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal EmployerDQSummary: %v", err)
	}
	if decoded.OrgID != summary.OrgID {
		t.Errorf("OrgID = %q, want %q", decoded.OrgID, summary.OrgID)
	}
	if decoded.OverallScore != 87.5 {
		t.Errorf("OverallScore = %f, want 87.5", decoded.OverallScore)
	}
	if decoded.TotalChecks != 8 {
		t.Errorf("TotalChecks = %d, want 8", decoded.TotalChecks)
	}
}

// --- helpers ---

func assertDQErrorCode(t *testing.T, w *httptest.ResponseRecorder, expectedCode string) {
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
