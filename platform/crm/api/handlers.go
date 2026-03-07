// Package api implements HTTP handlers for the CRM service.
// The CRM service is a NoUI platform-native service — it manages its own
// schema directly, not through the Data Connector.
package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	crmdb "github.com/noui/platform/crm/db"
	"github.com/noui/platform/crm/models"
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

	// Taxonomy
	mux.HandleFunc("GET /api/v1/crm/taxonomy", h.GetTaxonomy)

	// Audit
	mux.HandleFunc("GET /api/v1/crm/audit", h.GetAuditLog)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "crm",
		"version": "0.1.0",
	})
}

// --- Contact Handlers ---

func (h *Handler) SearchContacts(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantFromHeader(r)

	params := models.ContactSearchParams{
		Query:       r.URL.Query().Get("q"),
		ContactType: r.URL.Query().Get("type"),
		Limit:       intParam(r, "limit", 25),
		Offset:      intParam(r, "offset", 0),
	}

	contacts, total, err := h.store.ListContacts(tenantID, params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, contacts, total, params.Limit, params.Offset)
}

func (h *Handler) CreateContact(w http.ResponseWriter, r *http.Request) {
	var req models.CreateContactRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	now := time.Now().UTC()
	contact := models.Contact{
		ContactID:         uuid.New().String(),
		TenantID:          tenantFromHeader(r),
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

	if err := h.store.CreateContact(&contact); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusCreated, contact)
}

func (h *Handler) GetContact(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	contact, err := h.store.GetContact(id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Contact not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, contact)
}

func (h *Handler) UpdateContact(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	existing, err := h.store.GetContact(id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Contact not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	var req models.UpdateContactRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	applyContactUpdates(existing, &req)
	existing.UpdatedAt = time.Now().UTC()
	existing.UpdatedBy = "system"

	if err := h.store.UpdateContact(existing); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, existing)
}

func (h *Handler) GetContactByLegacyID(w http.ResponseWriter, r *http.Request) {
	legacyID := r.PathValue("legacyId")
	tenantID := tenantFromHeader(r)

	contact, err := h.store.GetContactByLegacyID(tenantID, legacyID)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Contact not found for legacy ID")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, contact)
}

func (h *Handler) GetContactTimeline(w http.ResponseWriter, r *http.Request) {
	contactID := r.PathValue("id")
	limit := intParam(r, "limit", 50)
	offset := intParam(r, "offset", 0)

	timeline, err := h.store.GetContactTimeline(contactID, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, timeline)
}

// --- Conversation Handlers ---

func (h *Handler) ListConversations(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantFromHeader(r)
	status := r.URL.Query().Get("status")
	anchorType := r.URL.Query().Get("anchor_type")
	anchorID := r.URL.Query().Get("anchor_id")
	limit := intParam(r, "limit", 25)
	offset := intParam(r, "offset", 0)

	conversations, total, err := h.store.ListConversations(tenantID, status, anchorType, anchorID, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, conversations, total, limit, offset)
}

func (h *Handler) CreateConversation(w http.ResponseWriter, r *http.Request) {
	var req models.CreateConversationRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	now := time.Now().UTC()
	conv := models.Conversation{
		ConversationID:   uuid.New().String(),
		TenantID:         tenantFromHeader(r),
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

	if err := h.store.CreateConversation(&conv); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusCreated, conv)
}

func (h *Handler) GetConversation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	conv, err := h.store.GetConversation(id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Conversation not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, conv)
}

func (h *Handler) UpdateConversation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	existing, err := h.store.GetConversation(id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Conversation not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	var req models.UpdateConversationRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	applyConversationUpdates(existing, &req)
	existing.UpdatedAt = time.Now().UTC()
	existing.UpdatedBy = "system"

	if err := h.store.UpdateConversation(existing); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, existing)
}

// --- Interaction Handlers ---

