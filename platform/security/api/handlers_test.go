package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/security/models"
)

// --- Test Helpers ---

// newTestHandler creates a Handler backed by a sqlmock DB.
func newTestHandler(t *testing.T) (*Handler, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return NewHandler(db), mock
}

// serve dispatches a request through a real ServeMux so Go 1.22 path values are populated.
func serve(h *Handler, method, path string, body []byte) *httptest.ResponseRecorder {
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	var req *http.Request
	if body != nil {
		req = httptest.NewRequest(method, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
}

// eventCols matches the 9-column SELECT used by scanEvent.
var eventCols = []string{
	"id", "tenant_id", "event_type", "actor_id", "actor_email",
	"ip_address", "user_agent", "metadata", "created_at",
}

// sessionCols matches the 10-column SELECT used by scanSession.
var sessionCols = []string{
	"id", "tenant_id", "user_id", "session_id", "email",
	"role", "ip_address", "user_agent", "started_at", "last_seen_at",
}

// --- HealthCheck ---

func TestHealthCheck(t *testing.T) {
	h, _ := newTestHandler(t)
	w := serve(h, "GET", "/healthz", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("HealthCheck status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("status = %q, want %q", body["status"], "ok")
	}
	if body["service"] != "security" {
		t.Errorf("service = %q, want %q", body["service"], "security")
	}
	if body["version"] != "0.1.0" {
		t.Errorf("version = %q, want %q", body["version"], "0.1.0")
	}
}

// --- Helper Function Tests ---

func TestTenantID_Default(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := tenantID(req)
	if got != defaultTenantID {
		t.Errorf("tenantID(no context) = %q, want %q", got, defaultTenantID)
	}
}

func TestIntParam_Valid(t *testing.T) {
	req := httptest.NewRequest("GET", "/?limit=50", nil)
	got := intParam(req, "limit", 25)
	if got != 50 {
		t.Errorf("intParam(limit=50) = %d, want 50", got)
	}
}

func TestIntParam_Missing(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := intParam(req, "limit", 25)
	if got != 25 {
		t.Errorf("intParam(missing) = %d, want 25 (default)", got)
	}
}

func TestIntParam_Invalid(t *testing.T) {
	req := httptest.NewRequest("GET", "/?limit=abc", nil)
	got := intParam(req, "limit", 25)
	if got != 25 {
		t.Errorf("intParam(abc) = %d, want 25 (default)", got)
	}
}

func TestDecodeJSON_NilBody(t *testing.T) {
	req := httptest.NewRequest("POST", "/", nil)
	req.Body = nil
	var v map[string]string
	err := decodeJSON(req, &v)
	if err == nil {
		t.Error("decodeJSON(nil body) should return error")
	}
}

// --- Response Helper Tests ---

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
		t.Fatalf("parse error: %v", err)
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
		t.Fatalf("parse error: %v", err)
	}
	if body["data"] == nil {
		t.Error("writeSuccess missing 'data' field")
	}
	meta, ok := body["meta"].(map[string]interface{})
	if !ok {
		t.Fatal("writeSuccess missing 'meta' field")
	}
	if meta["request_id"] == nil || meta["request_id"] == "" {
		t.Error("meta.request_id should not be empty")
	}
	if meta["timestamp"] == nil || meta["timestamp"] == "" {
		t.Error("meta.timestamp should not be empty")
	}
	if meta["service"] != "security" {
		t.Errorf("meta.service = %q, want security", meta["service"])
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
		t.Fatalf("parse error: %v", err)
	}
	errObj, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatal("writeError missing 'error' field")
	}
	if errObj["code"] != "INVALID" {
		t.Errorf("error.code = %q, want INVALID", errObj["code"])
	}
	if errObj["message"] != "bad input" {
		t.Errorf("error.message = %q, want %q", errObj["message"], "bad input")
	}
	if errObj["request_id"] == nil || errObj["request_id"] == "" {
		t.Error("error.request_id should not be empty")
	}
}

