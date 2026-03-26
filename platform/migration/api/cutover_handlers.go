package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

// HandleCreateCutoverPlan handles POST /api/v1/migration/engagements/{id}/cutover-plans.
func (h *Handler) HandleCreateCutoverPlan(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	if engID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	var req models.CreateCutoverPlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	// Validate steps array.
	if len(req.Steps) == 0 {
		apiresponse.WriteError(w, http.StatusUnprocessableEntity, "migration", "VALIDATION_ERROR", "steps array must not be empty")
		return
	}
	for i, s := range req.Steps {
		if s.Label == "" || s.Type == "" {
			apiresponse.WriteError(w, http.StatusUnprocessableEntity, "migration", "VALIDATION_ERROR",
				fmt.Sprintf("step %d: label and type are required", i))
			return
		}
		if s.Type != models.StepTypeAutomated && s.Type != models.StepTypeManual {
			apiresponse.WriteError(w, http.StatusUnprocessableEntity, "migration", "VALIDATION_ERROR",
				fmt.Sprintf("step %d: type must be AUTOMATED or MANUAL", i))
			return
		}
	}
	for i, s := range req.RollbackSteps {
		if s.Label == "" || s.Type == "" {
			apiresponse.WriteError(w, http.StatusUnprocessableEntity, "migration", "VALIDATION_ERROR",
				fmt.Sprintf("rollback_step %d: label and type are required", i))
			return
		}
	}

	// Get engagement and validate phase.
	engagement, err := migrationdb.GetEngagement(h.DB, engID)
	if err != nil {
		slog.Error("failed to get engagement for cutover plan", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", engID))
		return
	}

	if engagement.Status != models.StatusComplete {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "INVALID_PHASE",
			fmt.Sprintf("cutover plan requires COMPLETE status, current: %s", engagement.Status))
		return
	}

	// Check for existing active plan.
	hasActive, err := migrationdb.HasActiveCutoverPlan(h.DB, engID)
	if err != nil {
		slog.Error("failed to check active cutover plan", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to check active cutover plan")
		return
	}
	if hasActive {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "CONFLICT", "an active cutover plan already exists for this engagement")
		return
	}

	// Build steps with PENDING status and generated IDs.
	steps := make([]models.CutoverStep, len(req.Steps))
	for i, s := range req.Steps {
		steps[i] = models.CutoverStep{
			StepID: fmt.Sprintf("step-%d", s.Order),
			Label:  s.Label,
			Order:  s.Order,
			Type:   s.Type,
			Status: models.StepStatusPending,
		}
	}

	rollbackSteps := make([]models.CutoverStep, len(req.RollbackSteps))
	for i, s := range req.RollbackSteps {
		rollbackSteps[i] = models.CutoverStep{
			StepID: fmt.Sprintf("rollback-%d", s.Order),
			Label:  s.Label,
			Order:  s.Order,
			Type:   s.Type,
			Status: models.StepStatusPending,
		}
	}

	plan, err := migrationdb.CreateCutoverPlan(h.DB, engID, steps, rollbackSteps)
	if err != nil {
		slog.Error("failed to create cutover plan", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to create cutover plan")
		return
	}

	// Audit log.
	h.Audit.Log(r.Context(), models.AuditEntry{
		EngagementID: engID,
		Actor:        tenantID(r),
		Action:       "cutover_plan_created",
		EntityType:   "cutover_plan",
		EntityID:     plan.PlanID,
		AfterState:   mustJSON(plan),
	})

	slog.Info("cutover plan created", "engagement_id", engID, "plan_id", plan.PlanID)
	apiresponse.WriteSuccess(w, http.StatusCreated, "migration", plan)
}

// HandleApproveCutoverPlan handles PATCH /api/v1/migration/engagements/{id}/cutover-plans/{planId}/approve.
func (h *Handler) HandleApproveCutoverPlan(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	planID := r.PathValue("planId")
	if engID == "" || planID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and plan id are required")
		return
	}

	plan, err := migrationdb.GetCutoverPlan(h.DB, planID)
	if err != nil {
		slog.Error("failed to get cutover plan", "error", err, "plan_id", planID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get cutover plan")
		return
	}
	if plan == nil || plan.EngagementID != engID {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "cutover plan not found")
		return
	}

	if plan.Status != models.CutoverStatusDraft {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "INVALID_STATUS",
			fmt.Sprintf("plan must be in DRAFT status to approve, current: %s", plan.Status))
		return
	}

	tid := tenantID(r)
	updated, err := migrationdb.UpdateCutoverPlanStatus(h.DB, planID, models.CutoverStatusApproved, &tid)
	if err != nil {
		slog.Error("failed to approve cutover plan", "error", err, "plan_id", planID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to approve cutover plan")
		return
	}

	h.Audit.Log(r.Context(), models.AuditEntry{
		EngagementID: engID,
		Actor:        tid,
		Action:       "cutover_plan_approved",
		EntityType:   "cutover_plan",
		EntityID:     planID,
		AfterState:   mustJSON(updated),
	})

	h.broadcast(engID, "cutover_approved", map[string]string{
		"plan_id": planID,
	})

	slog.Info("cutover plan approved", "engagement_id", engID, "plan_id", planID, "approved_by", tid)
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", updated)
}

