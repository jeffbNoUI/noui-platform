package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

var versionLabelPattern = regexp.MustCompile(`^v\d+\.\d+$`)

// CreateSchemaVersion handles POST /api/v1/migration/schema-versions.
func (h *Handler) CreateSchemaVersion(w http.ResponseWriter, r *http.Request) {
	var req models.CreateSchemaVersionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	req.Label = strings.TrimSpace(req.Label)
	if !versionLabelPattern.MatchString(req.Label) {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "label must match ^v\\d+\\.\\d+$ (e.g., v1.0, v2.1)")
		return
	}

	if len(req.Fields) == 0 {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "at least one field is required")
		return
	}

	// Validate each field.
	for i, f := range req.Fields {
		if strings.TrimSpace(f.Entity) == "" {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", fmt.Sprintf("fields[%d].entity is required", i))
			return
		}
		if strings.TrimSpace(f.FieldName) == "" {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", fmt.Sprintf("fields[%d].field_name is required", i))
			return
		}
		if strings.TrimSpace(f.DataType) == "" {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", fmt.Sprintf("fields[%d].data_type is required", i))
			return
		}
	}

	tid := tenantID(r)
	result, err := migrationdb.CreateSchemaVersion(h.DB, tid, req.Label, req.Description, req.Fields)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique constraint") {
			apiresponse.WriteError(w, http.StatusConflict, "migration", "DUPLICATE_VERSION", fmt.Sprintf("version %s already exists for this tenant", req.Label))
			return
		}
		slog.Error("failed to create schema version", "error", err, "tenant_id", tid)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to create schema version")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "migration", result)
}

// ListSchemaVersions handles GET /api/v1/migration/schema-versions.
func (h *Handler) ListSchemaVersions(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	versions, err := migrationdb.ListSchemaVersions(h.DB, tid)
	if err != nil {
		slog.Error("failed to list schema versions", "error", err, "tenant_id", tid)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list schema versions")
		return
	}
	if versions == nil {
		versions = []models.SchemaVersion{}
	}
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", versions)
}

// GetSchemaVersion handles GET /api/v1/migration/schema-versions/{id}.
func (h *Handler) GetSchemaVersion(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "version id is required")
		return
	}

	result, err := migrationdb.GetSchemaVersion(h.DB, id)
	if err != nil {
		slog.Error("failed to get schema version", "error", err, "version_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get schema version")
		return
	}
	if result == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("schema version %s not found", id))
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", result)
}

// ActivateSchemaVersion handles POST /api/v1/migration/schema-versions/{id}/activate.
func (h *Handler) ActivateSchemaVersion(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "version id is required")
		return
	}

	result, err := migrationdb.ActivateSchemaVersion(h.DB, id)
	if err != nil {
		slog.Error("failed to activate schema version", "error", err, "version_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to activate schema version")
		return
	}
	if result == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("schema version %s not found", id))
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", result)
}

// DiffSchemaVersions handles GET /api/v1/migration/schema-versions/diff?from={id}&to={id}.
func (h *Handler) DiffSchemaVersions(w http.ResponseWriter, r *http.Request) {
	fromID := r.URL.Query().Get("from")
	toID := r.URL.Query().Get("to")

	if fromID == "" || toID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "both 'from' and 'to' query parameters are required")
		return
	}

	if fromID == toID {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "'from' and 'to' must be different version IDs")
		return
	}

	diff, err := migrationdb.DiffSchemaVersions(h.DB, fromID, toID)
	if err != nil {
		slog.Error("failed to diff schema versions", "error", err, "from", fromID, "to", toID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to compute schema version diff")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", diff)
}
