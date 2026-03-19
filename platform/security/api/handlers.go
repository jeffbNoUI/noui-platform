// Package api implements HTTP handlers for the Security Events service.
package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	secdb "github.com/noui/platform/security/db"
	"github.com/noui/platform/security/models"
	"github.com/noui/platform/validation"
)

// Handler holds dependencies for Security Events API handlers.
type Handler struct {
	store *secdb.Store
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(database *sql.DB) *Handler {
	return &Handler{
		store: secdb.NewStore(database),
	}
}

// RegisterRoutes sets up all security events API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	// Events
	mux.HandleFunc("GET /api/v1/security/events/stats", h.GetEventStats)
	mux.HandleFunc("GET /api/v1/security/events", h.ListEvents)
	mux.HandleFunc("POST /api/v1/security/events", h.CreateEvent)

	// Sessions
	mux.HandleFunc("GET /api/v1/security/sessions", h.ListActiveSessions)
	mux.HandleFunc("POST /api/v1/security/sessions", h.UpsertSession)
	mux.HandleFunc("DELETE /api/v1/security/sessions/{sessionId}", h.DeleteSession)

	// Clerk webhook
	mux.HandleFunc("POST /api/v1/security/webhook/clerk", h.ClerkWebhook)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "security",
		"version": "0.1.0",
	})
}

// --- Event Handlers ---

func (h *Handler) ListEvents(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)

	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	filter := models.EventFilter{
		EventType: r.URL.Query().Get("event_type"),
		ActorID:   r.URL.Query().Get("actor_id"),
		DateFrom:  r.URL.Query().Get("date_from"),
		DateTo:    r.URL.Query().Get("date_to"),
		Limit:     limit,
		Offset:    offset,
	}

	events, total, err := h.store.ListEvents(r.Context(), tid, filter)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "security", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, "security", events, total, filter.Limit, filter.Offset)
}

func (h *Handler) CreateEvent(w http.ResponseWriter, r *http.Request) {
	var req models.CreateEventRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "security", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("eventType", req.EventType)
	errs.Enum("eventType", req.EventType, models.EventTypeValues)
	errs.Required("actorId", req.ActorID)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "security", "INVALID_REQUEST", errs.Error())
		return
	}

	tid := tenantID(r)
	event, err := h.store.CreateEvent(r.Context(), tid, req)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "security", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "security", event)
}

func (h *Handler) GetEventStats(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)

	stats, err := h.store.GetEventStats(r.Context(), tid)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "security", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "security", stats)
}

// --- Session Handlers ---

func (h *Handler) ListActiveSessions(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)

	sessions, err := h.store.ListActiveSessions(r.Context(), tid)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "security", "DB_ERROR", err.Error())
		return
	}
	if sessions == nil {
		sessions = []models.ActiveSession{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "security", sessions)
}

func (h *Handler) UpsertSession(w http.ResponseWriter, r *http.Request) {
	var req models.CreateSessionRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "security", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("userId", req.UserID)
	errs.Required("sessionId", req.SessionID)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "security", "INVALID_REQUEST", errs.Error())
		return
	}

	tid := tenantID(r)
	session, err := h.store.UpsertSession(r.Context(), tid, req)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "security", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "security", session)
}

func (h *Handler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("sessionId")
	if sessionID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "security", "INVALID_REQUEST", "sessionId is required")
		return
	}

	tid := tenantID(r)
	err := h.store.DeleteSession(r.Context(), tid, sessionID)
	if err != nil {
		if err == secdb.ErrNotFound {
			apiresponse.WriteError(w, http.StatusNotFound, "security", "NOT_FOUND", "Session not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "security", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "security", map[string]string{"status": "deleted"})
}

// --- Clerk Webhook Handler ---

func (h *Handler) ClerkWebhook(w http.ResponseWriter, r *http.Request) {
	// Read raw body for signature verification, then unmarshal.
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "security", "INVALID_REQUEST", "failed to read request body")
		return
	}
	defer r.Body.Close()

	if err := verifyClerkSignature(r.Header, bodyBytes); err != nil {
		apiresponse.WriteError(w, http.StatusUnauthorized, "security", "UNAUTHORIZED", err.Error())
		return
	}

	var payload models.ClerkWebhookPayload
	if err := json.Unmarshal(bodyBytes, &payload); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "security", "INVALID_REQUEST", err.Error())
		return
	}

	if payload.Type == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "security", "INVALID_REQUEST", "type is required")
		return
	}

	// Map Clerk event types to our event types
	eventType := mapClerkEventType(payload.Type)
	if eventType == "" {
		// Unrecognized event type — acknowledge but skip
		apiresponse.WriteSuccess(w, http.StatusOK, "security", map[string]string{"status": "ignored", "clerkType": payload.Type})
		return
	}

	// Extract actor info from Clerk data
	actorID := extractString(payload.Data, "id")
	if actorID == "" {
		actorID = extractString(payload.Data, "user_id")
	}
	actorEmail := extractClerkEmail(payload.Data)

	// Serialize raw payload as metadata
	rawJSON, _ := json.Marshal(payload)
	metadata := string(rawJSON)

	tid := tenantID(r)
	req := models.CreateEventRequest{
		EventType:  eventType,
		ActorID:    actorID,
		ActorEmail: actorEmail,
		Metadata:   metadata,
	}

	event, err := h.store.CreateEvent(r.Context(), tid, req)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "security", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "security", event)
}

