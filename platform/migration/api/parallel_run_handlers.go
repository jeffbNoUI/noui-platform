package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
)

// --- Request / Response types ---

// createParallelRunRequest is the JSON body for POST .../parallel-runs.
type createParallelRunRequest struct {
	Name            string   `json:"name"`
	Description     *string  `json:"description"`
	LegacySource    string   `json:"legacy_source"`
	CanonicalSource string   `json:"canonical_source"`
	ComparisonMode  string   `json:"comparison_mode"`
	SampleRate      *float64 `json:"sample_rate"`
	Entities        []string `json:"entities"`
}

// parallelRunResultsResponse is the paginated response for GET .../results.
type parallelRunResultsResponse struct {
	Results []models.ParallelRunResult `json:"results"`
	Total   int                        `json:"total"`
	Page    int                        `json:"page"`
	PerPage int                        `json:"per_page"`
}

// parallelRunDetailResponse combines a parallel run with its summary statistics.
type parallelRunDetailResponse struct {
	models.ParallelRun
	Summary *models.ParallelRunSummary `json:"summary"`
}

// --- Handlers ---

// CreateParallelRun handles POST /api/v1/migration/engagements/{id}/parallel-runs.
// Creates a new parallel run and enqueues a parallel_run job.
// Requires editor-or-above role.
func (h *Handler) CreateParallelRun(w http.ResponseWriter, r *http.Request) {
	if !h.requireEditor(w, r) {
		return
	}

	engID := r.PathValue("id")
	if engID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	var req createParallelRunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	if req.Name == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "name is required")
		return
	}
	if req.LegacySource == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "legacy_source is required")
		return
	}
	if req.CanonicalSource == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "canonical_source is required")
		return
	}

	// Validate comparison_mode — CONTINUOUS returns 400 (invalid enum for this API).
	switch models.ComparisonMode(req.ComparisonMode) {
	case models.ComparisonModeSample, models.ComparisonModeFull:
		// valid
	case models.ComparisonModeContinuous:
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "CONTINUOUS mode not yet supported")
		return
	default:
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "comparison_mode must be SAMPLE or FULL")
		return
	}

	startedBy := auth.UserID(r.Context())
	if startedBy == "" {
		startedBy = "system"
	}

	run := &models.ParallelRun{
		EngagementID:    engID,
		Name:            req.Name,
		Description:     req.Description,
		Status:          models.ParallelRunPending,
		LegacySource:    req.LegacySource,
		CanonicalSource: req.CanonicalSource,
		ComparisonMode:  models.ComparisonMode(req.ComparisonMode),
		SampleRate:      req.SampleRate,
		StartedBy:       startedBy,
	}

	created, err := migrationdb.CreateParallelRun(h.DB, run)
	if err != nil {
		slog.Error("failed to create parallel run", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to create parallel run")
		return
	}

	// Enqueue the parallel_run job.
	if h.JobQueue != nil {
		sampleRate := 0.1 // default for SAMPLE mode
		if req.SampleRate != nil {
			sampleRate = *req.SampleRate
		}
		if models.ComparisonMode(req.ComparisonMode) == models.ComparisonModeFull {
			sampleRate = 1.0
		}

		inputJSON, _ := json.Marshal(map[string]interface{}{
			"run_id":          created.RunID,
			"engagement_id":   engID,
			"sample_rate":     sampleRate,
			"comparison_mode": req.ComparisonMode,
			"entities":        req.Entities,
		})

		_, err := h.JobQueue.Enqueue(r.Context(), jobqueue.EnqueueParams{
			EngagementID: engID,
			JobType:      jobqueue.JobTypeParallelRun,
			Scope:        "parallel_run:" + created.RunID,
			Priority:     5,
			InputJSON:    inputJSON,
		})
		if err != nil {
			slog.Error("failed to enqueue parallel run job", "error", err, "run_id", created.RunID)
			// Run was created but job enqueue failed — log but still return the run.
		}
	}

	slog.Info("parallel run created",
		"run_id", created.RunID,
		"engagement_id", engID,
		"comparison_mode", req.ComparisonMode,
		"started_by", startedBy,
	)

	h.broadcast(engID, "parallel_run_created", map[string]string{
		"run_id":        created.RunID,
		"engagement_id": engID,
	})

	apiresponse.WriteSuccess(w, http.StatusCreated, "migration", created)
}

