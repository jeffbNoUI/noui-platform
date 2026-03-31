// Package api implements HTTP handlers for the CRM service.
// The CRM service is a NoUI platform-native service — it manages its own
// schema directly, not through the Data Connector.
package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	crmdb "github.com/noui/platform/crm/db"
	"github.com/noui/platform/crm/models"
	"github.com/noui/platform/validation"
)

// Handler holds dependencies for CRM API handlers.
type Handler struct {
	store *crmdb.Store
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(database *sql.DB) *Handler {
	return &Handler{store: crmdb.NewStore(database)}
}

// RegisterRoutes sets up all CRM API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	// Contacts
	mux.HandleFunc("GET /api/v1/crm/contacts", h.SearchContacts)
	mux.HandleFunc("POST /api/v1/crm/contacts", h.CreateContact)
	mux.HandleFunc("GET /api/v1/crm/contacts/{id}", h.GetContact)
	mux.HandleFunc("PUT /api/v1/crm/contacts/{id}", h.UpdateContact)
	mux.HandleFunc("GET /api/v1/crm/contacts/{id}/timeline", h.GetContactTimeline)
	mux.HandleFunc("GET /api/v1/crm/contacts-by-legacy/{legacyId}", h.GetContactByLegacyID)

	// Conversations
	mux.HandleFunc("GET /api/v1/crm/conversations", h.ListConversations)
	mux.HandleFunc("POST /api/v1/crm/conversations", h.CreateConversation)
	mux.HandleFunc("GET /api/v1/crm/conversations/{id}", h.GetConversation)
	mux.HandleFunc("PUT /api/v1/crm/conversations/{id}", h.UpdateConversation)

	// Interactions
	mux.HandleFunc("GET /api/v1/crm/interactions", h.ListInteractions)
	mux.HandleFunc("POST /api/v1/crm/interactions", h.CreateInteraction)
	mux.HandleFunc("GET /api/v1/crm/interactions/{id}", h.GetInteraction)

	// Notes
	mux.HandleFunc("POST /api/v1/crm/notes", h.CreateNote)

	// Commitments
	mux.HandleFunc("GET /api/v1/crm/commitments", h.ListCommitments)
	mux.HandleFunc("POST /api/v1/crm/commitments", h.CreateCommitment)
	mux.HandleFunc("PUT /api/v1/crm/commitments/{id}", h.UpdateCommitment)

	// Outreach
	mux.HandleFunc("GET /api/v1/crm/outreach", h.ListOutreach)
	mux.HandleFunc("POST /api/v1/crm/outreach", h.CreateOutreach)
	mux.HandleFunc("PUT /api/v1/crm/outreach/{id}", h.UpdateOutreach)

	// Organizations
	mux.HandleFunc("GET /api/v1/crm/organizations", h.ListOrganizations)
	mux.HandleFunc("POST /api/v1/crm/organizations", h.CreateOrganization)
	mux.HandleFunc("GET /api/v1/crm/organizations/{id}", h.GetOrganization)
	mux.HandleFunc("GET /api/v1/crm/organizations/{id}/interactions", h.ListOrgInteractions)
	mux.HandleFunc("GET /api/v1/crm/organizations/{id}/contacts", h.ListOrgContacts)

	// Employer interactions
	mux.HandleFunc("POST /api/v1/crm/interactions/employer", h.CreateEmployerInteraction)

	// Taxonomy
	mux.HandleFunc("GET /api/v1/crm/taxonomy", h.GetTaxonomy)

	// Audit
	mux.HandleFunc("GET /api/v1/crm/audit", h.GetAuditLog)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "crm",
		"version": "0.1.0",
	})
}

// --- Contact Handlers ---

func (h *Handler) SearchContacts(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)

	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)
	params := models.ContactSearchParams{
		Query:       r.URL.Query().Get("q"),
		ContactType: r.URL.Query().Get("type"),
		Limit:       limit,
		Offset:      offset,
	}

	contacts, total, err := h.store.ListContacts(r.Context(), tenantID, params)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, "crm", contacts, total, params.Limit, params.Offset)
}

