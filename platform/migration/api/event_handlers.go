package api

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
)

// ListEvents handles GET /api/v1/migration/engagements/{id}/events.
// Supports ?limit and ?offset query parameters for pagination.
func (h *Handler) ListEvents(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	limit := 50
	offset := 0

	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}

	events, err := migrationdb.ListEvents(h.DB, engagementID, limit, offset)
	if err != nil {
		slog.Error("failed to list events", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to list events")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", events)
}
