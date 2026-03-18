package notify

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ConsoleProvider implements NotificationProvider by logging to stdout and
// storing delivery records in memory. Intended for development and testing only.
type ConsoleProvider struct {
	mu         sync.RWMutex
	deliveries map[string]DeliveryResult
}

// NewConsoleProvider creates a ConsoleProvider with an empty delivery store.
func NewConsoleProvider() *ConsoleProvider {
	return &ConsoleProvider{
		deliveries: make(map[string]DeliveryResult),
	}
}

// Send logs the notification to stdout and stores the delivery result in memory.
func (p *ConsoleProvider) Send(_ context.Context, req NotificationRequest) (DeliveryResult, error) {
	if req.RecipientID == "" {
		return DeliveryResult{}, fmt.Errorf("notify/console: recipient_id is required")
	}
	if req.Channel == "" {
		return DeliveryResult{}, fmt.Errorf("notify/console: channel is required")
	}
	if req.TemplateName == "" {
		return DeliveryResult{}, fmt.Errorf("notify/console: template_name is required")
	}

	id := uuid.New().String()
	sentAt := time.Now().UTC()

	result := DeliveryResult{
		ID:      id,
		Channel: req.Channel,
		Status:  "sent",
		SentAt:  sentAt,
	}

	p.mu.Lock()
	p.deliveries[id] = result
	p.mu.Unlock()

	slog.Info("notify/console: notification sent",
		"id", id,
		"recipient_id", req.RecipientID,
		"channel", req.Channel,
		"template", req.TemplateName,
		"data_keys", dataKeys(req.Data),
	)

	return result, nil
}

// GetStatus retrieves a previously stored delivery result by notification ID.
func (p *ConsoleProvider) GetStatus(_ context.Context, notificationID string) (DeliveryResult, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	result, ok := p.deliveries[notificationID]
	if !ok {
		return DeliveryResult{}, fmt.Errorf("notify/console: notification not found: %s", notificationID)
	}
	return result, nil
}

// Deliveries returns all stored delivery results. Useful for test assertions.
func (p *ConsoleProvider) Deliveries() []DeliveryResult {
	p.mu.RLock()
	defer p.mu.RUnlock()

	out := make([]DeliveryResult, 0, len(p.deliveries))
	for _, d := range p.deliveries {
		out = append(out, d)
	}
	return out
}

func dataKeys(data map[string]string) []string {
	keys := make([]string, 0, len(data))
	for k := range data {
		keys = append(keys, k)
	}
	return keys
}
