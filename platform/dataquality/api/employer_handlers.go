// Package api — employer-scoped data quality handlers.
// These endpoints provide DQ scores, issues, and checks filtered to employer domain tables.
package api

import (
	"net/http"
	"strings"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/dataquality/models"
	"github.com/noui/platform/validation"
)

// GetEmployerScore returns a DQ score scoped to employer-domain tables for a specific org.
func (h *Handler) GetEmployerScore(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("orgId")
	if orgID == "" {
		orgID = parsePathSegment(r.URL.Path, "employer")
	}
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "dataquality", "INVALID_ORG_ID", "orgId is required")
		return
	}

	var errs validation.Errors
	errs.UUID("orgId", orgID)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "dataquality", "INVALID_ORG_ID", errs.Error())
		return
	}

	tenantID := tenantID(r)

	// Get score filtered to employer target tables
	score, err := h.store.GetEmployerScore(r.Context(), tenantID, orgID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "dataquality", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "dataquality", score)
}

// ListEmployerIssues returns DQ issues scoped to employer-domain tables for a specific org.
func (h *Handler) ListEmployerIssues(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("orgId")
	if orgID == "" {
		orgID = parsePathSegment(r.URL.Path, "employer")
	}
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "dataquality", "INVALID_ORG_ID", "orgId is required")
		return
	}

	var errs validation.Errors
	errs.UUID("orgId", orgID)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "dataquality", "INVALID_ORG_ID", errs.Error())
		return
	}

	tenantID := tenantID(r)
	severity := r.URL.Query().Get("severity")
	status := r.URL.Query().Get("status")
	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	issues, total, err := h.store.ListEmployerIssues(r.Context(), tenantID, orgID, severity, status, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "dataquality", "DB_ERROR", err.Error())
		return
	}
	if issues == nil {
		issues = []models.DQIssue{}
	}

	apiresponse.WritePaginated(w, "dataquality", issues, total, limit, offset)
}

// ListEmployerChecks returns DQ check definitions relevant to employer-domain tables.
func (h *Handler) ListEmployerChecks(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("orgId")
	if orgID == "" {
		orgID = parsePathSegment(r.URL.Path, "employer")
	}
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "dataquality", "INVALID_ORG_ID", "orgId is required")
		return
	}

	var errs validation.Errors
	errs.UUID("orgId", orgID)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "dataquality", "INVALID_ORG_ID", errs.Error())
		return
	}

	tenantID := tenantID(r)
	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	checks, total, err := h.store.ListEmployerChecks(r.Context(), tenantID, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "dataquality", "DB_ERROR", err.Error())
		return
	}
	if checks == nil {
		checks = []models.DQCheckDefinition{}
	}

	apiresponse.WritePaginated(w, "dataquality", checks, total, limit, offset)
}

// parsePathSegment extracts the segment after the given key in a URL path.
func parsePathSegment(path, key string) string {
	parts := strings.Split(path, "/")
	for i, p := range parts {
		if p == key && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	return ""
}
