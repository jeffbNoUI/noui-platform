// Package apiresponse provides standardized HTTP response helpers for all platform services.
// Every service MUST use these helpers to ensure consistent JSON response shapes.
//
// Success:   {"data": ..., "meta": {"requestId": "...", "timestamp": "...", "service": "...", "version": "v1"}}
// Error:     {"error": {"code": "...", "message": "...", "requestId": "..."}}
// Paginated: {"data": [...], "pagination": {"total": N, "limit": N, "offset": N, "hasMore": bool}, "meta": {...}}
package apiresponse

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// WriteSuccess writes a success response with the standard envelope.
func WriteSuccess(w http.ResponseWriter, status int, service string, data any) {
	resp := map[string]any{
		"data": data,
		"meta": map[string]any{
			"requestId": uuid.New().String(),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"service":   service,
			"version":   "v1",
		},
	}
	WriteJSON(w, status, resp)
}

// WriteError writes an error response with the standard envelope.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	resp := map[string]any{
		"error": map[string]any{
			"code":      code,
			"message":   message,
			"requestId": uuid.New().String(),
		},
	}
	WriteJSON(w, status, resp)
}

// WritePaginated writes a paginated list response with the standard envelope.
func WritePaginated(w http.ResponseWriter, service string, data any, total, limit, offset int) {
	resp := map[string]any{
		"data": data,
		"pagination": map[string]any{
			"total":   total,
			"limit":   limit,
			"offset":  offset,
			"hasMore": offset+limit < total,
		},
		"meta": map[string]any{
			"requestId": uuid.New().String(),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"service":   service,
			"version":   "v1",
		},
	}
	WriteJSON(w, http.StatusOK, resp)
}

// WriteJSON writes any value as JSON with the given status code.
// Use this for non-standard responses (e.g., health checks, fire-and-forget acknowledgments).
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("error encoding JSON response", "error", err)
	}
}