func (h *Handler) CreateContact(w http.ResponseWriter, r *http.Request) {
	var req models.CreateContactRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("contactType", req.ContactType)
	errs.Enum("contactType", req.ContactType, []string{"member", "beneficiary", "alternate_payee", "external"})
	errs.Required("firstName", req.FirstName)
	errs.MaxLen("firstName", req.FirstName, 100)
	errs.Required("lastName", req.LastName)
	errs.MaxLen("lastName", req.LastName, 100)
	if req.MiddleName != nil {
		errs.MaxLen("middleName", *req.MiddleName, 100)
	}
	if req.PrimaryEmail != nil {
		errs.MaxLen("primaryEmail", *req.PrimaryEmail, 254)
	}
	if req.PrimaryPhone != nil {
		errs.MaxLen("primaryPhone", *req.PrimaryPhone, 20)
	}
	if req.DateOfBirth != nil {
		errs.DateYMDOptional("dateOfBirth", *req.DateOfBirth)
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", errs.Error())
		return
	}

	now := time.Now().UTC()
	contact := models.Contact{
		ContactID:         uuid.New().String(),
		TenantID:          tenantID(r),
		ContactType:       models.ContactType(req.ContactType),
		LegacyMemberID:    req.LegacyMemberID,
		FirstName:         req.FirstName,
		LastName:          req.LastName,
		MiddleName:        req.MiddleName,
		Suffix:            req.Suffix,
		DateOfBirth:       req.DateOfBirth,
		Gender:            req.Gender,
		PrimaryEmail:      req.PrimaryEmail,
		PrimaryPhone:      req.PrimaryPhone,
		PrimaryPhoneType:  req.PrimaryPhoneType,
		PreferredLanguage: ptrOrDefault(req.PreferredLanguage, "en"),
		PreferredChannel:  ptrOrDefault(req.PreferredChannel, "SECURE_MESSAGE"),
		MailReturned:      false,
		CreatedAt:         now,
		UpdatedAt:         now,
		CreatedBy:         "system",
		UpdatedBy:         "system",
	}

	if err := h.store.CreateContact(r.Context(), &contact); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "crm", contact)
}

func (h *Handler) GetContact(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	contact, err := h.store.GetContact(r.Context(), id)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}
	if contact == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "crm", "NOT_FOUND", "Contact not found")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "crm", contact)
}

func (h *Handler) UpdateContact(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	existing, err := h.store.GetContact(r.Context(), id)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}
	if existing == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "crm", "NOT_FOUND", "Contact not found")
		return
	}

	var req models.UpdateContactRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	if req.FirstName != nil {
		errs.MaxLen("firstName", *req.FirstName, 100)
	}
	if req.LastName != nil {
		errs.MaxLen("lastName", *req.LastName, 100)
	}
	if req.MiddleName != nil {
		errs.MaxLen("middleName", *req.MiddleName, 100)
	}
	if req.PrimaryEmail != nil {
		errs.MaxLen("primaryEmail", *req.PrimaryEmail, 254)
	}
	if req.PrimaryPhone != nil {
		errs.MaxLen("primaryPhone", *req.PrimaryPhone, 20)
	}
	if req.DateOfBirth != nil {
		errs.DateYMDOptional("dateOfBirth", *req.DateOfBirth)
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", errs.Error())
		return
	}

	applyContactUpdates(existing, &req)
	existing.UpdatedAt = time.Now().UTC()
	existing.UpdatedBy = "system"

	if err := h.store.UpdateContact(r.Context(), existing); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "crm", existing)
}

func (h *Handler) GetContactByLegacyID(w http.ResponseWriter, r *http.Request) {
	legacyID := r.PathValue("legacyId")
	tenantID := tenantID(r)

	contact, err := h.store.GetContactByLegacyID(r.Context(), tenantID, legacyID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}
	if contact == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "crm", "NOT_FOUND", "Contact not found for legacy ID")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "crm", contact)
}

func (h *Handler) GetContactTimeline(w http.ResponseWriter, r *http.Request) {
	contactID := r.PathValue("id")
	limit, offset := validation.Pagination(intParam(r, "limit", 50), intParam(r, "offset", 0), 100)

	timeline, err := h.store.GetContactTimeline(r.Context(), contactID, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "crm", timeline)
}

