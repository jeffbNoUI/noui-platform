package models

import (
	"encoding/json"
	"time"
)

// AuditEntry is the input struct for creating an audit log entry.
// BeforeState, AfterState, and Metadata are raw JSON — serialization is the caller's responsibility.
type AuditEntry struct {
	EngagementID string          `json:"engagement_id"`
	Actor        string          `json:"actor"`
	Action       string          `json:"action"`
	EntityType   string          `json:"entity_type"`
	EntityID     string          `json:"entity_id"`
	BeforeState  json.RawMessage `json:"before_state,omitempty"`
	AfterState   json.RawMessage `json:"after_state,omitempty"`
	Metadata     json.RawMessage `json:"metadata,omitempty"`
}

// AuditLogEntry is the output struct for reading audit log entries.
type AuditLogEntry struct {
	LogID        string          `json:"log_id"`
	EngagementID string          `json:"engagement_id"`
	Actor        string          `json:"actor"`
	Action       string          `json:"action"`
	EntityType   string          `json:"entity_type"`
	EntityID     string          `json:"entity_id"`
	BeforeState  json.RawMessage `json:"before_state,omitempty"`
	AfterState   json.RawMessage `json:"after_state,omitempty"`
	Metadata     json.RawMessage `json:"metadata,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
}

// AuditLogResponse is the paginated response for the audit log listing endpoint.
type AuditLogResponse struct {
	Entries []AuditLogEntry `json:"entries"`
	Total   int             `json:"total"`
	Page    int             `json:"page"`
	PerPage int             `json:"per_page"`
}
