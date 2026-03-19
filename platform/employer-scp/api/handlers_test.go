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
	if body["service"] != "employer-scp" {
		t.Errorf("service = %s, want employer-scp", body["service"])
	}
}

func TestCreateRequest_MissingFields(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	body := `{"orgId": "org1", "ssnHash": "hash123"}`
	req := httptest.NewRequest("POST", "/api/v1/scp/requests", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing fields", w.Code)
	}
}

func TestCreateRequest_InvalidServiceType(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	body := `{"orgId":"org1","ssnHash":"h","firstName":"A","lastName":"B","serviceType":"BOGUS","tier":"TIER_1","yearsRequested":"5.00"}`
	req := httptest.NewRequest("POST", "/api/v1/scp/requests", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422 for invalid service type", w.Code)
	}
}

func TestCreateRequest_InvalidTier(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	body := `{"orgId":"org1","ssnHash":"h","firstName":"A","lastName":"B","serviceType":"MILITARY_USERRA","tier":"TIER_99","yearsRequested":"5.00"}`
	req := httptest.NewRequest("POST", "/api/v1/scp/requests", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422 for invalid tier", w.Code)
	}
}

func TestCreateRequest_InvalidJSON(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	req := httptest.NewRequest("POST", "/api/v1/scp/requests", strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for invalid JSON", w.Code)
	}
}

func TestListRequests_MissingOrgID(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/v1/scp/requests", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing org_id", w.Code)
	}
}

func TestCheckEligibility_MissingParams(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/v1/scp/eligibility", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing params", w.Code)
	}
}

func TestCheckEligibility_ValidRequest(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/v1/scp/eligibility?service_type=MILITARY_USERRA&tier=TIER_2", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", w.Code)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["eligible"] != true {
		t.Errorf("expected eligible=true for valid combination")
	}
	if body["label"] == nil || body["label"] == "" {
		t.Error("expected label in response")
	}
}

func TestCheckEligibility_InvalidServiceType(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/v1/scp/eligibility?service_type=INVALID&tier=TIER_1", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200 (eligible=false is still a valid response)", w.Code)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["eligible"] != false {
		t.Errorf("expected eligible=false for invalid service type")
	}
}

func TestLookupCostFactor_MissingParams(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/v1/scp/cost-factors/lookup", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing params", w.Code)
	}
}

func TestLookupCostFactor_InvalidAge(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/v1/scp/cost-factors/lookup?tier=TIER_1&hire_date=2000-01-01&age=abc", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for invalid age", w.Code)
	}
}

func TestCreateCostFactor_MissingFields(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	body := `{"tier": "TIER_1"}`
	req := httptest.NewRequest("POST", "/api/v1/scp/cost-factors", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing fields", w.Code)
	}
}

func TestCreateCostFactor_InvalidTier(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	body := `{"tier":"INVALID","hireDateFrom":"2000-01-01","hireDateTo":"2099-12-31","costFactor":"0.125","ageAtPurchase":50,"effectiveDate":"2026-01-01"}`
	req := httptest.NewRequest("POST", "/api/v1/scp/cost-factors", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for invalid tier", w.Code)
	}
}

func TestGenerateQuote_MissingFields(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	body := `{"tier": "TIER_1"}`
	req := httptest.NewRequest("POST", "/api/v1/scp/quotes", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing fields", w.Code)
	}
}

func TestDenyRequest_MissingReason(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	body := `{}`
	req := httptest.NewRequest("PUT", "/api/v1/scp/requests/some-id/deny", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing reason", w.Code)
	}
}

func TestRecordPayment_MissingFields(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	body := `{"amount": ""}`
	req := httptest.NewRequest("POST", "/api/v1/scp/requests/some-id/payment", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing payment fields", w.Code)
	}
}

func TestParsePagination_Defaults(t *testing.T) {
	req := httptest.NewRequest("GET", "/test", nil)
	limit, offset := parsePagination(req)
	if limit != 25 {
		t.Errorf("default limit = %d, want 25", limit)
	}
	if offset != 0 {
		t.Errorf("default offset = %d, want 0", offset)
	}
}

func TestParsePagination_Custom(t *testing.T) {
	req := httptest.NewRequest("GET", "/test?limit=10&offset=20", nil)
	limit, offset := parsePagination(req)
	if limit != 10 {
		t.Errorf("limit = %d, want 10", limit)
	}
	if offset != 20 {
		t.Errorf("offset = %d, want 20", offset)
	}
}

func TestParsePagination_ClampMax(t *testing.T) {
	req := httptest.NewRequest("GET", "/test?limit=500", nil)
	limit, _ := parsePagination(req)
	if limit != 25 {
		t.Errorf("limit = %d, want 25 (clamped from 500)", limit)
	}
}
