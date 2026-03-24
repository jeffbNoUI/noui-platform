package api

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/mapper"
	"github.com/noui/platform/migration/profiler"
)

// CoverageReport handles GET /api/v1/migration/engagements/{id}/coverage-report.
// It produces a target-anchored coverage assessment: for each canonical field,
// how well can the source satisfy it?
func (h *Handler) CoverageReport(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	// Verify engagement exists.
	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("coverage report: failed to get engagement", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", id))
		return
	}

	registry := mapper.NewRegistry()

	report, err := profiler.ComputeCoverageFromDB(h.DB, id, registry, nil)
	if err != nil {
		slog.Error("coverage report: failed to compute", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to compute coverage report")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", report)
}
