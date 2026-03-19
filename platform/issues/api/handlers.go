// Package api implements HTTP handlers for the Issue Management service.
package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/noui/platform/apiresponse"
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
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
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
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, "issues", issues, total, filter.Limit, filter.Offset)
}

func (h *Handler) GetIssue(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "issues", "INVALID_REQUEST", "invalid issue id")
		return
	}
	tenantID := tenantID(r)

	issue, err := h.store.GetIssueByID(r.Context(), tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "issues", "NOT_FOUND", "Issue not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "issues", issue)
}

func (h *Handler) CreateIssue(w http.ResponseWriter, r *http.Request) {
	var req models.CreateIssueRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "issues", "INVALID_REQUEST", err.Error())
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
		apiresponse.WriteError(w, http.StatusBadRequest, "issues", "INVALID_REQUEST", errs.Error())
		return
	}

	tenantID := tenantID(r)
	issue, err := h.store.CreateIssue(r.Context(), tenantID, req)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "issues", issue)
}

func (h *Handler) UpdateIssue(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "issues", "INVALID_REQUEST", "invalid issue id")
		return
	}
	tenantID := tenantID(r)

	// Verify issue exists (tenant-scoped)
	_, err = h.store.GetIssueByID(r.Context(), tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "issues", "NOT_FOUND", "Issue not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	var req models.UpdateIssueRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "issues", "INVALID_REQUEST", err.Error())
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
		apiresponse.WriteError(w, http.StatusBadRequest, "issues", "INVALID_REQUEST", errs.Error())
		return
	}

	if err := h.store.UpdateIssue(r.Context(), tenantID, id, req); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	updated, err := h.store.GetIssueByID(r.Context(), tenantID, id)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "issues", updated)
}

// --- Comment Handlers ---

func (h *Handler) ListComments(w http.ResponseWriter, r *http.Request) {
	issueID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "issues", "INVALID_REQUEST", "invalid issue id")
		return
	}

	// Tenant-scoped guard: verify issue belongs to this tenant
	tenantID := tenantID(r)
	if _, err := h.store.GetIssueByID(r.Context(), tenantID, issueID); err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "issues", "NOT_FOUND", "Issue not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	comments, err := h.store.ListComments(r.Context(), issueID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}
	if comments == nil {
		comments = []models.IssueComment{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "issues", comments)
}

func (h *Handler) CreateComment(w http.ResponseWriter, r *http.Request) {
	issueID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "issues", "INVALID_REQUEST", "invalid issue id")
		return
	}

	// Tenant-scoped guard: verify issue belongs to this tenant
	tenantID := tenantID(r)
	if _, err := h.store.GetIssueByID(r.Context(), tenantID, issueID); err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "issues", "NOT_FOUND", "Issue not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	var req models.CreateCommentRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "issues", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("author", req.Author)
	errs.Required("content", req.Content)
	errs.MaxLen("author", req.Author, 200)
	errs.MaxLen("content", req.Content, 10000)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "issues", "INVALID_REQUEST", errs.Error())
		return
	}

	comment, err := h.store.CreateComment(r.Context(), issueID, req)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "issues", comment)
}

// --- Stats Handler ---

func (h *Handler) GetIssueStats(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)

	stats, err := h.store.GetIssueStats(r.Context(), tenantID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "issues", stats)
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
