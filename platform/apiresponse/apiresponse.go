// Package apiresponse provides consistent JSON response helpers for all
// platform services. Every response includes a top-level "meta" object with
// requestId (camelCase), timestamp, and service name.
package apiresponse

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// WriteJSON writes v as JSON with the given status code. It is a low-level
// helper — prefer WriteSuccess, WritePaginated, or WriteError.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("error encoding JSON response", "error", err)
	}
}

// WriteSuccess writes a standard success envelope:
//
//	{ "data": ..., "meta": { "requestId": "...", "timestamp": "...", "service": "...", "version": "v1" } }
func WriteSuccess(w http.ResponseWriter, status int, service string, data any) {
	resp := map[string]any{
		"data": data,
		"meta": meta(service),
	}
	WriteJSON(w, status, resp)
}

// WritePaginated writes a paginated success envelope:
//
//	{ "data": ..., "pagination": { "total": N, "limit": N, "offset": N, "hasMore": bool }, "meta": { ... } }
func WritePaginated(w http.ResponseWriter, service string, data any, total, limit, offset int) {
	resp := map[string]any{
		"data": data,
		"pagination": map[string]any{
			"total":   total,
			"limit":   limit,
			"offset":  offset,
			"hasMore": offset+limit < total,
		},
		"meta": meta(service),
	}
	WriteJSON(w, http.StatusOK, resp)
}

// WriteError writes a standard error envelope:
//
//	{ "error": { "code": "...", "message": "...", "requestId": "..." }, "meta": { ... } }
func WriteError(w http.ResponseWriter, status int, service, code, message string) {
	id := uuid.New().String()
	resp := map[string]any{
		"error": map[string]any{
			"code":      code,
			"message":   message,
			"requestId": id,
		},
		"meta": map[string]any{
			"requestId": id,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"service":   service,
			"version":   "v1",
		},
	}
	WriteJSON(w, status, resp)
}

// BuildSuccess returns a standard success envelope without writing it.
// Useful when the response needs to be cached before sending.
func BuildSuccess(service string, data any) map[string]any {
	return map[string]any{
		"data": data,
		"meta": meta(service),
	}
}

// BuildPaginated returns a paginated success envelope without writing it.
// Useful when the response needs to be cached before sending.
func BuildPaginated(service string, data any, total, limit, offset int) map[string]any {
	return map[string]any{
		"data": data,
		"pagination": map[string]any{
			"total":   total,
			"limit":   limit,
			"offset":  offset,
			"hasMore": offset+limit < total,
		},
		"meta": meta(service),
	}
}

func meta(service string) map[string]any {
	return map[string]any{
		"requestId": uuid.New().String(),
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"service":   service,
		"version":   "v1",
	}
}
