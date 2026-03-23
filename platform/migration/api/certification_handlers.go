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

// requiredChecklistKeys are the five items that must all be true for certification.
var requiredChecklistKeys = []string{
	"recon_score",
	"p1_resolved",
	"parallel_duration",
	"stakeholder_signoff",
	"rollback_plan",
}

// HandleCertify handles POST /api/v1/migration/engagements/{id}/certify.
// Creates a certification record after validating the checklist.
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

	// Validate all 5 checklist items are present and true.
	if req.Checklist == nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "checklist is required")
		return
	}
	for _, key := range requiredChecklistKeys {
		val, ok := req.Checklist[key]
		if !ok {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
				fmt.Sprintf("checklist item %q is required", key))
			return
		}
		boolVal, isBool := val.(bool)
		if !isBool || !boolVal {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
				fmt.Sprintf("checklist item %q must be true", key))
			return
		}
	}

	tid := tenantID(r)

	record := &models.CertificationRecord{
		EngagementID:  id,
		GateScore:     req.GateScore,
		P1Count:       req.P1Count,
		ChecklistJSON: req.Checklist,
		CertifiedBy:   tid,
		Notes:         req.Notes,
	}

	if err := migrationdb.CreateCertification(h.DB, record); err != nil {
		slog.Error("failed to create certification", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to create certification record")
		return
	}

	slog.Info("certification created", "engagement_id", id, "certified_by", tid, "gate_score", req.GateScore)
	apiresponse.WriteSuccess(w, http.StatusCreated, "migration", record)
}

// HandleGetCertification handles GET /api/v1/migration/engagements/{id}/certification.
// Returns the latest certification record for the engagement, or null data if none exists.
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
