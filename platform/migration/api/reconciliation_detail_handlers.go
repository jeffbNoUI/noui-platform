package api

import (
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
)

// ReconciliationSummary handles GET /api/v1/migration/engagements/{id}/reconciliation/summary.
func (h *Handler) ReconciliationSummary(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	summary, err := migrationdb.GetReconciliationSummary(h.DB, engagementID)
	if err != nil {
		slog.Error("failed to get reconciliation summary", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to get reconciliation summary")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", summary)
}

// ReconciliationByTier handles GET /api/v1/migration/engagements/{id}/reconciliation/tier/{n}.
func (h *Handler) ReconciliationByTier(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	tierStr := r.PathValue("n")
	tier, err := strconv.Atoi(tierStr)
	if err != nil || tier < 1 || tier > 3 {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
			fmt.Sprintf("tier must be 1, 2, or 3; got %q", tierStr))
		return
	}

	records, err := migrationdb.GetReconciliationByTier(h.DB, engagementID, tier)
	if err != nil {
		slog.Error("failed to get reconciliation by tier", "error", err,
			"engagement_id", engagementID, "tier", tier)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to get reconciliation by tier")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", records)
}