// HandleExecuteCutoverPlan handles POST /api/v1/migration/engagements/{id}/cutover-plans/{planId}/execute.
func (h *Handler) HandleExecuteCutoverPlan(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	planID := r.PathValue("planId")
	if engID == "" || planID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and plan id are required")
		return
	}

	plan, err := migrationdb.GetCutoverPlan(h.DB, planID)
	if err != nil {
		slog.Error("failed to get cutover plan", "error", err, "plan_id", planID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get cutover plan")
		return
	}
	if plan == nil || plan.EngagementID != engID {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "cutover plan not found")
		return
	}

	if plan.Status == models.CutoverStatusDraft {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "INVALID_STATUS",
			"plan must be approved before execution")
		return
	}
	if plan.Status != models.CutoverStatusApproved {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "INVALID_STATUS",
			fmt.Sprintf("plan must be in APPROVED status to execute, current: %s", plan.Status))
		return
	}

	tid := tenantID(r)

	// Transition plan to EXECUTING.
	updated, err := migrationdb.UpdateCutoverPlanStatus(h.DB, planID, models.CutoverStatusExecuting, nil)
	if err != nil {
		slog.Error("failed to start cutover execution", "error", err, "plan_id", planID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to start cutover execution")
		return
	}

	// Transition engagement to CUTOVER_IN_PROGRESS.
	_, err = migrationdb.UpdateEngagementStatus(h.DB, engID, models.StatusCutoverInProgress)
	if err != nil {
		slog.Error("failed to update engagement status", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to update engagement status")
		return
	}

	// Record gate transition.
	migrationdb.CreateGateTransition(h.DB, models.PhaseGateTransition{
		EngagementID: engID,
		FromPhase:    string(models.StatusComplete),
		ToPhase:      string(models.StatusCutoverInProgress),
		Direction:    "ADVANCE",
		GateMetrics:  map[string]float64{},
		Overrides:    []string{},
		AuthorizedBy: tid,
		Notes:        "Cutover execution started",
	})

	h.Audit.Log(r.Context(), models.AuditEntry{
		EngagementID: engID,
		Actor:        tid,
		Action:       "cutover_execution_started",
		EntityType:   "cutover_plan",
		EntityID:     planID,
		AfterState:   mustJSON(updated),
	})

	h.broadcast(engID, "cutover_started", map[string]string{
		"plan_id": planID,
	})

	slog.Info("cutover execution started", "engagement_id", engID, "plan_id", planID)
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", updated)
}

// HandleUpdateCutoverStep handles PATCH /api/v1/migration/engagements/{id}/cutover-plans/{planId}/steps/{stepId}.
func (h *Handler) HandleUpdateCutoverStep(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	planID := r.PathValue("planId")
	stepID := r.PathValue("stepId")
	if engID == "" || planID == "" || stepID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id, plan id, and step id are required")
		return
	}

	var req models.UpdateCutoverStepRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	// Validate step status.
	switch req.Status {
	case models.StepStatusInProgress, models.StepStatusCompleted, models.StepStatusFailed, models.StepStatusSkipped:
		// valid
	default:
		apiresponse.WriteError(w, http.StatusUnprocessableEntity, "migration", "VALIDATION_ERROR",
			fmt.Sprintf("invalid step status: %s", req.Status))
		return
	}

	plan, err := migrationdb.GetCutoverPlan(h.DB, planID)
	if err != nil {
		slog.Error("failed to get cutover plan", "error", err, "plan_id", planID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get cutover plan")
		return
	}
	if plan == nil || plan.EngagementID != engID {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "cutover plan not found")
		return
	}

	if plan.Status != models.CutoverStatusExecuting {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "INVALID_STATUS",
			fmt.Sprintf("plan must be EXECUTING to update steps, current: %s", plan.Status))
		return
	}

	// Find and update the step.
	stepFound := false
	for i, step := range plan.Steps {
		if step.StepID == stepID {
			stepFound = true
			// Idempotent: already in target status is a no-op.
			if step.Status == req.Status {
				apiresponse.WriteSuccess(w, http.StatusOK, "migration", plan)
				return
			}

			// Check ordering: cannot complete step N before step N-1 is done (unless skipped).
			if req.Status == models.StepStatusCompleted || req.Status == models.StepStatusInProgress {
				for j := 0; j < i; j++ {
					prev := plan.Steps[j]
					if prev.Status != models.StepStatusCompleted && prev.Status != models.StepStatusSkipped {
						apiresponse.WriteError(w, http.StatusConflict, "migration", "ORDER_VIOLATION",
							fmt.Sprintf("step %s must be completed or skipped before step %s", prev.StepID, stepID))
						return
					}
				}
			}

			plan.Steps[i].Status = req.Status
			plan.Steps[i].ErrorMessage = req.ErrorMessage
			break
		}
	}
	if !stepFound {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("step %s not found", stepID))
		return
	}

	// Persist updated steps.
	if err := migrationdb.UpdateCutoverPlanSteps(h.DB, planID, plan.Steps); err != nil {
		slog.Error("failed to update cutover step", "error", err, "plan_id", planID, "step_id", stepID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to update step")
		return
	}

	tid := tenantID(r)

	h.Audit.Log(r.Context(), models.AuditEntry{
		EngagementID: engID,
		Actor:        tid,
		Action:       "cutover_step_updated",
		EntityType:   "cutover_plan",
		EntityID:     planID,
		Metadata:     mustJSON(map[string]string{"step_id": stepID, "status": string(req.Status)}),
	})

	h.broadcast(engID, "step_completed", map[string]string{
		"plan_id": planID,
		"step_id": stepID,
		"status":  string(req.Status),
	})

	// Check if all steps are completed or skipped — auto-complete plan.
	allDone := true
	for _, s := range plan.Steps {
		if s.Status != models.StepStatusCompleted && s.Status != models.StepStatusSkipped {
			allDone = false
			break
		}
	}
	if allDone {
		updated, err := migrationdb.UpdateCutoverPlanStatus(h.DB, planID, models.CutoverStatusCompleted, nil)
		if err != nil {
			slog.Error("failed to auto-complete cutover plan", "error", err, "plan_id", planID)
			apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to complete cutover plan")
			return
		}

		// Transition engagement to GO_LIVE.
		_, err = migrationdb.UpdateEngagementStatus(h.DB, engID, models.StatusGoLive)
		if err != nil {
			slog.Error("failed to transition to GO_LIVE", "error", err, "engagement_id", engID)
			apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to transition engagement")
			return
		}

		migrationdb.CreateGateTransition(h.DB, models.PhaseGateTransition{
			EngagementID: engID,
			FromPhase:    string(models.StatusCutoverInProgress),
			ToPhase:      string(models.StatusGoLive),
			Direction:    "ADVANCE",
			GateMetrics:  map[string]float64{},
			Overrides:    []string{},
			AuthorizedBy: tid,
			Notes:        "Cutover completed — all steps done",
		})

		h.Audit.Log(r.Context(), models.AuditEntry{
			EngagementID: engID,
			Actor:        tid,
			Action:       "cutover_completed",
			EntityType:   "cutover_plan",
			EntityID:     planID,
			AfterState:   mustJSON(updated),
		})

		h.broadcast(engID, "cutover_completed", map[string]string{
			"plan_id": planID,
		})

		slog.Info("cutover completed, engagement is GO_LIVE", "engagement_id", engID, "plan_id", planID)
		apiresponse.WriteSuccess(w, http.StatusOK, "migration", updated)
		return
	}

	// Refresh plan for response.
	refreshed, err := migrationdb.GetCutoverPlan(h.DB, planID)
	if err != nil {
		slog.Error("failed to refresh cutover plan", "error", err, "plan_id", planID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to refresh plan")
		return
	}
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", refreshed)
}

// HandleRollbackCutoverPlan handles POST /api/v1/migration/engagements/{id}/cutover-plans/{planId}/rollback.
func (h *Handler) HandleRollbackCutoverPlan(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	planID := r.PathValue("planId")
	if engID == "" || planID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and plan id are required")
		return
	}

	var req models.RollbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}
	if req.RollbackReason == "" {
		apiresponse.WriteError(w, http.StatusUnprocessableEntity, "migration", "VALIDATION_ERROR", "rollback_reason is required")
		return
	}

	plan, err := migrationdb.GetCutoverPlan(h.DB, planID)
	if err != nil {
		slog.Error("failed to get cutover plan", "error", err, "plan_id", planID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get cutover plan")
		return
	}
	if plan == nil || plan.EngagementID != engID {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "cutover plan not found")
		return
	}

	if plan.Status != models.CutoverStatusExecuting && plan.Status != models.CutoverStatusCompleted {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "INVALID_STATUS",
			fmt.Sprintf("rollback requires EXECUTING or COMPLETED status, current: %s", plan.Status))
		return
	}

	tid := tenantID(r)

	// Determine current engagement status for the gate transition.
	engagement, err := migrationdb.GetEngagement(h.DB, engID)
	if err != nil {
		slog.Error("failed to get engagement for rollback", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}

	// Set plan to ROLLED_BACK.
	updated, err := migrationdb.UpdateCutoverPlanStatus(h.DB, planID, models.CutoverStatusRolledBack, nil)
	if err != nil {
		slog.Error("failed to rollback cutover plan", "error", err, "plan_id", planID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to rollback cutover plan")
		return
	}

	// Transition engagement back to COMPLETE.
	_, err = migrationdb.UpdateEngagementStatus(h.DB, engID, models.StatusComplete)
	if err != nil {
		slog.Error("failed to transition engagement back to COMPLETE", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to rollback engagement status")
		return
	}

	fromPhase := string(models.StatusCutoverInProgress)
	if engagement != nil {
		fromPhase = string(engagement.Status)
	}

	migrationdb.CreateGateTransition(h.DB, models.PhaseGateTransition{
		EngagementID: engID,
		FromPhase:    fromPhase,
		ToPhase:      string(models.StatusComplete),
		Direction:    "REGRESS",
		GateMetrics:  map[string]float64{},
		Overrides:    []string{},
		AuthorizedBy: tid,
		Notes:        req.RollbackReason,
	})

	h.Audit.Log(r.Context(), models.AuditEntry{
		EngagementID: engID,
		Actor:        tid,
		Action:       "cutover_rolled_back",
		EntityType:   "cutover_plan",
		EntityID:     planID,
		Metadata:     mustJSON(map[string]string{"rollback_reason": req.RollbackReason}),
	})

	h.broadcast(engID, "cutover_rolled_back", map[string]string{
		"plan_id": planID,
		"reason":  req.RollbackReason,
	})

	slog.Info("cutover rolled back", "engagement_id", engID, "plan_id", planID, "reason", req.RollbackReason)
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", updated)
}

// HandleListCutoverPlans handles GET /api/v1/migration/engagements/{id}/cutover-plans.
func (h *Handler) HandleListCutoverPlans(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	if engID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	plans, err := migrationdb.ListCutoverPlans(h.DB, engID)
	if err != nil {
		slog.Error("failed to list cutover plans", "error", err, "engagement_id", engID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list cutover plans")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", plans)
}

// HandleGetCutoverPlan handles GET /api/v1/migration/engagements/{id}/cutover-plans/{planId}.
func (h *Handler) HandleGetCutoverPlan(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	planID := r.PathValue("planId")
	if engID == "" || planID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and plan id are required")
		return
	}

	plan, err := migrationdb.GetCutoverPlan(h.DB, planID)
	if err != nil {
		slog.Error("failed to get cutover plan", "error", err, "plan_id", planID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get cutover plan")
		return
	}
	if plan == nil || plan.EngagementID != engID {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "cutover plan not found")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", plan)
}