// --- Conversation Handlers ---

func (h *Handler) ListConversations(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	status := r.URL.Query().Get("status")
	anchorType := r.URL.Query().Get("anchor_type")
	anchorID := r.URL.Query().Get("anchor_id")
	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	conversations, total, err := h.store.ListConversations(r.Context(), tenantID, status, anchorType, anchorID, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, "crm", conversations, total, limit, offset)
}

func (h *Handler) CreateConversation(w http.ResponseWriter, r *http.Request) {
	var req models.CreateConversationRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("anchorType", req.AnchorType)
	errs.MaxLen("anchorType", req.AnchorType, 50)
	if req.Subject != nil {
		errs.MaxLen("subject", *req.Subject, 200)
	}
	if req.TopicCategory != nil {
		errs.MaxLen("topicCategory", *req.TopicCategory, 100)
	}
	if req.TopicSubcategory != nil {
		errs.MaxLen("topicSubcategory", *req.TopicSubcategory, 100)
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", errs.Error())
		return
	}

	now := time.Now().UTC()
	conv := models.Conversation{
		ConversationID:   uuid.New().String(),
		TenantID:         tenantID(r),
		AnchorType:       req.AnchorType,
		AnchorID:         req.AnchorID,
		TopicCategory:    req.TopicCategory,
		TopicSubcategory: req.TopicSubcategory,
		Subject:          req.Subject,
		Status:           models.ConvStatusOpen,
		AssignedTeam:     req.AssignedTeam,
		AssignedAgent:    req.AssignedAgent,
		CreatedAt:        now,
		UpdatedAt:        now,
		CreatedBy:        "system",
		UpdatedBy:        "system",
	}

	if err := h.store.CreateConversation(r.Context(), &conv); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "crm", conv)
}

func (h *Handler) GetConversation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	conv, err := h.store.GetConversation(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "crm", "NOT_FOUND", "Conversation not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "crm", conv)
}

func (h *Handler) UpdateConversation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	existing, err := h.store.GetConversation(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "crm", "NOT_FOUND", "Conversation not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	var req models.UpdateConversationRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	if req.Status != nil {
		errs.Enum("status", *req.Status, []string{"open", "pending", "resolved", "closed", "reopened"})
	}
	if req.ResolutionSummary != nil {
		errs.MaxLen("resolutionSummary", *req.ResolutionSummary, 5000)
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", errs.Error())
		return
	}

	applyConversationUpdates(existing, &req)
	existing.UpdatedAt = time.Now().UTC()
	existing.UpdatedBy = "system"

	if err := h.store.UpdateConversation(r.Context(), existing); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "crm", existing)
}

// --- Interaction Handlers ---

func (h *Handler) ListInteractions(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)

	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)
	filter := crmdb.InteractionFilter{
		ContactID:      r.URL.Query().Get("contact_id"),
		ConversationID: r.URL.Query().Get("conversation_id"),
		Channel:        r.URL.Query().Get("channel"),
		Limit:          limit,
		Offset:         offset,
	}

	interactions, total, err := h.store.ListInteractions(r.Context(), tenantID, filter)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, "crm", interactions, total, filter.Limit, filter.Offset)
}

