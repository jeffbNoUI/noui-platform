// Package api implements HTTP handlers for the Correspondence service.
package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/noui/platform/auth"
	corrdb "github.com/noui/platform/correspondence/db"
	"github.com/noui/platform/correspondence/models"
)

// Handler holds dependencies for Correspondence API handlers.
type Handler struct {
	store *corrdb.Store
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(database *sql.DB) *Handler {
	return &Handler{store: corrdb.NewStore(database)}
}

// RegisterRoutes sets up all Correspondence API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	// Templates
	mux.HandleFunc("GET /api/v1/correspondence/templates", h.ListTemplates)
	mux.HandleFunc("GET /api/v1/correspondence/templates/{id}", h.GetTemplate)

	// Generate
	mux.HandleFunc("POST /api/v1/correspondence/generate", h.Generate)

	// History
	mux.HandleFunc("GET /api/v1/correspondence/history", h.ListHistory)
	mux.HandleFunc("GET /api/v1/correspondence/history/{id}", h.GetCorrespondence)
	mux.HandleFunc("PUT /api/v1/correspondence/history/{id}", h.UpdateCorrespondence)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "correspondence",
		"version": "0.1.0",
	})
}

// --- Template Handlers ---

func (h *Handler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	category := r.URL.Query().Get("category")
	stageCategory := r.URL.Query().Get("stage_category")
	activeOnly := r.URL.Query().Get("is_active") != "false"
	limit := intParam(r, "limit", 25)
	offset := intParam(r, "offset", 0)

	templates, total, err := h.store.ListTemplates(r.Context(), tenantID, category, stageCategory, activeOnly, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, templates, total, limit, offset)
}

func (h *Handler) GetTemplate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	tmpl, err := h.store.GetTemplate(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Template not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, tmpl)
}

// --- Generate Handler ---

func (h *Handler) Generate(w http.ResponseWriter, r *http.Request) {
	var req models.GenerateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	// Fetch the template
	tmpl, err := h.store.GetTemplate(r.Context(), req.TemplateID)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Template not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	// Render the template
	rendered, err := corrdb.RenderTemplate(tmpl, req.MergeData)
	if err != nil {
		writeError(w, http.StatusBadRequest, "MERGE_ERROR", err.Error())
		return
	}

	// Build subject from template name
	subject := tmpl.TemplateName
	if name, ok := req.MergeData["member_name"]; ok {
		subject = tmpl.TemplateName + " - " + name
	}

	now := time.Now().UTC()
	corr := models.Correspondence{
		CorrespondenceID: uuid.New().String(),
		TenantID:         tenantID(r),
		TemplateID:       req.TemplateID,
		MemberID:         req.MemberID,
		CaseID:           req.CaseID,
		ContactID:        req.ContactID,
		Subject:          subject,
		BodyRendered:     rendered,
		MergeData:        req.MergeData,
		Status:           "draft",
		GeneratedBy:      "system",
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := h.store.CreateCorrespondence(r.Context(), &corr); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusCreated, corr)
}

// --- History Handlers ---

func (h *Handler) ListHistory(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	status := r.URL.Query().Get("status")
	limit := intParam(r, "limit", 25)
	offset := intParam(r, "offset", 0)

	var memberID *int
	if mid := r.URL.Query().Get("member_id"); mid != "" {
		if v, err := strconv.Atoi(mid); err == nil {
			memberID = &v
		}
	}

	var contactID *string
	if cid := r.URL.Query().Get("contact_id"); cid != "" {
		contactID = &cid
	}

	var caseID *string
	if caseid := r.URL.Query().Get("case_id"); caseid != "" {
		caseID = &caseid
	}

	history, total, err := h.store.ListHistory(r.Context(), tenantID, memberID, contactID, caseID, status, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, history, total, limit, offset)
}

func (h *Handler) GetCorrespondence(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	corr, err := h.store.GetCorrespondence(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Correspondence not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, corr)
}

func (h *Handler) UpdateCorrespondence(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	existing, err := h.store.GetCorrespondence(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Correspondence not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	var req models.UpdateCorrespondenceRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	if req.Status != nil {
		existing.Status = *req.Status
		if *req.Status == "sent" {
			now := time.Now().UTC()
			existing.SentAt = &now
		}
	}
	if req.SentVia != nil {
		existing.SentVia = req.SentVia
	}
	if req.DeliveryAddress != nil {
		existing.DeliveryAddress = req.DeliveryAddress
	}

	if err := h.store.UpdateCorrespondence(r.Context(), existing); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, existing)
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

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("error encoding JSON response", "error", err)
	}
}

func writeSuccess(w http.ResponseWriter, status int, data interface{}) {
	resp := map[string]interface{}{
		"data": data,
		"meta": map[string]interface{}{
			"requestId": uuid.New().String(),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"service":   "correspondence",
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
			"service":   "correspondence",
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
