package api

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

// ListRelationships handles GET /api/v1/migration/engagements/{id}/profiling/{runId}/relationships.
// Returns paginated source relationships. Supports ?orphans_only=true filter.
func (h *Handler) ListRelationships(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("runId")
	if runID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "runId is required")
		return
	}

	orphansOnly := r.URL.Query().Get("orphans_only") == "true"
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}

	rels, total, err := db.ListSourceRelationships(h.DB, runID, orphansOnly, page, perPage)
	if err != nil {
		slog.Error("failed to list relationships", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list relationships")
		return
	}
	if rels == nil {
		rels = []models.SourceRelationship{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]interface{}{
		"relationships": rels,
		"total":         total,
		"page":          page,
		"per_page":      perPage,
	})
}

// OrphanSummary handles GET /api/v1/migration/engagements/{id}/profiling/{runId}/orphan-summary.
// Returns aggregate orphan metrics for a profiling run.
func (h *Handler) OrphanSummary(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("runId")
	if runID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "runId is required")
		return
	}

	summary, err := db.GetOrphanSummary(h.DB, runID)
	if err != nil {
		slog.Error("failed to get orphan summary", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get orphan summary")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", summary)
}