func (h *Handler) CreateInteraction(w http.ResponseWriter, r *http.Request) {
	var req models.CreateInteractionRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("channel", req.Channel)
	errs.Enum("channel", req.Channel, []string{
		"PHONE_INBOUND", "PHONE_OUTBOUND", "SECURE_MESSAGE",
		"EMAIL_INBOUND", "EMAIL_OUTBOUND", "WALK_IN",
		"PORTAL_ACTIVITY", "MAIL_INBOUND", "MAIL_OUTBOUND",
		"INTERNAL_HANDOFF", "SYSTEM_EVENT", "FAX",
	})
	errs.Required("interactionType", req.InteractionType)
	errs.MaxLen("interactionType", req.InteractionType, 50)
	errs.Required("direction", req.Direction)
	errs.Enum("direction", req.Direction, []string{"INBOUND", "OUTBOUND", "INTERNAL"})
	if req.Summary != nil {
		errs.MaxLen("summary", *req.Summary, 5000)
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

	interaction := models.Interaction{
		InteractionID:   uuid.New().String(),
		TenantID:        tenantID(r),
		ConversationID:  req.ConversationID,
		ContactID:       req.ContactID,
		OrgID:           req.OrgID,
		AgentID:         req.AgentID,
		Channel:         models.InteractionChannel(req.Channel),
		InteractionType: models.InteractionType(req.InteractionType),
		Category:        req.Category,
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

	// Write audit trail entry for the new interaction (fire-and-forget with background context)
	agentIDVal := "system"
	if interaction.AgentID != nil {
		agentIDVal = *interaction.AgentID
	}
	go func(tid, entityID, agentID string, channel, direction interface{}) {
		ctx := context.Background()
		eventTime := time.Now().UTC()
		summary := fmt.Sprintf("%v %v interaction created", channel, direction)

		prevHash, _ := h.store.GetLastAuditHash(ctx, tid)
		recordHash := crmdb.ComputeAuditHash(tid, "interaction_created", "interaction", entityID, agentID, summary, eventTime)

		_ = h.store.WriteAuditLog(ctx, &crmdb.AuditEntry{
			TenantID:      tid,
			EventTime:     eventTime,
			EventType:     "interaction_created",
			EntityType:    "interaction",
			EntityID:      &entityID,
			AgentID:       agentID,
			Summary:       &summary,
			PrevAuditHash: ptrIfNonEmpty(prevHash),
			RecordHash:    recordHash,
		})
	}(interaction.TenantID, interaction.InteractionID, agentIDVal, interaction.Channel, interaction.Direction)

	apiresponse.WriteSuccess(w, http.StatusCreated, "crm", interaction)
}

func (h *Handler) GetInteraction(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	interaction, err := h.store.GetInteraction(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "crm", "NOT_FOUND", "Interaction not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "crm", interaction)
}

// --- Note Handlers ---

func (h *Handler) CreateNote(w http.ResponseWriter, r *http.Request) {
	var req models.CreateNoteRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("interactionId", req.InteractionID)
	errs.Required("category", req.Category)
	errs.MaxLen("category", req.Category, 100)
	errs.Required("summary", req.Summary)
	errs.MaxLen("summary", req.Summary, 5000)
	errs.Required("outcome", req.Outcome)
	errs.MaxLen("outcome", req.Outcome, 200)
	if req.Narrative != nil {
		errs.MaxLen("narrative", *req.Narrative, 50000)
	}
	if req.NextStep != nil {
		errs.MaxLen("nextStep", *req.NextStep, 1000)
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", errs.Error())
		return
	}

	now := time.Now().UTC()
	note := models.Note{
		NoteID:        uuid.New().String(),
		InteractionID: req.InteractionID,
		TemplateID:    req.TemplateID,
		Category:      req.Category,
		Subcategory:   req.Subcategory,
		Summary:       req.Summary,
		Outcome:       req.Outcome,
		NextStep:      req.NextStep,
		Narrative:     req.Narrative,
		Sentiment:     req.Sentiment,
		UrgentFlag:    req.UrgentFlag,
		AISuggested:   req.AISuggested,
		CreatedAt:     now,
		CreatedBy:     "system",
		UpdatedAt:     now,
		UpdatedBy:     "system",
	}

	if req.AIConfidence != nil {
		v, err := strconv.ParseFloat(*req.AIConfidence, 64)
		if err != nil {
			apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", "aiConfidence must be a decimal number")
			return
		}
		note.AIConfidence = &v
	}

	if err := h.store.CreateNote(r.Context(), &note); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "crm", note)
}

// --- Commitment Handlers ---

func (h *Handler) ListCommitments(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	status := r.URL.Query().Get("status")
	ownerAgent := r.URL.Query().Get("owner_agent")
	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	commitments, total, err := h.store.ListCommitments(r.Context(), tenantID, status, ownerAgent, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, "crm", commitments, total, limit, offset)
}

func (h *Handler) CreateCommitment(w http.ResponseWriter, r *http.Request) {
	var req models.CreateCommitmentRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("interactionId", req.InteractionID)
	errs.Required("description", req.Description)
	errs.MaxLen("description", req.Description, 1000)
	errs.Required("targetDate", req.TargetDate)
	errs.DateYMD("targetDate", req.TargetDate)
	errs.Required("ownerAgent", req.OwnerAgent)
	errs.MaxLen("ownerAgent", req.OwnerAgent, 200)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", errs.Error())
		return
	}

	alertDays := 2
	if req.AlertDaysBefore != nil {
		alertDays = *req.AlertDaysBefore
	}

	now := time.Now().UTC()
	commitment := models.Commitment{
		CommitmentID:    uuid.New().String(),
		TenantID:        tenantID(r),
		InteractionID:   req.InteractionID,
		ContactID:       req.ContactID,
		ConversationID:  req.ConversationID,
		Description:     req.Description,
		TargetDate:      req.TargetDate,
		OwnerAgent:      req.OwnerAgent,
		OwnerTeam:       req.OwnerTeam,
		Status:          models.CommitPending,
		AlertDaysBefore: alertDays,
		CreatedAt:       now,
		CreatedBy:       "system",
		UpdatedAt:       now,
		UpdatedBy:       "system",
	}

	if err := h.store.CreateCommitment(r.Context(), &commitment); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "crm", commitment)
}

