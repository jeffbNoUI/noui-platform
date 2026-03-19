// Package api — employer-specific correspondence handlers.
// These endpoints filter/generate templates in the employer context.
package api

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/correspondence/models"
	"github.com/noui/platform/validation"
)

// ListEmployerTemplates returns only templates with category='employer'.
func (h *Handler) ListEmployerTemplates(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	activeOnly := r.URL.Query().Get("is_active") != "false"
	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	templates, total, err := h.store.ListTemplates(r.Context(), tenantID, "employer", "", activeOnly, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "correspondence", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, "correspondence", templates, total, limit, offset)
}

// GenerateEmployer generates correspondence with employer org context pre-filled into merge data.
// Looks up the employer org from crm_organization to auto-populate org_name, ein, division, etc.
func (h *Handler) GenerateEmployer(w http.ResponseWriter, r *http.Request) {
	var req models.EmployerGenerateRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "correspondence", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("templateId", req.TemplateID)
	errs.Required("orgId", req.OrgID)
	errs.UUID("orgId", req.OrgID)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "correspondence", "INVALID_REQUEST", errs.Error())
		return
	}

	// Look up employer org details for merge field pre-population
	orgMerge, err := h.store.GetOrgMergeFields(r.Context(), req.OrgID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "correspondence", "DB_ERROR", "Failed to load employer context: "+err.Error())
		return
	}
	if orgMerge == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "correspondence", "ORG_NOT_FOUND", "Employer organization not found")
		return
	}

	// Merge org fields into request merge data (user-supplied values take precedence)
	mergeData := make(map[string]string)
	for k, v := range orgMerge {
		mergeData[k] = v
	}
	for k, v := range req.MergeData {
		mergeData[k] = v
	}

	// Fetch the template
	tmpl, err := h.store.GetTemplate(r.Context(), req.TemplateID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusNotFound, "correspondence", "NOT_FOUND", "Template not found")
		return
	}

	// Render
	rendered, err := h.store.RenderTemplatePublic(tmpl, mergeData)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "correspondence", "MERGE_ERROR", err.Error())
		return
	}

	subject := tmpl.TemplateName
	if name, ok := mergeData["org_name"]; ok {
		subject = tmpl.TemplateName + " - " + name
	}

	now := time.Now().UTC()
	corr := models.Correspondence{
		CorrespondenceID: uuid.New().String(),
		TenantID:         tenantID(r),
		TemplateID:       req.TemplateID,
		ContactID:        req.ContactID,
		Subject:          subject,
		BodyRendered:     rendered,
		MergeData:        mergeData,
		Status:           "draft",
		GeneratedBy:      "system",
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := h.store.CreateCorrespondence(r.Context(), &corr); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "correspondence", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "correspondence", corr)
}
