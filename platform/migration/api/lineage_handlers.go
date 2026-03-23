package api

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
)

// HandleGetLineage handles GET /api/v1/migration/batches/{id}/lineage.
// Query params: member_id, column_name, limit (default 100, max 1000), offset (default 0).
func (h *Handler) HandleGetLineage(w http.ResponseWriter, r *http.Request) {
	batchID := r.PathValue("id")
	if batchID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id is required")
		return
	}

	memberID := r.URL.Query().Get("member_id")
	columnName := r.URL.Query().Get("column_name")

	limit := 100
	if v := r.URL.Query().Get("limit"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > 1000 {
		limit = 1000
	}

	offset := 0
	if v := r.URL.Query().Get("offset"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	records, err := migrationdb.GetLineage(h.DB, batchID, memberID, columnName, limit, offset)
	if err != nil {
		slog.Error("failed to get lineage", "error", err, "batch_id", batchID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to retrieve lineage records")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]any{
		"records": records,
		"count":   len(records),
		"limit":   limit,
		"offset":  offset,
	})
}

// HandleGetLineageSummary handles GET /api/v1/migration/batches/{id}/lineage/summary.
func (h *Handler) HandleGetLineageSummary(w http.ResponseWriter, r *http.Request) {
	batchID := r.PathValue("id")
	if batchID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id is required")
		return
	}

	summary, err := migrationdb.GetLineageSummary(h.DB, batchID)
	if err != nil {
		slog.Error("failed to get lineage summary", "error", err, "batch_id", batchID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to retrieve lineage summary")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", summary)
}
