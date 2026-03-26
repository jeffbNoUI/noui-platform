package api

import (
	"database/sql"
	"fmt"
	"log/slog"

	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

// Gate metric threshold constants — hardcoded, not configurable per engagement.
// These define the governance requirements for each phase transition.
const (
	// RECONCILING -> PARALLEL_RUN
	GateMappingAgreedPctThreshold = 0.90

	// PARALLEL_RUN -> COMPLETE
	GateReconGateScoreThreshold = 0.95
	GateReconP1UnresolvedMax    = 0.0

	// COMPLETE -> CUTOVER_IN_PROGRESS
	GateHasCompletedParallelRunThreshold = 1.0 // 1.0 = true
	GateHasCertificationThreshold        = 1.0 // 1.0 = true
)

// gateMetricDefinitions maps each phase transition pair to the metrics that must be evaluated.
// Key: "FROM->TO"
var gateMetricDefinitions = map[string][]models.GateMetricDefinition{
	"RECONCILING->PARALLEL_RUN": {
		{
			Name:           "mapping_agreed_pct",
			Description:    "Mapping agreement percentage must be >= 90%",
			Threshold:      GateMappingAgreedPctThreshold,
			GreaterOrEqual: true,
		},
	},
	"PARALLEL_RUN->COMPLETE": {
		{
			Name:           "recon_gate_score",
			Description:    "Reconciliation gate score must be >= 95%",
			Threshold:      GateReconGateScoreThreshold,
			GreaterOrEqual: true,
		},
		{
			Name:           "recon_p1_unresolved",
			Description:    "All P1 reconciliation issues must be resolved (count = 0)",
			Threshold:      GateReconP1UnresolvedMax,
			GreaterOrEqual: false,
		},
	},
	"COMPLETE->CUTOVER_IN_PROGRESS": {
		{
			Name:           "has_completed_parallel_run",
			Description:    "At least one completed parallel run is required",
			Threshold:      GateHasCompletedParallelRunThreshold,
			GreaterOrEqual: true,
		},
		{
			Name:           "has_certification",
			Description:    "Engagement must have a certification record",
			Threshold:      GateHasCertificationThreshold,
			GreaterOrEqual: true,
		},
	},
}

// GetGateMetricDefinitions returns the metric definitions for a given transition.
// Exported for testing.
func GetGateMetricDefinitions(fromPhase, toPhase models.EngagementStatus) []models.GateMetricDefinition {
	key := fmt.Sprintf("%s->%s", fromPhase, toPhase)
	return gateMetricDefinitions[key]
}

// EvaluateGate evaluates gate requirements for a phase transition.
// AC-2: Deterministic — same DB state always produces same result.
func EvaluateGate(db *sql.DB, engagementID string, fromPhase, toPhase models.EngagementStatus) (*models.GateEvaluationResult, error) {
	defs := GetGateMetricDefinitions(fromPhase, toPhase)

	// If no gate definitions for this transition, it passes automatically.
	if len(defs) == 0 {
		return &models.GateEvaluationResult{
			Passed:           true,
			Metrics:          map[string]models.GateMetricResult{},
			BlockingFailures: []string{},
		}, nil
	}

	// Fetch current metrics from DB.
	rawMetrics, err := migrationdb.GetGateMetrics(db, engagementID)
	if err != nil {
		return nil, fmt.Errorf("get gate metrics: %w", err)
	}

	// Fetch additional metrics not in GetGateMetrics for COMPLETE -> CUTOVER_IN_PROGRESS.
	key := fmt.Sprintf("%s->%s", fromPhase, toPhase)
	if key == "COMPLETE->CUTOVER_IN_PROGRESS" {
		hasParallel, err := migrationdb.HasCompletedParallelRun(db, engagementID)
		if err == nil {
			if hasParallel {
				rawMetrics["has_completed_parallel_run"] = 1.0
			} else {
				rawMetrics["has_completed_parallel_run"] = 0.0
			}
		}

		cert, err := migrationdb.GetLatestCertification(db, engagementID)
		if err == nil && cert != nil {
			rawMetrics["has_certification"] = 1.0
		} else {
			rawMetrics["has_certification"] = 0.0
		}
	}

	result := &models.GateEvaluationResult{
		Passed:           true,
		Metrics:          make(map[string]models.GateMetricResult, len(defs)),
		BlockingFailures: []string{},
	}

	for _, def := range defs {
		currentValue := rawMetrics[def.Name]

		var passed bool
		if def.GreaterOrEqual {
			passed = currentValue >= def.Threshold
		} else {
			passed = currentValue <= def.Threshold
		}

		result.Metrics[def.Name] = models.GateMetricResult{
			Name:         def.Name,
			CurrentValue: currentValue,
			Threshold:    def.Threshold,
			Passed:       passed,
			Description:  def.Description,
		}

		if !passed {
			result.Passed = false
			result.BlockingFailures = append(result.BlockingFailures,
				fmt.Sprintf("%s: current value %.4f does not meet threshold %.4f (%s)",
					def.Name, currentValue, def.Threshold, def.Description))
		}
	}

	return result, nil
}

// checkAndNotifyGateReadiness evaluates whether the engagement meets gate requirements
// for the next phase and creates a GATE_READY notification if so.
// AC-4 (3): Called after recon execution or certification completes.
func checkAndNotifyGateReadiness(h *Handler, engagementID, engagementName string, currentPhase models.EngagementStatus, tenantID string) {
	nextPhase := nextPhaseFor(currentPhase)
	if nextPhase == "" {
		return
	}

	eval, err := EvaluateGate(h.DB, engagementID, currentPhase, nextPhase)
	if err != nil {
		slog.Warn("failed gate readiness check", "error", err, "engagement_id", engagementID)
		return
	}

	if eval.Passed {
		summary := fmt.Sprintf("%s meets requirements to advance to %s", engagementName, nextPhase)
		if notif, err := migrationdb.CreateNotification(h.DB, tenantID, engagementID, engagementName, "GATE_READY", summary); err != nil {
			slog.Warn("failed to create gate readiness notification", "error", err)
		} else if notif != nil {
			h.broadcast(engagementID, "notification_created", notif)
		}
	}
}
