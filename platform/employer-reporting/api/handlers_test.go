package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	erdb "github.com/noui/platform/employer-reporting/db"
)

// --- HealthCheck ---

func TestHealthCheck(t *testing.T) {
	h := &Handler{}
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
	if body["service"] != "employer-reporting" {
		t.Errorf("HealthCheck service = %q, want %q", body["service"], "employer-reporting")
	}
	if body["version"] != "0.1.0" {
		t.Errorf("HealthCheck version = %q, want %q", body["version"], "0.1.0")
	}
}

// --- ListFiles: missing org_id ---

func TestListFiles_MissingOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/reporting/files", nil)
	w := httptest.NewRecorder()

	h.ListFiles(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ListFiles status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	if errObj, ok := body["error"].(map[string]interface{}); ok {
		if errObj["code"] != "INVALID_REQUEST" {
			t.Errorf("error code = %v, want INVALID_REQUEST", errObj["code"])
		}
	}
}

// --- GetFile: missing fileId ---

func TestGetFile_MissingFileId(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/reporting/files/", nil)
	w := httptest.NewRecorder()

	h.GetFile(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("GetFile status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- DeleteFile: missing fileId ---

func TestDeleteFile_MissingFileId(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("DELETE", "/api/v1/reporting/files/", nil)
	w := httptest.NewRecorder()

	h.DeleteFile(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("DeleteFile status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ManualEntry: empty body ---

func TestManualEntry_EmptyBody(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("POST", "/api/v1/reporting/manual-entry",
		strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ManualEntry(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ManualEntry status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestManualEntry_NoRecords(t *testing.T) {
	h := &Handler{}
	body := `{"orgId":"abc","periodStart":"2026-01-01","periodEnd":"2026-01-31","divisionCode":"STATE","records":[]}`
	req := httptest.NewRequest("POST", "/api/v1/reporting/manual-entry",
		strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ManualEntry(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ManualEntry status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if errObj, ok := resp["error"].(map[string]interface{}); ok {
		if errObj["code"] != "NO_RECORDS" {
			t.Errorf("error code = %v, want NO_RECORDS", errObj["code"])
		}
	}
}

func TestManualEntry_InvalidJSON(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("POST", "/api/v1/reporting/manual-entry",
		strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ManualEntry(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ManualEntry status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ListExceptions: missing org_id ---

func TestListExceptions_MissingOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/reporting/exceptions", nil)
	w := httptest.NewRecorder()

	h.ListExceptions(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ListExceptions status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- GetException: missing id ---

func TestGetException_MissingId(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/reporting/exceptions/", nil)
	w := httptest.NewRecorder()

	h.GetException(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("GetException status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ResolveException: missing note ---

func TestResolveException_MissingNote(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("PUT", "/api/v1/reporting/exceptions/abc/resolve",
		strings.NewReader(`{"note":""}`))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", "abc")
	w := httptest.NewRecorder()

	h.ResolveException(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ResolveException status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestResolveException_InvalidJSON(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("PUT", "/api/v1/reporting/exceptions/abc/resolve",
		strings.NewReader("not json"))
	req.SetPathValue("id", "abc")
	w := httptest.NewRecorder()

	h.ResolveException(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ResolveException status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- EscalateException: missing id ---

func TestEscalateException_MissingId(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("PUT", "/api/v1/reporting/exceptions//escalate", nil)
	w := httptest.NewRecorder()

	h.EscalateException(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("EscalateException status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- SetupPayment: invalid method ---

func TestSetupPayment_MissingFileId(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("POST", "/api/v1/reporting/files//payment-setup",
		strings.NewReader(`{"method":"ACH"}`))
	w := httptest.NewRecorder()

	h.SetupPayment(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("SetupPayment status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestSetupPayment_InvalidMethod(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("POST", "/api/v1/reporting/files/abc/payment-setup",
		strings.NewReader(`{"method":"CASH"}`))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("fileId", "abc")
	w := httptest.NewRecorder()

	h.SetupPayment(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("SetupPayment status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if errObj, ok := resp["error"].(map[string]interface{}); ok {
		if errObj["code"] != "INVALID_METHOD" {
			t.Errorf("error code = %v, want INVALID_METHOD", errObj["code"])
		}
	}
}

// --- ListPayments: missing org_id ---

func TestListPayments_MissingOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/reporting/payments", nil)
	w := httptest.NewRecorder()

	h.ListPayments(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ListPayments status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- CancelPayment: missing paymentId ---

func TestCancelPayment_MissingPaymentId(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("DELETE", "/api/v1/reporting/payments/", nil)
	w := httptest.NewRecorder()

	h.CancelPayment(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("CancelPayment status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- SubmitCorrection: validation ---

func TestSubmitCorrection_MissingFields(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("POST", "/api/v1/reporting/corrections",
		strings.NewReader(`{"orgId":"abc"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.SubmitCorrection(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("SubmitCorrection status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestSubmitCorrection_InvalidJSON(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("POST", "/api/v1/reporting/corrections",
		strings.NewReader("not json"))
	w := httptest.NewRecorder()

	h.SubmitCorrection(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("SubmitCorrection status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- GetInterest: missing orgId ---

func TestGetInterest_MissingOrgId(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/reporting/interest/", nil)
	w := httptest.NewRecorder()

	h.GetInterest(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("GetInterest status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- Helper tests ---

func TestIntParam(t *testing.T) {
	tests := []struct {
		query    string
		key      string
		defVal   int
		expected int
	}{
		{"", "limit", 25, 25},
		{"limit=10", "limit", 25, 10},
		{"limit=abc", "limit", 25, 25},
		{"offset=5", "offset", 0, 5},
	}

	for _, tt := range tests {
		req := httptest.NewRequest("GET", "/test?"+tt.query, nil)
		got := intParam(req, tt.key, tt.defVal)
		if got != tt.expected {
			t.Errorf("intParam(%q, %q, %d) = %d, want %d", tt.query, tt.key, tt.defVal, got, tt.expected)
		}
	}
}

func TestSumAmounts(t *testing.T) {
	entry := erdb.ManualEntryRecord{
		MemberContribution:   "550.00",
		EmployerContribution: "520.00",
		AEDAmount:            "250.00",
		SAEDAmount:           "250.00",
		AAPAmount:            "50.00",
		DCSupplementAmount:   "12.50",
	}

	got := sumAmounts(entry)
	if got != "1632.50" {
		t.Errorf("sumAmounts = %q, want %q", got, "1632.50")
	}
}
