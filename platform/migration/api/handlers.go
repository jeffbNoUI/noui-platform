// Package api implements HTTP handlers for the migration service.
package api

import (
	"database/sql"
	"net/http"

	"github.com/noui/platform/apiresponse"
)

// Handler holds dependencies for API handlers.
type Handler struct {
	DB *sql.DB
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(db *sql.DB) *Handler {
	return &Handler{DB: db}
}

// RegisterRoutes sets up all API routes on the given mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)
	// Migration endpoints will be added in subsequent tasks
}

// HealthCheck returns service status information.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "migration",
		"version": "0.1.0",
	})
}
