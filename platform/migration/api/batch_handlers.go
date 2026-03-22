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

// ListBatches handles GET /api/v1/migration/engagements/{id}/batches.
func (h *Handler) ListBatches(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	batches, err := migrationdb.ListBatches(h.DB, engagementID)
	if err != nil {
		slog.Error("failed to list batches", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list batches")
		return
	}

	if batches == nil {
		batches = []models.MigrationBatch{}
	}
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", batches)
}

// GetBatch handles GET /api/v1/migration/batches/{id}.
func (h *Handler) GetBatch(w http.ResponseWriter, r *http.Request) {
	batchID := r.PathValue("id")
	if batchID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id is required")
		return
	}

	batch, err := migrationdb.GetBatch(h.DB, batchID)
	if err != nil {
		slog.Error("failed to get batch", "error", err, "batch_id", batchID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get batch")
		return
	}
	if batch == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("batch %s not found", batchID))
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", batch)
}

// CreateBatch handles POST /api/v1/migration/engagements/{id}/batches.
func (h *Handler) CreateBatch(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	// Verify engagement exists.
	engagement, err := migrationdb.GetEngagement(h.DB, engagementID)
	if err != nil {
		slog.Error("failed to get engagement for batch create", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to verify engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", engagementID))
		return
	}

	var req models.CreateBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	req.BatchScope = strings.TrimSpace(req.BatchScope)
	if req.BatchScope == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch_scope is required")
		return
	}

	req.MappingVersion = strings.TrimSpace(req.MappingVersion)
	if req.MappingVersion == "" {
		req.MappingVersion = "v1.0"
	}

	batch, err := migrationdb.CreateBatch(h.DB, engagementID, req.BatchScope, req.MappingVersion)
	if err != nil {
		slog.Error("failed to create batch", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to create batch")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "migration", batch)
}

// ListExceptions handles GET /api/v1/migration/batches/{id}/exceptions.
func (h *Handler) ListExceptions(w http.ResponseWriter, r *http.Request) {
	batchID := r.PathValue("id")
	if batchID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id is required")
		return
	}

	exceptions, err := migrationdb.ListExceptions(h.DB, batchID)
	if err != nil {
		slog.Error("failed to list exceptions", "error", err, "batch_id", batchID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list exceptions")
		return
	}

	if exceptions == nil {
		exceptions = []models.MigrationException{}
	}
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", exceptions)
}
