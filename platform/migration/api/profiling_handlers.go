package api

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	"github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
)

// InitiateProfilingRun handles POST /api/v1/migration/engagements/{id}/profiling-runs.
// Creates a new profiling run and enqueues L1 jobs for all discovered source tables.
func (h *Handler) InitiateProfilingRun(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	if engID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	var req models.CreateProfilingRunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.SourcePlatform == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "source_platform is required")
		return
	}

	initiatedBy := auth.UserID(r.Context())

	runID, err := db.CreateProfilingRun(h.DB, engID, req.SourcePlatform, initiatedBy)
	if err != nil {
		slog.Error("failed to create profiling run", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to create profiling run")
		return
	}

	// Update run status to RUNNING_L1.
	level := 1
	if err := db.UpdateProfilingRunStatus(h.DB, runID, models.ProfilingStatusRunningL1, &level, nil); err != nil {
		slog.Error("failed to update run status", "error", err, "run_id", runID)
	}

	// Discover source tables and enqueue L1 jobs.
	if h.JobQueue != nil {
		go h.enqueueL1Jobs(engID, runID, req.SourcePlatform)
	}

	run, err := db.GetProfilingRun(h.DB, runID)
	if err != nil || run == nil {
		slog.Error("failed to get profiling run after creation", "error", err, "run_id", runID)
		apiresponse.WriteSuccess(w, http.StatusCreated, "migration", map[string]string{"id": runID})
		return
	}

	h.broadcast(engID, "profiling_run_started", map[string]string{
		"run_id": runID,
		"status": string(run.Status),
	})

	apiresponse.WriteSuccess(w, http.StatusCreated, "migration", run)
}

// enqueueL1Jobs discovers source tables and creates L1 profiling jobs.
func (h *Handler) enqueueL1Jobs(engID, runID, sourcePlatform string) {
	conn, err := db.GetEngagementSourceConnection(h.DB, engID)
	if err != nil {
		slog.Error("cannot enqueue L1 jobs: no source connection", "error", err, "engagement_id", engID)
		errMsg := err.Error()
		_ = db.UpdateProfilingRunStatus(h.DB, runID, models.ProfilingStatusFailed, nil, &errMsg)
		return
	}

	tables, err := db.DiscoverSourceTables(conn)
	if err != nil {
		slog.Error("cannot enqueue L1 jobs: table discovery failed", "error", err, "engagement_id", engID)
		errMsg := err.Error()
		_ = db.UpdateProfilingRunStatus(h.DB, runID, models.ProfilingStatusFailed, nil, &errMsg)
		return
	}

	if len(tables) == 0 {
		slog.Warn("no source tables found", "engagement_id", engID)
		errMsg := "no source tables found"
		_ = db.UpdateProfilingRunStatus(h.DB, runID, models.ProfilingStatusFailed, nil, &errMsg)
		return
	}

	var params []jobqueue.EnqueueParams
	for i, t := range tables {
		input, _ := json.Marshal(map[string]interface{}{
			"profiling_run_id": runID,
			"engagement_id":    engID,
			"schema_name":      t.SchemaName,
			"table_name":       t.TableName,
			"source_driver":    conn.Driver,
		})
		// Higher priority for smaller tables (faster visual progress).
		priority := max(1000-i, 0)
		params = append(params, jobqueue.EnqueueParams{
			EngagementID: engID,
			JobType:      "profile_l1",
			Scope:        t.SchemaName + "." + t.TableName,
			Priority:     priority,
			InputJSON:    input,
		})
	}

	ids, err := h.JobQueue.EnqueueBatch(context.Background(), params)
	if err != nil {
		slog.Error("failed to enqueue L1 jobs", "error", err, "engagement_id", engID, "tables", len(tables))
		return
	}

	slog.Info("enqueued L1 profiling jobs",
		"engagement_id", engID,
		"run_id", runID,
		"job_count", len(ids),
	)
}

// ListProfilingRuns handles GET /api/v1/migration/engagements/{id}/profiling-runs.
func (h *Handler) ListProfilingRuns(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	if engID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	runs, err := db.ListProfilingRuns(h.DB, engID)
	if err != nil {
		slog.Error("failed to list profiling runs", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list profiling runs")
		return
	}
	if runs == nil {
		runs = []models.ProfilingRun{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", runs)
}

// GetProfilingRunHandler handles GET /api/v1/migration/profiling-runs/{run_id}.
func (h *Handler) GetProfilingRunHandler(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("run_id")
	if runID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "run_id is required")
		return
	}

	run, err := db.GetProfilingRun(h.DB, runID)
	if err != nil {
		slog.Error("failed to get profiling run", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get profiling run")
		return
	}
	if run == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "profiling run not found")
		return
	}

	// Include source table inventory.
	tables, _ := db.ListSourceTables(h.DB, runID)
	if tables == nil {
		tables = []models.SourceTableProfile{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", models.ProfilingRunSummaryResponse{
		Run:    *run,
		Tables: tables,
	})
}

// GetProfilingInventory handles GET /api/v1/migration/profiling-runs/{run_id}/inventory.
func (h *Handler) GetProfilingInventory(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("run_id")
	if runID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "run_id is required")
		return
	}

	tables, err := db.ListSourceTables(h.DB, runID)
	if err != nil {
		slog.Error("failed to list source tables", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list source tables")
		return
	}
	if tables == nil {
		tables = []models.SourceTableProfile{}
	}

	columns, err := db.ListSourceColumnsByRun(h.DB, runID)
	if err != nil {
		slog.Error("failed to list source columns", "error", err, "run_id", runID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list source columns")
		return
	}
	if columns == nil {
		columns = []models.SourceColumnProfile{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", models.InventoryResponse{
		Tables:  tables,
		Columns: columns,
	})
}
