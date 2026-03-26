package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
	"github.com/noui/platform/migration/worker"
)

// HandleInitiateDriftDetection handles POST /api/v1/migration/engagements/{id}/drift-detection.
func (h *Handler) HandleInitiateDriftDetection(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	if engID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	// Parse optional body — default drift_type is BOTH.
	var req models.CreateDriftDetectionRequest
	if r.Body != nil {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			// Tolerate empty body — use defaults.
			req.DriftType = models.DriftTypeBoth
		}
	}
	if req.DriftType == "" {
		req.DriftType = models.DriftTypeBoth
	}
	// Validate drift_type.
	switch req.DriftType {
	case models.DriftTypeSchema, models.DriftTypeData, models.DriftTypeBoth:
		// valid
	default:
		apiresponse.WriteError(w, http.StatusUnprocessableEntity, "migration", "VALIDATION_ERROR",
			fmt.Sprintf("invalid drift_type: %s (must be SCHEMA, DATA, or BOTH)", req.DriftType))
		return
	}

	// Validate engagement exists and is in GO_LIVE status.
	engagement, err := migrationdb.GetEngagement(h.DB, engID)
	if err != nil {
		slog.Error("failed to get engagement for drift detection", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND",
			fmt.Sprintf("engagement %s not found", engID))
		return
	}
	if engagement.Status != models.StatusGoLive {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "INVALID_PHASE",
			fmt.Sprintf("drift detection requires GO_LIVE status, current: %s", engagement.Status))
		return
	}

	// Get active schema version as baseline.
	baselineID, err := migrationdb.GetActiveSchemaVersionID(h.DB, engagement.TenantID)
	if err != nil {
		slog.Error("failed to get active schema version", "error", err, "tenant_id", engagement.TenantID)
		apiresponse.WriteError(w, http.StatusUnprocessableEntity, "migration", "NO_BASELINE",
			"no active schema version found — required for drift detection baseline")
		return
	}

	// Job queue required.
	if h.JobQueue == nil {
		apiresponse.WriteError(w, http.StatusServiceUnavailable, "migration", "SERVICE_UNAVAILABLE", "job queue not available")
		return
	}

	// Create drift detection run.
	run, err := migrationdb.CreateDriftDetectionRun(h.DB, engID, req.DriftType, baselineID)
	if err != nil {
		slog.Error("failed to create drift detection run", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to create drift detection run")
		return
	}

	// Enqueue job.
	input, _ := json.Marshal(worker.DriftDetectionInput{
		RunID:        run.RunID,
		EngagementID: engID,
		DriftType:    string(req.DriftType),
		BaselineID:   baselineID,
	})
	_, err = h.JobQueue.Enqueue(r.Context(), jobqueue.EnqueueParams{
		EngagementID: engID,
		JobType:      worker.JobTypeDriftDetection,
		Scope:        "drift_detection",
		InputJSON:    json.RawMessage(input),
	})
	if err != nil {
		slog.Error("failed to enqueue drift detection job", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to enqueue drift detection job")
		return
	}

	slog.Info("drift detection initiated", "engagement_id", engID, "run_id", run.RunID, "drift_type", req.DriftType)
	apiresponse.WriteSuccess(w, http.StatusAccepted, "migration", run)
}

// HandleListDriftDetectionRuns handles GET /api/v1/migration/engagements/{id}/drift-detection.
func (h *Handler) HandleListDriftDetectionRuns(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	if engID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	page, perPage := parsePagination(r)

	runs, total, err := migrationdb.ListDriftDetectionRuns(h.DB, engID, page, perPage)
	if err != nil {
		slog.Error("failed to list drift detection runs", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list drift detection runs")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]interface{}{
		"runs":     runs,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

// HandleGetDriftDetectionRun handles GET /api/v1/migration/engagements/{id}/drift-detection/{runId}.
func (h *Handler) HandleGetDriftDetectionRun(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	runID := r.PathValue("runId")
	if engID == "" || runID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and run id are required")
		return
	}

	run, err := migrationdb.GetDriftDetectionRun(h.DB, runID)
	if err != nil {
		slog.Error("failed to get drift detection run", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get drift detection run")
		return
	}
	if run == nil || run.EngagementID != engID {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "drift detection run not found")
		return
	}

	// Get severity filter from query params.
	severity := r.URL.Query().Get("severity")
	var severityPtr *string
	if severity != "" {
		severityPtr = &severity
	}

	records, _, err := migrationdb.GetDriftRecordsForRun(h.DB, runID, severityPtr, 1, 100)
	if err != nil {
		slog.Error("failed to get drift records", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get drift records")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", models.DriftDetectionRunWithRecords{
		Run:     *run,
		Records: records,
	})
}

// HandleGetDriftDetectionRecords handles GET /api/v1/migration/engagements/{id}/drift-detection/{runId}/records.
func (h *Handler) HandleGetDriftDetectionRecords(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	runID := r.PathValue("runId")
	if engID == "" || runID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and run id are required")
		return
	}

	// Verify run exists and belongs to engagement.
	run, err := migrationdb.GetDriftDetectionRun(h.DB, runID)
	if err != nil {
		slog.Error("failed to get drift detection run", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get drift detection run")
		return
	}
	if run == nil || run.EngagementID != engID {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "drift detection run not found")
		return
	}

	page, perPage := parsePagination(r)
	severity := r.URL.Query().Get("severity")
	var severityPtr *string
	if severity != "" {
		severityPtr = &severity
	}

	records, total, err := migrationdb.GetDriftRecordsForRun(h.DB, runID, severityPtr, page, perPage)
	if err != nil {
		slog.Error("failed to get drift records", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get drift records")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]interface{}{
		"records":  records,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

// parsePagination extracts page and per_page from query parameters.
func parsePagination(r *http.Request) (int, int) {
	page := 1
	perPage := 20
	if p := r.URL.Query().Get("page"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 0 {
			page = n
		}
	}
	if pp := r.URL.Query().Get("per_page"); pp != "" {
		if n, err := strconv.Atoi(pp); err == nil && n > 0 && n <= 100 {
			perPage = n
		}
	}
	return page, perPage
}
