// Package api implements HTTP handlers for the Issue Management service.
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
	issuedb "github.com/noui/platform/issues/db"
	"github.com/noui/platform/issues/models"
	"github.com/noui/platform/validation"
)

// Handler holds dependencies for Issue Management API handlers.
type Handler struct {
	store *issuedb.Store
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(database *sql.DB) *Handler {
	return &Handler{
		store: issuedb.NewStore(database),
	}
}

// RegisterRoutes sets up all issue management API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	// Issues
	mux.HandleFunc("GET /api/v1/issues", h.ListIssues)
	mux.HandleFunc("POST /api/v1/issues", h.CreateIssue)

	// Stats (must be before {id} routes)
	mux.HandleFunc("GET /api/v1/issues/stats", h.GetIssueStats)

	mux.HandleFunc("GET /api/v1/issues/{id}", h.GetIssue)
	mux.HandleFunc("PUT /api/v1/issues/{id}", h.UpdateIssue)

	// Comments
	mux.HandleFunc("GET /api/v1/issues/{id}/comments", h.ListComments)
	mux.HandleFunc("POST /api/v1/issues/{id}/comments", h.CreateComment)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "issues",
		"version": "0.1.0",
	})
}

// --- Issue Handlers ---

func (h *Handler) ListIssues(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)

	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	filter := models.IssueFilter{
		Status:     r.URL.Query().Get("status"),
		Severity:   r.URL.Query().Get("severity"),
		Category:   r.URL.Query().Get("category"),
		AssignedTo: r.URL.Query().Get("assigned_to"),
		Limit:      limit,
		Offset:     offset,
	}

	issues, total, err := h.store.ListIssues(r.Context(), tenantID, filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, issues, total, filter.Limit, filter.Offset)
}

func (h *Handler) GetIssue(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid issue id")
		return
	}
	tenantID := tenantID(r)

	issue, err := h.store.GetIssueByID(r.Context(), tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Issue not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, issue)
}

func (h *Handler) CreateIssue(w http.ResponseWriter, r *http.Request) {
	var req models.CreateIssueRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("title", req.Title)
	errs.MaxLen("title", req.Title, 500)
	errs.Required("reportedBy", req.ReportedBy)
	errs.MaxLen("reportedBy", req.ReportedBy, 200)
	errs.EnumOptional("severity", req.Severity, models.SeverityValues)
	errs.EnumOptional("category", req.Category, models.CategoryValues)
	errs.MaxLen("description", req.Description, 10000)
	errs.MaxLen("affectedService", req.AffectedService, 200)
	errs.MaxLen("assignedTo", req.AssignedTo, 200)
	if errs.HasErrors() {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", errs.Error())
		return
	}

	tenantID := tenantID(r)
	issue, err := h.store.CreateIssue(r.Context(), tenantID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusCreated, issue)
}

func (h *Handler) UpdateIssue(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid issue id")
		return
	}
	tenantID := tenantID(r)

	// Verify issue exists (tenant-scoped)
	_, err = h.store.GetIssueByID(r.Context(), tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Issue not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	var req models.UpdateIssueRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	if req.Title != nil {
		errs.Required("title", *req.Title)
		errs.MaxLen("title", *req.Title, 500)
	}
	if req.Severity != nil {
		errs.Enum("severity", *req.Severity, models.SeverityValues)
	}
	if req.Category != nil {
		errs.Enum("category", *req.Category, models.CategoryValues)
	}
	if req.Status != nil {
		errs.Enum("status", *req.Status, models.StatusValues)
	}
	if req.AssignedTo != nil {
		errs.MaxLen("assignedTo", *req.AssignedTo, 200)
	}
	if req.Description != nil {
		errs.MaxLen("description", *req.Description, 10000)
	}
	if req.AffectedService != nil {
		errs.MaxLen("affectedService", *req.AffectedService, 200)
	}
	if req.ResolutionNote != nil {
		errs.MaxLen("resolutionNote", *req.ResolutionNote, 10000)
	}
	if errs.HasErrors() {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", errs.Error())
		return
	}

	if err := h.store.UpdateIssue(r.Context(), tenantID, id, req); err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	updated, err := h.store.GetIssueByID(r.Context(), tenantID, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, updated)
}

// --- Comment Handlers ---

func (h *Handler) ListComments(w http.ResponseWriter, r *http.Request) {
	issueID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid issue id")
		return
	}

	comments, err := h.store.ListComments(r.Context(), issueID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	if comments == nil {
		comments = []models.IssueComment{}
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": comments})
}

func (h *Handler) CreateComment(w http.ResponseWriter, r *http.Request) {
	issueID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid issue id")
		return
	}

	var req models.CreateCommentRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("author", req.Author)
	errs.Required("content", req.Content)
	errs.MaxLen("author", req.Author, 200)
	errs.MaxLen("content", req.Content, 10000)
	if errs.HasErrors() {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", errs.Error())
		return
	}

	comment, err := h.store.CreateComment(r.Context(), issueID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusCreated, comment)
}

// --- Stats Handler ---

func (h *Handler) GetIssueStats(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)

	stats, err := h.store.GetIssueStats(r.Context(), tenantID)
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
			"request_id": uuid.New().String(),
			"timestamp":  time.Now().UTC().Format(time.RFC3339),
			"service":    "issues",
			"version":    "v1",
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
			"request_id": uuid.New().String(),
			"timestamp":  time.Now().UTC().Format(time.RFC3339),
			"service":    "issues",
			"version":    "v1",
		},
	}
	writeJSON(w, http.StatusOK, resp)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	resp := map[string]any{
		"error": map[string]any{
			"code":       code,
			"message":    message,
			"request_id": uuid.New().String(),
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
