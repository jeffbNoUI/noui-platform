package notify

import (
	"context"
	"time"
)

// NotificationRequest describes a notification to be sent to a member.
type NotificationRequest struct {
	RecipientID  string            // Member or user ID
	Channel      string            // "email", "sms", "in_portal"
	TemplateName string            // e.g. "application_received", "document_needed"
	Data         map[string]string // Merge fields: {member_name}, {case_id}, etc.
}

// DeliveryResult is returned after a send attempt, providing the delivery ID and status.
type DeliveryResult struct {
	ID      string
	Channel string
	Status  string // "sent", "queued", "failed"
	SentAt  time.Time
}

// NotificationProvider defines the interface for notification delivery backends.
// Implementations may target console logging (dev), SMTP, SMS gateways,
// or in-portal notification tables.
type NotificationProvider interface {
	// Send delivers a notification and returns the delivery result.
	Send(ctx context.Context, req NotificationRequest) (DeliveryResult, error)

	// GetStatus retrieves the delivery status of a previously sent notification.
	GetStatus(ctx context.Context, notificationID string) (DeliveryResult, error)
}