func (h *Handler) UpdateCommitment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	existing, err := h.store.GetCommitment(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "crm", "NOT_FOUND", "Commitment not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	var req models.UpdateCommitmentRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	if req.Status != nil {
		errs.Enum("status", *req.Status, []string{"pending", "in_progress", "fulfilled", "overdue", "cancelled"})
	}
	if req.FulfillmentNote != nil {
		errs.MaxLen("fulfillmentNote", *req.FulfillmentNote, 5000)
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", errs.Error())
		return
	}

	applyCommitmentUpdates(existing, &req)
	existing.UpdatedAt = time.Now().UTC()
	existing.UpdatedBy = "system"

	if err := h.store.UpdateCommitment(r.Context(), existing); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "crm", existing)
}

// --- Outreach Handlers ---

func (h *Handler) ListOutreach(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	status := r.URL.Query().Get("status")
	assignedAgent := r.URL.Query().Get("assigned_agent")
	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	outreach, total, err := h.store.ListOutreach(r.Context(), tenantID, status, assignedAgent, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, "crm", outreach, total, limit, offset)
}

func (h *Handler) CreateOutreach(w http.ResponseWriter, r *http.Request) {
	var req models.CreateOutreachRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("triggerType", req.TriggerType)
	errs.MaxLen("triggerType", req.TriggerType, 100)
	errs.Required("outreachType", req.OutreachType)
	errs.MaxLen("outreachType", req.OutreachType, 100)
	if req.Subject != nil {
		errs.MaxLen("subject", *req.Subject, 200)
	}
	if req.TalkingPoints != nil {
		errs.MaxLen("talkingPoints", *req.TalkingPoints, 5000)
	}
	if req.Priority != nil {
		errs.Enum("priority", *req.Priority, []string{"LOW", "NORMAL", "HIGH", "URGENT"})
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", errs.Error())
		return
	}

	maxAttempts := 3
	if req.MaxAttempts != nil {
		maxAttempts = *req.MaxAttempts
	}

	now := time.Now().UTC()
	outreach := models.Outreach{
		OutreachID:    uuid.New().String(),
		TenantID:      tenantID(r),
		ContactID:     req.ContactID,
		OrgID:         req.OrgID,
		TriggerType:   req.TriggerType,
		TriggerDetail: req.TriggerDetail,
		OutreachType:  req.OutreachType,
		Subject:       req.Subject,
		TalkingPoints: req.TalkingPoints,
		Priority:      ptrOrDefault(req.Priority, "NORMAL"),
		AssignedAgent: req.AssignedAgent,
		AssignedTeam:  req.AssignedTeam,
		Status:        models.OutreachPending,
		MaxAttempts:   maxAttempts,
		ScheduledFor:  parseOptionalTime(req.ScheduledFor),
		DueBy:         parseOptionalTime(req.DueBy),
		CreatedAt:     now,
		CreatedBy:     "system",
		UpdatedAt:     now,
		UpdatedBy:     "system",
	}

	if err := h.store.CreateOutreach(r.Context(), &outreach); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "crm", outreach)
}

