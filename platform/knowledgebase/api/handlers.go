// Package api implements HTTP handlers for the Knowledge Base service.
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
	"github.com/noui/platform/cache"
	kbdb "github.com/noui/platform/knowledgebase/db"
	"github.com/noui/platform/validation"
)

// Handler holds dependencies for Knowledge Base API handlers.
type Handler struct {
	store *kbdb.Store
	cache *cache.Cache
}

// NewHandler creates a Handler with the given database connection.
// Starts an in-memory cache with 5-minute TTL for list and stage help responses.
func NewHandler(database *sql.DB) *Handler {
	return &Handler{
		store: kbdb.NewStore(database),
		cache: cache.New(5 * time.Minute),
	}
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
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
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

	cacheKey := fmt.Sprintf("articles:%s:%s:%s:%s:%d:%d", tenantID, stageID, topic, query, limit, offset)
	if cached, ok := h.cache.Get(cacheKey); ok {
		w.Header().Set("Cache-Control", "public, max-age=300")
		w.Header().Set("X-Cache", "HIT")
		apiresponse.WriteJSON(w, http.StatusOK, cached)
		return
	}

	articles, total, err := h.store.ListArticles(r.Context(), tenantID, stageID, topic, query, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "DB_ERROR", err.Error())
		return
	}

	resp := apiresponse.BuildPaginated("knowledgebase", articles, total, limit, offset)
	h.cache.Set(cacheKey, resp)
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.Header().Set("X-Cache", "MISS")
	apiresponse.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) GetArticle(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	article, err := h.store.GetArticle(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "knowledgebase", "NOT_FOUND", "Article not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", article)
}

func (h *Handler) GetStageHelp(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	stageID := r.PathValue("stageId")

	cacheKey := fmt.Sprintf("stagehelp:%s:%s", tenantID, stageID)
	if cached, ok := h.cache.Get(cacheKey); ok {
		w.Header().Set("Cache-Control", "public, max-age=300")
		w.Header().Set("X-Cache", "HIT")
		apiresponse.WriteJSON(w, http.StatusOK, cached)
		return
	}

	article, err := h.store.GetStageHelp(r.Context(), tenantID, stageID)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "knowledgebase", "NOT_FOUND", "No help found for stage: "+stageID)
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "DB_ERROR", err.Error())
		return
	}

	resp := apiresponse.BuildSuccess("knowledgebase", article)
	h.cache.Set(cacheKey, resp)
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.Header().Set("X-Cache", "MISS")
	apiresponse.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) SearchArticles(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantID(r)
	query := r.URL.Query().Get("q")
	if query == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "knowledgebase", "INVALID_REQUEST", "Search query 'q' is required")
		return
	}

	var errs validation.Errors
	errs.MaxLen("q", query, 200)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "knowledgebase", "INVALID_REQUEST", errs.Error())
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	articles, total, err := h.store.SearchArticles(r.Context(), tenantID, query, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, "knowledgebase", articles, total, limit, offset)
}

// --- Rule Handlers ---

func (h *Handler) ListRules(w http.ResponseWriter, r *http.Request) {
	domain := r.URL.Query().Get("domain")
	limit, offset := validation.Pagination(intParam(r, "limit", 50), intParam(r, "offset", 0), 100)

	cacheKey := fmt.Sprintf("rules:%s:%d:%d", domain, limit, offset)
	if cached, ok := h.cache.Get(cacheKey); ok {
		w.Header().Set("Cache-Control", "public, max-age=300")
		w.Header().Set("X-Cache", "HIT")
		apiresponse.WriteJSON(w, http.StatusOK, cached)
		return
	}

	rules, total, err := h.store.ListRules(r.Context(), domain, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "DB_ERROR", err.Error())
		return
	}

	resp := apiresponse.BuildPaginated("knowledgebase", rules, total, limit, offset)
	h.cache.Set(cacheKey, resp)
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.Header().Set("X-Cache", "MISS")
	apiresponse.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) GetRule(w http.ResponseWriter, r *http.Request) {
	ruleID := r.PathValue("ruleId")

	rule, articles, err := h.store.GetRule(r.Context(), ruleID)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, "knowledgebase", "NOT_FOUND", "Rule not found: "+ruleID)
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", map[string]interface{}{
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
