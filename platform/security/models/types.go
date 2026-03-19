package models

import "time"

// SecurityEvent represents a recorded authentication/access event.
type SecurityEvent struct {
	ID         int       `json:"id"`
	TenantID   string    `json:"tenantId"`
	EventType  string    `json:"eventType"`
	ActorID    string    `json:"actorId"`
	ActorEmail string    `json:"actorEmail"`
	IPAddress  string    `json:"ipAddress"`
	UserAgent  string    `json:"userAgent"`
	Metadata   string    `json:"metadata"`
	CreatedAt  time.Time `json:"createdAt"`
}

// ActiveSession represents a tracked user session.
type ActiveSession struct {
	ID         int       `json:"id"`
	TenantID   string    `json:"tenantId"`
	UserID     string    `json:"userId"`
	SessionID  string    `json:"sessionId"`
	Email      string    `json:"email"`
	Role       string    `json:"role"`
	IPAddress  string    `json:"ipAddress"`
	UserAgent  string    `json:"userAgent"`
	StartedAt  time.Time `json:"startedAt"`
	LastSeenAt time.Time `json:"lastSeenAt"`
}

// EventStats holds aggregated security event metrics for summary cards.
type EventStats struct {
	ActiveUsers     int `json:"activeUsers"`
	ActiveSessions  int `json:"activeSessions"`
	FailedLogins24h int `json:"failedLogins24h"`
	RoleChanges7d   int `json:"roleChanges7d"`
}

// EventFilter holds query params for listing security events.
type EventFilter struct {
	EventType string
	ActorID   string
	DateFrom  string
	DateTo    string
	Limit     int
	Offset    int
}

// CreateEventRequest is the JSON body for ingesting a security event.
type CreateEventRequest struct {
	EventType  string `json:"eventType"`
	ActorID    string `json:"actorId"`
	ActorEmail string `json:"actorEmail"`
	IPAddress  string `json:"ipAddress"`
	UserAgent  string `json:"userAgent"`
	Metadata   string `json:"metadata"`
}

// CreateSessionRequest is the JSON body for registering/updating a session.
type CreateSessionRequest struct {
	UserID    string `json:"userId"`
	SessionID string `json:"sessionId"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	IPAddress string `json:"ipAddress"`
	UserAgent string `json:"userAgent"`
}

// ClerkWebhookPayload is the simplified Clerk webhook event structure.
type ClerkWebhookPayload struct {
	Type string                 `json:"type"`
	Data map[string]interface{} `json:"data"`
}

// EventType enum values.
var EventTypeValues = []string{
	"login_success",
	"login_failure",
	"role_change",
	"session_start",
	"session_end",
	"password_reset",
	"account_created",
	"account_deleted",
	"session_revoked",
	"org_member_added",
	"org_member_removed",
}
