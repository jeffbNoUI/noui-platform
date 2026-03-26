package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	"github.com/noui/platform/migration/jobqueue"
)

// requireEditor checks that the request context has an editor or owner role.
// Returns true if the role is sufficient; writes 403 and returns false otherwise.
func (h *Handler) requireEditor(w http.ResponseWriter, r *http.Request) bool {
	role := auth.UserRole(r.Context())
	if role == "editor" || role == "owner" {
		return true
	}
	apiresponse.WriteError(w, http.StatusForbidden, "migration", "FORBIDDEN", "editor role required")
	return false
}

// ListJobs handles GET /api/v1/migration/engagements/{id}/jobs.
// Supports ?type=, ?status=, ?sort=, ?cursor=, ?cursor_id=, ?limit= query params.
func (h *Handler) ListJobs(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	if engID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	if h.JobQueue == nil {
		apiresponse.WriteError(w, http.StatusServiceUnavailable, "migration", "JOB_QUEUE_UNAVAILABLE", "job queue not initialized")
		return
	}

	params := jobqueue.ListParams{Limit: 100}
	if jt := r.URL.Query().Get("type"); jt != "" {
		params.JobType = &jt
	}
	if st := r.URL.Query().Get("status"); st != "" {
		s := jobqueue.JobStatus(st)
		params.Status = &s
	}
	if sort := r.URL.Query().Get("sort"); sort != "" {
		params.Sort = sort
	}
	if lim := r.URL.Query().Get("limit"); lim != "" {
		if n, err := strconv.Atoi(lim); err == nil && n > 0 {
			params.Limit = n
		}
	}

	// Cursor-based pagination: both cursor and cursor_id required together
	cursorStr := r.URL.Query().Get("cursor")
	cursorID := r.URL.Query().Get("cursor_id")
	if cursorStr != "" || cursorID != "" {
		if cursorStr == "" || cursorID == "" {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "cursor and cursor_id must be provided together")
			return
		}
		if t, err := time.Parse(time.RFC3339Nano, cursorStr); err == nil {
			params.CursorAt = &t
			params.CursorID = &cursorID
		}
	}

	jobs, err := h.JobQueue.ListByEngagement(r.Context(), engID, params)
	if err != nil {
		slog.Error("failed to list jobs", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list jobs")
		return
	}

	if jobs == nil {
		jobs = []jobqueue.Job{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", jobs)
}

// GetJob handles GET /api/v1/migration/engagements/{id}/jobs/{job_id}.
// Scoped to engagement — returns 404 if job doesn't belong to the engagement.
func (h *Handler) GetJob(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	jobID := r.PathValue("job_id")
	if engID == "" || jobID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and job_id are required")
		return
	}

	if h.JobQueue == nil {
		apiresponse.WriteError(w, http.StatusServiceUnavailable, "migration", "JOB_QUEUE_UNAVAILABLE", "job queue not initialized")
		return
	}

	job, err := h.JobQueue.GetByEngagement(r.Context(), jobID, engID)
	if err != nil {
		slog.Error("failed to get job", "error", err, "job_id", jobID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get job")
		return
	}
	if job == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "job not found")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", job)
}

// CancelJob handles POST /api/v1/migration/engagements/{id}/jobs/{job_id}/cancel.
// Only PENDING or CLAIMED jobs can be cancelled. RUNNING jobs return 409.
// Requires editor or owner role.
func (h *Handler) CancelJob(w http.ResponseWriter, r *http.Request) {
	if !h.requireEditor(w, r) {
		return
	}

	engID := r.PathValue("id")
	jobID := r.PathValue("job_id")
	if engID == "" || jobID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and job_id are required")
		return
	}

	if h.JobQueue == nil {
		apiresponse.WriteError(w, http.StatusServiceUnavailable, "migration", "JOB_QUEUE_UNAVAILABLE", "job queue not initialized")
		return
	}

	if err := h.JobQueue.CancelScoped(r.Context(), jobID, engID); err != nil {
		slog.Error("failed to cancel job", "error", err, "job_id", jobID)
		apiresponse.WriteError(w, http.StatusConflict, "migration", "CANCEL_FAILED", err.Error())
		return
	}

	h.broadcast(engID, "job_cancelled", map[string]string{
		"job_id": jobID,
		"status": "CANCELLED",
	})

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]string{
		"job_id": jobID,
		"status": "CANCELLED",
	})
}

