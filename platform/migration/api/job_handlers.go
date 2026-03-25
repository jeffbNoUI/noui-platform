package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/migration/jobqueue"
)

// ListJobs handles GET /api/v1/migration/engagements/{id}/jobs.
// Supports ?type= and ?status= query filters.
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

// GetJob handles GET /api/v1/migration/jobs/{job_id}.
func (h *Handler) GetJob(w http.ResponseWriter, r *http.Request) {
	jobID := r.PathValue("job_id")
	if jobID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "job_id is required")
		return
	}

	if h.JobQueue == nil {
		apiresponse.WriteError(w, http.StatusServiceUnavailable, "migration", "JOB_QUEUE_UNAVAILABLE", "job queue not initialized")
		return
	}

	job, err := h.JobQueue.Get(r.Context(), jobID)
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

// CancelJob handles POST /api/v1/migration/jobs/{job_id}/cancel.
func (h *Handler) CancelJob(w http.ResponseWriter, r *http.Request) {
	jobID := r.PathValue("job_id")
	if jobID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "job_id is required")
		return
	}

	if h.JobQueue == nil {
		apiresponse.WriteError(w, http.StatusServiceUnavailable, "migration", "JOB_QUEUE_UNAVAILABLE", "job queue not initialized")
		return
	}

	if err := h.JobQueue.Cancel(r.Context(), jobID); err != nil {
		slog.Error("failed to cancel job", "error", err, "job_id", jobID)
		apiresponse.WriteError(w, http.StatusConflict, "migration", "CANCEL_FAILED", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]string{
		"job_id": jobID,
		"status": "CANCELLED",
	})
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
