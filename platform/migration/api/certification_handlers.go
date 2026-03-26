package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

// Certification gate thresholds.
const (
	GateScoreThreshold     = 0.95
	P1UnresolvedMaxAllowed = 0
)

// evalChecklist evaluates the hybrid certification checklist. Auto-evaluated
// items are computed from DB state; human-attested items come from the request.
func evalChecklist(db *sql.DB, engagementID string, stakeholderSignoff, rollbackPlan bool) (*models.ChecklistEvaluation, error) {
	metrics, err := migrationdb.GetGateMetrics(db, engagementID)
	if err != nil {
		return nil, fmt.Errorf("get gate metrics: %w", err)
	}

	reconScore, _ := metrics["recon_gate_score"]
	p1Unresolved := int(metrics["recon_p1_unresolved"])

	hasParallel, err := migrationdb.HasCompletedParallelRun(db, engagementID)
	if err != nil {
		return nil, fmt.Errorf("check parallel run: %w", err)
	}

	items := []models.ChecklistItem{
		{
			Key:         "recon_score",
			Label:       "Reconciliation gate score >= 95%",
			Passed:      reconScore >= GateScoreThreshold,
			AutoEval:    true,
			Description: fmt.Sprintf("Current score: %.2f, threshold: %.2f", reconScore, GateScoreThreshold),
		},
		{
			Key:         "p1_resolved",
			Label:       "All P1 issues resolved",
			Passed:      p1Unresolved <= P1UnresolvedMaxAllowed,
			AutoEval:    true,
			Description: fmt.Sprintf("Unresolved P1 count: %d", p1Unresolved),
		},
		{
			Key:         "parallel_duration",
			Label:       "At least one completed parallel run",
			Passed:      hasParallel,
			AutoEval:    true,
			Description: "Requires at least one COMPLETED parallel run",
		},
		{
			Key:      "stakeholder_signoff",
			Label:    "Stakeholder sign-off obtained",
			Passed:   stakeholderSignoff,
			AutoEval: false,
		},
		{
			Key:      "rollback_plan",
			Label:    "Rollback plan documented",
			Passed:   rollbackPlan,
			AutoEval: false,
		},
	}

	allPassed := true
	for _, item := range items {
		if !item.Passed {
			allPassed = false
			break
		}
	}

	return &models.ChecklistEvaluation{
		Items:     items,
		AllPassed: allPassed,
	}, nil
}

