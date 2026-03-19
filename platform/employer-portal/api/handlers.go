// Package api implements HTTP handlers for the employer-portal service.
package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	epdb "github.com/noui/platform/employer-portal/db"
	"github.com/noui/platform/validation"
)

// Handler holds dependencies for employer-portal API handlers.
type Handler struct {
	store *epdb.Store
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(database *sql.DB) *Handler {
	return &Handler{store: epdb.NewStore(database)}
}

// RegisterRoutes sets up all employer-portal API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	// Portal Users
	mux.HandleFunc("GET /api/v1/employer/users", h.ListPortalUsers)
	mux.HandleFunc("POST /api/v1/employer/users", h.CreatePortalUser)
	mux.HandleFunc("PUT /api/v1/employer/users/{id}/role", h.UpdatePortalUserRole)
	mux.HandleFunc("DELETE /api/v1/employer/users/{id}", h.DeactivatePortalUser)

	// Dashboard
	mux.HandleFunc("GET /api/v1/employer/dashboard", h.GetDashboard)

	// Alerts
	mux.HandleFunc("GET /api/v1/employer/alerts", h.ListAlerts)
	mux.HandleFunc("POST /api/v1/employer/alerts", h.CreateAlert)

	// Rate tables (read-only)
	mux.HandleFunc("GET /api/v1/employer/rate-tables", h.ListRateTables)
	mux.HandleFunc("GET /api/v1/employer/rate-tables/current", h.GetCurrentRate)

	// Divisions reference
	mux.HandleFunc("GET /api/v1/employer/divisions", h.ListDivisions)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "employer-portal",
		"version": "0.1.0",
	})
}

// --- Portal User Handlers ---

func (h *Handler) ListPortalUsers(w http.ResponseWriter, r *http.Request) {
	orgID := r.URL.Query().Get("org_id")
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "employer-portal", "INVALID_REQUEST", "org_id query parameter is required")
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	users, total, err := h.store.ListPortalUsers(r.Context(), orgID, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "employer-portal", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, "employer-portal", users, total, limit, offset)
}

func (h *Handler) CreatePortalUser(w http.ResponseWriter, r *http.Request) {
	var req epdb.CreatePortalUserRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "employer-portal", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("orgId", req.OrgID)
	errs.Required("contactId", req.ContactID)
	errs.Required("portalRole", req.PortalRole)
	errs.Enum("portalRole", req.PortalRole, []string{"SUPER_USER", "PAYROLL_CONTACT", "HR_CONTACT", "READ_ONLY"})
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "employer-portal", "INVALID_REQUEST", errs.Error())
		return
	}

	user := epdb.PortalUser{
		ID:         uuid.New().String(),
		OrgID:      req.OrgID,
		ContactID:  req.ContactID,
		PortalRole: req.PortalRole,
		IsActive:   true,
	}

	if err := h.store.CreatePortalUser(r.Context(), &user); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "employer-portal", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "employer-portal", user)
}

func (h *Handler) UpdatePortalUserRole(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req epdb.UpdatePortalUserRoleRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "employer-portal", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("portalRole", req.PortalRole)
	errs.Enum("portalRole", req.PortalRole, []string{"SUPER_USER", "PAYROLL_CONTACT", "HR_CONTACT", "READ_ONLY"})
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "employer-portal", "INVALID_REQUEST", errs.Error())
		return
	}

	if err := h.store.UpdatePortalUserRole(r.Context(), id, req.PortalRole); err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "employer-portal", "NOT_FOUND", "Portal user not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "employer-portal", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "employer-portal", map[string]string{"id": id, "portalRole": req.PortalRole})
}

func (h *Handler) DeactivatePortalUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	if err := h.store.DeactivatePortalUser(r.Context(), id); err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "employer-portal", "NOT_FOUND", "Portal user not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "employer-portal", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "employer-portal", map[string]string{"id": id, "status": "deactivated"})
}

