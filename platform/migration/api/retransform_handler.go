package api

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/migration/loader"
	"github.com/noui/platform/migration/transformer"
)

// RetransformBatch handles POST /api/v1/migration/batches/{id}/retransform.
// It triggers re-transformation of rows affected by an approved mapping correction.
func (h *Handler) RetransformBatch(w http.ResponseWriter, r *http.Request) {
	batchID := r.PathValue("id")
	if batchID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id is required")
		return
	}

	var req loader.RetransformRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	if req.CorrectionID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "correction_id is required")
		return
	}

	// Use the default pipeline for re-transformation.
	pipeline := transformer.DefaultPipeline()

	// For retransform, we use h.DB as both the migration DB and source DB.
	// In production, the source DB connection would come from the engagement config.
	// The batch ID is available for context but the core retransform operates
	// via the correction -> lineage chain.
	result, err := loader.Retransform(h.DB, h.DB, req.CorrectionID, pipeline, req.NewMappings)
	if err != nil {
		slog.Error("retransform failed",
			"error", err,
			"batch_id", batchID,
			"correction_id", req.CorrectionID,
		)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "RETRANSFORM_ERROR", err.Error())
		return
	}

	slog.Info("retransform completed",
		"batch_id", batchID,
		"correction_id", req.CorrectionID,
		"rows_affected", result.RowsAffected,
		"rows_transformed", result.RowsTransformed,
		"rows_failed", result.RowsFailed,
	)

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", result)
}
