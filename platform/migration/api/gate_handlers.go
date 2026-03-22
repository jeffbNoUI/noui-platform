package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

// phaseOrder defines the canonical ordering of phases for regression validation.
var phaseOrder = map[models.EngagementStatus]int{
	models.StatusDiscovery:    0,
	models.StatusProfiling:    1,
	models.StatusMapping:      2,
	models.StatusTransforming: 3,
	models.StatusReconciling:  4,
	models.StatusParallelRun:  5,
	models.StatusComplete:     6,
}

// orderedPhases lists phases in forward order for next-phase lookup.
var orderedPhases = []models.EngagementStatus{
	models.StatusDiscovery,
	models.StatusProfiling,
	models.StatusMapping,
	models.StatusTransforming,
	models.StatusReconciling,
	models.StatusParallelRun,
	models.StatusComplete,
}

// nextPhaseFor returns the next phase in the canonical order, or "" if at the end.
func nextPhaseFor(current models.EngagementStatus) models.EngagementStatus {
	idx, ok := phaseOrder[current]
	if !ok || idx >= len(orderedPhases)-1 {
		return ""
	}
	return orderedPhases[idx+1]
}

// generateGateRecommendation produces a deterministic AI recommendation based on metrics.
func generateGateRecommendation(engagement *models.Engagement, metrics map[string]float64) *models.AIRecommendation {
	nextPhase := nextPhaseFor(engagement.Status)
	if nextPhase == "" {
		return nil
	}

	var issues []string

	if v, ok := metrics["quality_min_score"]; ok && v < 0.70 {
		issues = append(issues, fmt.Sprintf("Quality minimum score %.2f is below 0.70 threshold", v))
	}
	if v, ok := metrics["mapping_agreed_pct"]; ok && v < 0.80 {
		issues = append(issues, fmt.Sprintf("Mapping agreement %.0f%% is below 80%% threshold", v*100))
	}
	if v, ok := metrics["recon_gate_score"]; ok && v < 0.95 {
		issues = append(issues, fmt.Sprintf("Reconciliation gate score %.2f is below 0.95 threshold", v))
	}
	if v, ok := metrics["recon_p1_unresolved"]; ok && v > 0 {
		issues = append(issues, fmt.Sprintf("%.0f unresolved P1 reconciliation issues remain", v))
	}

	if len(issues) == 0 {
		return &models.AIRecommendation{
			Phase:      string(nextPhase),
			Type:       "GATE_READY",
			Summary:    fmt.Sprintf("Ready to advance to %s", nextPhase),
			Detail:     "All gate conditions met. Recommend proceeding.",
			Confidence: 0.95,
			Actionable: true,
			SuggestedActions: []models.SuggestedAction{
				{Label: "Approve & Advance", Action: "advance"},
			},
		}
	}

	return &models.AIRecommendation{
		Phase:      string(nextPhase),
		Type:       "GATE_BLOCKED",
		Summary:    fmt.Sprintf("Not ready to advance to %s", nextPhase),
		Detail:     "Issues found: " + strings.Join(issues, "; "),
		Confidence: 0.85,
		Actionable: false,
		SuggestedActions: []models.SuggestedAction{
			{Label: "Review Issues", Action: "review"},
			{Label: "Override & Advance", Action: "override"},
		},
	}
}

// HandleGetGateStatus handles GET /api/v1/migration/engagements/{id}/gate-status.
func (h *Handler) HandleGetGateStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("failed to get engagement for gate status", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", id))
		return
	}

	metrics, err := migrationdb.GetGateMetrics(h.DB, id)
	if err != nil {
		slog.Error("failed to get gate metrics", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to compute gate metrics")
		return
	}

	rec := generateGateRecommendation(engagement, metrics)

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", models.GateStatusResponse{
		Metrics:        metrics,
		Recommendation: rec,
	})
}