// mapClerkEventType maps Clerk webhook event types to our internal event types.
func mapClerkEventType(clerkType string) string {
	switch clerkType {
	case "user.signed_in":
		return "login_success"
	case "session.created":
		return "session_start"
	case "session.ended":
		return "session_end"
	case "user.updated":
		return "role_change"
	case "user.created":
		return "account_created"
	case "user.deleted":
		return "account_deleted"
	case "session.revoked":
		return "session_revoked"
	case "organization.membership.created":
		return "org_member_added"
	case "organization.membership.deleted":
		return "org_member_removed"
	default:
		return ""
	}
}

// extractString safely extracts a string value from a map.
func extractString(data map[string]interface{}, key string) string {
	if data == nil {
		return ""
	}
	v, ok := data[key]
	if !ok {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return ""
	}
	return s
}

// extractClerkEmail extracts the primary email from Clerk's email_addresses array.
func extractClerkEmail(data map[string]interface{}) string {
	if data == nil {
		return ""
	}
	addrs, ok := data["email_addresses"]
	if !ok {
		return ""
	}
	arr, ok := addrs.([]interface{})
	if !ok || len(arr) == 0 {
		return ""
	}
	first, ok := arr[0].(map[string]interface{})
	if !ok {
		return ""
	}
	email, ok := first["email_address"].(string)
	if !ok {
		return ""
	}
	return email
}

// --- Helper Functions ---

const defaultTenantID = "00000000-0000-0000-0000-000000000001"

func tenantID(r *http.Request) string {
	if tid := auth.TenantID(r.Context()); tid != "" {
		return tid
	}
	return defaultTenantID
}

func decodeJSON(r *http.Request, v any) error {
	if r.Body == nil {
		return fmt.Errorf("request body is empty")
	}
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

func intParam(r *http.Request, name string, defaultVal int) int {
	s := r.URL.Query().Get(name)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}

// verifyClerkSignature validates Svix webhook signatures used by Clerk.
// If CLERK_WEBHOOK_SECRET is not set, validation is skipped (dev mode).
func verifyClerkSignature(headers http.Header, body []byte) error {
	secret := os.Getenv("CLERK_WEBHOOK_SECRET")
	if secret == "" {
		slog.Warn("CLERK_WEBHOOK_SECRET not set — skipping webhook signature validation (dev mode)")
		return nil
	}

	svixID := headers.Get("svix-id")
	svixTimestamp := headers.Get("svix-timestamp")
	svixSignature := headers.Get("svix-signature")

	if svixID == "" || svixTimestamp == "" || svixSignature == "" {
		return fmt.Errorf("missing svix signature headers")
	}

	// Clerk/Svix secrets are base64-encoded with a "whsec_" prefix
	secretBytes, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(secret, "whsec_"))
	if err != nil {
		return fmt.Errorf("invalid webhook secret encoding")
	}

	// Signed content: "${svix_id}.${svix_timestamp}.${body}"
	signedContent := fmt.Sprintf("%s.%s.%s", svixID, svixTimestamp, string(body))

	mac := hmac.New(sha256.New, secretBytes)
	mac.Write([]byte(signedContent))
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	// svix-signature may contain multiple signatures: "v1,<sig1> v1,<sig2>"
	for _, sig := range strings.Split(svixSignature, " ") {
		parts := strings.SplitN(sig, ",", 2)
		if len(parts) != 2 {
			continue
		}
		if hmac.Equal([]byte(expected), []byte(parts[1])) {
			return nil
		}
	}

	return fmt.Errorf("invalid webhook signature")
}