// ListParallelRuns handles GET /api/v1/migration/engagements/{id}/parallel-runs.
// Supports ?status= query parameter for filtering.
// All authenticated roles can view.
func (h *Handler) ListParallelRuns(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	if engID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	var statusFilter *string
	if s := r.URL.Query().Get("status"); s != "" {
		statusFilter = &s
	}

	runs, err := migrationdb.ListParallelRuns(h.DB, engID, statusFilter)
	if err != nil {
		slog.Error("failed to list parallel runs", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list parallel runs")
		return
	}

	if runs == nil {
		runs = []models.ParallelRun{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", runs)
}

// GetParallelRun handles GET /api/v1/migration/engagements/{id}/parallel-runs/{runId}.
// Returns a single parallel run with summary statistics.
// All authenticated roles can view.
func (h *Handler) GetParallelRun(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	runID := r.PathValue("runId")
	if engID == "" || runID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and run id are required")
		return
	}

	run, err := migrationdb.GetParallelRun(h.DB, runID)
	if err != nil {
		slog.Error("failed to get parallel run", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get parallel run")
		return
	}
	if run == nil || run.EngagementID != engID {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "parallel run not found")
		return
	}

	summary, err := migrationdb.GetParallelRunSummary(h.DB, runID)
	if err != nil {
		slog.Warn("failed to get parallel run summary", "error", err, "run_id", runID)
		// Non-fatal — return run without summary.
	}

	resp := parallelRunDetailResponse{
		ParallelRun: *run,
		Summary:     summary,
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", resp)
}

// GetParallelRunResults handles GET /api/v1/migration/engagements/{id}/parallel-runs/{runId}/results.
// Supports ?match=true|false, ?entity=, ?page=, ?per_page= query params.
// per_page max is 200 — requests above 200 are clamped (not rejected).
// All authenticated roles can view.
func (h *Handler) GetParallelRunResults(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	runID := r.PathValue("runId")
	if engID == "" || runID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and run id are required")
		return
	}

	// Verify run belongs to engagement.
	run, err := migrationdb.GetParallelRun(h.DB, runID)
	if err != nil {
		slog.Error("failed to get parallel run for results", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get parallel run")
		return
	}
	if run == nil || run.EngagementID != engID {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "parallel run not found")
		return
	}

	// Parse filters.
	var matchFilter *bool
	if m := r.URL.Query().Get("match"); m != "" {
		b, err := strconv.ParseBool(m)
		if err == nil {
			matchFilter = &b
		}
	}

	var entityFilter *string
	if e := r.URL.Query().Get("entity"); e != "" {
		entityFilter = &e
	}

	// Parse pagination — per_page clamped to max 200, not rejected.
	page := 1
	perPage := 50
	if p := r.URL.Query().Get("page"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 0 {
			page = n
		}
	}
	if pp := r.URL.Query().Get("per_page"); pp != "" {
		if n, err := strconv.Atoi(pp); err == nil && n > 0 {
			perPage = n
		}
	}
	if perPage > 200 {
		perPage = 200
	}

	offset := (page - 1) * perPage

	results, err := migrationdb.GetParallelRunResults(h.DB, runID, matchFilter, entityFilter, perPage, offset)
	if err != nil {
		slog.Error("failed to get parallel run results", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get parallel run results")
		return
	}

	total, err := migrationdb.CountParallelRunResults(h.DB, runID, matchFilter, entityFilter)
	if err != nil {
		slog.Warn("failed to count parallel run results", "error", err, "run_id", runID)
		total = len(results) // fallback
	}

	if results == nil {
		results = []models.ParallelRunResult{}
	}

	apiresponse.WriteJSON(w, http.StatusOK, parallelRunResultsResponse{
		Results: results,
		Total:   total,
		Page:    page,
		PerPage: perPage,
	})
}

// CancelParallelRun handles POST /api/v1/migration/engagements/{id}/parallel-runs/{runId}/cancel.
// For PENDING/CLAIMED jobs: cancels via jobqueue.CancelScoped.
// For RUNNING jobs: sets parallel_run status to CANCELLED — worker detects on next heartbeat
// (cooperative cancel with up to 30s latency).
// Returns 409 if run is already in terminal state (COMPLETED|FAILED|CANCELLED).
// PAUSED runs are cancellable (PAUSED->CANCELLED is a valid transition).
// Requires editor-or-above role.
func (h *Handler) CancelParallelRun(w http.ResponseWriter, r *http.Request) {
	if !h.requireEditor(w, r) {
		return
	}

	engID := r.PathValue("id")
	runID := r.PathValue("runId")
	if engID == "" || runID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and run id are required")
		return
	}

	run, err := migrationdb.GetParallelRun(h.DB, runID)
	if err != nil {
		slog.Error("failed to get parallel run for cancel", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get parallel run")
		return
	}
	if run == nil || run.EngagementID != engID {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "parallel run not found")
		return
	}

	// Check if transition to CANCELLED is valid.
	if !run.Status.CanTransitionTo(models.ParallelRunCancelled) {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "CANCEL_FAILED",
			"parallel run is in terminal state: "+string(run.Status))
		return
	}

	// Cancel strategy depends on current status:
	// - PENDING: Update parallel_run status to CANCELLED. When the worker picks up the
	//   associated job and the executor tries CANCELLED→RUNNING, the transition fails
	//   and the job is marked FAILED. This is effectively a pre-emptive cancel.
	// - RUNNING: Set parallel_run status to CANCELLED. The worker's heartbeat loop
	//   (default 30s interval) detects the cancelled status and stops the executor
	//   via context cancellation (cooperative cancel — up to 30s latency).
	// - PAUSED: Directly transition to CANCELLED.

	// Update parallel_run status to CANCELLED.
	updated, err := migrationdb.UpdateParallelRunStatus(h.DB, runID, models.ParallelRunCancelled)
	if err != nil {
		slog.Error("failed to cancel parallel run", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusConflict, "migration", "CANCEL_FAILED", err.Error())
		return
	}

	slog.Info("parallel run cancelled",
		"run_id", runID,
		"engagement_id", engID,
		"previous_status", string(run.Status),
	)

	h.broadcast(engID, "parallel_run_cancelled", map[string]string{
		"run_id":        runID,
		"engagement_id": engID,
	})

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", updated)
}

// TODO: POST .../parallel-runs/{runId}/pause — PAUSE endpoint deferred to a future contract.
// M03a schema supports PAUSED status, but no API endpoint triggers it yet.
