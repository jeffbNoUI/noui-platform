package api

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

// GetL4CoverageReport handles GET /api/v1/migration/engagements/{id}/profiling/{runId}/coverage.
// Returns the full coverage report with field_details for an L4 profiling run.
func (h *Handler) GetL4CoverageReport(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	runID := r.PathValue("runId")
	if engID == "" || runID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and run id are required")
		return
	}

	// Verify engagement exists.
	engagement, err := migrationdb.GetEngagement(h.DB, engID)
	if err != nil {
		slog.Error("l4 coverage: failed to get engagement", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", engID))
		return
	}

	// Verify profiling run exists and belongs to this engagement.
	run, err := migrationdb.GetProfilingRun(h.DB, runID)
	if err != nil {
		slog.Error("l4 coverage: failed to get profiling run", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get profiling run")
		return
	}
	if run == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("profiling run %s not found", runID))
		return
	}
	if run.EngagementID != engID {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "profiling run does not belong to this engagement")
		return
	}

	report, err := migrationdb.GetCoverageReport(h.DB, runID)
	if err != nil {
		slog.Error("l4 coverage: failed to get coverage report", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to get coverage report")
		return
	}
	if report == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("no coverage report for profiling run %s", runID))
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", report)
}

// GetL4CoverageGaps handles GET /api/v1/migration/engagements/{id}/profiling/{runId}/coverage/gaps.
// Returns only UNMAPPED and REVIEW_REQUIRED fields — the primary action list for analysts.
func (h *Handler) GetL4CoverageGaps(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	runID := r.PathValue("runId")
	if engID == "" || runID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and run id are required")
		return
	}

	// Verify engagement exists.
	engagement, err := migrationdb.GetEngagement(h.DB, engID)
	if err != nil {
		slog.Error("l4 gaps: failed to get engagement", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", engID))
		return
	}

	// Verify profiling run belongs to engagement.
	run, err := migrationdb.GetProfilingRun(h.DB, runID)
	if err != nil {
		slog.Error("l4 gaps: failed to get profiling run", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get profiling run")
		return
	}
	if run == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("profiling run %s not found", runID))
		return
	}
	if run.EngagementID != engID {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "profiling run does not belong to this engagement")
		return
	}

	report, err := migrationdb.GetCoverageReport(h.DB, runID)
	if err != nil {
		slog.Error("l4 gaps: failed to get coverage report", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to get coverage report")
		return
	}
	if report == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("no coverage report for profiling run %s", runID))
		return
	}

	// Filter to only gaps (UNMAPPED + REVIEW_REQUIRED).
	var gaps []models.CoverageFieldDetail
	for _, f := range report.FieldDetails {
		if f.Status == models.CoverageFieldUnmapped || f.Status == models.CoverageFieldReviewRequired {
			gaps = append(gaps, f)
		}
	}
	if gaps == nil {
		gaps = []models.CoverageFieldDetail{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]interface{}{
		"profiling_run_id":  report.ProfilingRunID,
		"schema_version_id": report.SchemaVersionID,
		"total_gaps":        len(gaps),
		"review_required":   report.ReviewRequiredCount,
		"unmapped":          report.NoMatchCount,
		"fields":            gaps,
	})
}