// --- Dashboard Handler ---

func (h *Handler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	orgID := r.URL.Query().Get("org_id")
	if orgID == "" {
		// Return zero-state dashboard if no org specified
		apiresponse.WriteSuccess(w, http.StatusOK, "employer-portal", epdb.DashboardSummary{})
		return
	}

	summary, err := h.store.GetDashboardSummary(r.Context(), orgID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "employer-portal", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "employer-portal", summary)
}

// --- Alert Handlers ---

func (h *Handler) ListAlerts(w http.ResponseWriter, r *http.Request) {
	orgID := r.URL.Query().Get("org_id")
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "employer-portal", "INVALID_REQUEST", "org_id query parameter is required")
		return
	}

	alerts, err := h.store.ListAlerts(r.Context(), orgID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "employer-portal", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "employer-portal", alerts)
}

func (h *Handler) CreateAlert(w http.ResponseWriter, r *http.Request) {
	var req epdb.CreateAlertRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "employer-portal", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.Required("alertType", req.AlertType)
	errs.Enum("alertType", req.AlertType, []string{"DEADLINE", "TASK", "CRITICAL", "POLICY_CHANGE"})
	errs.Required("title", req.Title)
	errs.MaxLen("title", req.Title, 500)
	errs.Required("effectiveFrom", req.EffectiveFrom)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "employer-portal", "INVALID_REQUEST", errs.Error())
		return
	}

	effectiveFrom, err := time.Parse(time.RFC3339, req.EffectiveFrom)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "employer-portal", "INVALID_REQUEST", "effectiveFrom must be a valid RFC3339 timestamp")
		return
	}

	var effectiveTo *time.Time
	if req.EffectiveTo != nil {
		t, err := time.Parse(time.RFC3339, *req.EffectiveTo)
		if err != nil {
			apiresponse.WriteError(w, http.StatusBadRequest, "employer-portal", "INVALID_REQUEST", "effectiveTo must be a valid RFC3339 timestamp")
			return
		}
		effectiveTo = &t
	}

	alert := epdb.Alert{
		ID:            uuid.New().String(),
		OrgID:         req.OrgID,
		AlertType:     req.AlertType,
		Title:         req.Title,
		Body:          req.Body,
		EffectiveFrom: effectiveFrom,
		EffectiveTo:   effectiveTo,
	}

	// Use tenant ID as created_by
	tid := tenantID(r)
	alert.CreatedBy = &tid

	if err := h.store.CreateAlert(r.Context(), &alert); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "employer-portal", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "employer-portal", alert)
}

// --- Rate Table Handlers ---

func (h *Handler) ListRateTables(w http.ResponseWriter, r *http.Request) {
	divisionCode := r.URL.Query().Get("division_code")

	var safetyOfficer *bool
	if so := r.URL.Query().Get("safety_officer"); so != "" {
		b := so == "true"
		safetyOfficer = &b
	}

	rates, err := h.store.ListRateTables(r.Context(), divisionCode, safetyOfficer)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "employer-portal", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "employer-portal", rates)
}

func (h *Handler) GetCurrentRate(w http.ResponseWriter, r *http.Request) {
	divisionCode := r.URL.Query().Get("division_code")
	if divisionCode == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "employer-portal", "INVALID_REQUEST", "division_code query parameter is required")
		return
	}

	isSafetyOfficer := r.URL.Query().Get("safety_officer") == "true"

	rate, err := h.store.GetCurrentRate(r.Context(), divisionCode, isSafetyOfficer)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "employer-portal", "NOT_FOUND", "No current rate found for the specified division")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "employer-portal", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "employer-portal", rate)
}

// --- Division Handlers ---

func (h *Handler) ListDivisions(w http.ResponseWriter, r *http.Request) {
	divisions, err := h.store.ListDivisions(r.Context())
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "employer-portal", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "employer-portal", divisions)
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
