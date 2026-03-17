package apiresponse

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteSuccess_Shape(t *testing.T) {
	w := httptest.NewRecorder()
	WriteSuccess(w, http.StatusOK, "testservice", map[string]string{"key": "value"})

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", ct)
	}

	var body map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}

	if _, ok := body["data"]; !ok {
		t.Fatal("missing 'data' key")
	}
	if _, ok := body["meta"]; !ok {
		t.Fatal("missing 'meta' key")
	}

	var meta map[string]string
	if err := json.Unmarshal(body["meta"], &meta); err != nil {
		t.Fatalf("meta parse error: %v", err)
	}
	if meta["requestId"] == "" {
		t.Error("meta.requestId is empty")
	}
	if meta["timestamp"] == "" {
		t.Error("meta.timestamp is empty")
	}
	if meta["service"] != "testservice" {
		t.Errorf("meta.service = %q, want %q", meta["service"], "testservice")
	}
	if meta["version"] != "v1" {
		t.Errorf("meta.version = %q, want %q", meta["version"], "v1")
	}
}

func TestWriteSuccess_CustomStatus(t *testing.T) {
	w := httptest.NewRecorder()
	WriteSuccess(w, http.StatusCreated, "crm", map[string]string{"id": "abc"})
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusCreated)
	}
}

func TestWriteError_Shape(t *testing.T) {
	w := httptest.NewRecorder()
	WriteError(w, http.StatusBadRequest, "INVALID_INPUT", "name is required")

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}

	if _, ok := body["error"]; !ok {
		t.Fatal("missing 'error' key")
	}

	var errObj map[string]string
	if err := json.Unmarshal(body["error"], &errObj); err != nil {
		t.Fatalf("error parse: %v", err)
	}
	if errObj["code"] != "INVALID_INPUT" {
		t.Errorf("error.code = %q, want INVALID_INPUT", errObj["code"])
	}
	if errObj["message"] != "name is required" {
		t.Errorf("error.message = %q, want 'name is required'", errObj["message"])
	}
	if errObj["requestId"] == "" {
		t.Error("error.requestId is empty")
	}
}

func TestWritePaginated_Shape(t *testing.T) {
	w := httptest.NewRecorder()
	items := []string{"a", "b", "c"}
	WritePaginated(w, "crm", items, 100, 25, 0)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}

	if _, ok := body["data"]; !ok {
		t.Fatal("missing 'data' key")
	}
	if _, ok := body["pagination"]; !ok {
		t.Fatal("missing 'pagination' key")
	}
	if _, ok := body["meta"]; !ok {
		t.Fatal("missing 'meta' key")
	}

	var pg map[string]interface{}
	if err := json.Unmarshal(body["pagination"], &pg); err != nil {
		t.Fatalf("pagination parse: %v", err)
	}
	if pg["total"] != float64(100) {
		t.Errorf("pagination.total = %v, want 100", pg["total"])
	}
	if pg["limit"] != float64(25) {
		t.Errorf("pagination.limit = %v, want 25", pg["limit"])
	}
	if pg["offset"] != float64(0) {
		t.Errorf("pagination.offset = %v, want 0", pg["offset"])
	}
	if pg["hasMore"] != true {
		t.Errorf("pagination.hasMore = %v, want true", pg["hasMore"])
	}
}

func TestWritePaginated_HasMoreFalse(t *testing.T) {
	w := httptest.NewRecorder()
	WritePaginated(w, "crm", []string{"a"}, 1, 25, 0)

	var body struct {
		Pagination struct {
			HasMore bool `json:"hasMore"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Pagination.HasMore {
		t.Error("expected hasMore=false when total <= offset+limit")
	}
}

func TestWriteJSON_RawOutput(t *testing.T) {
	w := httptest.NewRecorder()
	WriteJSON(w, http.StatusAccepted, map[string]string{"status": "logged"})

	if w.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusAccepted)
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body["status"] != "logged" {
		t.Errorf("status = %q, want logged", body["status"])
	}
}
