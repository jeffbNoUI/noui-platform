package api

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
)

// HandleListAuditLog handles GET /api/v1/migration/engagements/{id}/audit-log.
// Returns paginated, filterable, read-only audit entries.
// Supports ?entity_type=, ?entity_id=, ?actor=, ?page=, ?per_page= query params.
func (h *Handler) HandleListAuditLog(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	filter := migrationdb.AuditLogFilter{
		Page:    1,
		PerPage: 50,
	}

	if v := r.URL.Query().Get("entity_type"); v != "" {
		filter.EntityType = &v
	}
	if v := r.URL.Query().Get("entity_id"); v != "" {
		filter.EntityID = &v
	}
	if v := r.URL.Query().Get("actor"); v != "" {
		filter.Actor = &v
	}
	if v := r.URL.Query().Get("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			filter.Page = n
		}
	}
	if v := r.URL.Query().Get("per_page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			filter.PerPage = n
		}
	}

	result, err := migrationdb.ListAuditLog(h.DB, engagementID, filter)
	if err != nil {
		slog.Error("failed to list audit log", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list audit log")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", result)
}