func (h *Handler) ListInteractions(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantFromHeader(r)

	filter := crmdb.InteractionFilter{
		ContactID: r.URL.Query().Get("contact_id"),
		Channel:   r.URL.Query().Get("channel"),
		Limit:     intParam(r, "limit", 25),
		Offset:    intParam(r, "offset", 0),
	}

	interactions, total, err := h.store.ListInteractions(tenantID, filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, interactions, total, filter.Limit, filter.Offset)
}

func (h *Handler) CreateInteraction(w http.ResponseWriter, r *http.Request) {
	var req models.CreateInteractionRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	now := time.Now().UTC()
	startedAt := now
	if req.StartedAt != nil {
		startedAt = *req.StartedAt
	}

	interaction := models.Interaction{
		InteractionID:   uuid.New().String(),
		TenantID:        tenantFromHeader(r),
		ConversationID:  req.ConversationID,
		ContactID:       req.ContactID,
		OrgID:           req.OrgID,
		AgentID:         req.AgentID,
		Channel:         models.InteractionChannel(req.Channel),
		InteractionType: models.InteractionType(req.InteractionType),
		Category:        req.Category,
		Subcategory:     req.Subcategory,
		Outcome:         req.Outcome,
		Direction:      models.Direction(req.Direction),
		StartedAt:      startedAt,
		Summary:        req.Summary,
		Visibility:     models.Visibility(ptrOrDefault(req.Visibility, "INTERNAL")),
		CreatedAt:      now,
		CreatedBy:      "system",
	}

	if err := h.store.CreateInteraction(&interaction); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusCreated, interaction)
}

func (h *Handler) GetInteraction(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	interaction, err := h.store.GetInteraction(id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Interaction not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, interaction)
}

// --- Note Handlers ---

func (h *Handler) CreateNote(w http.ResponseWriter, r *http.Request) {
	var req models.CreateNoteRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
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
		UrgentFlag:   req.UrgentFlag,
		AISuggested:  req.AISuggested,
		CreatedAt:     now,
		CreatedBy:     "system",
		UpdatedAt:     now,
		UpdatedBy:     "system",
	}

	if req.AIConfidence != nil {
		v, err := strconv.ParseFloat(*req.AIConfidence, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "aiConfidence must be a decimal number")
			return
		}
		note.AIConfidence = &v
	}

	if err := h.store.CreateNote(&note); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusCreated, note)
}

// --- Commitment Handlers ---

func (h *Handler) ListCommitments(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantFromHeader(r)
	status := r.URL.Query().Get("status")
	ownerAgent := r.URL.Query().Get("owner_agent")
	limit := intParam(r, "limit", 25)
	offset := intParam(r, "offset", 0)

	commitments, total, err := h.store.ListCommitments(tenantID, status, ownerAgent, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, commitments, total, limit, offset)
}

func (h *Handler) CreateCommitment(w http.ResponseWriter, r *http.Request) {
	var req models.CreateCommitmentRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	alertDays := 2
	if req.AlertDaysBefore != nil {
		alertDays = *req.AlertDaysBefore
	}

	now := time.Now().UTC()
	commitment := models.Commitment{
		CommitmentID:    uuid.New().String(),
		TenantID:        tenantFromHeader(r),
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

	if err := h.store.CreateCommitment(&commitment); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusCreated, commitment)
}

func (h *Handler) UpdateCommitment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	existing, err := h.store.GetCommitment(id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Commitment not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	var req models.UpdateCommitmentRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	applyCommitmentUpdates(existing, &req)
	existing.UpdatedAt = time.Now().UTC()
	existing.UpdatedBy = "system"

	if err := h.store.UpdateCommitment(existing); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, existing)
}

// --- Outreach Handlers ---

func (h *Handler) ListOutreach(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantFromHeader(r)
	status := r.URL.Query().Get("status")
	assignedAgent := r.URL.Query().Get("assigned_agent")
	limit := intParam(r, "limit", 25)
	offset := intParam(r, "offset", 0)

	outreach, total, err := h.store.ListOutreach(tenantID, status, assignedAgent, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, outreach, total, limit, offset)
}

