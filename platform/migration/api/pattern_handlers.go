package api

import (
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

// GetReconciliationPatterns handles GET /api/v1/migration/engagements/{id}/reconciliation/patterns.
// Returns intelligence-detected systematic patterns for the engagement.
func (h *Handler) GetReconciliationPatterns(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	patterns, err := migrationdb.GetPatternsByEngagement(h.DB, engagementID)
	if err != nil {
		slog.Error("failed to get reconciliation patterns", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to get patterns")
		return
	}

	if patterns == nil {
		patterns = []models.ReconciliationPattern{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]any{
		"engagement_id": engagementID,
		"patterns":      patterns,
		"count":         len(patterns),
	})
}

// ResolvePattern handles PATCH /api/v1/migration/reconciliation/patterns/{id}/resolve.
func (h *Handler) ResolvePattern(w http.ResponseWriter, r *http.Request) {
	patternID := r.PathValue("id")
	if patternID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "pattern id is required")
		return
	}

	userID := auth.UserID(r.Context())
	if userID == "" {
		userID = "system"
	}

	pattern, err := migrationdb.ResolvePattern(h.DB, patternID, userID)
	if err != nil {
		slog.Error("failed to resolve pattern", "error", err, "pattern_id", patternID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "RESOLVE_FAILED", "failed to resolve pattern")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", pattern)
}
