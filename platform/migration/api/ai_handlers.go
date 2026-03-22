package api

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

// HandleGetAIRecommendations handles GET /api/v1/migration/engagements/{id}/ai/recommendations.
// Returns all active deterministic recommendations for the engagement.
func (h *Handler) HandleGetAIRecommendations(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("failed to get engagement for AI recommendations", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", id))
		return
	}

	metrics, err := migrationdb.GetGateMetrics(h.DB, id)
	if err != nil {
		slog.Error("failed to get gate metrics for recommendations", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to compute metrics")
		return
	}

	var recommendations []models.AIRecommendation

	// Gate recommendation.
	if rec := generateGateRecommendation(engagement, metrics); rec != nil {
		recommendations = append(recommendations, *rec)
	}

	// Quality recommendation: if any quality dimension is below threshold.
	if v, ok := metrics["quality_min_score"]; ok && v < 0.70 {
		recommendations = append(recommendations, models.AIRecommendation{
			Phase:      string(engagement.Status),
			Type:       "QUALITY_ALERT",
			Summary:    "Data quality below threshold",
			Detail:     fmt.Sprintf("Minimum quality dimension score is %.2f. Review profiling results and address data issues before proceeding.", v),
			Confidence: 0.90,
			Actionable: true,
			SuggestedActions: []models.SuggestedAction{
				{Label: "View Quality Profile", Action: "view_quality"},
				{Label: "Run Remediation", Action: "remediation"},
			},
		})
	}

	// Mapping recommendation: if mappings need review.
	if v, ok := metrics["mapping_agreed_pct"]; ok && v < 1.0 && v > 0 {
		pendingPct := (1.0 - v) * 100
		recommendations = append(recommendations, models.AIRecommendation{
			Phase:      string(engagement.Status),
			Type:       "MAPPING_REVIEW",
			Summary:    fmt.Sprintf("%.0f%% of mappings pending review", pendingPct),
			Detail:     "Some field mappings have not been agreed upon. Review and approve pending mappings.",
			Confidence: 0.92,
			Actionable: true,
			SuggestedActions: []models.SuggestedAction{
				{Label: "Review Mappings", Action: "review_mappings"},
			},
		})
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", recommendations)
}

// HandleGetBatchSizing handles GET /api/v1/migration/engagements/{id}/ai/batch-sizing.
// Reads quality profiles and suggests batch groupings based on quality scores.
func (h *Handler) HandleGetBatchSizing(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	metrics, err := migrationdb.GetGateMetrics(h.DB, id)
	if err != nil {
		slog.Error("failed to get metrics for batch sizing", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to compute metrics")
		return
	}

	tableCount := int(metrics["tables_profiled"])
	qualityMin := metrics["quality_min_score"]

	// Deterministic batch sizing based on quality profile.
	var recommendation string
	var batchSize int
	if qualityMin >= 0.85 {
		batchSize = max(tableCount/2, 1)
		recommendation = "High quality data detected. Recommend larger batches for efficiency."
	} else if qualityMin >= 0.70 {
		batchSize = max(tableCount/4, 1)
		recommendation = "Moderate quality data detected. Recommend medium-sized batches with spot checks."
	} else {
		batchSize = 1
		recommendation = "Low quality data detected. Recommend isolating each table in its own batch for careful validation."
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]any{
		"engagement_id":  id,
		"tables_profiled": tableCount,
		"quality_min":     qualityMin,
		"recommended_batch_size": batchSize,
		"recommendation":  recommendation,
	})
}

// HandleGetRemediation handles GET /api/v1/migration/engagements/{id}/ai/remediation.
// Reads quality profiles and suggests fixes for low-scoring dimensions.
func (h *Handler) HandleGetRemediation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	metrics, err := migrationdb.GetGateMetrics(h.DB, id)
	if err != nil {
		slog.Error("failed to get metrics for remediation", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to compute metrics")
		return
	}

	type RemediationSuggestion struct {
		Dimension   string  `json:"dimension"`
		Score       float64 `json:"score"`
		Suggestion  string  `json:"suggestion"`
		Priority    string  `json:"priority"`
	}

	var suggestions []RemediationSuggestion

	qualityMin := metrics["quality_min_score"]
	if qualityMin < 0.70 {
		suggestions = append(suggestions, RemediationSuggestion{
			Dimension:  "overall_quality",
			Score:      qualityMin,
			Suggestion: "Overall quality is below acceptable threshold. Re-run profiling after source data cleanup.",
			Priority:   "P1",
		})
	} else if qualityMin < 0.85 {
		suggestions = append(suggestions, RemediationSuggestion{
			Dimension:  "overall_quality",
			Score:      qualityMin,
			Suggestion: "Quality is acceptable but could be improved. Review individual table profiles for weak dimensions.",
			Priority:   "P2",
		})
	}

	if v, ok := metrics["mapping_agreed_pct"]; ok && v < 0.80 {
		suggestions = append(suggestions, RemediationSuggestion{
			Dimension:  "mapping_agreement",
			Score:      v,
			Suggestion: "Mapping agreement rate is low. Schedule a mapping review session with the source system SME.",
			Priority:   "P2",
		})
	}

	if v, ok := metrics["recon_p1_unresolved"]; ok && v > 0 {
		suggestions = append(suggestions, RemediationSuggestion{
			Dimension:  "reconciliation",
			Score:      v,
			Suggestion: fmt.Sprintf("%.0f P1 reconciliation issues require immediate attention. Review root causes and apply fixes.", v),
			Priority:   "P1",
		})
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]any{
		"engagement_id": id,
		"suggestions":   suggestions,
	})
}

// HandleGetRootCause handles GET /api/v1/migration/engagements/{id}/reconciliation/root-cause.
// Reads reconciliation data and groups systematic mismatches.
func (h *Handler) HandleGetRootCause(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	summary, err := migrationdb.GetReconciliationSummary(h.DB, id)
	if err != nil {
		slog.Error("failed to get reconciliation summary for root cause", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get reconciliation data")
		return
	}

	totalMismatches := summary.MinorCount + summary.MajorCount + summary.ErrorCount
	var analysis string
	var confidence float64

	if totalMismatches == 0 {
		analysis = "No mismatches detected. All reconciliation records match."
		confidence = 1.0
	} else if summary.ErrorCount > summary.MinorCount+summary.MajorCount {
		analysis = fmt.Sprintf("Systematic errors detected: %d ERROR-level mismatches dominate. Likely root cause is a transformation rule defect or missing code mapping.", summary.ErrorCount)
		confidence = 0.80
	} else if summary.MajorCount > summary.MinorCount {
		analysis = fmt.Sprintf("Major mismatches (%d) exceed minor ones (%d). Root cause likely involves date format or calculation logic differences.", summary.MajorCount, summary.MinorCount)
		confidence = 0.70
	} else {
		analysis = fmt.Sprintf("Minor mismatches (%d) are the primary issue. Root cause likely involves rounding or precision differences.", summary.MinorCount)
		confidence = 0.75
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", models.RootCauseResponse{
		Analysis:      analysis,
		AffectedCount: totalMismatches,
		Confidence:    confidence,
	})
}
