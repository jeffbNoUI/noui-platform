package api

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
)

// CompareEngagements handles GET /api/v1/migration/compare?ids=uuid1,uuid2.
func (h *Handler) CompareEngagements(w http.ResponseWriter, r *http.Request) {
	idsParam := r.URL.Query().Get("ids")
	if idsParam == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "ids query parameter is required (comma-separated)")
		return
	}

	ids := strings.Split(idsParam, ",")
	if len(ids) < 2 {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "at least 2 engagement ids are required for comparison")
		return
	}

	// Trim whitespace from each ID.
	for i := range ids {
		ids[i] = strings.TrimSpace(ids[i])
	}

	result, err := migrationdb.CompareEngagements(h.DB, ids)
	if err != nil {
		slog.Error("failed to compare engagements", "error", err, "ids", idsParam)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to compare engagements")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", result)
}
