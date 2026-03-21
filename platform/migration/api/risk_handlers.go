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

// ListRisks handles GET /api/v1/migration/risks.
// Supports optional ?engagement_id query parameter.
func (h *Handler) ListRisks(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)

	var engagementID *string
	if eid := r.URL.Query().Get("engagement_id"); eid != "" {
		engagementID = &eid
	}

	risks, err := migrationdb.ListRisks(h.DB, tid, engagementID)
	if err != nil {
		slog.Error("failed to list risks", "error", err, "tenant_id", tid)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to list risks")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", risks)
}

// CreateRisk handles POST /api/v1/migration/engagements/{id}/risks.
func (h *Handler) CreateRisk(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	var req models.CreateRiskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	// Override engagement_id from path.
	req.EngagementID = &engagementID

	req.Description = strings.TrimSpace(req.Description)
	if req.Description == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "description is required")
		return
	}

	req.Severity = strings.TrimSpace(req.Severity)
	if req.Severity != "P1" && req.Severity != "P2" && req.Severity != "P3" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "severity must be P1, P2, or P3")
		return
	}

	tid := tenantID(r)
	risk, err := migrationdb.CreateRisk(h.DB, tid, req)
	if err != nil {
		slog.Error("failed to create risk", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to create risk")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "migration", risk)
}

// UpdateRisk handles PUT /api/v1/migration/risks/{id}.
func (h *Handler) UpdateRisk(w http.ResponseWriter, r *http.Request) {
	riskID := r.PathValue("id")
	if riskID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "risk id is required")
		return
	}

	var req models.UpdateRiskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	if req.Status == nil && req.Mitigation == nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "at least one field (status or mitigation) is required")
		return
	}

	if req.Status != nil {
		s := *req.Status
		if s != "OPEN" && s != "ACKNOWLEDGED" && s != "MITIGATED" && s != "CLOSED" {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
				"status must be OPEN, ACKNOWLEDGED, MITIGATED, or CLOSED")
			return
		}
	}

	risk, err := migrationdb.UpdateRisk(h.DB, riskID, req)
	if err != nil {
		slog.Error("failed to update risk", "error", err, "risk_id", riskID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to update risk")
		return
	}
	if risk == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("risk %s not found", riskID))
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", risk)
}

// DeleteRisk handles DELETE /api/v1/migration/risks/{id}.
func (h *Handler) DeleteRisk(w http.ResponseWriter, r *http.Request) {
	riskID := r.PathValue("id")
	if riskID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "risk id is required")
		return
	}

	deleted, err := migrationdb.DeleteRisk(h.DB, riskID)
	if err != nil {
		slog.Error("failed to delete risk", "error", err, "risk_id", riskID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to delete risk")
		return
	}
	if !deleted {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("risk %s not found", riskID))
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]string{"deleted": riskID})
}
