package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/noui/platform/casemanagement/domain"
	"github.com/noui/platform/casemanagement/models"
)

// --- ListEmployerCases ---

func TestListEmployerCases_MissingOrgID(t *testing.T) {
	h, _ := newTestHandler(t)
	req := httptest.NewRequest("GET", "/api/v1/employer//cases", nil)
	w := httptest.NewRecorder()
	h.ListEmployerCases(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("ListEmployerCases(no org) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestListEmployerCases_InvalidUUID(t *testing.T) {
	h, _ := newTestHandler(t)
	w := serve(h, "GET", "/api/v1/employer/not-a-uuid/cases", nil)

	if w.Code != http.StatusBadRequest {
		t.Errorf("ListEmployerCases(bad uuid) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertCMErrorCode(t, w, "INVALID_ORG_ID")
}

// --- GetEmployerCaseSummary ---

func TestGetEmployerCaseSummary_MissingOrgID(t *testing.T) {
	h, _ := newTestHandler(t)
	req := httptest.NewRequest("GET", "/api/v1/employer//cases/summary", nil)
	w := httptest.NewRecorder()
	h.GetEmployerCaseSummary(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("GetEmployerCaseSummary(no org) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestGetEmployerCaseSummary_InvalidUUID(t *testing.T) {
	h, _ := newTestHandler(t)
	w := serve(h, "GET", "/api/v1/employer/bad-id/cases/summary", nil)

	if w.Code != http.StatusBadRequest {
		t.Errorf("GetEmployerCaseSummary(bad uuid) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertCMErrorCode(t, w, "INVALID_ORG_ID")
}

// --- CreateEmployerCase ---

func TestCreateEmployerCase_EmptyBody(t *testing.T) {
	h, _ := newTestHandler(t)
	w := serve(h, "POST", "/api/v1/employer/cases", nil)

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateEmployerCase(empty) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateEmployerCase_MissingFields(t *testing.T) {
	h, _ := newTestHandler(t)
	body := `{"employerOrgId":"550e8400-e29b-41d4-a716-446655440000"}`
	w := serve(h, "POST", "/api/v1/employer/cases", []byte(body))

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateEmployerCase(missing fields) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertCMErrorCode(t, w, "INVALID_REQUEST")
}

func TestCreateEmployerCase_InvalidTriggerType(t *testing.T) {
	h, _ := newTestHandler(t)
	body := `{
		"employerOrgId":"550e8400-e29b-41d4-a716-446655440000",
		"triggerType":"INVALID_TYPE",
		"triggerReferenceId":"ref-001",
		"memberId":10001
	}`
	w := serve(h, "POST", "/api/v1/employer/cases", []byte(body))

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateEmployerCase(bad trigger) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertCMErrorCode(t, w, "INVALID_REQUEST")
}

func TestCreateEmployerCase_InvalidOrgUUID(t *testing.T) {
	h, _ := newTestHandler(t)
	body := `{
		"employerOrgId":"not-a-uuid",
		"triggerType":"ENROLLMENT_SUBMITTED",
		"triggerReferenceId":"ref-001",
		"memberId":10001
	}`
	w := serve(h, "POST", "/api/v1/employer/cases", []byte(body))

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateEmployerCase(bad uuid) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertCMErrorCode(t, w, "INVALID_REQUEST")
}

func TestCreateEmployerCase_InvalidPriority(t *testing.T) {
	h, _ := newTestHandler(t)
	body := `{
		"employerOrgId":"550e8400-e29b-41d4-a716-446655440000",
		"triggerType":"ENROLLMENT_SUBMITTED",
		"triggerReferenceId":"ref-001",
		"memberId":10001,
		"priority":"invalid"
	}`
	w := serve(h, "POST", "/api/v1/employer/cases", []byte(body))

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateEmployerCase(bad priority) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertCMErrorCode(t, w, "INVALID_REQUEST")
}

// --- parsePathSegment ---

func TestParsePathSegment_Employer_Found(t *testing.T) {
	got := parsePathSegment("/api/v1/employer/abc-123/cases/summary", "employer")
	if got != "abc-123" {
		t.Errorf("parsePathSegment = %q, want %q", got, "abc-123")
	}
}

func TestParsePathSegment_Employer_NotFound(t *testing.T) {
	got := parsePathSegment("/api/v1/cases/123", "employer")
	if got != "" {
		t.Errorf("parsePathSegment(not found) = %q, want empty", got)
	}
}

func TestParsePathSegment_Employer_AtEnd(t *testing.T) {
	got := parsePathSegment("/api/v1/employer", "employer")
	if got != "" {
		t.Errorf("parsePathSegment(at end) = %q, want empty", got)
	}
}

// --- Trigger Configs ---

func TestTriggerConfigsContainAllTypes(t *testing.T) {
	for _, triggerType := range models.EmployerTriggerTypes {
		cfg, ok := domain.GetTriggerConfig(triggerType)
		if !ok {
			t.Errorf("missing trigger config for %q", triggerType)
			continue
		}
		if cfg.CaseType == "" {
			t.Errorf("trigger %q has empty CaseType", triggerType)
		}
		if cfg.SLADays <= 0 {
			t.Errorf("trigger %q has SLADays = %d, want > 0", triggerType, cfg.SLADays)
		}
	}
}

func TestTriggerConfig_UnknownType(t *testing.T) {
	_, ok := domain.GetTriggerConfig("NONEXISTENT")
	if ok {
		t.Error("GetTriggerConfig(NONEXISTENT) should return false")
	}
}

// --- EmployerCaseSummary serialization ---

func TestEmployerCaseSummaryJSON(t *testing.T) {
	summary := models.EmployerCaseSummary{
		OrgID:          "550e8400-e29b-41d4-a716-446655440000",
		TotalCases:     10,
		ActiveCases:    6,
		CompletedCases: 3,
		AtRiskCases:    1,
	}

	data, err := json.Marshal(summary)
	if err != nil {
		t.Fatalf("Marshal EmployerCaseSummary: %v", err)
	}

	var decoded models.EmployerCaseSummary
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal EmployerCaseSummary: %v", err)
	}
	if decoded.OrgID != summary.OrgID {
		t.Errorf("OrgID = %q, want %q", decoded.OrgID, summary.OrgID)
	}
	if decoded.TotalCases != 10 {
		t.Errorf("TotalCases = %d, want 10", decoded.TotalCases)
	}
	if decoded.ActiveCases != 6 {
		t.Errorf("ActiveCases = %d, want 6", decoded.ActiveCases)
	}
}

// --- CreateEmployerCaseRequest serialization ---

func TestCreateEmployerCaseRequestJSON(t *testing.T) {
	body := `{
		"employerOrgId":"550e8400-e29b-41d4-a716-446655440000",
		"triggerType":"TERMINATION_CERTIFIED",
		"triggerReferenceId":"term-ref-001",
		"memberId":10001,
		"priority":"high"
	}`

	var req models.CreateEmployerCaseRequest
	if err := json.Unmarshal([]byte(body), &req); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if req.EmployerOrgID != "550e8400-e29b-41d4-a716-446655440000" {
		t.Errorf("EmployerOrgID = %q, want UUID", req.EmployerOrgID)
	}
	if req.TriggerType != "TERMINATION_CERTIFIED" {
		t.Errorf("TriggerType = %q, want TERMINATION_CERTIFIED", req.TriggerType)
	}
	if req.MemberID != 10001 {
		t.Errorf("MemberID = %d, want 10001", req.MemberID)
	}
}

// --- EmployerTriggerTypes ---

func TestEmployerTriggerTypesContainsExpected(t *testing.T) {
	expected := []string{
		"ENROLLMENT_SUBMITTED",
		"TERMINATION_CERTIFIED",
		"CONTRIBUTION_EXCEPTION",
		"WARET_DESIGNATION",
		"SCP_APPLICATION",
	}
	if len(models.EmployerTriggerTypes) != len(expected) {
		t.Fatalf("EmployerTriggerTypes has %d entries, want %d", len(models.EmployerTriggerTypes), len(expected))
	}
	for i, tt := range expected {
		if models.EmployerTriggerTypes[i] != tt {
			t.Errorf("EmployerTriggerTypes[%d] = %q, want %q", i, models.EmployerTriggerTypes[i], tt)
		}
	}
}

// --- helpers ---

func assertCMErrorCode(t *testing.T, w *httptest.ResponseRecorder, expectedCode string) {
	t.Helper()
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response body parse error: %v (body: %s)", err, w.Body.String())
	}
	errObj, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatalf("response missing 'error' field (body: %s)", w.Body.String())
	}
	if errObj["code"] != expectedCode {
		t.Errorf("error.code = %q, want %q", errObj["code"], expectedCode)
	}
}

// Silence unused import warning — strings is used in employer_handlers.go
var _ = strings.Split
