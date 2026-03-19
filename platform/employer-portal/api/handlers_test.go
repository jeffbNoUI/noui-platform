package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/noui/platform/apiresponse"
	epdb "github.com/noui/platform/employer-portal/db"
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
	if body["service"] != "employer-portal" {
		t.Errorf("HealthCheck service = %q, want %q", body["service"], "employer-portal")
	}
	if body["version"] != "0.1.0" {
		t.Errorf("HealthCheck version = %q, want %q", body["version"], "0.1.0")
	}
}

// --- GetDashboard (no DB, zero-state) ---

func TestGetDashboard_ZeroState(t *testing.T) {
	h := &Handler{} // no org_id means zero-state
	req := httptest.NewRequest("GET", "/api/v1/employer/dashboard", nil)
	w := httptest.NewRecorder()

	h.GetDashboard(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("GetDashboard status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("GetDashboard body parse error: %v", err)
	}

	data, ok := body["data"].(map[string]interface{})
	if !ok {
		t.Fatal("GetDashboard response missing 'data' field")
	}

	// All counts should be zero
	for _, field := range []string{"pendingExceptions", "unresolvedTasks", "recentSubmissions", "activeAlerts"} {
		if v, ok := data[field]; !ok {
			t.Errorf("data missing field %q", field)
		} else if v != float64(0) {
			t.Errorf("data[%q] = %v, want 0", field, v)
		}
	}

	meta, ok := body["meta"].(map[string]interface{})
	if !ok {
		t.Fatal("GetDashboard response missing 'meta' field")
	}
	if meta["service"] != "employer-portal" {
		t.Errorf("meta.service = %q, want %q", meta["service"], "employer-portal")
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

func TestDecodeJSON_Valid(t *testing.T) {
	body := `{"orgId":"org-1","contactId":"contact-1","portalRole":"SUPER_USER"}`
	req := httptest.NewRequest("POST", "/", strings.NewReader(body))
	var cr epdb.CreatePortalUserRequest
	if err := decodeJSON(req, &cr); err != nil {
		t.Fatalf("decodeJSON error: %v", err)
	}
	if cr.OrgID != "org-1" {
		t.Errorf("OrgID = %q, want org-1", cr.OrgID)
	}
	if cr.PortalRole != "SUPER_USER" {
		t.Errorf("PortalRole = %q, want SUPER_USER", cr.PortalRole)
	}
}

func TestDecodeJSON_NilBody(t *testing.T) {
	req := httptest.NewRequest("POST", "/", nil)
	req.Body = nil
	var cr epdb.CreatePortalUserRequest
	if err := decodeJSON(req, &cr); err == nil {
		t.Error("decodeJSON(nil body) should return error")
	}
}

func TestDecodeJSON_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest("POST", "/", strings.NewReader("{not valid json"))
	var cr epdb.CreatePortalUserRequest
	if err := decodeJSON(req, &cr); err == nil {
		t.Error("decodeJSON(invalid json) should return error")
	}
}

// --- Response Helpers ---

func TestWriteSuccess(t *testing.T) {
	w := httptest.NewRecorder()
	apiresponse.WriteSuccess(w, http.StatusOK, "employer-portal", map[string]string{"hello": "world"})

	if w.Code != http.StatusOK {
		t.Errorf("WriteSuccess status = %d, want %d", w.Code, http.StatusOK)
	}

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
	if meta["service"] != "employer-portal" {
		t.Errorf("meta.service = %q, want %q", meta["service"], "employer-portal")
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
	apiresponse.WriteError(w, http.StatusBadRequest, "employer-portal", "INVALID_REQUEST", "bad input")

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
		t.Errorf("error.code = %q, want INVALID_REQUEST", errObj["code"])
	}
	if errObj["message"] != "bad input" {
		t.Errorf("error.message = %q, want %q", errObj["message"], "bad input")
	}
}

func TestWritePaginated(t *testing.T) {
	w := httptest.NewRecorder()
	apiresponse.WritePaginated(w, "employer-portal", []string{"a", "b"}, 10, 2, 0)

	if w.Code != http.StatusOK {
		t.Errorf("WritePaginated status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("WritePaginated body parse error: %v", err)
	}
	pag, ok := body["pagination"].(map[string]interface{})
	if !ok {
		t.Fatal("WritePaginated missing 'pagination' field")
	}
	if pag["total"] != float64(10) {
		t.Errorf("pagination.total = %v, want 10", pag["total"])
	}
	if pag["hasMore"] != true {
		t.Errorf("pagination.hasMore = %v, want true", pag["hasMore"])
	}
}

// --- CreatePortalUser Validation ---

func TestCreatePortalUser_MissingFields(t *testing.T) {
	h := &Handler{} // store not needed for validation failures
	body := `{}`
	req := httptest.NewRequest("POST", "/api/v1/employer/users", strings.NewReader(body))
	w := httptest.NewRecorder()

	h.CreatePortalUser(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("CreatePortalUser(empty) status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	errObj, ok := resp["error"].(map[string]interface{})
	if !ok {
		t.Fatal("response missing 'error' field")
	}
	if errObj["code"] != "INVALID_REQUEST" {
		t.Errorf("error.code = %q, want INVALID_REQUEST", errObj["code"])
	}
}

func TestCreatePortalUser_InvalidRole(t *testing.T) {
	h := &Handler{}
	body := `{"orgId":"org-1","contactId":"contact-1","portalRole":"ADMIN"}`
	req := httptest.NewRequest("POST", "/api/v1/employer/users", strings.NewReader(body))
	w := httptest.NewRecorder()

	h.CreatePortalUser(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("CreatePortalUser(invalid role) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreatePortalUser_InvalidJSON(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("POST", "/api/v1/employer/users", strings.NewReader("{not json"))
	w := httptest.NewRecorder()

	h.CreatePortalUser(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("CreatePortalUser(bad json) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ListPortalUsers Validation ---

func TestListPortalUsers_MissingOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/employer/users", nil)
	w := httptest.NewRecorder()

	h.ListPortalUsers(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ListPortalUsers(no org_id) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- GetCurrentRate Validation ---

func TestGetCurrentRate_MissingDivision(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/employer/rate-tables/current", nil)
	w := httptest.NewRecorder()

	h.GetCurrentRate(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("GetCurrentRate(no division) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ListAlerts Validation ---

func TestListAlerts_MissingOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/employer/alerts", nil)
	w := httptest.NewRecorder()

	h.ListAlerts(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ListAlerts(no org_id) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- CreateAlert Validation ---

func TestCreateAlert_MissingFields(t *testing.T) {
	h := &Handler{}
	body := `{}`
	req := httptest.NewRequest("POST", "/api/v1/employer/alerts", strings.NewReader(body))
	w := httptest.NewRecorder()

	h.CreateAlert(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("CreateAlert(empty) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateAlert_InvalidAlertType(t *testing.T) {
	h := &Handler{}
	body := `{"alertType":"UNKNOWN","title":"Test","effectiveFrom":"2026-03-19T00:00:00Z"}`
	req := httptest.NewRequest("POST", "/api/v1/employer/alerts", strings.NewReader(body))
	w := httptest.NewRecorder()

	h.CreateAlert(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("CreateAlert(invalid type) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- Model JSON Serialization ---

func TestPortalUserJSON_RoundTrip(t *testing.T) {
	u := epdb.PortalUser{
		ID:         "user-123",
		OrgID:      "org-456",
		ContactID:  "contact-789",
		PortalRole: "SUPER_USER",
		IsActive:   true,
	}

	data, err := json.Marshal(u)
	if err != nil {
		t.Fatalf("Marshal PortalUser: %v", err)
	}

	var decoded epdb.PortalUser
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal PortalUser: %v", err)
	}

	if decoded.PortalRole != "SUPER_USER" {
		t.Errorf("PortalRole = %q, want SUPER_USER", decoded.PortalRole)
	}
	if !decoded.IsActive {
		t.Error("IsActive should be true")
	}
}

func TestDashboardSummaryJSON_RoundTrip(t *testing.T) {
	s := epdb.DashboardSummary{
		PendingExceptions: 5,
		UnresolvedTasks:   3,
		RecentSubmissions: 12,
		ActiveAlerts:      2,
	}

	data, err := json.Marshal(s)
	if err != nil {
		t.Fatalf("Marshal DashboardSummary: %v", err)
	}

	var decoded epdb.DashboardSummary
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal DashboardSummary: %v", err)
	}

	if decoded.PendingExceptions != 5 {
		t.Errorf("PendingExceptions = %d, want 5", decoded.PendingExceptions)
	}
	if decoded.ActiveAlerts != 2 {
		t.Errorf("ActiveAlerts = %d, want 2", decoded.ActiveAlerts)
	}
}

func TestAlertJSON_RoundTrip(t *testing.T) {
	orgID := "org-1"
	body := "Important notice"
	a := epdb.Alert{
		ID:        "alert-1",
		OrgID:     &orgID,
		AlertType: "DEADLINE",
		Title:     "Payroll deadline approaching",
		Body:      &body,
	}

	data, err := json.Marshal(a)
	if err != nil {
		t.Fatalf("Marshal Alert: %v", err)
	}

	var decoded epdb.Alert
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal Alert: %v", err)
	}

	if decoded.AlertType != "DEADLINE" {
		t.Errorf("AlertType = %q, want DEADLINE", decoded.AlertType)
	}
	if decoded.Title != "Payroll deadline approaching" {
		t.Errorf("Title = %q, want 'Payroll deadline approaching'", decoded.Title)
	}
}
