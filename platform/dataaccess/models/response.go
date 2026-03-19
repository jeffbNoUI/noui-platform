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
	RequestID string `json:"requestId"`
}

// APIMeta provides request metadata.
type APIMeta struct {
	RequestID string    `json:"requestId"`
	Timestamp time.Time `json:"timestamp"`
}

// PaginatedData wraps list results with pagination metadata.
type PaginatedData struct {
	Items  interface{} `json:"items"`
	Total  int         `json:"total"`
	Limit  int         `json:"limit"`
	Offset int         `json:"offset"`
}
