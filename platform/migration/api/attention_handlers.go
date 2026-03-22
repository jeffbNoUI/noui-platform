package api

import (
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
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
