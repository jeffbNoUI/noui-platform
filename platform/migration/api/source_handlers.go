package api

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

// ConfigureSource handles POST /api/v1/migration/engagements/{id}/source.
// Accepts a SourceConnection JSON body, saves it to the engagement, and tests the connection.
func (h *Handler) ConfigureSource(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	var conn models.SourceConnection
	if err := json.NewDecoder(r.Body).Decode(&conn); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	if conn.Driver == "" || conn.Host == "" || conn.Port == "" || conn.User == "" || conn.DBName == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "driver, host, port, user, and dbname are required")
		return
	}

	// Test the connection before saving.
	if err := migrationdb.TestSourceConnection(&conn); err != nil {
		slog.Error("source connection test failed", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "CONNECTION_FAILED", "failed to connect to source database: "+err.Error())
		return
	}

	// Save the connection config to the engagement.
	if err := migrationdb.SaveSourceConnection(h.DB, id, &conn); err != nil {
		slog.Error("failed to save source connection", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "SAVE_FAILED", "failed to save source connection")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]bool{"connected": true})
}

// DiscoverTables handles GET /api/v1/migration/engagements/{id}/source/tables.
// Reads the source_connection from the engagement, connects to the source DB,
// and returns discovered tables.
func (h *Handler) DiscoverTables(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	// Fetch the engagement to get its source connection.
	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("failed to get engagement", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "engagement not found")
		return
	}
	if engagement.SourceConnection == nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "NO_SOURCE", "no source connection configured for this engagement")
		return
	}

	tables, err := migrationdb.DiscoverSourceTables(engagement.SourceConnection)
	if err != nil {
		slog.Error("failed to discover source tables", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "DISCOVERY_FAILED", "failed to discover source tables: "+err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", tables)
}
