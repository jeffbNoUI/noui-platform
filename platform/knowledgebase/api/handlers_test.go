package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/noui/platform/apiresponse"
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
	if body["service"] != "knowledgebase" {
		t.Errorf("HealthCheck service = %q, want %q", body["service"], "knowledgebase")
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

func TestTenantID_FallbackWithoutMiddleware(t *testing.T) {
	// Without auth middleware, tenantID falls back to default
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
	apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", map[string]string{"title": "Test Article"})

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
	if meta["service"] != "knowledgebase" {
		t.Errorf("meta.service = %q, want %q", meta["service"], "knowledgebase")
	}
	if meta["requestId"] == nil || meta["requestId"] == "" {
		t.Error("meta.requestId should not be empty")
	}
	if meta["version"] != "v1" {
		t.Errorf("meta.version = %q, want %q", meta["version"], "v1")
	}
}

func TestWriteError(t *testing.T) {
	w := httptest.NewRecorder()
	apiresponse.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST", "query required")

	if w.Code != http.StatusBadRequest {
		t.Errorf("WriteError status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("WriteError body parse error: %v", err)
	}
	errObj, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatal("WriteError response missing 'error' field")
	}
	if errObj["code"] != "INVALID_REQUEST" {
		t.Errorf("error.code = %q, want %q", errObj["code"], "INVALID_REQUEST")
	}
	if errObj["message"] != "query required" {
		t.Errorf("error.message = %q, want %q", errObj["message"], "query required")
	}
}

func TestWritePaginated(t *testing.T) {
	w := httptest.NewRecorder()
	apiresponse.WritePaginated(w, "knowledgebase", []string{"article1", "article2"}, 50, 25, 0)

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("WritePaginated body parse error: %v", err)
	}
	pag, ok := body["pagination"].(map[string]interface{})
	if !ok {
		t.Fatal("WritePaginated missing 'pagination' field")
	}
	if pag["total"] != float64(50) {
		t.Errorf("pagination.total = %v, want 50", pag["total"])
	}
	if pag["hasMore"] != true {
		t.Errorf("pagination.hasMore = %v, want true (25 < 50)", pag["hasMore"])
	}
	if pag["limit"] != float64(25) {
		t.Errorf("pagination.limit = %v, want 25", pag["limit"])
	}
}

// --- DecodeJSON ---

func TestDecodeJSON_NilBody(t *testing.T) {
	req := httptest.NewRequest("POST", "/", nil)
	req.Body = nil
	var data map[string]string
	if err := decodeJSON(req, &data); err == nil {
		t.Error("decodeJSON(nil body) should return error")
	}
}

// --- SearchArticles requires query param ---

func TestSearchArticles_MissingQuery(t *testing.T) {
	h := &Handler{} // store is nil, but we should fail before DB access
	req := httptest.NewRequest("GET", "/api/v1/kb/search", nil)
	w := httptest.NewRecorder()

	h.SearchArticles(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("SearchArticles(no q) status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	errObj, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatal("missing error object")
	}
	if errObj["code"] != "INVALID_REQUEST" {
		t.Errorf("error.code = %q, want INVALID_REQUEST", errObj["code"])
	}
}
