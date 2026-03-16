// Package api implements HTTP handlers for the Case Management service.
package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/noui/platform/auth"
	cmdb "github.com/noui/platform/casemanagement/db"
	"github.com/noui/platform/casemanagement/models"
)

// Handler holds dependencies for Case Management API handlers.
type Handler struct {
	store *cmdb.Store
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(database *sql.DB) *Handler {
	return &Handler{store: cmdb.NewStore(database)}
}

// RegisterRoutes sets up all case management API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	// Stage definitions
	mux.HandleFunc("GET /api/v1/stages", h.ListStages)

	// Cases
	mux.HandleFunc("GET /api/v1/cases", h.ListCases)
	mux.HandleFunc("POST /api/v1/cases", h.CreateCase)

	// Stats (must be before {id} routes for clarity)
	mux.HandleFunc("GET /api/v1/cases/stats", h.GetCaseStats)
	mux.HandleFunc("GET /api/v1/cases/stats/sla", h.GetSLAStats)
	mux.HandleFunc("GET /api/v1/cases/stats/volume", h.GetVolumeStats)

	mux.HandleFunc("GET /api/v1/cases/{id}", h.GetCase)
	mux.HandleFunc("PUT /api/v1/cases/{id}", h.UpdateCase)
	mux.HandleFunc("POST /api/v1/cases/{id}/advance", h.AdvanceStage)
	mux.HandleFunc("GET /api/v1/cases/{id}/history", h.GetStageHistory)

	// Notes
	mux.HandleFunc("GET /api/v1/cases/{id}/notes", h.ListNotes)
	mux.HandleFunc("POST /api/v1/cases/{id}/notes", h.CreateNote)
	mux.HandleFunc("DELETE /api/v1/cases/{id}/notes/{noteId}", h.DeleteNote)

	// Documents
	mux.HandleFunc("GET /api/v1/cases/{id}/documents", h.ListDocuments)
	mux.HandleFunc("POST /api/v1/cases/{id}/documents", h.CreateDocument)
	mux.HandleFunc("DELETE /api/v1/cases/{id}/documents/{docId}", h.DeleteDocument)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "casemanagement",
		"version": "0.1.0",
	})
}

// --- Stage Handlers ---

func (h *Handler) ListStages(w http.ResponseWriter, r *http.Request) {
	stages, err := h.store.ListStages(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": stages})
}

// --- Case Handlers ---

func (h *Handler) ListCases(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)

	filter := models.CaseFilter{
		Status:     r.URL.Query().Get("status"),
		Priority:   r.URL.Query().Get("priority"),
		AssignedTo: r.URL.Query().Get("assigned_to"),
		Stage:      r.URL.Query().Get("stage"),
		MemberID:   intParam(r, "member_id", 0),
		Limit:      intParam(r, "limit", 25),
		Offset:     intParam(r, "offset", 0),
	}

	cases, total, err := h.store.ListCases(r.Context(), tenantID, filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, cases, total, filter.Limit, filter.Offset)
}

func (h *Handler) GetCase(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	tenantID := tenantID(r)
	c, err := h.store.GetCase(r.Context(), tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Case not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	// Enrich with note and document counts
	noteCount, _ := h.store.NoteCount(r.Context(), id)
	docCount, _ := h.store.DocumentCount(r.Context(), id)

	detail := models.CaseDetail{
		RetirementCase: *c,
		NoteCount:      noteCount,
		DocumentCount:  docCount,
	}

	writeSuccess(w, http.StatusOK, detail)
}

func (h *Handler) CreateCase(w http.ResponseWriter, r *http.Request) {
	var req models.CreateCaseRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	if req.CaseID == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "caseId is required")
		return
	}

	// Look up stage 0 for initial stage
	stage, err := h.store.GetStage(r.Context(), 0)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "failed to load initial stage")
		return
	}

	priority := req.Priority
	if priority == "" {
		priority = "standard"
	}

	now := time.Now().UTC()
	slaTargetDays := 90
	if req.Priority == "urgent" {
		slaTargetDays = 30
	} else if req.Priority == "high" {
		slaTargetDays = 60
	}
	slaDeadline := now.AddDate(0, 0, slaTargetDays)

	c := &models.RetirementCase{
		CaseID:          req.CaseID,
		TenantID:        tenantID(r),
		MemberID:        req.MemberID,
		CaseType:        req.CaseType,
		RetirementDate:  req.RetirementDate,
		Priority:        priority,
		SLAStatus:       "on-track",
		CurrentStage:    stage.StageName,
		CurrentStageIdx: 0,
		AssignedTo:      req.AssignedTo,
		DaysOpen:        0,
		Status:          "active",
		SLATargetDays:   slaTargetDays,
		SLADeadlineAt:   slaDeadline,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := h.store.CreateCase(r.Context(), c, req.Flags); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	// Re-fetch with JOINed member data (unscoped — we just created it with the right tenant)
	full, err := h.store.GetCaseByID(r.Context(), c.CaseID)
	if err != nil {
		// Case was created but re-fetch failed; return the bare case
		writeSuccess(w, http.StatusCreated, c)
		return
	}

	writeSuccess(w, http.StatusCreated, full)
}

