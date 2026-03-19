// Package api — employer-scoped case management handlers.
// These endpoints list cases for an employer org and create cases from employer event triggers.
package api

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/casemanagement/domain"
	"github.com/noui/platform/casemanagement/models"
	"github.com/noui/platform/validation"
)

// ListEmployerCases returns cases linked to members of the given employer org.
func (h *Handler) ListEmployerCases(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("orgId")
	if orgID == "" {
		orgID = parsePathSegment(r.URL.Path, "employer")
	}
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "casemanagement", "INVALID_ORG_ID", "orgId is required")
		return
	}

	var errs validation.Errors
	errs.UUID("orgId", orgID)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "casemanagement", "INVALID_ORG_ID", errs.Error())
		return
	}

	tid := tenantID(r)
	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	cases, total, err := h.store.ListCasesByEmployer(r.Context(), tid, orgID, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "casemanagement", "DB_ERROR", err.Error())
		return
	}
	if cases == nil {
		cases = []models.RetirementCase{}
	}

	apiresponse.WritePaginated(w, "casemanagement", cases, total, limit, offset)
}

// GetEmployerCaseSummary returns aggregate case counts for an employer org.
func (h *Handler) GetEmployerCaseSummary(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("orgId")
	if orgID == "" {
		orgID = parsePathSegment(r.URL.Path, "employer")
	}
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "casemanagement", "INVALID_ORG_ID", "orgId is required")
		return
	}

	var errs validation.Errors
	errs.UUID("orgId", orgID)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "casemanagement", "INVALID_ORG_ID", errs.Error())
		return
	}

	tid := tenantID(r)

	summary, err := h.store.GetEmployerCaseSummary(r.Context(), tid, orgID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "casemanagement", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "casemanagement", summary)
}

// CreateEmployerCase creates a case triggered by an employer event.
// Uses trigger type → case config mapping for defaults and the trigger reference ID
// as the case ID for idempotency.
func (h *Handler) CreateEmployerCase(w http.ResponseWriter, r *http.Request) {
	var req models.CreateEmployerCaseRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "casemanagement", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("employerOrgId", req.EmployerOrgID)
	errs.UUID("employerOrgId", req.EmployerOrgID)
	errs.Required("triggerType", req.TriggerType)
	errs.Enum("triggerType", req.TriggerType, models.EmployerTriggerTypes)
	errs.Required("triggerReferenceId", req.TriggerReferenceID)
	errs.PositiveInt("memberId", req.MemberID)
	if req.Priority != "" {
		errs.Enum("priority", req.Priority, []string{"standard", "high", "urgent"})
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "casemanagement", "INVALID_REQUEST", errs.Error())
		return
	}

	tid := tenantID(r)

	// Idempotency: check if a case already exists for this trigger reference
	existing, err := h.store.GetCaseByTriggerRef(r.Context(), tid, req.TriggerReferenceID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "casemanagement", "DB_ERROR", err.Error())
		return
	}
	if existing != nil {
		// Already exists — return it with 200 (not 201)
		apiresponse.WriteSuccess(w, http.StatusOK, "casemanagement", existing)
		return
	}

	// Look up trigger config for defaults
	triggerCfg, ok := domain.GetTriggerConfig(req.TriggerType)
	if !ok {
		apiresponse.WriteError(w, http.StatusBadRequest, "casemanagement", "INVALID_TRIGGER", "unknown trigger type")
		return
	}

	priority := req.Priority
	if priority == "" {
		priority = triggerCfg.Priority
	}

	slaDays := triggerCfg.SLADays
	if priority == "urgent" {
		slaDays = 10
	} else if priority == "high" && slaDays > 15 {
		slaDays = 15
	}

	// Look up stage 0 for initial stage
	stage, err := h.store.GetStage(r.Context(), 0)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "casemanagement", "DB_ERROR", "failed to load initial stage")
		return
	}

	now := time.Now().UTC()
	c := &models.RetirementCase{
		CaseID:          req.TriggerReferenceID,
		TenantID:        tid,
		MemberID:        req.MemberID,
		CaseType:        triggerCfg.CaseType,
		Priority:        priority,
		SLAStatus:       "on-track",
		CurrentStage:    stage.StageName,
		CurrentStageIdx: 0,
		AssignedTo:      req.AssignedTo,
		DaysOpen:        0,
		Status:          "active",
		SLATargetDays:   slaDays,
		SLADeadlineAt:   now.AddDate(0, 0, slaDays),
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	flags := []string{fmt.Sprintf("employer:%s", req.EmployerOrgID)}

	if err := h.store.CreateCase(r.Context(), c, flags); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "casemanagement", "DB_ERROR", err.Error())
		return
	}

	// Re-fetch with JOINed member data
	full, err := h.store.GetCaseByID(r.Context(), c.CaseID)
	if err != nil {
		apiresponse.WriteSuccess(w, http.StatusCreated, "casemanagement", c)
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "casemanagement", full)
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
