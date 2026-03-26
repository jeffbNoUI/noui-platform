package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
	"github.com/noui/platform/migration/worker"
)

// HandleCreateReconExecution triggers a new reconciliation execution.
// POST /api/v1/migration/engagements/{id}/recon-executions
func (h *Handler) HandleCreateReconExecution(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")

	var req models.CreateReconExecutionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid request body")
		return
	}

	if req.ParallelRunID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "MISSING_PARALLEL_RUN_ID", "parallel_run_id is required")
		return
	}

	// Validate parallel run exists, belongs to engagement, and is COMPLETED.
	pr, err := migrationdb.GetParallelRun(h.DB, req.ParallelRunID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "DB_ERROR", err.Error())
		return
	}
	if pr == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "parallel run not found")
		return
	}
	if pr.EngagementID != engagementID {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "WRONG_ENGAGEMENT", "parallel run does not belong to this engagement")
		return
	}
	if pr.Status != models.ParallelRunCompleted {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "NOT_COMPLETED", "parallel run must be COMPLETED before recon execution")
		return
	}

	// Resolve ruleset.
	var rulesetID string
	if req.RulesetID != nil && *req.RulesetID != "" {
		rs, err := migrationdb.GetReconRuleSet(h.DB, *req.RulesetID)
		if err != nil {
			apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "DB_ERROR", err.Error())
			return
		}
		if rs == nil {
			apiresponse.WriteError(w, http.StatusNotFound, "migration", "RULESET_NOT_FOUND", "specified ruleset not found")
			return
		}
		if rs.EngagementID != engagementID {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "WRONG_ENGAGEMENT", "ruleset does not belong to this engagement")
			return
		}
		rulesetID = rs.RulesetID
	} else {
		rs, err := migrationdb.GetActiveReconRuleSet(h.DB, engagementID)
		if err != nil {
			apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "DB_ERROR", err.Error())
			return
		}
		if rs == nil {
			apiresponse.WriteError(w, http.StatusConflict, "migration", "NO_ACTIVE_RULESET", "no ACTIVE ruleset found for this engagement")
			return
		}
		rulesetID = rs.RulesetID
	}

	// Create execution run in PENDING.
	run, err := migrationdb.CreateReconExecutionRun(h.DB, engagementID, rulesetID, req.ParallelRunID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "CREATE_FAILED", err.Error())
		return
	}

	// Enqueue job.
	if h.JobQueue != nil {
		input := worker.ReconExecutionInput{
			EngagementID:  engagementID,
			ParallelRunID: req.ParallelRunID,
			RulesetID:     req.RulesetID,
			ExecutionID:   run.ExecutionID,
		}
		inputJSON, _ := json.Marshal(input)
		if _, err := h.JobQueue.Enqueue(r.Context(), jobqueue.EnqueueParams{
			EngagementID: engagementID,
			JobType:      "recon_execution",
			InputJSON:    inputJSON,
		}); err != nil {
			apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "ENQUEUE_FAILED", err.Error())
			return
		}
	}

	apiresponse.WriteJSON(w, http.StatusAccepted, run)
}

// HandleListReconExecutions returns paginated execution runs for an engagement.
// GET /api/v1/migration/engagements/{id}/recon-executions
func (h *Handler) HandleListReconExecutions(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	runs, err := migrationdb.ListReconExecutionRuns(h.DB, engagementID, perPage, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "DB_ERROR", err.Error())
		return
	}
	if runs == nil {
		runs = []models.ReconExecutionRun{}
	}
	apiresponse.WriteJSON(w, http.StatusOK, runs)
}

// HandleGetReconExecution returns a single execution run.
// GET /api/v1/migration/engagements/{id}/recon-executions/{execId}
func (h *Handler) HandleGetReconExecution(w http.ResponseWriter, r *http.Request) {
	execID := r.PathValue("execId")
	run, err := migrationdb.GetReconExecutionRun(h.DB, execID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "DB_ERROR", err.Error())
		return
	}
	if run == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "execution run not found")
		return
	}
	apiresponse.WriteJSON(w, http.StatusOK, run)
}

// HandleListReconExecutionMismatches returns paginated mismatches for an execution run.
// GET /api/v1/migration/engagements/{id}/recon-executions/{execId}/mismatches
func (h *Handler) HandleListReconExecutionMismatches(w http.ResponseWriter, r *http.Request) {
	execID := r.PathValue("execId")
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	var priorityFilter, entityFilter *string
	if v := r.URL.Query().Get("priority"); v != "" {
		priorityFilter = &v
	}
	if v := r.URL.Query().Get("canonical_entity"); v != "" {
		entityFilter = &v
	}

	mismatches, err := migrationdb.ListReconExecutionMismatches(h.DB, execID, priorityFilter, entityFilter, perPage, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "DB_ERROR", err.Error())
		return
	}
	if mismatches == nil {
		mismatches = []models.ReconExecutionMismatch{}
	}
	apiresponse.WriteJSON(w, http.StatusOK, mismatches)
}