// HandleCertify handles POST /api/v1/migration/engagements/{id}/certify.
// Evaluates the hybrid checklist server-side and creates a certification record
// if all items pass. Transitions the engagement to COMPLETE.
func (h *Handler) HandleCertify(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	var req models.CertifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	// Get engagement and validate phase.
	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("failed to get engagement for certification", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", id))
		return
	}

	// Only PARALLEL_RUN or RECONCILING phases may certify.
	if engagement.Status != models.StatusParallelRun && engagement.Status != models.StatusReconciling {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "INVALID_PHASE",
			fmt.Sprintf("certification requires PARALLEL_RUN or RECONCILING phase, current: %s", engagement.Status))
		return
	}

	// Evaluate the hybrid checklist.
	eval, err := evalChecklist(h.DB, id, req.StakeholderSignoff, req.RollbackPlan)
	if err != nil {
		slog.Error("failed to evaluate checklist", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to evaluate checklist")
		return
	}

	tid := tenantID(r)

	if !eval.AllPassed {
		// Audit the rejection.
		h.Audit.Log(r.Context(), models.AuditEntry{
			EngagementID: id,
			Actor:        tid,
			Action:       "certify_rejected",
			EntityType:   "certification",
			EntityID:     id,
			Metadata:     mustJSON(eval),
		})

		// Return 422 with checklist details.
		failedItems := []string{}
		for _, item := range eval.Items {
			if !item.Passed {
				failedItems = append(failedItems, item.Key)
			}
		}
		apiresponse.WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{
			"status":       "error",
			"service":      "migration",
			"error_code":   "CHECKLIST_FAILED",
			"message":      fmt.Sprintf("checklist items failed: %v", failedItems),
			"failed_items": failedItems,
			"checklist":    eval,
		})
		return
	}

	// Build auto-evaluated snapshot from fresh metrics.
	metrics, _ := migrationdb.GetGateMetrics(h.DB, id)
	autoEvalSnapshot, _ := json.Marshal(map[string]any{
		"metrics":   metrics,
		"checklist": eval,
	})

	// Build checklist_json as map for backward compat.
	checklistMap := make(map[string]any)
	for _, item := range eval.Items {
		checklistMap[item.Key] = item.Passed
	}

	reconScore, _ := metrics["recon_gate_score"]
	p1Count := int(metrics["recon_p1_unresolved"])

	record := &models.CertificationRecord{
		EngagementID:  id,
		GateScore:     reconScore,
		P1Count:       p1Count,
		ChecklistJSON: checklistMap,
		AutoEvaluated: autoEvalSnapshot,
		CertifiedBy:   tid,
		Notes:         req.Notes,
	}

	if err := migrationdb.CreateCertification(h.DB, record); err != nil {
		slog.Error("failed to create certification", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to create certification record")
		return
	}

	// Transition engagement to COMPLETE.
	_, err = migrationdb.UpdateEngagementStatus(h.DB, id, models.StatusComplete)
	if err != nil {
		slog.Error("failed to update engagement status to COMPLETE", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to update engagement status")
		return
	}

	// Record gate transition.
	transition := models.PhaseGateTransition{
		EngagementID:     id,
		FromPhase:        string(engagement.Status),
		ToPhase:          string(models.StatusComplete),
		Direction:        "ADVANCE",
		GateMetrics:      metrics,
		AIRecommendation: "",
		Overrides:        []string{},
		AuthorizedBy:     tid,
		Notes:            req.Notes,
	}
	migrationdb.CreateGateTransition(h.DB, transition)

	// Audit the certification.
	h.Audit.Log(r.Context(), models.AuditEntry{
		EngagementID: id,
		Actor:        tid,
		Action:       "certify",
		EntityType:   "certification",
		EntityID:     record.ID,
		AfterState:   mustJSON(record),
	})

	// Broadcast phase change.
	h.broadcast(id, "phase_changed", map[string]string{
		"from":      string(engagement.Status),
		"to":        string(models.StatusComplete),
		"direction": "ADVANCE",
	})

	// AC-4 (4): Certification notification.
	certSummary := fmt.Sprintf("%s certified by %s with gate score %.2f", engagement.SourceSystemName, tid, reconScore)
	if notif, err := migrationdb.CreateNotification(h.DB, tid, id, engagement.SourceSystemName, "CERTIFIED", certSummary); err != nil {
		slog.Warn("failed to create certification notification", "error", err)
	} else if notif != nil {
		h.broadcast(id, "notification_created", notif)
	}

	// AC-4 (3): Check gate readiness for next phase after certification.
	checkAndNotifyGateReadiness(h, id, engagement.SourceSystemName, models.StatusComplete, tid)

	slog.Info("certification created", "engagement_id", id, "certified_by", tid, "gate_score", reconScore)
	apiresponse.WriteSuccess(w, http.StatusCreated, "migration", record)
}

// HandleGetCertification handles GET /api/v1/migration/engagements/{id}/certification.
// Returns the latest certification record for backward compatibility.
func (h *Handler) HandleGetCertification(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	record, err := migrationdb.GetLatestCertification(h.DB, id)
	if err != nil {
		slog.Error("failed to get certification", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get certification record")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", record)
}

// HandleListCertifications handles GET /api/v1/migration/engagements/{id}/certifications.
// Returns paginated certification records.
func (h *Handler) HandleListCertifications(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))

	result, err := migrationdb.ListCertifications(h.DB, id, page, perPage)
	if err != nil {
		slog.Error("failed to list certifications", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list certifications")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", result)
}

// HandleGetCertificationChecklist handles GET /api/v1/migration/engagements/{id}/certification/checklist.
// Returns a read-only preview of the checklist with human items defaulting to false.
func (h *Handler) HandleGetCertificationChecklist(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	eval, err := evalChecklist(h.DB, id, false, false)
	if err != nil {
		slog.Error("failed to evaluate checklist", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to evaluate checklist")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", eval)
}

// mustJSON marshals v to JSON, returning nil on error.
func mustJSON(v any) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	return b
}

// Ensure AuditLogger.Log is nil-safe via the existing pattern in audit.go.
// We call h.Audit.Log() directly — it handles nil receiver.
var _ = (*migrationdb.AuditLogger)(nil) // compile-time assertion that the type exists
var _ context.Context                   // suppress unused import