// HandleAdvancePhase handles POST /api/v1/migration/engagements/{id}/advance-phase.
func (h *Handler) HandleAdvancePhase(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	var req models.AdvancePhaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("failed to get engagement for advance", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", id))
		return
	}

	nextPhase := nextPhaseFor(engagement.Status)
	if nextPhase == "" {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "INVALID_TRANSITION", "engagement is already at the final phase")
		return
	}

	if !engagement.Status.CanTransitionTo(nextPhase) {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "INVALID_TRANSITION",
			fmt.Sprintf("cannot advance from %s to %s", engagement.Status, nextPhase))
		return
	}

	// Compute gate metrics for audit trail.
	metrics, _ := migrationdb.GetGateMetrics(h.DB, id)

	// Advance the engagement status.
	_, err = migrationdb.UpdateEngagementStatus(h.DB, id, nextPhase)
	if err != nil {
		slog.Error("failed to advance engagement phase", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to advance phase")
		return
	}

	tid := tenantID(r)
	transition := models.PhaseGateTransition{
		EngagementID:     id,
		FromPhase:        string(engagement.Status),
		ToPhase:          string(nextPhase),
		Direction:        "ADVANCE",
		GateMetrics:      metrics,
		AIRecommendation: "",
		Overrides:        req.Overrides,
		AuthorizedBy:     tid,
		Notes:            req.Notes,
	}
	if transition.Overrides == nil {
		transition.Overrides = []string{}
	}

	created, err := migrationdb.CreateGateTransition(h.DB, transition)
	if err != nil {
		slog.Error("failed to create gate transition record", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to record gate transition")
		return
	}

	slog.Info("phase advanced", "engagement_id", id, "from", engagement.Status, "to", nextPhase)
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", created)
}

// HandleRegressPhase handles POST /api/v1/migration/engagements/{id}/regress-phase.
func (h *Handler) HandleRegressPhase(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	var req models.RegressPhaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	req.TargetPhase = strings.TrimSpace(req.TargetPhase)
	if req.TargetPhase == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "target_phase is required")
		return
	}

	req.Notes = strings.TrimSpace(req.Notes)
	if req.Notes == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "notes are required for regression")
		return
	}

	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("failed to get engagement for regress", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", id))
		return
	}

	targetStatus := models.EngagementStatus(req.TargetPhase)
	targetOrd, targetOk := phaseOrder[targetStatus]
	currentOrd, currentOk := phaseOrder[engagement.Status]

	if !targetOk || !currentOk {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
			fmt.Sprintf("invalid phase: %s", req.TargetPhase))
		return
	}

	if targetOrd >= currentOrd {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "INVALID_TRANSITION",
			fmt.Sprintf("target phase %s is not prior to current phase %s", req.TargetPhase, engagement.Status))
		return
	}

	// Compute gate metrics for audit trail.
	metrics, _ := migrationdb.GetGateMetrics(h.DB, id)

	// Regress the engagement status.
	_, err = migrationdb.UpdateEngagementStatus(h.DB, id, targetStatus)
	if err != nil {
		slog.Error("failed to regress engagement phase", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to regress phase")
		return
	}

	tid := tenantID(r)
	transition := models.PhaseGateTransition{
		EngagementID:     id,
		FromPhase:        string(engagement.Status),
		ToPhase:          string(targetStatus),
		Direction:        "REGRESS",
		GateMetrics:      metrics,
		AIRecommendation: "",
		Overrides:        []string{},
		AuthorizedBy:     tid,
		Notes:            req.Notes,
	}

	created, err := migrationdb.CreateGateTransition(h.DB, transition)
	if err != nil {
		slog.Error("failed to create gate transition record", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to record gate transition")
		return
	}

	slog.Info("phase regressed", "engagement_id", id, "from", engagement.Status, "to", targetStatus)
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", created)
}

// HandleGetGateHistory handles GET /api/v1/migration/engagements/{id}/gate-history.
func (h *Handler) HandleGetGateHistory(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	transitions, err := migrationdb.ListGateTransitions(h.DB, id)
	if err != nil {
		slog.Error("failed to list gate transitions", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list gate history")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", transitions)
}
