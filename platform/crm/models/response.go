package models

import "time"

const (
	serviceName    = "crm"
	serviceVersion = "0.1.0"
)

// NewAPIMeta creates an APIMeta populated with the current timestamp and
// the CRM service identity. The caller supplies the request ID.
func NewAPIMeta(requestID string) APIMeta {
	return APIMeta{
		RequestID: requestID,
		Timestamp: time.Now().UTC(),
		Service:   serviceName,
		Version:   serviceVersion,
	}
}

// NewSuccessResponse builds a SuccessResponse wrapping the given data payload.
func NewSuccessResponse[T any](data T, meta APIMeta) SuccessResponse[T] {
	return SuccessResponse[T]{
		Data: data,
		Meta: meta,
	}
}

// NewErrorResponse builds an ErrorResponse from the error code, human-readable
// message, and the originating request ID.
func NewErrorResponse(code string, message string, requestID string) ErrorResponse {
	return ErrorResponse{
		Error: APIError{
			Code:      code,
			Message:   message,
			RequestID: requestID,
		},
	}
}

// NewPaginatedResponse builds a PaginatedResponse wrapping a data slice,
// pagination metadata, and the standard API meta.
func NewPaginatedResponse[T any](data []T, pagination Pagination, meta APIMeta) PaginatedResponse[T] {
	if data == nil {
		data = []T{}
	}
	return PaginatedResponse[T]{
		Data:       data,
		Pagination: pagination,
		Meta:       meta,
	}
}
