// Package api — employer-specific CRM handlers.
// These endpoints provide employer-scoped interaction and contact views.
package api

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/crm/models"
	"github.com/noui/platform/validation"
)

// Employer interaction categories — used when creating employer-initiated interactions.
const (
	EmpCatContribution = "CONTRIBUTION_QUESTION"
	EmpCatEnrollment   = "ENROLLMENT_ISSUE"
	EmpCatTermination  = "TERMINATION_INQUIRY"
	EmpCatWaret        = "WARET_INQUIRY"
	EmpCatSCP          = "SCP_INQUIRY"
	EmpCatGeneral      = "GENERAL_EMPLOYER"
)

// validEmployerCategories lists valid employer interaction categories.
var validEmployerCategories = []string{
	EmpCatContribution, EmpCatEnrollment, EmpCatTermination,
	EmpCatWaret, EmpCatSCP, EmpCatGeneral,
}

// ListOrgInteractions returns interactions linked to a specific employer organization.
func (h *Handler) ListOrgInteractions(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("id")
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_ORG_ID", "Organization ID is required")
		return
	}

	var errs validation.Errors
	errs.UUID("orgId", orgID)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_ORG_ID", errs.Error())
		return
	}

	category := r.URL.Query().Get("category")
	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	interactions, total, err := h.store.ListOrgInteractions(r.Context(), orgID, category, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}
	if interactions == nil {
		interactions = []models.Interaction{}
	}

	apiresponse.WritePaginated(w, "crm", interactions, total, limit, offset)
}

// CreateEmployerInteraction creates an interaction initiated by an employer.
// Requires org_id, category (one of the employer categories), channel, and direction.
func (h *Handler) CreateEmployerInteraction(w http.ResponseWriter, r *http.Request) {
	var req models.CreateInteractionRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	orgIDVal := ""
	if req.OrgID != nil {
		orgIDVal = *req.OrgID
	}
	errs.Required("orgId", orgIDVal)
	if orgIDVal != "" {
		errs.UUID("orgId", orgIDVal)
	}
	errs.Required("channel", req.Channel)
	errs.Enum("channel", req.Channel, []string{
		"phone_inbound", "phone_outbound", "secure_message",
		"email_inbound", "email_outbound", "walk_in",
		"portal_activity", "mail_inbound", "mail_outbound",
		"internal_handoff", "system_event", "fax",
	})
	errs.Required("interactionType", req.InteractionType)
	errs.Required("direction", req.Direction)
	errs.Enum("direction", req.Direction, []string{"inbound", "outbound", "internal"})
	if req.Category != nil {
		errs.Enum("category", *req.Category, validEmployerCategories)
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", errs.Error())
		return
	}

	now := time.Now().UTC()
	startedAt := now
	if req.StartedAt != nil {
		startedAt = *req.StartedAt
	}

	// Default category if not provided
	cat := EmpCatGeneral
	if req.Category != nil {
		cat = *req.Category
	}

	interaction := models.Interaction{
		InteractionID:   uuid.New().String(),
		TenantID:        tenantID(r),
		ConversationID:  req.ConversationID,
		ContactID:       req.ContactID,
		OrgID:           req.OrgID,
		AgentID:         req.AgentID,
		Channel:         models.InteractionChannel(req.Channel),
		InteractionType: models.InteractionType(req.InteractionType),
		Category:        &cat,
		Subcategory:     req.Subcategory,
		Outcome:         req.Outcome,
		Direction:       models.Direction(req.Direction),
		StartedAt:       startedAt,
		Summary:         req.Summary,
		Visibility:      models.Visibility(ptrOrDefault(req.Visibility, "INTERNAL")),
		CreatedAt:       now,
		CreatedBy:       "system",
	}

	if err := h.store.CreateInteraction(r.Context(), &interaction); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "crm", interaction)
}

// ListOrgContacts returns contacts associated with an employer organization, including their roles.
func (h *Handler) ListOrgContacts(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("id")
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_ORG_ID", "Organization ID is required")
		return
	}

	var errs validation.Errors
	errs.UUID("orgId", orgID)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_ORG_ID", errs.Error())
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	contacts, total, err := h.store.ListOrgContacts(r.Context(), orgID, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}
	if contacts == nil {
		contacts = []models.Contact{}
	}

	apiresponse.WritePaginated(w, "crm", contacts, total, limit, offset)
}
