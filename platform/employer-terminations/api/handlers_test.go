package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// newTestHandler creates a Handler with a nil DB (handlers that hit DB will fail,
// but routing/validation/health tests work fine).
func newTestHandler() *Handler {
	return &Handler{store: nil}
}

func TestHealthCheck(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("health check status = %d, want 200", w.Code)
	}

	var body map[string]string
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("status = %s, want ok", body["status"])
	}
	if body["service"] != "employer-terminations" {
		t.Errorf("service = %s, want employer-terminations", body["service"])
	}
}

func TestCreateCertification_MissingFields(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	body := `{"orgId": "org1", "ssnHash": "hash123"}`
	req := httptest.NewRequest("POST", "/api/v1/terminations/certifications", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing fields", w.Code)
	}
}

func TestCreateCertification_InvalidReason(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	body := `{
		"orgId": "org1", "ssnHash": "hash123",
		"firstName": "John", "lastName": "Doe",
		"lastDayWorked": "2025-01-15",
		"terminationReason": "FIRED"
	}`
	req := httptest.NewRequest("POST", "/api/v1/terminations/certifications", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for invalid reason", w.Code)
	}
}

func TestCreateCertification_InvalidJSON(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	req := httptest.NewRequest("POST", "/api/v1/terminations/certifications", strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for invalid JSON", w.Code)
	}
}

func TestListCertifications_MissingOrgID(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/v1/terminations/certifications", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing org_id", w.Code)
	}
}

func TestListHolds_MissingOrgID(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/v1/terminations/holds", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing org_id", w.Code)
	}
}

func TestCreateRefund_MissingFields(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	body := `{"ssnHash": "hash123"}`
	req := httptest.NewRequest("POST", "/api/v1/terminations/refunds", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing fields", w.Code)
	}
}

func TestCreateRefund_InvalidJSON(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	req := httptest.NewRequest("POST", "/api/v1/terminations/refunds", strings.NewReader("{bad"))
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for invalid JSON", w.Code)
	}
}

func TestListRefunds_MissingSSN(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/v1/terminations/refunds", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing ssn_hash", w.Code)
	}
}

func TestSetupPayment_InvalidMethod(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	body := `{"paymentMethod": "BITCOIN"}`
	req := httptest.NewRequest("PUT", "/api/v1/terminations/refunds/some-id/payment", strings.NewReader(body))
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for invalid payment method", w.Code)
	}
}

func TestRejectCertification_MissingReason(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	body := `{}`
	req := httptest.NewRequest("PUT", "/api/v1/terminations/certifications/some-id/reject", strings.NewReader(body))
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing reason", w.Code)
	}
}

func TestResolveHold_MissingCertID(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	body := `{"note": "resolved"}`
	req := httptest.NewRequest("PUT", "/api/v1/terminations/holds/some-id/resolve", strings.NewReader(body))
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing certificationId", w.Code)
	}
}

func TestParsePagination(t *testing.T) {
	tests := []struct {
		query      string
		wantLimit  int
		wantOffset int
	}{
		{"", 25, 0},
		{"limit=10&offset=5", 10, 5},
		{"limit=200", 25, 0}, // over max
		{"limit=-1", 25, 0},  // negative
		{"offset=-1", 25, 0}, // negative offset stays 0
	}
	for _, tt := range tests {
		req := httptest.NewRequest("GET", "/test?"+tt.query, nil)
		limit, offset := parsePagination(req)
		if limit != tt.wantLimit || offset != tt.wantOffset {
			t.Errorf("parsePagination(%q) = (%d, %d), want (%d, %d)",
				tt.query, limit, offset, tt.wantLimit, tt.wantOffset)
		}
	}
}
