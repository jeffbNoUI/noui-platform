package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/noui/platform/casemanagement/models"
)

// --- HealthCheck ---

func TestHealthCheck(t *testing.T) {
	h := &Handler{} // no DB needed for health check
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
	if body["service"] != "casemanagement" {
		t.Errorf("HealthCheck service = %q, want %q", body["service"], "casemanagement")
	}
	if body["version"] != "0.1.0" {
		t.Errorf("HealthCheck version = %q, want %q", body["version"], "0.1.0")
	}
}

// --- Helper Functions ---

func TestTenantFromHeader_Default(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := tenantFromHeader(req)
	if got != defaultTenantID {
		t.Errorf("tenantFromHeader(no header) = %q, want %q", got, defaultTenantID)
	}
}

func TestTenantFromHeader_Custom(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Tenant-ID", "custom-tenant-789")
	got := tenantFromHeader(req)
	if got != "custom-tenant-789" {
		t.Errorf("tenantFromHeader(custom) = %q, want %q", got, "custom-tenant-789")
	}
}

func TestIntParam_Default(t *testing.T) {
	req := httptest.NewRequest("GET", "/?limit=", nil)
	got := intParam(req, "limit", 25)
	if got != 25 {
		t.Errorf("intParam(empty) = %d, want 25", got)
	}
}

func TestIntParam_Valid(t *testing.T) {
	req := httptest.NewRequest("GET", "/?limit=50", nil)
	got := intParam(req, "limit", 25)
	if got != 50 {
		t.Errorf("intParam(50) = %d, want 50", got)
	}
}

func TestIntParam_Invalid(t *testing.T) {
	req := httptest.NewRequest("GET", "/?limit=abc", nil)
	got := intParam(req, "limit", 25)
	if got != 25 {
		t.Errorf("intParam(abc) = %d, want 25 (default)", got)
	}
}

func TestIntParam_Missing(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := intParam(req, "offset", 0)
	if got != 0 {
		t.Errorf("intParam(missing) = %d, want 0", got)
	}
}

// --- Response Helpers ---

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
		t.Fatalf("writeJSON body parse error: %v", err)
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
		t.Fatalf("writeSuccess body parse error: %v", err)
	}
	if body["data"] == nil {
		t.Error("writeSuccess response missing 'data' field")
	}
	meta, ok := body["meta"].(map[string]interface{})
	if !ok {
		t.Fatal("writeSuccess response missing 'meta' field")
	}
	if meta["service"] != "casemanagement" {
		t.Errorf("meta.service = %q, want %q", meta["service"], "casemanagement")
	}
	if meta["requestId"] == nil || meta["requestId"] == "" {
		t.Error("meta.requestId should not be empty")
	}
	if meta["version"] != "v1" {
		t.Errorf("meta.version = %q, want %q", meta["version"], "v1")
	}
}

func TestWriteSuccess_Created(t *testing.T) {
	w := httptest.NewRecorder()
	writeSuccess(w, http.StatusCreated, map[string]string{"id": "RET-2026-0147"})

	if w.Code != http.StatusCreated {
		t.Errorf("writeSuccess(Created) status = %d, want %d", w.Code, http.StatusCreated)
	}
}

func TestWriteError(t *testing.T) {
	w := httptest.NewRecorder()
	writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "bad input")

	if w.Code != http.StatusBadRequest {
		t.Errorf("writeError status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("writeError body parse error: %v", err)
	}
	errObj, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatal("writeError response missing 'error' field")
	}
	if errObj["code"] != "INVALID_REQUEST" {
		t.Errorf("error.code = %q, want INVALID_REQUEST", errObj["code"])
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
	writePaginated(w, []string{"a", "b"}, 10, 2, 0)

	if w.Code != http.StatusOK {
		t.Errorf("writePaginated status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("writePaginated body parse error: %v", err)
	}
	pag, ok := body["pagination"].(map[string]interface{})
	if !ok {
		t.Fatal("writePaginated missing 'pagination' field")
	}
	if pag["total"] != float64(10) {
		t.Errorf("pagination.total = %v, want 10", pag["total"])
	}
	if pag["hasMore"] != true {
		t.Errorf("pagination.hasMore = %v, want true (offset 0 + limit 2 < total 10)", pag["hasMore"])
	}
	meta, ok := body["meta"].(map[string]interface{})
	if !ok {
		t.Fatal("writePaginated missing 'meta' field")
	}
	if meta["service"] != "casemanagement" {
		t.Errorf("meta.service = %q, want %q", meta["service"], "casemanagement")
	}
}

func TestWritePaginated_NoMore(t *testing.T) {
	w := httptest.NewRecorder()
	writePaginated(w, []string{"a"}, 1, 25, 0)

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	pag := body["pagination"].(map[string]interface{})
	if pag["hasMore"] != false {
		t.Errorf("pagination.hasMore = %v, want false (offset 0 + limit 25 >= total 1)", pag["hasMore"])
	}
}

func TestWritePaginated_ExactBoundary(t *testing.T) {
	w := httptest.NewRecorder()
	writePaginated(w, []string{"a", "b", "c"}, 3, 3, 0)

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	pag := body["pagination"].(map[string]interface{})
	if pag["hasMore"] != false {
		t.Errorf("pagination.hasMore = %v, want false (offset 0 + limit 3 == total 3)", pag["hasMore"])
	}
}

// --- DecodeJSON ---

func TestDecodeJSON_Valid(t *testing.T) {
	body := `{"transitionedBy":"Sarah Chen","note":"Eligibility confirmed"}`
	req := httptest.NewRequest("POST", "/", strings.NewReader(body))
	var ar models.AdvanceStageRequest
	if err := decodeJSON(req, &ar); err != nil {
		t.Fatalf("decodeJSON error: %v", err)
	}
	if ar.TransitionedBy != "Sarah Chen" {
		t.Errorf("TransitionedBy = %q, want %q", ar.TransitionedBy, "Sarah Chen")
	}
	if ar.Note != "Eligibility confirmed" {
		t.Errorf("Note = %q, want %q", ar.Note, "Eligibility confirmed")
	}
}

func TestDecodeJSON_NilBody(t *testing.T) {
	req := httptest.NewRequest("POST", "/", nil)
	req.Body = nil
	var ar models.AdvanceStageRequest
	if err := decodeJSON(req, &ar); err == nil {
		t.Error("decodeJSON(nil body) should return error")
	}
}

func TestDecodeJSON_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest("POST", "/", strings.NewReader("{not valid json"))
	var ar models.AdvanceStageRequest
	if err := decodeJSON(req, &ar); err == nil {
		t.Error("decodeJSON(invalid json) should return error")
	}
}

