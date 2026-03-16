// Package api implements HTTP handlers for the Data Quality service.
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
	dqdb "github.com/noui/platform/dataquality/db"
	"github.com/noui/platform/dataquality/models"
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
	writeJSON(w, http.StatusOK, map[string]string{
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
	limit := intParam(r, "limit", 25)
	offset := intParam(r, "offset", 0)

	checks, total, err := h.store.ListChecks(r.Context(), tenantID, category, activeOnly, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, checks, total, limit, offset)
}

func (h *Handler) GetCheck(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	check, err := h.store.GetCheck(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Check not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, check)
}

// --- Result Handlers ---

func (h *Handler) ListResults(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	checkID := r.URL.Query().Get("check_id")
	limit := intParam(r, "limit", 50)

	results, err := h.store.ListResults(r.Context(), tenantID, checkID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, results)
}

// --- Score Handlers ---

func (h *Handler) GetScore(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)

	score, err := h.store.GetScore(r.Context(), tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, score)
}

func (h *Handler) GetScoreTrend(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	days := intParam(r, "days", 30)

	trend, err := h.store.GetScoreTrend(r.Context(), tenantID, days)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, trend)
}

// --- Issue Handlers ---

func (h *Handler) ListIssues(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	severity := r.URL.Query().Get("severity")
	status := r.URL.Query().Get("status")
	limit := intParam(r, "limit", 25)
	offset := intParam(r, "offset", 0)

	issues, total, err := h.store.ListIssues(r.Context(), tenantID, severity, status, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, issues, total, limit, offset)
}

func (h *Handler) UpdateIssue(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	existing, err := h.store.GetIssue(r.Context(), id)
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
			"service":   "dataquality",
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
			"service":   "dataquality",
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