// RetryJob handles POST /api/v1/migration/engagements/{id}/jobs/{job_id}/retry.
// Only FAILED jobs can be retried. Returns 409 for non-FAILED jobs.
// Requires editor or owner role.
func (h *Handler) RetryJob(w http.ResponseWriter, r *http.Request) {
	if !h.requireEditor(w, r) {
		return
	}

	engID := r.PathValue("id")
	jobID := r.PathValue("job_id")
	if engID == "" || jobID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and job_id are required")
		return
	}

	if h.JobQueue == nil {
		apiresponse.WriteError(w, http.StatusServiceUnavailable, "migration", "JOB_QUEUE_UNAVAILABLE", "job queue not initialized")
		return
	}

	if err := h.JobQueue.Retry(r.Context(), jobID, engID); err != nil {
		slog.Error("failed to retry job", "error", err, "job_id", jobID)
		apiresponse.WriteError(w, http.StatusConflict, "migration", "RETRY_FAILED", err.Error())
		return
	}

	h.broadcast(engID, "job_retried", map[string]string{
		"job_id": jobID,
		"status": "PENDING",
	})

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]string{
		"job_id": jobID,
		"status": "PENDING",
	})
}

// JobSummary handles GET /api/v1/migration/engagements/{id}/jobs/summary.
// Returns counts by status and average execution time using a single GROUP BY query.
func (h *Handler) JobSummary(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	if engID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	if h.JobQueue == nil {
		apiresponse.WriteError(w, http.StatusServiceUnavailable, "migration", "JOB_QUEUE_UNAVAILABLE", "job queue not initialized")
		return
	}

	summary, err := h.JobQueue.Summary(r.Context(), engID)
	if err != nil {
		slog.Error("failed to get job summary", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get job summary")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", summary)
}

// EnqueueJobRequest is the JSON body for POST .../jobs.
type EnqueueJobRequest struct {
	JobType     string          `json:"job_type"`
	Scope       string          `json:"scope"`
	Priority    int             `json:"priority"`
	InputJSON   json.RawMessage `json:"input_json"`
	MaxAttempts int             `json:"max_attempts"`
}

// EnqueueJob handles POST /api/v1/migration/engagements/{id}/jobs.
func (h *Handler) EnqueueJob(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	if engID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	if h.JobQueue == nil {
		apiresponse.WriteError(w, http.StatusServiceUnavailable, "migration", "JOB_QUEUE_UNAVAILABLE", "job queue not initialized")
		return
	}

	var req EnqueueJobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}
	if req.JobType == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "job_type is required")
		return
	}
	if req.Scope == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "scope is required")
		return
	}

	jobID, err := h.JobQueue.Enqueue(r.Context(), jobqueue.EnqueueParams{
		EngagementID: engID,
		JobType:      req.JobType,
		Scope:        req.Scope,
		Priority:     req.Priority,
		InputJSON:    req.InputJSON,
		MaxAttempts:  req.MaxAttempts,
	})
	if err != nil {
		slog.Error("failed to enqueue job", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to enqueue job")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "migration", map[string]string{
		"job_id": jobID,
		"status": "PENDING",
	})
}

// WorkerHealth handles GET /api/v1/migration/workers.
// Returns active workers with recent heartbeats.
func (h *Handler) WorkerHealth(w http.ResponseWriter, r *http.Request) {
	if h.JobQueue == nil {
		apiresponse.WriteError(w, http.StatusServiceUnavailable, "migration", "JOB_QUEUE_UNAVAILABLE", "job queue not initialized")
		return
	}

	workers, err := h.JobQueue.ActiveWorkers(r.Context(), 2*time.Minute)
	if err != nil {
		slog.Error("failed to get active workers", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get workers")
		return
	}

	if workers == nil {
		workers = []jobqueue.WorkerInfo{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]any{
		"workers":      workers,
		"worker_count": len(workers),
	})
}