func TestDecodeJSON_CreateCaseRequest(t *testing.T) {
	body := `{"caseId":"RET-2026-0200","memberId":10001,"caseType":"RET","retirementDate":"2026-06-01","assignedTo":"Sarah Chen","flags":["leave-payout"]}`
	req := httptest.NewRequest("POST", "/", strings.NewReader(body))
	var cr models.CreateCaseRequest
	if err := decodeJSON(req, &cr); err != nil {
		t.Fatalf("decodeJSON error: %v", err)
	}
	if cr.CaseID != "RET-2026-0200" {
		t.Errorf("CaseID = %q, want RET-2026-0200", cr.CaseID)
	}
	if cr.MemberID != 10001 {
		t.Errorf("MemberID = %d, want 10001", cr.MemberID)
	}
	if len(cr.Flags) != 1 || cr.Flags[0] != "leave-payout" {
		t.Errorf("Flags = %v, want [leave-payout]", cr.Flags)
	}
}

// --- Model Serialization ---

func TestRetirementCaseJSON_RoundTrip(t *testing.T) {
	c := models.RetirementCase{
		CaseID:          "RET-2026-0147",
		TenantID:        defaultTenantID,
		MemberID:        10001,
		CaseType:        "RET",
		RetirementDate:  "2026-04-01",
		Priority:        "standard",
		SLAStatus:       "on-track",
		CurrentStage:    "Benefit Calculation",
		CurrentStageIdx: 4,
		AssignedTo:      "Sarah Chen",
		DaysOpen:        5,
		Status:          "active",
		Flags:           []string{"leave-payout"},
		Name:            "Robert Martinez",
		Tier:            1,
		Dept:            "Public Works",
	}

	data, err := json.Marshal(c)
	if err != nil {
		t.Fatalf("Marshal RetirementCase: %v", err)
	}

	var decoded models.RetirementCase
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal RetirementCase: %v", err)
	}

	if decoded.CaseID != "RET-2026-0147" {
		t.Errorf("CaseID = %q, want RET-2026-0147", decoded.CaseID)
	}
	if decoded.CurrentStageIdx != 4 {
		t.Errorf("CurrentStageIdx = %d, want 4", decoded.CurrentStageIdx)
	}
	if decoded.Name != "Robert Martinez" {
		t.Errorf("Name = %q, want Robert Martinez", decoded.Name)
	}
	if len(decoded.Flags) != 1 || decoded.Flags[0] != "leave-payout" {
		t.Errorf("Flags = %v, want [leave-payout]", decoded.Flags)
	}
}

func TestStageTransitionJSON_RoundTrip(t *testing.T) {
	fromIdx := 3
	fromStage := "Marital Share Calculation"
	st := models.StageTransition{
		ID:             1,
		CaseID:         "DRO-2026-0031",
		FromStageIdx:   &fromIdx,
		ToStageIdx:     4,
		FromStage:      &fromStage,
		ToStage:        "Benefit Calculation",
		TransitionedBy: "Sarah Chen",
		Note:           "DRO review complete",
	}

	data, err := json.Marshal(st)
	if err != nil {
		t.Fatalf("Marshal StageTransition: %v", err)
	}

	var decoded models.StageTransition
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal StageTransition: %v", err)
	}

	if decoded.CaseID != "DRO-2026-0031" {
		t.Errorf("CaseID = %q, want DRO-2026-0031", decoded.CaseID)
	}
	if decoded.FromStageIdx == nil || *decoded.FromStageIdx != 3 {
		t.Errorf("FromStageIdx = %v, want 3", decoded.FromStageIdx)
	}
	if decoded.ToStageIdx != 4 {
		t.Errorf("ToStageIdx = %d, want 4", decoded.ToStageIdx)
	}
	if decoded.Note != "DRO review complete" {
		t.Errorf("Note = %q, want %q", decoded.Note, "DRO review complete")
	}
}

func TestStageDefinitionJSON_RoundTrip(t *testing.T) {
	sd := models.StageDefinition{
		StageIdx:    0,
		StageName:   "Application Intake",
		Description: "Initial application received and logged",
		SortOrder:   0,
	}

	data, err := json.Marshal(sd)
	if err != nil {
		t.Fatalf("Marshal StageDefinition: %v", err)
	}

	var decoded models.StageDefinition
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal StageDefinition: %v", err)
	}

	if decoded.StageIdx != 0 {
		t.Errorf("StageIdx = %d, want 0", decoded.StageIdx)
	}
	if decoded.StageName != "Application Intake" {
		t.Errorf("StageName = %q, want Application Intake", decoded.StageName)
	}
}
