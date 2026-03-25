package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

const defaultTenantID = "00000000-0000-0000-0000-000000000001"

// tenantID extracts the tenant ID from auth context, falling back to a default for dev.
func tenantID(r *http.Request) string {
	if tid := auth.TenantID(r.Context()); tid != "" {
		return tid
	}
	return defaultTenantID
}

// CreateEngagement handles POST /api/v1/migration/engagements.
func (h *Handler) CreateEngagement(w http.ResponseWriter, r *http.Request) {
	var req models.CreateEngagementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	req.SourceSystemName = strings.TrimSpace(req.SourceSystemName)
	if req.SourceSystemName == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "source_system_name is required")
		return
	}

	tid := tenantID(r)
	engagement, err := migrationdb.CreateEngagement(h.DB, tid, req.SourceSystemName, req.SourcePlatformType, req.ContributionModel)
	if err != nil {
		slog.Error("failed to create engagement", "error", err, "tenant_id", tid)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to create engagement")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "migration", engagement)
}

// GetEngagement handles GET /api/v1/migration/engagements/{id}.
func (h *Handler) GetEngagement(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("failed to get engagement", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", id))
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", engagement)
}

// UpdateEngagement handles PATCH /api/v1/migration/engagements/{id}.
func (h *Handler) UpdateEngagement(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	var req models.UpdateEngagementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	req.Status = strings.TrimSpace(req.Status)
	if req.Status == "" && req.ContributionModel == nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "status or contribution_model is required")
		return
	}

	var updated *models.Engagement

	if req.Status != "" {
		// Fetch current engagement to validate the transition.
		current, err := migrationdb.GetEngagement(h.DB, id)
		if err != nil {
			slog.Error("failed to get engagement for update", "error", err, "engagement_id", id)
			apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
			return
		}
		if current == nil {
			apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", id))
			return
		}

		newStatus := models.EngagementStatus(req.Status)
		if !current.Status.CanTransitionTo(newStatus) {
			apiresponse.WriteError(w, http.StatusConflict, "migration", "INVALID_TRANSITION",
				fmt.Sprintf("cannot transition from %s to %s", current.Status, newStatus))
			return
		}

		updated, err = migrationdb.UpdateEngagementStatus(h.DB, id, newStatus)
		if err != nil {
			slog.Error("failed to update engagement", "error", err, "engagement_id", id)
			apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to update engagement")
			return
		}
	}

	if req.ContributionModel != nil {
		var err error
		updated, err = migrationdb.UpdateContributionModel(h.DB, id, *req.ContributionModel)
		if err != nil {
			slog.Error("failed to update contribution model", "error", err, "engagement_id", id)
			apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to update contribution model")
			return
		}
		if updated == nil {
			apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", id))
			return
		}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", updated)
}

// ListEngagements handles GET /api/v1/migration/engagements.
func (h *Handler) ListEngagements(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)

	engagements, err := migrationdb.ListEngagements(h.DB, tid)
	if err != nil {
		slog.Error("failed to list engagements", "error", err, "tenant_id", tid)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list engagements")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", engagements)
}
