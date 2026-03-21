package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthCheck(t *testing.T) {
	h := NewHandler(nil) // DB not needed for health check
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()

	h.HealthCheck(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var body map[string]string
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body["service"] != "migration" {
		t.Errorf("expected service=migration, got %q", body["service"])
	}
	if body["status"] != "ok" {
		t.Errorf("expected status=ok, got %q", body["status"])
	}
	if body["version"] != "0.1.0" {
		t.Errorf("expected version=0.1.0, got %q", body["version"])
	}
}
