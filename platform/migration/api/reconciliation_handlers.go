package api

import (
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/migration/reconciler"
)

// ReconcileBatch handles POST /api/v1/migration/batches/{id}/reconcile.
// It runs Tier 1 and Tier 2 reconciliation for the batch, combines results,
// computes the weighted scoring gate, and returns the GateResult.
func (h *Handler) ReconcileBatch(w http.ResponseWriter, r *http.Request) {
	batchID := r.PathValue("id")
	if batchID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id is required")
		return
	}

	// Run Tier 1: stored calculation reconciliation.
	tier1Results, err := reconciler.ReconcileTier1(h.DB, batchID)
	if err != nil {
		slog.Error("tier1 reconciliation failed",
			"error", err,
			"batch_id", batchID,
		)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "RECONCILE_ERROR", "tier 1 reconciliation failed")
		return
	}

	// Run Tier 2: payment history reconciliation.
	tier2Results, err := reconciler.ReconcileTier2(h.DB, batchID)
	if err != nil {
		slog.Error("tier2 reconciliation failed",
			"error", err,
			"batch_id", batchID,
		)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "RECONCILE_ERROR", "tier 2 reconciliation failed")
		return
	}

	// TODO: Tier 3 requires plan-level benchmarks — skip for now.
	// When implemented, benchmarks will be loaded from the engagement config.

	// Combine all results and compute the gate.
	var allResults []reconciler.ReconciliationResult
	allResults = append(allResults, tier1Results...)
	allResults = append(allResults, tier2Results...)

	gate := reconciler.ComputeGate(allResults)

	slog.Info("reconciliation completed",
		"batch_id", batchID,
		"weighted_score", gate.WeightedScore,
		"gate_passed", gate.GatePassed,
		"total_members", gate.TotalMembers,
		"p1_unresolved", gate.P1Unresolved,
	)

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", gate)
}

// GetReconciliation handles GET /api/v1/migration/engagements/{id}/reconciliation.
// Returns stored reconciliation results for the engagement.
func (h *Handler) GetReconciliation(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	// TODO: Query stored reconciliation results from database.
	// For now, return a placeholder indicating the endpoint exists.
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]any{
		"engagement_id": engagementID,
		"status":        "not_yet_implemented",
		"message":       "reconciliation result storage is pending",
	})
}

// GetP1Issues handles GET /api/v1/migration/engagements/{id}/reconciliation/p1.
// Returns only P1 (critical) reconciliation issues for the engagement.
func (h *Handler) GetP1Issues(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	// TODO: Query stored reconciliation results filtered to P1 priority.
	// For now, return a placeholder indicating the endpoint exists.
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]any{
		"engagement_id": engagementID,
		"p1_issues":     []any{},
		"status":        "not_yet_implemented",
		"message":       "P1 issue query is pending",
	})
}
