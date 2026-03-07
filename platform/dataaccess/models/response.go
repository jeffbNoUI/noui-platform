package models

import "time"

// APIResponse wraps all successful API responses.
type APIResponse struct {
	Data interface{} `json:"data"`
	Meta APIMeta     `json:"meta"`
}

// APIError represents an error response.
type APIError struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail provides structured error information.
type ErrorDetail struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"request_id"`
}

// APIMeta provides request metadata.
type APIMeta struct {
	RequestID string    `json:"request_id"`
	Timestamp time.Time `json:"timestamp"`
}

// HealthResponse is returned by the /healthz endpoint.
type HealthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
	Version string `json:"version"`
}
