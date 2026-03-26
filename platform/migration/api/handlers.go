// Package api implements HTTP handlers for the migration service.
package api

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/intelligence"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/reconciler"
	"github.com/noui/platform/migration/report"
	"github.com/noui/platform/migration/ws"
)

// Handler holds dependencies for API handlers.
type Handler struct {
	DB          *sql.DB
	IntelClient intelligence.Scorer      // nil-safe: handlers degrade to template-only if nil
	Analyzer    intelligence.Analyzer    // nil-safe: pattern detection degrades if nil
	Hub         *ws.Hub                  // WebSocket hub for broadcasting events (nil-safe)
	PlanConfig  *reconciler.PlanConfig   // nil-safe: reconciliation degrades if not loaded
	JobQueue    *jobqueue.Queue          // nil-safe: job endpoints return 503 if nil
	Renderer    report.Renderer          // nil-safe: PDF endpoints return 503 if nil
	Audit       *migrationdb.AuditLogger // nil-safe: audit logging degrades if nil
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(db *sql.DB) *Handler {
	return &Handler{DB: db}
}

// NewHandlerWithIntel creates a Handler with database and intelligence service client.
func NewHandlerWithIntel(db *sql.DB, intelClient intelligence.Scorer) *Handler {
	return &Handler{DB: db, IntelClient: intelClient}
}

// RegisterRoutes sets up all API routes on the given mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	// Engagement CRUD
	mux.HandleFunc("POST /api/v1/migration/engagements", h.CreateEngagement)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}", h.GetEngagement)
	mux.HandleFunc("PATCH /api/v1/migration/engagements/{id}", h.UpdateEngagement)
	mux.HandleFunc("GET /api/v1/migration/engagements", h.ListEngagements)

	// Quality profiling
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/profile", h.ProfileEngagement)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/profiles", h.ListProfiles)
	mux.HandleFunc("PATCH /api/v1/migration/engagements/{id}/approve-baseline", h.ApproveBaseline)

	// Field mappings
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/generate-mappings", h.GenerateMappings)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/mappings", h.ListMappings)
	mux.HandleFunc("PUT /api/v1/migration/engagements/{id}/mappings/{mapping_id}", h.UpdateMapping)
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/mappings/{mapping_id}/acknowledge", h.AcknowledgeMapping)

	// Code mappings
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/code-mappings", h.ListCodeMappings)
	mux.HandleFunc("PUT /api/v1/migration/engagements/{id}/code-mappings/{mapping_id}", h.UpdateCodeMapping)

	// Batch CRUD
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/batches", h.ListBatches)
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/batches", h.CreateBatch)
	mux.HandleFunc("GET /api/v1/migration/batches/{id}", h.GetBatch)
	mux.HandleFunc("GET /api/v1/migration/batches/{id}/exceptions", h.ListExceptions)
	mux.HandleFunc("POST /api/v1/migration/batches/{id}/execute", h.ExecuteBatchHandler)

	// Retransform
	mux.HandleFunc("POST /api/v1/migration/batches/{id}/retransform", h.RetransformBatch)

	// Reconciliation
	mux.HandleFunc("POST /api/v1/migration/batches/{id}/reconcile", h.ReconcileBatch)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/reconciliation", h.GetReconciliation)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/reconciliation/p1", h.GetP1Issues)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/reconciliation/patterns", h.GetReconciliationPatterns)
	mux.HandleFunc("PATCH /api/v1/migration/reconciliation/patterns/{id}/resolve", h.ResolvePattern)

	// Dashboard
	mux.HandleFunc("GET /api/v1/migration/dashboard/summary", h.DashboardSummary)
	mux.HandleFunc("GET /api/v1/migration/dashboard/system-health", h.SystemHealth)

	// Risks
	mux.HandleFunc("GET /api/v1/migration/risks", h.ListRisks)
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/risks", h.CreateRisk)
	mux.HandleFunc("PUT /api/v1/migration/risks/{id}", h.UpdateRisk)
	mux.HandleFunc("DELETE /api/v1/migration/risks/{id}", h.DeleteRisk)

	// Exception clusters
	mux.HandleFunc("GET /api/v1/migration/batches/{id}/exception-clusters", h.ListExceptionClusters)
	mux.HandleFunc("POST /api/v1/migration/exception-clusters/{id}/apply", h.ApplyCluster)

	// Reconciliation detail
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/reconciliation/summary", h.ReconciliationSummary)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/reconciliation/tier/{n}", h.ReconciliationByTier)

	// Compare
	mux.HandleFunc("GET /api/v1/migration/compare", h.CompareEngagements)

	// Source database
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/source", h.ConfigureSource)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/source/tables", h.DiscoverTables)

	// Events
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/events", h.ListEvents)

	// Phase gates
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/gate-status", h.HandleGetGateStatus)
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/advance-phase", h.HandleAdvancePhase)
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/regress-phase", h.HandleRegressPhase)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/gate-history", h.HandleGetGateHistory)

	// Attention queue
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/attention", h.HandleGetAttentionItems)
	mux.HandleFunc("GET /api/v1/migration/attention/summary", h.HandleGetAttentionSummary)
	mux.HandleFunc("PATCH /api/v1/migration/engagements/{id}/attention/{itemId}/resolve", h.HandleResolveAttention)
	mux.HandleFunc("PATCH /api/v1/migration/engagements/{id}/attention/{itemId}/defer", h.HandleDeferAttention)

	// AI recommendations
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/ai/recommendations", h.HandleGetAIRecommendations)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/ai/batch-sizing", h.HandleGetBatchSizing)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/ai/remediation", h.HandleGetRemediation)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/reconciliation/root-cause", h.HandleGetRootCause)

	// Coverage report (target-anchored profiling)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/coverage-report", h.CoverageReport)

	// Mapping specification document (auditable artifact)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/reports/mapping-spec", h.MappingSpec)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/reports/mapping-spec/pdf", h.MappingSpecPDF)

	// Lineage traceability report (M07b)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/reports/lineage/{batch_id}/pdf", h.LineageReportPDF)

	// Reconciliation summary report (M07b)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/reports/reconciliation/pdf", h.ReconciliationReportPDF)

	// Certification
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/certify", h.HandleCertify)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/certification", h.HandleGetCertification)

	// Lineage
	mux.HandleFunc("GET /api/v1/migration/batches/{id}/lineage", h.HandleGetLineage)
	mux.HandleFunc("GET /api/v1/migration/batches/{id}/lineage/summary", h.HandleGetLineageSummary)

	// Audit log (read-only — no UPDATE or DELETE endpoints)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/audit-log", h.HandleListAuditLog)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/audit-log/export", h.HandleExportAuditLog)

	// Retention policy
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/retention-policy", h.HandleGetRetentionPolicy)
	mux.HandleFunc("PATCH /api/v1/migration/engagements/{id}/retention-policy", h.HandleSetRetentionPolicy)

	// Notifications
	mux.HandleFunc("GET /api/v1/migration/notifications", h.HandleGetNotifications)
	mux.HandleFunc("PUT /api/v1/migration/notifications/{id}/read", h.HandleMarkNotificationRead)
	mux.HandleFunc("PUT /api/v1/migration/notifications/read-all", h.HandleMarkAllNotificationsRead)

	// Job queue
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/jobs", h.EnqueueJob)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/jobs", h.ListJobs)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/jobs/summary", h.JobSummary)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/jobs/{job_id}", h.GetJob)
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/jobs/{job_id}/cancel", h.CancelJob)
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/jobs/{job_id}/retry", h.RetryJob)
	mux.HandleFunc("GET /api/v1/migration/workers", h.WorkerHealth)

	// Progressive profiling (5-level model)
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/profiling-runs", h.InitiateProfilingRun)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/profiling-runs", h.ListProfilingRuns)
	mux.HandleFunc("GET /api/v1/migration/profiling-runs/{run_id}", h.GetProfilingRunHandler)
	mux.HandleFunc("GET /api/v1/migration/profiling-runs/{run_id}/inventory", h.GetProfilingInventory)

	// Parallel runs (M03c)
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/parallel-runs", h.CreateParallelRun)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/parallel-runs", h.ListParallelRuns)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/parallel-runs/{runId}", h.GetParallelRun)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/parallel-runs/{runId}/results", h.GetParallelRunResults)
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/parallel-runs/{runId}/cancel", h.CancelParallelRun)

	// Schema versioning
	mux.HandleFunc("POST /api/v1/migration/schema-versions", h.CreateSchemaVersion)
	mux.HandleFunc("GET /api/v1/migration/schema-versions", h.ListSchemaVersions)
	mux.HandleFunc("GET /api/v1/migration/schema-versions/diff", h.DiffSchemaVersions)
	mux.HandleFunc("GET /api/v1/migration/schema-versions/{id}", h.GetSchemaVersion)
	mux.HandleFunc("POST /api/v1/migration/schema-versions/{id}/activate", h.ActivateSchemaVersion)
}

// broadcast sends a WebSocket event to all clients in an engagement room.
// Nil-safe: no-op if Hub is nil.
func (h *Handler) broadcast(engagementID, eventType string, payload interface{}) {
	if h.Hub == nil {
		return
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	h.Hub.Broadcast(engagementID, ws.Event{
		Type:    eventType,
		Payload: json.RawMessage(data),
	})
}

// HealthCheck returns service status information.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "migration",
		"version": "0.1.0",
	})
}
