// Package api implements HTTP handlers for the Preferences service.
package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	prefdb "github.com/noui/platform/preferences/db"
	"github.com/noui/platform/preferences/models"
)

// Handler holds dependencies for Preferences API handlers.
type Handler struct {
	store *prefdb.Store
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(database *sql.DB) *Handler {
	return &Handler{store: prefdb.NewStore(database)}
}

// RegisterRoutes sets up all Preferences API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	// Preferences
	mux.HandleFunc("GET /api/v1/preferences", h.GetPreferences)
	mux.HandleFunc("PUT /api/v1/preferences", h.UpsertPreference)
	mux.HandleFunc("DELETE /api/v1/preferences", h.ResetPreferences)

	// Suggestions
	mux.HandleFunc("GET /api/v1/suggestions", h.GetSuggestions)
	mux.HandleFunc("POST /api/v1/suggestions/{id}/respond", h.RespondToSuggestion)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "preferences",
		"version": "0.1.0",
	})
}

// --- Preference Handlers ---

// GetPreferences returns all preferences for the authenticated user and context key.
func (h *Handler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	if userID == "" {
		apiresponse.WriteError(w, http.StatusUnauthorized, "preferences", "UNAUTHORIZED", "user ID required")
		return
	}

	contextKey := r.URL.Query().Get("context_key")
	if contextKey == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "preferences", "INVALID_REQUEST", "context_key query parameter is required")
		return
	}

	prefs, err := h.store.GetPreferences(r.Context(), userID, contextKey)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "preferences", "DB_ERROR", err.Error())
		return
	}

	// Return [] not null when empty
	if prefs == nil {
		prefs = []map[string]any{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "preferences", prefs)
}

// UpsertPreference creates or updates a user preference and logs the event.
func (h *Handler) UpsertPreference(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	if userID == "" {
		apiresponse.WriteError(w, http.StatusUnauthorized, "preferences", "UNAUTHORIZED", "user ID required")
		return
	}
	tid := tenantID(r)

	var req models.UpsertPreferenceRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "preferences", "INVALID_REQUEST", err.Error())
		return
	}

	// Validate required fields
	if req.ContextKey == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "preferences", "INVALID_REQUEST", "contextKey is required")
		return
	}
	if req.PanelID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "preferences", "INVALID_REQUEST", "panelId is required")
		return
	}
	if req.ActionType == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "preferences", "INVALID_REQUEST", "actionType is required")
		return
	}

	// Apply defaults
	if req.Visibility == "" {
		req.Visibility = models.VisibilityVisible
	}
	if req.DefaultState == "" {
		req.DefaultState = models.DefaultCollapsed
	}

	// Log the event
	payload := map[string]any{
		"visibility":   string(req.Visibility),
		"defaultState": string(req.DefaultState),
	}
	if req.Position != nil {
		payload["position"] = *req.Position
	}

	if err := h.store.InsertEvent(r.Context(), userID, tid, req.ContextKey, string(req.ActionType), req.PanelID, req.ContextFlags, payload); err != nil {
		slog.Error("failed to insert preference event", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "preferences", "DB_ERROR", err.Error())
		return
	}

	// Upsert the preference
	if err := h.store.UpsertPreference(r.Context(), userID, tid, req.ContextKey, req.PanelID, string(req.Visibility), req.Position, string(req.DefaultState)); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "preferences", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "preferences", map[string]string{"status": "saved"})
}

// ResetPreferences deletes all preferences for a user and context key, logging a reset event.
func (h *Handler) ResetPreferences(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	if userID == "" {
		apiresponse.WriteError(w, http.StatusUnauthorized, "preferences", "UNAUTHORIZED", "user ID required")
		return
	}
	tid := tenantID(r)

	contextKey := r.URL.Query().Get("context_key")
	if contextKey == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "preferences", "INVALID_REQUEST", "context_key query parameter is required")
		return
	}

	// Log reset event
	if err := h.store.InsertEvent(r.Context(), userID, tid, contextKey, "reset", "", nil, nil); err != nil {
		slog.Error("failed to insert reset event", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "preferences", "DB_ERROR", err.Error())
		return
	}

	// Delete all preferences for this user+context
	if err := h.store.DeletePreferences(r.Context(), userID, contextKey); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "preferences", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "preferences", map[string]string{"status": "reset"})
}

// --- Suggestion Handlers ---

// GetSuggestions returns up to 1 suggestion for the authenticated user's role and context key.
func (h *Handler) GetSuggestions(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	if userID == "" {
		apiresponse.WriteError(w, http.StatusUnauthorized, "preferences", "UNAUTHORIZED", "user ID required")
		return
	}

	role := auth.UserRole(r.Context())
	if role == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "preferences", "INVALID_REQUEST", "user role not available in context")
		return
	}

	contextKey := r.URL.Query().Get("context_key")
	if contextKey == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "preferences", "INVALID_REQUEST", "context_key query parameter is required")
		return
	}

	suggestions, err := h.store.GetSuggestions(r.Context(), userID, role, contextKey)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "preferences", "DB_ERROR", err.Error())
		return
	}

	// Return [] not null when empty
	if suggestions == nil {
		suggestions = []map[string]any{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "preferences", suggestions)
}

// RespondToSuggestion records a user's response to a suggestion.
func (h *Handler) RespondToSuggestion(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	if userID == "" {
		apiresponse.WriteError(w, http.StatusUnauthorized, "preferences", "UNAUTHORIZED", "user ID required")
		return
	}

	suggestionID := r.PathValue("id")
	if suggestionID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "preferences", "INVALID_REQUEST", "suggestion ID is required")
		return
	}

	var req models.RespondRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "preferences", "INVALID_REQUEST", err.Error())
		return
	}

	// Validate response value
	validResponses := map[string]bool{
		"accepted":  true,
		"dismissed": true,
		"snoozed":   true,
	}
	if !validResponses[req.Response] {
		apiresponse.WriteError(w, http.StatusBadRequest, "preferences", "INVALID_REQUEST", "response must be one of: accepted, dismissed, snoozed")
		return
	}

	if err := h.store.RespondToSuggestion(r.Context(), userID, suggestionID, req.Response); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "preferences", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "preferences", map[string]string{"status": "recorded"})
}

// --- Helper Functions ---

const defaultTenantID = "00000000-0000-0000-0000-000000000001"

func tenantID(r *http.Request) string {
	if tid := auth.TenantID(r.Context()); tid != "" {
		return tid
	}
	return defaultTenantID
}

func decodeJSON(r *http.Request, v interface{}) error {
	if r.Body == nil {
		return fmt.Errorf("request body is empty")
	}
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

