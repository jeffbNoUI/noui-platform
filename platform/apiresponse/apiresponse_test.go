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
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	if resp["data"] == nil {
		t.Fatal("missing data field")
	}
	meta, ok := resp["meta"].(map[string]any)
	if !ok {
		t.Fatal("missing or invalid meta field")
	}
	if meta["requestId"] == nil {
		t.Fatal("missing requestId in meta")
	}
	if meta["timestamp"] == nil {
		t.Fatal("missing timestamp in meta")
	}
	if meta["service"] != "testservice" {
		t.Fatalf("expected service=testservice, got %v", meta["service"])
	}
}

func TestWriteSuccess_ContentType(t *testing.T) {
	w := httptest.NewRecorder()
	WriteSuccess(w, http.StatusCreated, "svc", nil)

	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Fatalf("expected application/json, got %s", ct)
	}
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestWritePaginated_Shape(t *testing.T) {
	w := httptest.NewRecorder()
	WritePaginated(w, "svc", []string{"a", "b"}, 10, 2, 0)

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	pag, ok := resp["pagination"].(map[string]any)
	if !ok {
		t.Fatal("missing pagination field")
	}
	if pag["total"] != float64(10) {
		t.Fatalf("expected total=10, got %v", pag["total"])
	}
	if pag["hasMore"] != true {
		t.Fatal("expected hasMore=true")
	}
}

func TestWritePaginated_HasMoreFalse(t *testing.T) {
	w := httptest.NewRecorder()
	WritePaginated(w, "svc", []string{"a"}, 3, 10, 0)

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	pag := resp["pagination"].(map[string]any)
	if pag["hasMore"] != false {
		t.Fatal("expected hasMore=false when offset+limit >= total")
	}
}

func TestWriteError_Shape(t *testing.T) {
	w := httptest.NewRecorder()
	WriteError(w, http.StatusNotFound, "svc", "NOT_FOUND", "resource not found")

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)

	errObj, ok := resp["error"].(map[string]any)
	if !ok {
		t.Fatal("missing error field")
	}
	if errObj["code"] != "NOT_FOUND" {
		t.Fatalf("expected code=NOT_FOUND, got %v", errObj["code"])
	}
	if errObj["requestId"] == nil {
		t.Fatal("missing requestId in error")
	}

	meta, ok := resp["meta"].(map[string]any)
	if !ok {
		t.Fatal("missing meta field in error response")
	}
	if meta["requestId"] == nil {
		t.Fatal("missing requestId in meta")
	}
}

func TestWriteError_RequestIdConsistency(t *testing.T) {
	w := httptest.NewRecorder()
	WriteError(w, http.StatusBadRequest, "svc", "BAD_REQUEST", "invalid input")

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)

	errObj := resp["error"].(map[string]any)
	meta := resp["meta"].(map[string]any)

	// requestId in error and meta should be the same
	if errObj["requestId"] != meta["requestId"] {
		t.Fatalf("requestId mismatch: error=%v, meta=%v", errObj["requestId"], meta["requestId"])
	}
}

func TestBuildSuccess_Shape(t *testing.T) {
	resp := BuildSuccess("cachesvc", map[string]string{"cached": "true"})

	if resp["data"] == nil {
		t.Fatal("missing data field")
	}
	meta, ok := resp["meta"].(map[string]any)
	if !ok {
		t.Fatal("missing meta field")
	}
	if meta["service"] != "cachesvc" {
		t.Fatalf("expected service=cachesvc, got %v", meta["service"])
	}
	if meta["requestId"] == nil {
		t.Fatal("missing requestId in meta")
	}
}

func TestBuildPaginated_Shape(t *testing.T) {
	resp := BuildPaginated("cachesvc", []string{"a"}, 5, 10, 0)

	pag, ok := resp["pagination"].(map[string]any)
	if !ok {
		t.Fatal("missing pagination field")
	}
	if pag["total"] != 5 {
		t.Fatalf("expected total=5, got %v", pag["total"])
	}
	if pag["hasMore"] != false {
		t.Fatal("expected hasMore=false")
	}
}
