package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/noui/platform/correspondence/db"
	"github.com/noui/platform/correspondence/models"
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
	if body["service"] != "correspondence" {
		t.Errorf("HealthCheck service = %q, want %q", body["service"], "correspondence")
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
	req.Header.Set("X-Tenant-ID", "custom-tenant-123")
	got := tenantFromHeader(req)
	if got != "custom-tenant-123" {
		t.Errorf("tenantFromHeader(custom) = %q, want %q", got, "custom-tenant-123")
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
	got := intParam(req, "limit", 10)
	if got != 10 {
		t.Errorf("intParam(missing) = %d, want 10", got)
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
	if meta["service"] != "correspondence" {
		t.Errorf("meta.service = %q, want %q", meta["service"], "correspondence")
	}
	if meta["requestId"] == nil || meta["requestId"] == "" {
		t.Error("meta.requestId should not be empty")
	}
}

func TestWriteError(t *testing.T) {
	w := httptest.NewRecorder()
	writeError(w, http.StatusBadRequest, "INVALID", "bad input")

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
	if errObj["code"] != "INVALID" {
		t.Errorf("error.code = %q, want %q", errObj["code"], "INVALID")
	}
	if errObj["message"] != "bad input" {
		t.Errorf("error.message = %q, want %q", errObj["message"], "bad input")
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
		t.Errorf("pagination.hasMore = %v, want true", pag["hasMore"])
	}
}

// --- DecodeJSON ---

func TestDecodeJSON_Valid(t *testing.T) {
	body := `{"templateId":"tmpl-1","mergeData":{"name":"John"}}`
	req := httptest.NewRequest("POST", "/", strings.NewReader(body))
	var gr models.GenerateRequest
	if err := decodeJSON(req, &gr); err != nil {
		t.Fatalf("decodeJSON error: %v", err)
	}
	if gr.TemplateID != "tmpl-1" {
		t.Errorf("TemplateID = %q, want %q", gr.TemplateID, "tmpl-1")
	}
	if gr.MergeData["name"] != "John" {
		t.Errorf("MergeData[name] = %q, want %q", gr.MergeData["name"], "John")
	}
}

func TestDecodeJSON_NilBody(t *testing.T) {
	req := httptest.NewRequest("POST", "/", nil)
	req.Body = nil
	var gr models.GenerateRequest
	if err := decodeJSON(req, &gr); err == nil {
		t.Error("decodeJSON(nil body) should return error")
	}
}

// --- RenderTemplate ---

func TestRenderTemplate_Basic(t *testing.T) {
	tmpl := &models.Template{
		BodyTemplate: "Dear {{name}}, your case {{case_id}} is ready.",
		MergeFields: []models.MergeField{
			{Name: "name", Required: true},
			{Name: "case_id", Required: true},
		},
	}
	result, err := db.RenderTemplate(tmpl, map[string]string{
		"name":    "Robert Martinez",
		"case_id": "RET-2026-0147",
	})
	if err != nil {
		t.Fatalf("RenderTemplate error: %v", err)
	}
	expected := "Dear Robert Martinez, your case RET-2026-0147 is ready."
	if result != expected {
		t.Errorf("RenderTemplate = %q, want %q", result, expected)
	}
}

func TestRenderTemplate_MissingRequired(t *testing.T) {
	tmpl := &models.Template{
		BodyTemplate: "Dear {{name}},",
		MergeFields: []models.MergeField{
			{Name: "name", Required: true},
		},
	}
	_, err := db.RenderTemplate(tmpl, map[string]string{})
	if err == nil {
		t.Error("RenderTemplate should fail with missing required field")
	}
	if !strings.Contains(err.Error(), "name") {
		t.Errorf("error should mention missing field 'name', got: %v", err)
	}
}

func TestRenderTemplate_OptionalFieldOmitted(t *testing.T) {
	tmpl := &models.Template{
		BodyTemplate: "Dear {{name}}, ref: {{ref_number}}.",
		MergeFields: []models.MergeField{
			{Name: "name", Required: true},
			{Name: "ref_number", Required: false},
		},
	}
	result, err := db.RenderTemplate(tmpl, map[string]string{
		"name": "Jennifer",
	})
	if err != nil {
		t.Fatalf("RenderTemplate error: %v", err)
	}
	// Optional field not substituted — placeholder remains
	if !strings.Contains(result, "Dear Jennifer") {
		t.Errorf("RenderTemplate should contain name, got: %q", result)
	}
}

func TestRenderTemplate_ExtraFields(t *testing.T) {
	tmpl := &models.Template{
		BodyTemplate: "Hello {{name}}.",
		MergeFields:  []models.MergeField{},
	}
	result, err := db.RenderTemplate(tmpl, map[string]string{
		"name":  "David",
		"extra": "ignored",
	})
	if err != nil {
		t.Fatalf("RenderTemplate error: %v", err)
	}
	if result != "Hello David." {
		t.Errorf("RenderTemplate = %q, want %q", result, "Hello David.")
	}
}
