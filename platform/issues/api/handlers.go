// Package api implements HTTP handlers for the Issue Management service.
package api

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

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

	// Error reporting
	mux.HandleFunc("POST /api/v1/errors/report", h.ReportError)
	mux.HandleFunc("GET /api/v1/errors/recent", h.ListRecentErrors)

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

// --- Error Reporting ---

// ReportError receives frontend error reports, deduplicates via fingerprint,
// and creates or updates an Issue.
func (h *Handler) ReportError(w http.ResponseWriter, r *http.Request) {
	var report models.ErrorReport
	if err := decodeJSON(r, &report); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "issues", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("requestId", report.RequestID)
	if report.ErrorCode != "REACT_CRASH" {
		errs.Required("url", report.URL)
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "issues", "INVALID_REQUEST", errs.Error())
		return
	}

	tenantID := tenantID(r)
	fingerprint := errorFingerprint(report.ErrorCode, report.URL, report.HTTPStatus)

	existingID, err := h.store.FindByFingerprint(r.Context(), tenantID, fingerprint)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	if existingID > 0 {
		if err := h.store.IncrementErrorOccurrence(r.Context(), tenantID, existingID, report.RequestID, report.Portal, report.Route); err != nil {
			apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
			return
		}
		apiresponse.WriteSuccess(w, http.StatusOK, "issues", map[string]any{
			"action":  "updated",
			"issueId": existingID,
		})
		return
	}

	severity := "medium"
	if report.HTTPStatus >= 500 {
		severity = "high"
	}
	if report.ErrorCode == "REACT_CRASH" {
		severity = "critical"
	}

	description := fmt.Sprintf(
		"Error Code: %s\nHTTP Status: %d\nURL: %s\nMessage: %s\nPortal: %s\nRoute: %s\nRequest ID: %s\nfingerprint:%s",
		report.ErrorCode, report.HTTPStatus, report.URL, report.ErrorMessage,
		report.Portal, report.Route, report.RequestID, fingerprint,
	)
	if report.ComponentStack != "" {
		description += fmt.Sprintf("\n\nComponent Stack:\n%s", report.ComponentStack)
	}

	title := fmt.Sprintf("[Auto] %s: %s", report.ErrorCode, report.URL)
	if len(title) > 500 {
		title = title[:497] + "..."
	}

	issue, err := h.store.CreateIssue(r.Context(), tenantID, models.CreateIssueRequest{
		Title:           title,
		Description:     description,
		Severity:        severity,
		Category:        "error-report",
		AffectedService: parseServiceFromURL(report.URL),
		ReportedBy:      "system:error-reporter",
	})
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "issues", issue)
}

// ListRecentErrors returns error-report issues, optionally filtered by a since timestamp.
func (h *Handler) ListRecentErrors(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)

	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	filter := models.IssueFilter{
		Status:   r.URL.Query().Get("status"),
		Category: "error-report",
		Limit:    limit,
		Offset:   offset,
	}
	if filter.Status == "" {
		filter.Status = "open"
	}

	issues, total, err := h.store.ListIssues(r.Context(), tenantID, filter)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "issues", "DB_ERROR", err.Error())
		return
	}

	if since := r.URL.Query().Get("since"); since != "" {
		if sinceTime, err := time.Parse(time.RFC3339, since); err == nil {
			var filtered []models.Issue
			for _, iss := range issues {
				if iss.ReportedAt.After(sinceTime) {
					filtered = append(filtered, iss)
				}
			}
			issues = filtered
			total = len(filtered)
		}
	}

	apiresponse.WritePaginated(w, "issues", issues, total, filter.Limit, filter.Offset)
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

// errorFingerprint generates a dedup key from error attributes.
func errorFingerprint(errorCode, url string, httpStatus int) string {
	raw := fmt.Sprintf("%s:%s:%d", errorCode, url, httpStatus)
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:16])
}

// parseServiceFromURL extracts a service name from a URL path.
func parseServiceFromURL(url string) string {
	serviceMap := map[string]string{
		"members": "dataaccess", "salary": "dataaccess", "employment": "dataaccess",
		"crm": "crm", "organizations": "crm", "contacts": "crm",
		"correspondence": "correspondence", "templates": "correspondence",
		"dataquality": "dataquality", "dq": "dataquality",
		"knowledgebase": "knowledgebase", "articles": "knowledgebase",
		"cases":    "casemanagement",
		"issues":   "issues",
		"employer": "crm",
	}

	parts := strings.Split(strings.TrimPrefix(url, "/"), "/")
	for _, part := range parts {
		if part == "api" || part == "v1" || part == "" {
			continue
		}
		if svc, ok := serviceMap[part]; ok {
			return svc
		}
		return part
	}
	return "unknown"
}
