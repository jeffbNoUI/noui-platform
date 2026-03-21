package api

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
)

// ListExceptionClusters handles GET /api/v1/migration/batches/{id}/exception-clusters.
func (h *Handler) ListExceptionClusters(w http.ResponseWriter, r *http.Request) {
	batchID := r.PathValue("id")
	if batchID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id is required")
		return
	}

	clusters, err := migrationdb.ListExceptionClusters(h.DB, batchID)
	if err != nil {
		slog.Error("failed to list exception clusters", "error", err, "batch_id", batchID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to list exception clusters")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", clusters)
}

// ApplyCluster handles POST /api/v1/migration/exception-clusters/{id}/apply.
func (h *Handler) ApplyCluster(w http.ResponseWriter, r *http.Request) {
	clusterID := r.PathValue("id")
	if clusterID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "cluster id is required")
		return
	}

	cluster, err := migrationdb.ApplyCluster(h.DB, clusterID)
	if err != nil {
		slog.Error("failed to apply cluster", "error", err, "cluster_id", clusterID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR",
			fmt.Sprintf("failed to apply cluster: %s", err.Error()))
		return
	}
	if cluster == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND",
			fmt.Sprintf("cluster %s not found", clusterID))
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", cluster)
}