func TestWritePaginated(t *testing.T) {
	w := httptest.NewRecorder()
	writePaginated(w, []string{"a", "b"}, 10, 5, 0)

	if w.Code != http.StatusOK {
		t.Errorf("writePaginated status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}

	pag, ok := body["pagination"].(map[string]interface{})
	if !ok {
		t.Fatal("writePaginated missing 'pagination' field")
	}
	if pag["total"] != float64(10) {
		t.Errorf("pagination.total = %v, want 10", pag["total"])
	}
	if pag["limit"] != float64(5) {
		t.Errorf("pagination.limit = %v, want 5", pag["limit"])
	}
	if pag["hasMore"] != true {
		t.Errorf("pagination.hasMore = %v, want true", pag["hasMore"])
	}
}

func TestWritePaginated_NoMore(t *testing.T) {
	w := httptest.NewRecorder()
	writePaginated(w, []string{"a"}, 3, 5, 0)

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	pag := body["pagination"].(map[string]interface{})
	if pag["hasMore"] != false {
		t.Errorf("pagination.hasMore = %v, want false (offset+limit >= total)", pag["hasMore"])
	}
}

// --- Model Serialization ---

func TestSecurityEventJSON(t *testing.T) {
	now := time.Now().UTC()
	ev := models.SecurityEvent{
		ID:         1,
		TenantID:   "tenant-1",
		EventType:  "login_success",
		ActorID:    "user-1",
		ActorEmail: "user@example.com",
		IPAddress:  "192.168.1.1",
		UserAgent:  "Mozilla/5.0",
		Metadata:   "{}",
		CreatedAt:  now,
	}

	data, err := json.Marshal(ev)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	var decoded models.SecurityEvent
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if decoded.EventType != "login_success" {
		t.Errorf("EventType = %q, want login_success", decoded.EventType)
	}
	if decoded.ActorID != "user-1" {
		t.Errorf("ActorID = %q, want user-1", decoded.ActorID)
	}
}

func TestActiveSessionJSON(t *testing.T) {
	now := time.Now().UTC()
	sess := models.ActiveSession{
		ID:         1,
		TenantID:   "tenant-1",
		UserID:     "user-1",
		SessionID:  "sess-abc",
		Email:      "user@example.com",
		Role:       "admin",
		IPAddress:  "10.0.0.1",
		UserAgent:  "Chrome",
		StartedAt:  now,
		LastSeenAt: now,
	}

	data, err := json.Marshal(sess)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	var decoded models.ActiveSession
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if decoded.SessionID != "sess-abc" {
		t.Errorf("SessionID = %q, want sess-abc", decoded.SessionID)
	}
}

// --- CreateEvent ---

func TestCreateEvent_MissingEventType(t *testing.T) {
	h, _ := newTestHandler(t)

	reqBody, _ := json.Marshal(models.CreateEventRequest{
		ActorID: "user-1",
	})

	w := serve(h, "POST", "/api/v1/security/events", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateEvent(no eventType) status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	errObj := body["error"].(map[string]interface{})
	if errObj["code"] != "INVALID_REQUEST" {
		t.Errorf("error.code = %q, want INVALID_REQUEST", errObj["code"])
	}
}

func TestCreateEvent_MissingActorID(t *testing.T) {
	h, _ := newTestHandler(t)

	reqBody, _ := json.Marshal(models.CreateEventRequest{
		EventType: "login_success",
	})

	w := serve(h, "POST", "/api/v1/security/events", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateEvent(no actorId) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateEvent_InvalidEventType(t *testing.T) {
	h, _ := newTestHandler(t)

	reqBody, _ := json.Marshal(models.CreateEventRequest{
		EventType: "unknown_event",
		ActorID:   "user-1",
	})

	w := serve(h, "POST", "/api/v1/security/events", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateEvent(invalid eventType) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateEvent_MalformedJSON(t *testing.T) {
	h, _ := newTestHandler(t)

	w := serve(h, "POST", "/api/v1/security/events", []byte(`{invalid json`))

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateEvent(malformed JSON) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateEvent_Valid(t *testing.T) {
	h, mock := newTestHandler(t)

	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO security_events").
		WillReturnRows(sqlmock.NewRows(eventCols).AddRow(
			1, defaultTenantID, "login_success", "user-1", "user@example.com",
			"192.168.1.1", "Mozilla/5.0", "{}", now,
		))

	reqBody, _ := json.Marshal(models.CreateEventRequest{
		EventType:  "login_success",
		ActorID:    "user-1",
		ActorEmail: "user@example.com",
		IPAddress:  "192.168.1.1",
		UserAgent:  "Mozilla/5.0",
	})

	w := serve(h, "POST", "/api/v1/security/events", reqBody)

	if w.Code != http.StatusCreated {
		t.Fatalf("CreateEvent status = %d, want %d\nbody: %s", w.Code, http.StatusCreated, w.Body.String())
	}

	var body struct {
		Data models.SecurityEvent   `json:"data"`
		Meta map[string]interface{} `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.EventType != "login_success" {
		t.Errorf("EventType = %q, want login_success", body.Data.EventType)
	}
	if body.Meta["request_id"] == nil || body.Meta["request_id"] == "" {
		t.Error("meta.request_id should not be empty")
	}
}

// --- ListEvents ---

func TestListEvents_Empty(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	mock.ExpectQuery("SELECT").
		WillReturnRows(sqlmock.NewRows(eventCols))

	w := serve(h, "GET", "/api/v1/security/events", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListEvents status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	pag := body["pagination"].(map[string]interface{})
	if pag["total"] != float64(0) {
		t.Errorf("pagination.total = %v, want 0", pag["total"])
	}
}

func TestListEvents_WithResults(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	now := time.Now().UTC()
	dataRows := sqlmock.NewRows(eventCols).
		AddRow(1, defaultTenantID, "login_success", "user-1", "u1@example.com", "10.0.0.1", "Chrome", "{}", now).
		AddRow(2, defaultTenantID, "login_failure", "user-2", "u2@example.com", "10.0.0.2", "Firefox", "{}", now)
	mock.ExpectQuery("SELECT").
		WillReturnRows(dataRows)

	w := serve(h, "GET", "/api/v1/security/events?limit=25&offset=0", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListEvents status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data       []models.SecurityEvent `json:"data"`
		Pagination map[string]interface{} `json:"pagination"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if len(body.Data) != 2 {
		t.Fatalf("expected 2 events, got %d", len(body.Data))
	}
	if body.Pagination["total"] != float64(2) {
		t.Errorf("pagination.total = %v, want 2", body.Pagination["total"])
	}
}

// --- GetEventStats ---

func TestGetEventStats(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"active_users", "active_sessions", "failed_logins_24h", "role_changes_7d"}).
			AddRow(12, 5, 3, 1))

	w := serve(h, "GET", "/api/v1/security/events/stats", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("GetEventStats status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data models.EventStats      `json:"data"`
		Meta map[string]interface{} `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.ActiveUsers != 12 {
		t.Errorf("ActiveUsers = %d, want 12", body.Data.ActiveUsers)
	}
	if body.Data.FailedLogins24h != 3 {
		t.Errorf("FailedLogins24h = %d, want 3", body.Data.FailedLogins24h)
	}
	if body.Meta["request_id"] == nil || body.Meta["request_id"] == "" {
		t.Error("meta.request_id should not be empty")
	}
}

// --- Sessions ---

func TestUpsertSession_MissingFields(t *testing.T) {
	h, _ := newTestHandler(t)

	reqBody, _ := json.Marshal(models.CreateSessionRequest{})

	w := serve(h, "POST", "/api/v1/security/sessions", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("UpsertSession(empty) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestUpsertSession_MissingSessionID(t *testing.T) {
	h, _ := newTestHandler(t)

	reqBody, _ := json.Marshal(models.CreateSessionRequest{
		UserID: "user-1",
	})

	w := serve(h, "POST", "/api/v1/security/sessions", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("UpsertSession(no sessionId) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestUpsertSession_Valid(t *testing.T) {
	h, mock := newTestHandler(t)

	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO active_sessions").
		WillReturnRows(sqlmock.NewRows(sessionCols).AddRow(
			1, defaultTenantID, "user-1", "sess-abc", "user@example.com",
			"admin", "192.168.1.1", "Mozilla/5.0", now, now,
		))

	reqBody, _ := json.Marshal(models.CreateSessionRequest{
		UserID:    "user-1",
		SessionID: "sess-abc",
		Email:     "user@example.com",
		Role:      "admin",
		IPAddress: "192.168.1.1",
		UserAgent: "Mozilla/5.0",
	})

	w := serve(h, "POST", "/api/v1/security/sessions", reqBody)

	if w.Code != http.StatusCreated {
		t.Fatalf("UpsertSession status = %d, want %d\nbody: %s", w.Code, http.StatusCreated, w.Body.String())
	}

	var body struct {
		Data models.ActiveSession `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.SessionID != "sess-abc" {
		t.Errorf("SessionID = %q, want sess-abc", body.Data.SessionID)
	}
}

func TestListActiveSessions_Empty(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows(sessionCols))

	w := serve(h, "GET", "/api/v1/security/sessions", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListActiveSessions status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data []models.ActiveSession `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	// Verify empty returns empty array (not null)
	if body.Data == nil {
		t.Error("ListActiveSessions(empty) returned nil, want empty slice")
	}
}

func TestDeleteSession_NotFound(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectExec("DELETE FROM active_sessions").
		WillReturnResult(sqlmock.NewResult(0, 0))

	w := serve(h, "DELETE", "/api/v1/security/sessions/nonexistent", nil)

	if w.Code != http.StatusNotFound {
		t.Errorf("DeleteSession(nonexistent) status = %d, want %d\nbody: %s",
			w.Code, http.StatusNotFound, w.Body.String())
	}
}

func TestDeleteSession_Valid(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectExec("DELETE FROM active_sessions").
		WillReturnResult(sqlmock.NewResult(0, 1))

	w := serve(h, "DELETE", "/api/v1/security/sessions/sess-abc", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("DeleteSession status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}
}

// --- Clerk Webhook ---

func TestClerkWebhook_MissingType(t *testing.T) {
	h, _ := newTestHandler(t)

	reqBody, _ := json.Marshal(models.ClerkWebhookPayload{
		Data: map[string]interface{}{"id": "user-1"},
	})

	w := serve(h, "POST", "/api/v1/security/webhook/clerk", reqBody)

	if w.Code != http.StatusBadRequest {
		t.Errorf("ClerkWebhook(no type) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestClerkWebhook_UnrecognizedType(t *testing.T) {
	h, _ := newTestHandler(t)

	reqBody, _ := json.Marshal(models.ClerkWebhookPayload{
		Type: "organization.created",
		Data: map[string]interface{}{"id": "org-1"},
	})

	w := serve(h, "POST", "/api/v1/security/webhook/clerk", reqBody)

	if w.Code != http.StatusOK {
		t.Fatalf("ClerkWebhook(unrecognized) status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data map[string]string `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data["status"] != "ignored" {
		t.Errorf("status = %q, want ignored", body.Data["status"])
	}
}

func TestClerkWebhook_SignedIn(t *testing.T) {
	h, mock := newTestHandler(t)

	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO security_events").
		WillReturnRows(sqlmock.NewRows(eventCols).AddRow(
			1, defaultTenantID, "login_success", "user-1", "user@example.com",
			"", "", `{"type":"user.signed_in","data":{"id":"user-1","email_addresses":[{"email_address":"user@example.com"}]}}`, now,
		))

	reqBody, _ := json.Marshal(models.ClerkWebhookPayload{
		Type: "user.signed_in",
		Data: map[string]interface{}{
			"id": "user-1",
			"email_addresses": []interface{}{
				map[string]interface{}{"email_address": "user@example.com"},
			},
		},
	})

	w := serve(h, "POST", "/api/v1/security/webhook/clerk", reqBody)

	if w.Code != http.StatusCreated {
		t.Fatalf("ClerkWebhook(signed_in) status = %d, want %d\nbody: %s",
			w.Code, http.StatusCreated, w.Body.String())
	}

	var body struct {
		Data models.SecurityEvent `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.EventType != "login_success" {
		t.Errorf("EventType = %q, want login_success", body.Data.EventType)
	}
}

func TestClerkWebhook_MalformedJSON(t *testing.T) {
	h, _ := newTestHandler(t)

	w := serve(h, "POST", "/api/v1/security/webhook/clerk", []byte(`{invalid`))

	if w.Code != http.StatusBadRequest {
		t.Errorf("ClerkWebhook(malformed) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- Clerk Helper Tests ---

func TestMapClerkEventType(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"user.signed_in", "login_success"},
		{"session.created", "session_start"},
		{"session.ended", "session_end"},
		{"user.updated", "role_change"},
		{"unknown.event", ""},
	}

	for _, tt := range tests {
		got := mapClerkEventType(tt.input)
		if got != tt.want {
			t.Errorf("mapClerkEventType(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestExtractString(t *testing.T) {
	data := map[string]interface{}{"id": "user-1", "count": 42}

	if got := extractString(data, "id"); got != "user-1" {
		t.Errorf("extractString(id) = %q, want user-1", got)
	}
	if got := extractString(data, "missing"); got != "" {
		t.Errorf("extractString(missing) = %q, want empty", got)
	}
	if got := extractString(data, "count"); got != "" {
		t.Errorf("extractString(count) = %q, want empty (not string)", got)
	}
	if got := extractString(nil, "id"); got != "" {
		t.Errorf("extractString(nil data) = %q, want empty", got)
	}
}

func TestExtractClerkEmail(t *testing.T) {
	// Valid email
	data := map[string]interface{}{
		"email_addresses": []interface{}{
			map[string]interface{}{"email_address": "user@example.com"},
		},
	}
	if got := extractClerkEmail(data); got != "user@example.com" {
		t.Errorf("extractClerkEmail(valid) = %q, want user@example.com", got)
	}

	// No email_addresses
	if got := extractClerkEmail(map[string]interface{}{}); got != "" {
		t.Errorf("extractClerkEmail(no addrs) = %q, want empty", got)
	}

	// Nil data
	if got := extractClerkEmail(nil); got != "" {
		t.Errorf("extractClerkEmail(nil) = %q, want empty", got)
	}

	// Empty array
	data2 := map[string]interface{}{
		"email_addresses": []interface{}{},
	}
	if got := extractClerkEmail(data2); got != "" {
		t.Errorf("extractClerkEmail(empty arr) = %q, want empty", got)
	}
}
