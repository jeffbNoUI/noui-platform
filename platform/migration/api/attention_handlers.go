package api

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

// HandleGetAttentionItems handles GET /api/v1/migration/engagements/{id}/attention.
// Supports optional query params: priority (P1, P2, P3), source (RISK, RECONCILIATION).
func (h *Handler) HandleGetAttentionItems(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	var priority, source *string
	if p := r.URL.Query().Get("priority"); p != "" {
		priority = &p
	}
	if s := r.URL.Query().Get("source"); s != "" {
		source = &s
	}

	items, err := migrationdb.GetAttentionItems(h.DB, id, priority, source)
	if err != nil {
		slog.Error("failed to get attention items", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get attention items")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", items)
}

// HandleGetAttentionSummary handles GET /api/v1/migration/attention/summary.
func (h *Handler) HandleGetAttentionSummary(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)

	summary, err := migrationdb.GetAttentionSummary(h.DB, tid)
	if err != nil {
		slog.Error("failed to get attention summary", "error", err, "tenant_id", tid)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get attention summary")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", summary)
}

// attentionRequest is the JSON body for resolve/defer endpoints.
type attentionRequest struct {
	Source         string `json:"source"`
	ResolutionNote string `json:"resolution_note"`
}

// HandleResolveAttention handles PATCH /api/v1/migration/engagements/{id}/attention/{itemId}/resolve.
func (h *Handler) HandleResolveAttention(w http.ResponseWriter, r *http.Request) {
	h.handleAttentionMutation(w, r, "resolve")
}

// HandleDeferAttention handles PATCH /api/v1/migration/engagements/{id}/attention/{itemId}/defer.
func (h *Handler) HandleDeferAttention(w http.ResponseWriter, r *http.Request) {
	h.handleAttentionMutation(w, r, "defer")
}

// handleAttentionMutation is the shared implementation for resolve and defer.
func (h *Handler) handleAttentionMutation(w http.ResponseWriter, r *http.Request, action string) {
	engagementID := r.PathValue("id")
	itemID := r.PathValue("itemId")
	if engagementID == "" || itemID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and item id are required")
		return
	}

	var req attentionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	if req.Source != "RISK" && req.Source != "RECONCILIATION" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "invalid_source", "source must be RISK or RECONCILIATION")
		return
	}

	// resolved_by comes from JWT sub claim, not request body.
	resolvedBy := auth.UserID(r.Context())
	if resolvedBy == "" {
		resolvedBy = "system" // dev fallback
	}

	var rowsAffected int64
	var err error
	var eventType string

	switch action {
	case "resolve":
		eventType = "attention_resolved"
		rowsAffected, err = migrationdb.ResolveAttentionItem(h.DB, req.Source, itemID, engagementID, resolvedBy, req.ResolutionNote)
	case "defer":
		eventType = "attention_deferred"
		rowsAffected, err = migrationdb.DeferAttentionItem(h.DB, req.Source, itemID, engagementID, resolvedBy, req.ResolutionNote)
	}

	if err != nil {
		slog.Error("failed to "+action+" attention item", "error", err, "item_id", itemID, "source", req.Source)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to "+action+" attention item")
		return
	}

	if rowsAffected == 0 {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "already_resolved", "item is already resolved or not found")
		return
	}

	// Activity log event for audit trail.
	payload, _ := json.Marshal(map[string]string{
		"item_id": itemID,
		"source":  req.Source,
		"action":  action,
		"note":    req.ResolutionNote,
	})
	migrationdb.InsertEvent(h.DB, engagementID, eventType, payload)

	// Immutable audit log entry (AC-6: audit integration into attention mutations).
	// Actor comes from JWT context, never from request body.
	afterState, _ := json.Marshal(map[string]string{
		"source":          req.Source,
		"resolution_note": req.ResolutionNote,
		"resolved_by":     resolvedBy,
	})
	if h.Audit != nil {
		h.Audit.Log(r.Context(), models.AuditEntry{
			EngagementID: engagementID,
			Actor:        resolvedBy,
			Action:       action,
			EntityType:   "attention",
			EntityID:     itemID,
			BeforeState:  nil, // attention items are derived, no prior state to capture
			AfterState:   afterState,
		})
	}

	// WebSocket broadcast to engagement members.
	if engagementID != "" {
		h.broadcast(engagementID, eventType, map[string]string{
			"item_id":       itemID,
			"source":        req.Source,
			"engagement_id": engagementID,
		})
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]string{
		"item_id": itemID,
		"source":  req.Source,
		"action":  action,
		"status":  "success",
	})
}
