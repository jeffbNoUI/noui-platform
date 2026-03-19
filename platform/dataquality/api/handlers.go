// Package api implements HTTP handlers for the Data Quality service.
package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	dqdb "github.com/noui/platform/dataquality/db"
	"github.com/noui/platform/dataquality/models"
	"github.com/noui/platform/validation"
)

// Handler holds dependencies for Data Quality API handlers.
type Handler struct {
	store *dqdb.Store
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(database *sql.DB) *Handler {
	return &Handler{store: dqdb.NewStore(database)}
}

// RegisterRoutes sets up all Data Quality API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	// Check definitions
	mux.HandleFunc("GET /api/v1/dq/checks", h.ListChecks)
	mux.HandleFunc("GET /api/v1/dq/checks/{id}", h.GetCheck)

	// Results
	mux.HandleFunc("GET /api/v1/dq/results", h.ListResults)

	// Score
	mux.HandleFunc("GET /api/v1/dq/score", h.GetScore)
	mux.HandleFunc("GET /api/v1/dq/score/trend", h.GetScoreTrend)

	// Issues
	mux.HandleFunc("GET /api/v1/dq/issues", h.ListIssues)
	mux.HandleFunc("PUT /api/v1/dq/issues/{id}", h.UpdateIssue)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "dataquality",
		"version": "0.1.0",
	})
}

// --- Check Handlers ---

func (h *Handler) ListChecks(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	category := r.URL.Query().Get("category")
	activeOnly := r.URL.Query().Get("is_active") != "false"
	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	checks, total, err := h.store.ListChecks(r.Context(), tenantID, category, activeOnly, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "dataquality", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, "dataquality", checks, total, limit, offset)
}

func (h *Handler) GetCheck(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	check, err := h.store.GetCheck(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "dataquality", "NOT_FOUND", "Check not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "dataquality", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "dataquality", check)
}

// --- Result Handlers ---

func (h *Handler) ListResults(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	checkID := r.URL.Query().Get("check_id")
	limit, _ := validation.Pagination(intParam(r, "limit", 50), 0, 100)

	results, err := h.store.ListResults(r.Context(), tenantID, checkID, limit)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "dataquality", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "dataquality", results)
}

// --- Score Handlers ---

func (h *Handler) GetScore(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)

	score, err := h.store.GetScore(r.Context(), tenantID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "dataquality", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "dataquality", score)
}

func (h *Handler) GetScoreTrend(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	days := intParam(r, "days", 30)

	var errs validation.Errors
	errs.IntRange("days", days, 1, 365)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "dataquality", "INVALID_REQUEST", errs.Error())
		return
	}

	trend, err := h.store.GetScoreTrend(r.Context(), tenantID, days)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "dataquality", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "dataquality", trend)
}

// --- Issue Handlers ---

func (h *Handler) ListIssues(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	severity := r.URL.Query().Get("severity")
	status := r.URL.Query().Get("status")
	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	issues, total, err := h.store.ListIssues(r.Context(), tenantID, severity, status, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "dataquality", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, "dataquality", issues, total, limit, offset)
}

func (h *Handler) UpdateIssue(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	existing, err := h.store.GetIssue(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "dataquality", "NOT_FOUND", "Issue not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "dataquality", "DB_ERROR", err.Error())
		return
	}

	var req models.UpdateIssueRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "dataquality", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	if req.Status != nil {
		errs.Enum("status", *req.Status, []string{"open", "resolved", "false_positive"})
	}
	if req.ResolutionNote != nil {
		errs.MaxLen("resolutionNote", *req.ResolutionNote, 5000)
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "dataquality", "INVALID_REQUEST", errs.Error())
		return
	}

	if req.Status != nil {
		existing.Status = *req.Status
		if *req.Status == "resolved" || *req.Status == "false_positive" {
			now := time.Now().UTC()
			existing.ResolvedAt = &now
			by := "system"
			existing.ResolvedBy = &by
		}
	}
	if req.ResolutionNote != nil {
		existing.ResolutionNote = req.ResolutionNote
	}

	if err := h.store.UpdateIssue(r.Context(), existing); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "dataquality", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "dataquality", existing)
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
