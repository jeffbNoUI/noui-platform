// Package api implements HTTP handlers for the Knowledge Base service.
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
	kbdb "github.com/noui/platform/knowledgebase/db"
	"github.com/noui/platform/validation"
)

// Handler holds dependencies for Knowledge Base API handlers.
type Handler struct {
	store *kbdb.Store
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(database *sql.DB) *Handler {
	return &Handler{store: kbdb.NewStore(database)}
}

// RegisterRoutes sets up all Knowledge Base API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	// Articles
	mux.HandleFunc("GET /api/v1/kb/articles", h.ListArticles)
	mux.HandleFunc("GET /api/v1/kb/articles/{id}", h.GetArticle)

	// Stage-indexed help (replaces frontend getHelpForStage)
	mux.HandleFunc("GET /api/v1/kb/stages/{stageId}", h.GetStageHelp)

	// Search
	mux.HandleFunc("GET /api/v1/kb/search", h.SearchArticles)

	// Rules
	mux.HandleFunc("GET /api/v1/kb/rules", h.ListRules)
	mux.HandleFunc("GET /api/v1/kb/rules/{ruleId}", h.GetRule)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "knowledgebase",
		"version": "0.1.0",
	})
}

// --- Article Handlers ---

func (h *Handler) ListArticles(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	stageID := r.URL.Query().Get("stage_id")
	topic := r.URL.Query().Get("topic")
	query := r.URL.Query().Get("q")
	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	articles, total, err := h.store.ListArticles(r.Context(), tenantID, stageID, topic, query, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, articles, total, limit, offset)
}

func (h *Handler) GetArticle(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	article, err := h.store.GetArticle(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Article not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, article)
}

func (h *Handler) GetStageHelp(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	stageID := r.PathValue("stageId")

	article, err := h.store.GetStageHelp(r.Context(), tenantID, stageID)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "No help found for stage: "+stageID)
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, article)
}

func (h *Handler) SearchArticles(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	query := r.URL.Query().Get("q")
	if query == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Search query 'q' is required")
		return
	}

	var errs validation.Errors
	errs.MaxLen("q", query, 200)
	if errs.HasErrors() {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", errs.Error())
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	articles, total, err := h.store.SearchArticles(r.Context(), tenantID, query, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, articles, total, limit, offset)
}

// --- Rule Handlers ---

func (h *Handler) ListRules(w http.ResponseWriter, r *http.Request) {
	domain := r.URL.Query().Get("domain")
	limit, offset := validation.Pagination(intParam(r, "limit", 50), intParam(r, "offset", 0), 100)

	rules, total, err := h.store.ListRules(r.Context(), domain, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writePaginated(w, rules, total, limit, offset)
}

func (h *Handler) GetRule(w http.ResponseWriter, r *http.Request) {
	ruleID := r.PathValue("ruleId")

	rule, articles, err := h.store.GetRule(r.Context(), ruleID)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Rule not found: "+ruleID)
			return
		}
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, map[string]interface{}{
		"rule":     rule,
		"articles": articles,
	})
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
			"service":   "knowledgebase",
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
			"service":   "knowledgebase",
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