func (h *Handler) CreateOutreach(w http.ResponseWriter, r *http.Request) {
	var req models.CreateOutreachRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	maxAttempts := 3
	if req.MaxAttempts != nil {
		maxAttempts = *req.MaxAttempts
	}

	now := time.Now().UTC()
	outreach := models.Outreach{
		OutreachID:    uuid.New().String(),
		TenantID:      tenantFromHeader(r),
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

	if err := h.store.CreateOutreach(&outreach); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusCreated, outreach)
}

func (h *Handler) UpdateOutreach(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	existing, err := h.store.GetOutreach(id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Outreach not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	var req models.UpdateOutreachRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	applyOutreachUpdates(existing, &req)
	existing.UpdatedAt = time.Now().UTC()
	existing.UpdatedBy = "system"

	if err := h.store.UpdateOutreach(existing); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, existing)
}

// --- Organization Handlers ---

func (h *Handler) ListOrganizations(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantFromHeader(r)
	orgType := r.URL.Query().Get("type")
	limit := intParam(r, "limit", 25)
	offset := intParam(r, "offset", 0)

	orgs, total, err := h.store.ListOrganizations(tenantID, orgType, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, orgs, total, limit, offset)
}

func (h *Handler) CreateOrganization(w http.ResponseWriter, r *http.Request) {
	var req models.CreateOrganizationRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	now := time.Now().UTC()
	org := models.Organization{
		OrgID:            uuid.New().String(),
		TenantID:         tenantFromHeader(r),
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

	if err := h.store.CreateOrganization(&org); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusCreated, org)
}

func (h *Handler) GetOrganization(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	org, err := h.store.GetOrganization(id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Organization not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, org)
}

// --- Taxonomy Handler ---

func (h *Handler) GetTaxonomy(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantFromHeader(r)
	categories, err := h.store.GetTaxonomyTree(tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, categories)
}

// --- Audit Handler ---

func (h *Handler) GetAuditLog(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantFromHeader(r)
	entityType := r.URL.Query().Get("entity_type")
	entityID := r.URL.Query().Get("entity_id")
	limit := intParam(r, "limit", 50)

	entries, err := h.store.GetAuditLog(tenantID, entityType, entityID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, entries)
}

// --- Helper Functions ---

const defaultTenantID = "00000000-0000-0000-0000-000000000001"

func tenantFromHeader(r *http.Request) string {
	tid := r.Header.Get("X-Tenant-ID")
	if tid == "" {
		return defaultTenantID
	}
	return tid
}

func decodeJSON(r *http.Request, v interface{}) error {
	if r.Body == nil {
		return fmt.Errorf("request body is empty")
	}
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("error encoding JSON response: %v", err)
	}
}

func writeSuccess(w http.ResponseWriter, status int, data interface{}) {
	resp := map[string]interface{}{
		"data": data,
		"meta": map[string]interface{}{
			"requestId": uuid.New().String(),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"service":   "crm",
			"version":   "v1",
		},
	}
	writeJSON(w, status, resp)
}

func writePaginated(w http.ResponseWriter, data interface{}, total, limit, offset int) {
	resp := map[string]interface{}{
		"data": data,
		"pagination": map[string]interface{}{
			"total":   total,
			"limit":   limit,
			"offset":  offset,
			"hasMore": offset+limit < total,
		},
		"meta": map[string]interface{}{
			"requestId": uuid.New().String(),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"service":   "crm",
			"version":   "v1",
		},
	}
	writeJSON(w, http.StatusOK, resp)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	resp := map[string]interface{}{
		"error": map[string]interface{}{
			"code":      code,
			"message":   message,
			"requestId": uuid.New().String(),
		},
	}
	writeJSON(w, status, resp)
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