func (h *Handler) UpdateOutreach(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	existing, err := h.store.GetOutreach(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "crm", "NOT_FOUND", "Outreach not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	var req models.UpdateOutreachRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	if req.Status != nil {
		errs.Enum("status", *req.Status, []string{"pending", "assigned", "attempted", "completed", "cancelled", "deferred"})
	}
	if req.ResultOutcome != nil {
		errs.MaxLen("resultOutcome", *req.ResultOutcome, 200)
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", errs.Error())
		return
	}

	applyOutreachUpdates(existing, &req)
	existing.UpdatedAt = time.Now().UTC()
	existing.UpdatedBy = "system"

	if err := h.store.UpdateOutreach(r.Context(), existing); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "crm", existing)
}

// --- Organization Handlers ---

func (h *Handler) ListOrganizations(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	orgType := r.URL.Query().Get("type")
	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	orgs, total, err := h.store.ListOrganizations(r.Context(), tenantID, orgType, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, "crm", orgs, total, limit, offset)
}

func (h *Handler) CreateOrganization(w http.ResponseWriter, r *http.Request) {
	var req models.CreateOrganizationRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("orgType", req.OrgType)
	errs.MaxLen("orgType", req.OrgType, 50)
	errs.Required("orgName", req.OrgName)
	errs.MaxLen("orgName", req.OrgName, 200)
	if req.OrgShortName != nil {
		errs.MaxLen("orgShortName", *req.OrgShortName, 50)
	}
	if req.MainEmail != nil {
		errs.MaxLen("mainEmail", *req.MainEmail, 254)
	}
	if req.MainPhone != nil {
		errs.MaxLen("mainPhone", *req.MainPhone, 20)
	}
	if req.EIN != nil {
		errs.MaxLen("ein", *req.EIN, 20)
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "crm", "INVALID_REQUEST", errs.Error())
		return
	}

	now := time.Now().UTC()
	org := models.Organization{
		OrgID:            uuid.New().String(),
		TenantID:         tenantID(r),
		OrgType:          req.OrgType,
		OrgName:          req.OrgName,
		OrgShortName:     req.OrgShortName,
		LegacyEmployerID: req.LegacyEmployerID,
		EIN:              req.EIN,
		MainPhone:        req.MainPhone,
		MainEmail:        req.MainEmail,
		CreatedAt:        now,
		UpdatedAt:        now,
		CreatedBy:        "system",
		UpdatedBy:        "system",
	}

	if err := h.store.CreateOrganization(r.Context(), &org); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "crm", org)
}

func (h *Handler) GetOrganization(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	org, err := h.store.GetOrganization(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "crm", "NOT_FOUND", "Organization not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "crm", org)
}

// --- Taxonomy Handler ---

func (h *Handler) GetTaxonomy(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	categories, err := h.store.GetTaxonomyTree(r.Context(), tenantID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "crm", categories)
}

// --- Audit Handler ---

func (h *Handler) GetAuditLog(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	limit, _ := validation.Pagination(intParam(r, "limit", 50), 0, 200)

	filter := crmdb.AuditFilter{
		EntityType: r.URL.Query().Get("entity_type"),
		EntityID:   r.URL.Query().Get("entity_id"),
		AgentID:    r.URL.Query().Get("agent_id"),
		DateFrom:   r.URL.Query().Get("date_from"),
		DateTo:     r.URL.Query().Get("date_to"),
		Limit:      limit,
	}

	entries, err := h.store.GetAuditLog(r.Context(), tid, filter)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "crm", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "crm", entries)
}

// --- Helper Functions ---

const defaultTenantID = "00000000-0000-0000-0000-000000000001"

