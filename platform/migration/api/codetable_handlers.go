package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/migration/mapper"
)

// CodeMappingResponse combines discovered code columns with existing mappings.
type CodeMappingResponse struct {
	Discoveries []mapper.CodeColumnCandidate `json:"discoveries"`
	Mappings    []mapper.CodeMapping         `json:"mappings"`
}

// UpdateCodeMappingRequest is the JSON body for PUT .../code-mappings/{mapping_id}.
type UpdateCodeMappingRequest struct {
	CanonicalValue string `json:"canonical_value"`
	ApprovedBy     string `json:"approved_by"`
}

// ListCodeMappings handles GET /api/v1/migration/engagements/{id}/code-mappings.
// Returns existing code mappings for the engagement.
func (h *Handler) ListCodeMappings(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	mappings, err := mapper.ListCodeMappings(h.DB, id)
	if err != nil {
		slog.Error("failed to list code mappings", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list code mappings")
		return
	}

	if mappings == nil {
		mappings = []mapper.CodeMapping{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", CodeMappingResponse{
		Discoveries: []mapper.CodeColumnCandidate{}, // discovery requires source DB access, omit here
		Mappings:    mappings,
	})
}

// UpdateCodeMapping handles PUT /api/v1/migration/engagements/{id}/code-mappings/{mapping_id}.
func (h *Handler) UpdateCodeMapping(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	mappingID := r.PathValue("mapping_id")
	if id == "" || mappingID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and mapping id are required")
		return
	}

	var req UpdateCodeMappingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	if req.CanonicalValue == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "canonical_value is required")
		return
	}

	m, err := mapper.UpdateCodeMapping(h.DB, id, mappingID, req.CanonicalValue, req.ApprovedBy)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND",
				fmt.Sprintf("code mapping %s not found in engagement %s", mappingID, id))
		} else {
			slog.Error("failed to update code mapping", "error", err, "mapping_id", mappingID, "engagement_id", id)
			apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to update code mapping")
		}
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", m)
}
