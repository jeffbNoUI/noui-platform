package notify

import (
	"context"
	"testing"
)

// Compile-time interface compliance check.
var _ NotificationProvider = (*ConsoleProvider)(nil)

func TestConsoleSend_Success(t *testing.T) {
	p := NewConsoleProvider()
	req := NotificationRequest{
		RecipientID:  "member-42",
		Channel:      "email",
		TemplateName: "application_received",
		Data:         map[string]string{"member_name": "Jane Doe", "case_id": "C-100"},
	}

	result, err := p.Send(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ID == "" {
		t.Error("expected non-empty delivery ID")
	}
	if result.Channel != "email" {
		t.Errorf("channel = %q, want %q", result.Channel, "email")
	}
	if result.Status != "sent" {
		t.Errorf("status = %q, want %q", result.Status, "sent")
	}
	if result.SentAt.IsZero() {
		t.Error("expected non-zero SentAt timestamp")
	}
}

func TestConsoleSend_MissingRecipient(t *testing.T) {
	p := NewConsoleProvider()
	_, err := p.Send(context.Background(), NotificationRequest{
		Channel:      "sms",
		TemplateName: "test",
	})
	if err == nil {
		t.Fatal("expected error for missing recipient")
	}
}

func TestConsoleSend_MissingChannel(t *testing.T) {
	p := NewConsoleProvider()
	_, err := p.Send(context.Background(), NotificationRequest{
		RecipientID:  "member-1",
		TemplateName: "test",
	})
	if err == nil {
		t.Fatal("expected error for missing channel")
	}
}

func TestConsoleSend_MissingTemplate(t *testing.T) {
	p := NewConsoleProvider()
	_, err := p.Send(context.Background(), NotificationRequest{
		RecipientID: "member-1",
		Channel:     "in_portal",
	})
	if err == nil {
		t.Fatal("expected error for missing template")
	}
}

func TestConsoleGetStatus_Found(t *testing.T) {
	p := NewConsoleProvider()
	sent, _ := p.Send(context.Background(), NotificationRequest{
		RecipientID:  "member-42",
		Channel:      "sms",
		TemplateName: "document_needed",
		Data:         map[string]string{"document_type": "birth_certificate"},
	})

	result, err := p.GetStatus(context.Background(), sent.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ID != sent.ID {
		t.Errorf("id = %q, want %q", result.ID, sent.ID)
	}
	if result.Channel != "sms" {
		t.Errorf("channel = %q, want %q", result.Channel, "sms")
	}
	if result.Status != "sent" {
		t.Errorf("status = %q, want %q", result.Status, "sent")
	}
}

func TestConsoleGetStatus_NotFound(t *testing.T) {
	p := NewConsoleProvider()
	_, err := p.GetStatus(context.Background(), "nonexistent-id")
	if err == nil {
		t.Fatal("expected error for nonexistent notification ID")
	}
}

func TestConsoleDeliveries_Roundtrip(t *testing.T) {
	p := NewConsoleProvider()

	channels := []string{"email", "sms", "in_portal"}
	for _, ch := range channels {
		_, err := p.Send(context.Background(), NotificationRequest{
			RecipientID:  "member-1",
			Channel:      ch,
			TemplateName: "test_template",
		})
		if err != nil {
			t.Fatalf("send on channel %q failed: %v", ch, err)
		}
	}

	deliveries := p.Deliveries()
	if len(deliveries) != 3 {
		t.Errorf("deliveries count = %d, want 3", len(deliveries))
	}
}

func TestConsoleSend_UniqueIDs(t *testing.T) {
	p := NewConsoleProvider()
	req := NotificationRequest{
		RecipientID:  "member-1",
		Channel:      "email",
		TemplateName: "test",
	}

	r1, _ := p.Send(context.Background(), req)
	r2, _ := p.Send(context.Background(), req)
	if r1.ID == r2.ID {
		t.Error("expected unique IDs for separate sends")
	}
}