func tenantID(r *http.Request) string {
	if tid := auth.TenantID(r.Context()); tid != "" {
		return tid
	}
	return defaultTenantID
}

func decodeJSON(r *http.Request, v interface{}) error {
	if r.Body == nil {
		return fmt.Errorf("request body is empty")
	}
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

func intParam(r *http.Request, name string, defaultVal int) int {
	s := r.URL.Query().Get(name)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}

func ptrOrDefault(p *string, def string) string {
	if p != nil {
		return *p
	}
	return def
}

func ptrIfNonEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func parseOptionalTime(s *string) *time.Time {
	if s == nil {
		return nil
	}
	t, err := time.Parse(time.RFC3339, *s)
	if err != nil {
		return nil
	}
	return &t
}

func applyContactUpdates(c *models.Contact, req *models.UpdateContactRequest) {
	if req.FirstName != nil {
		c.FirstName = *req.FirstName
	}
	if req.LastName != nil {
		c.LastName = *req.LastName
	}
	if req.PrimaryEmail != nil {
		c.PrimaryEmail = req.PrimaryEmail
	}
	if req.PrimaryPhone != nil {
		c.PrimaryPhone = req.PrimaryPhone
	}
	if req.PreferredChannel != nil {
		c.PreferredChannel = *req.PreferredChannel
	}
	if req.PreferredLanguage != nil {
		c.PreferredLanguage = *req.PreferredLanguage
	}
	if req.SecurityFlag != nil {
		c.SecurityFlag = req.SecurityFlag
	}
	if req.SecurityFlagNote != nil {
		c.SecurityFlagNote = req.SecurityFlagNote
	}
	if req.IdentityVerified != nil {
		c.IdentityVerified = *req.IdentityVerified
		if *req.IdentityVerified {
			now := time.Now().UTC()
			c.IdentityVerifiedAt = &now
			by := "system"
			c.IdentityVerifiedBy = &by
		}
	}
}

func applyConversationUpdates(c *models.Conversation, req *models.UpdateConversationRequest) {
	if req.Status != nil {
		c.Status = models.ConversationStatus(*req.Status)
		if *req.Status == "resolved" || *req.Status == "closed" {
			now := time.Now().UTC()
			c.ResolvedAt = &now
			by := "system"
			c.ResolvedBy = &by
		}
	}
	if req.AssignedTeam != nil {
		c.AssignedTeam = req.AssignedTeam
	}
	if req.AssignedAgent != nil {
		c.AssignedAgent = req.AssignedAgent
	}
	if req.ResolutionSummary != nil {
		c.ResolutionSummary = req.ResolutionSummary
	}
}

func applyCommitmentUpdates(c *models.Commitment, req *models.UpdateCommitmentRequest) {
	if req.Status != nil {
		c.Status = models.CommitmentStatus(*req.Status)
		if *req.Status == "fulfilled" {
			now := time.Now().UTC()
			c.FulfilledAt = &now
			by := "system"
			c.FulfilledBy = &by
		}
	}
	if req.FulfillmentNote != nil {
		c.FulfillmentNote = req.FulfillmentNote
	}
}

func applyOutreachUpdates(o *models.Outreach, req *models.UpdateOutreachRequest) {
	if req.Status != nil {
		o.Status = models.OutreachStatus(*req.Status)
		if *req.Status == "attempted" {
			o.AttemptCount++
			now := time.Now().UTC()
			o.LastAttemptAt = &now
		}
		if *req.Status == "completed" {
			now := time.Now().UTC()
			o.CompletedAt = &now
		}
	}
	if req.AssignedAgent != nil {
		o.AssignedAgent = req.AssignedAgent
	}
	if req.AssignedTeam != nil {
		o.AssignedTeam = req.AssignedTeam
	}
	if req.ResultOutcome != nil {
		o.ResultOutcome = req.ResultOutcome
	}
	if req.ScheduledFor != nil {
		o.ScheduledFor = parseOptionalTime(req.ScheduledFor)
	}
	if req.DueBy != nil {
		o.DueBy = parseOptionalTime(req.DueBy)
	}
}