func (h *Handler) UpdateCase(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	tenantID := tenantID(r)

	// Verify case exists (tenant-scoped)
	_, err := h.store.GetCase(r.Context(), tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Case not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	var req models.UpdateCaseRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	if err := h.store.UpdateCase(r.Context(), tenantID, id, req); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	updated, err := h.store.GetCase(r.Context(), tenantID, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, updated)
}

func (h *Handler) AdvanceStage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	tenantID := tenantID(r)

	var req models.AdvanceStageRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	if strings.TrimSpace(req.TransitionedBy) == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "transitionedBy is required")
		return
	}

	updated, err := h.store.AdvanceStage(r.Context(), tenantID, id, req.TransitionedBy, req.Note)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Case not found")
			return
		}
		writeError(w, http.StatusBadRequest, "ADVANCE_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, updated)
}

func (h *Handler) GetStageHistory(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	tenantID := tenantID(r)

	history, err := h.store.GetStageHistory(r.Context(), tenantID, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	if history == nil {
		history = []models.StageTransition{}
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": history})
}

// --- Note Handlers ---

func (h *Handler) ListNotes(w http.ResponseWriter, r *http.Request) {
	caseID := r.PathValue("id")

	notes, err := h.store.ListNotes(r.Context(), caseID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	if notes == nil {
		notes = []models.CaseNote{}
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": notes})
}

func (h *Handler) CreateNote(w http.ResponseWriter, r *http.Request) {
	caseID := r.PathValue("id")

	var req models.CreateNoteRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	if strings.TrimSpace(req.Author) == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "author is required")
		return
	}
	if strings.TrimSpace(req.Content) == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "content is required")
		return
	}

	note, err := h.store.CreateNote(r.Context(), caseID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusCreated, note)
}

func (h *Handler) DeleteNote(w http.ResponseWriter, r *http.Request) {
	caseID := r.PathValue("id")
	noteID, err := strconv.Atoi(r.PathValue("noteId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid noteId")
		return
	}

	if err := h.store.DeleteNote(r.Context(), caseID, noteID); err != nil {
		if err == cmdb.ErrNotFound {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Note not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// --- Document Handlers ---

func (h *Handler) ListDocuments(w http.ResponseWriter, r *http.Request) {
	caseID := r.PathValue("id")

	docs, err := h.store.ListDocuments(r.Context(), caseID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	if docs == nil {
		docs = []models.CaseDocument{}
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": docs})
}

func (h *Handler) CreateDocument(w http.ResponseWriter, r *http.Request) {
	caseID := r.PathValue("id")

	var req models.CreateDocumentRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	if strings.TrimSpace(req.Filename) == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "filename is required")
		return
	}
	if strings.TrimSpace(req.UploadedBy) == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "uploadedBy is required")
		return
	}

	doc, err := h.store.CreateDocument(r.Context(), caseID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusCreated, doc)
}

func (h *Handler) DeleteDocument(w http.ResponseWriter, r *http.Request) {
	caseID := r.PathValue("id")
	docID, err := strconv.Atoi(r.PathValue("docId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid docId")
		return
	}

	if err := h.store.DeleteDocument(r.Context(), caseID, docID); err != nil {
		if err == cmdb.ErrNotFound {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Document not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// --- Stats Handlers ---

func (h *Handler) GetCaseStats(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)

	stats, err := h.store.GetCaseStats(r.Context(), tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, stats)
}

func (h *Handler) GetSLAStats(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)

	stats, err := h.store.GetSLAStats(r.Context(), tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, stats)
}

func (h *Handler) GetVolumeStats(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	months := intParam(r, "months", 6)

	stats, err := h.store.GetVolumeStats(r.Context(), tenantID, months)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, stats)
}

// --- Helper Functions ---

const defaultTenantID = "00000000-0000-0000-0000-000000000001"

func tenantID(r *http.Request) string {
	if tid := auth.TenantID(r.Context()); tid != "" {
		return tid
	}
	return defaultTenantID
}

func decodeJSON(r *http.Request, v any) error {
	if r.Body == nil {
		return fmt.Errorf("request body is empty")
	}
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("error encoding JSON response", "error", err)
	}
}

func writeSuccess(w http.ResponseWriter, status int, data any) {
	resp := map[string]any{
		"data": data,
		"meta": map[string]any{
			"requestId": uuid.New().String(),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"service":   "casemanagement",
			"version":   "v1",
		},
	}
	writeJSON(w, status, resp)
}

func writePaginated(w http.ResponseWriter, data any, total, limit, offset int) {
	resp := map[string]any{
		"data": data,
		"pagination": map[string]any{
			"total":   total,
			"limit":   limit,
			"offset":  offset,
			"hasMore": offset+limit < total,
		},
		"meta": map[string]any{
			"requestId": uuid.New().String(),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"service":   "casemanagement",
			"version":   "v1",
		},
	}
	writeJSON(w, http.StatusOK, resp)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	resp := map[string]any{
		"error": map[string]any{
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
