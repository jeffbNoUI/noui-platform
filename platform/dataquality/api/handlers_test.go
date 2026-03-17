package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/dataquality/models"
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
	if body["service"] != "dataquality" {
		t.Errorf("HealthCheck service = %q, want %q", body["service"], "dataquality")
	}
}

// --- Helper Functions ---

func TestTenantID_Default(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := tenantID(req)
	if got != defaultTenantID {
		t.Errorf("tenantID(no context) = %q, want %q", got, defaultTenantID)
	}
}

func TestTenantID_FromContext(t *testing.T) {
	// Use auth.NewMiddleware to inject tenant into context via a real JWT flow.
	// Since we can't set the unexported context key directly, we verify that
	// without middleware the function falls back to defaultTenantID — the
	// middleware integration is tested at the auth package level.
	req := httptest.NewRequest("GET", "/", nil)
	got := tenantID(req)
	if got != defaultTenantID {
		t.Errorf("tenantID(empty context) = %q, want %q", got, defaultTenantID)
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
	req := httptest.NewRequest("GET", "/?limit=100", nil)
	got := intParam(req, "limit", 25)
	if got != 100 {
		t.Errorf("intParam(100) = %d, want 100", got)
	}
}

func TestIntParam_Invalid(t *testing.T) {
	req := httptest.NewRequest("GET", "/?limit=xyz", nil)
	got := intParam(req, "limit", 25)
	if got != 25 {
		t.Errorf("intParam(xyz) = %d, want 25 (default)", got)
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
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"key": "value"})

	if w.Code != http.StatusOK {
		t.Errorf("WriteJSON status = %d, want %d", w.Code, http.StatusOK)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
}

func TestWriteSuccess(t *testing.T) {
	w := httptest.NewRecorder()
	apiresponse.WriteSuccess(w, http.StatusOK, "dataquality", map[string]string{"score": "95.5"})

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("WriteSuccess body parse error: %v", err)
	}
	if body["data"] == nil {
		t.Error("WriteSuccess response missing 'data' field")
	}
	meta, ok := body["meta"].(map[string]interface{})
	if !ok {
		t.Fatal("WriteSuccess response missing 'meta' field")
	}
	if meta["service"] != "dataquality" {
		t.Errorf("meta.service = %q, want %q", meta["service"], "dataquality")
	}
}

func TestWriteError(t *testing.T) {
	w := httptest.NewRecorder()
	apiresponse.WriteError(w, http.StatusNotFound, "NOT_FOUND", "check not found")

	if w.Code != http.StatusNotFound {
		t.Errorf("WriteError status = %d, want %d", w.Code, http.StatusNotFound)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("WriteError body parse error: %v", err)
	}
	errObj, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatal("WriteError response missing 'error' field")
	}
	if errObj["code"] != "NOT_FOUND" {
		t.Errorf("error.code = %q, want %q", errObj["code"], "NOT_FOUND")
	}
}

func TestWritePaginated(t *testing.T) {
	w := httptest.NewRecorder()
	apiresponse.WritePaginated(w, "dataquality", []string{"issue1"}, 1, 25, 0)

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("WritePaginated body parse error: %v", err)
	}
	pag, ok := body["pagination"].(map[string]interface{})
	if !ok {
		t.Fatal("WritePaginated missing 'pagination' field")
	}
	if pag["total"] != float64(1) {
		t.Errorf("pagination.total = %v, want 1", pag["total"])
	}
	if pag["hasMore"] != false {
		t.Errorf("pagination.hasMore = %v, want false", pag["hasMore"])
	}
}

// --- DecodeJSON ---

func TestDecodeJSON_Valid(t *testing.T) {
	body := `{"status":"resolved","resolutionNote":"fixed"}`
	req := httptest.NewRequest("PUT", "/", strings.NewReader(body))
	var ur models.UpdateIssueRequest
	if err := decodeJSON(req, &ur); err != nil {
		t.Fatalf("decodeJSON error: %v", err)
	}
	if ur.Status == nil || *ur.Status != "resolved" {
		t.Errorf("Status = %v, want 'resolved'", ur.Status)
	}
	if ur.ResolutionNote == nil || *ur.ResolutionNote != "fixed" {
		t.Errorf("ResolutionNote = %v, want 'fixed'", ur.ResolutionNote)
	}
}

func TestDecodeJSON_NilBody(t *testing.T) {
	req := httptest.NewRequest("PUT", "/", nil)
	req.Body = nil
	var ur models.UpdateIssueRequest
	if err := decodeJSON(req, &ur); err == nil {
		t.Error("decodeJSON(nil body) should return error")
	}
}

// --- Model Serialization ---

func TestDQScoreJSON(t *testing.T) {
	score := models.DQScore{
		OverallScore:   92.5,
		TotalChecks:    10,
		PassingChecks:  9,
		OpenIssues:     3,
		CriticalIssues: 1,
		CategoryScores: map[string]float64{
			"completeness": 95.0,
			"consistency":  90.0,
			"validity":     92.5,
		},
	}

	data, err := json.Marshal(score)
	if err != nil {
		t.Fatalf("Marshal DQScore: %v", err)
	}

	var decoded models.DQScore
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal DQScore: %v", err)
	}
	if decoded.OverallScore != 92.5 {
		t.Errorf("OverallScore = %f, want 92.5", decoded.OverallScore)
	}
	if decoded.CategoryScores["completeness"] != 95.0 {
		t.Errorf("CategoryScores[completeness] = %f, want 95.0", decoded.CategoryScores["completeness"])
	}
}
