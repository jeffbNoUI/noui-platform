package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRetransformBatch_MissingCorrectionID(t *testing.T) {
	h := NewHandler(nil)

	body := `{"new_mappings": []}`
	req := httptest.NewRequest("POST", "/api/v1/migration/batches/batch-001/retransform", strings.NewReader(body))
	req.SetPathValue("id", "batch-001")
	w := httptest.NewRecorder()

	h.RetransformBatch(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestRetransformBatch_InvalidBody(t *testing.T) {
	h := NewHandler(nil)

	req := httptest.NewRequest("POST", "/api/v1/migration/batches/batch-001/retransform", strings.NewReader("not json"))
	req.SetPathValue("id", "batch-001")
	w := httptest.NewRecorder()

	h.RetransformBatch(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestRetransformBatch_MissingBatchID(t *testing.T) {
	h := NewHandler(nil)

	body := `{"correction_id": "corr-001", "new_mappings": []}`
	req := httptest.NewRequest("POST", "/api/v1/migration/batches//retransform", strings.NewReader(body))
	// Do not set path value to simulate missing id
	w := httptest.NewRecorder()

	h.RetransformBatch(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}
