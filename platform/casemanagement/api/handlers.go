// Package api implements HTTP handlers for the Case Management service.
package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
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
	mux.HandleFunc("GET /api/v1/cases/{id}", h.GetCase)
	mux.HandleFunc("PUT /api/v1/cases/{id}", h.UpdateCase)
	mux.HandleFunc("POST /api/v1/cases/{id}/advance", h.AdvanceStage)
	mux.HandleFunc("GET /api/v1/cases/{id}/history", h.GetStageHistory)
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
	stages, err := h.store.ListStages()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": stages})
}

// --- Case Handlers ---

func (h *Handler) ListCases(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantFromHeader(r)

	filter := models.CaseFilter{
		Status:     r.URL.Query().Get("status"),
		Priority:   r.URL.Query().Get("priority"),
		AssignedTo: r.URL.Query().Get("assigned_to"),
		MemberID:   intParam(r, "member_id", 0),
		Limit:      intParam(r, "limit", 25),
		Offset:     intParam(r, "offset", 0),
	}

	cases, total, err := h.store.ListCases(tenantID, filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, cases, total, filter.Limit, filter.Offset)
}

func (h *Handler) GetCase(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	c, err := h.store.GetCase(id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Case not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, c)
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
	stage, err := h.store.GetStage(0)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "failed to load initial stage")
		return
	}

	priority := req.Priority
	if priority == "" {
		priority = "standard"
	}

	now := time.Now().UTC()
	c := &models.RetirementCase{
		CaseID:          req.CaseID,
		TenantID:        tenantFromHeader(r),
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
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := h.store.CreateCase(c, req.Flags); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	// Re-fetch with JOINed member data
	full, err := h.store.GetCase(c.CaseID)
	if err != nil {
		// Case was created but re-fetch failed; return the bare case
		writeSuccess(w, http.StatusCreated, c)
		return
	}

	writeSuccess(w, http.StatusCreated, full)
}

func (h *Handler) UpdateCase(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	// Verify case exists
	_, err := h.store.GetCase(id)
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

	if err := h.store.UpdateCase(id, req); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	updated, err := h.store.GetCase(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, updated)
}

func (h *Handler) AdvanceStage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req models.AdvanceStageRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	if strings.TrimSpace(req.TransitionedBy) == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "transitionedBy is required")
		return
	}

	updated, err := h.store.AdvanceStage(id, req.TransitionedBy, req.Note)
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

	history, err := h.store.GetStageHistory(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": history})
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
		log.Printf("error encoding JSON response: %v", err)
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
