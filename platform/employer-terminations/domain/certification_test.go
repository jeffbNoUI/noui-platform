package domain

import (
	"testing"
	"time"
)

func TestEvaluateHoldAction_Pending_NoActionYet(t *testing.T) {
	created := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2025, 1, 5, 0, 0, 0, 0, time.UTC) // 4 days in
	cfg := DefaultHoldConfig()

	action := EvaluateHoldAction("PENDING", created, now, cfg)
	if action != HoldActionNone {
		t.Errorf("expected NONE at day 4, got %s", action)
	}
}

func TestEvaluateHoldAction_Pending_Reminder(t *testing.T) {
	created := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2025, 1, 16, 0, 0, 0, 0, time.UTC) // 15 days in
	cfg := DefaultHoldConfig()

	action := EvaluateHoldAction("PENDING", created, now, cfg)
	if action != HoldActionReminder {
		t.Errorf("expected SEND_REMINDER at day 15, got %s", action)
	}
}

func TestEvaluateHoldAction_ReminderSent_Escalate(t *testing.T) {
	created := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2025, 1, 31, 0, 0, 0, 0, time.UTC) // 30 days in
	cfg := DefaultHoldConfig()

	action := EvaluateHoldAction("REMINDER_SENT", created, now, cfg)
	if action != HoldActionEscalate {
		t.Errorf("expected ESCALATE at day 30, got %s", action)
	}
}

func TestEvaluateHoldAction_Escalated_Expire(t *testing.T) {
	created := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2025, 2, 15, 0, 0, 0, 0, time.UTC) // 45 days in
	cfg := DefaultHoldConfig()

	action := EvaluateHoldAction("ESCALATED", created, now, cfg)
	if action != HoldActionExpire {
		t.Errorf("expected EXPIRE at day 45, got %s", action)
	}
}

func TestEvaluateHoldAction_Resolved_NoAction(t *testing.T) {
	created := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC)
	cfg := DefaultHoldConfig()

	action := EvaluateHoldAction("RESOLVED", created, now, cfg)
	if action != HoldActionNone {
		t.Errorf("expected NONE for resolved hold, got %s", action)
	}
}

func TestEvaluateHoldAction_Pending_DirectExpire(t *testing.T) {
	created := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2025, 2, 16, 0, 0, 0, 0, time.UTC) // 46 days in, still PENDING
	cfg := DefaultHoldConfig()

	action := EvaluateHoldAction("PENDING", created, now, cfg)
	if action != HoldActionExpire {
		t.Errorf("expected EXPIRE for pending hold past countdown, got %s", action)
	}
}

func TestShouldCreateHold_NoCertification(t *testing.T) {
	if !ShouldCreateHold(false, nil) {
		t.Error("expected hold needed when no certification exists")
	}
}

func TestShouldCreateHold_HasCertification(t *testing.T) {
	if ShouldCreateHold(true, nil) {
		t.Error("expected no hold needed when certification exists")
	}
}

func TestComputeHoldExpiry(t *testing.T) {
	created := time.Date(2025, 3, 1, 10, 0, 0, 0, time.UTC)
	expiry := ComputeHoldExpiry(created, 45)
	expected := time.Date(2025, 4, 15, 10, 0, 0, 0, time.UTC)

	if !expiry.Equal(expected) {
		t.Errorf("expected expiry %s, got %s", expected, expiry)
	}
}

func TestDefaultHoldConfig(t *testing.T) {
	cfg := DefaultHoldConfig()
	if cfg.CountdownDays != 45 {
		t.Errorf("expected 45 countdown days, got %d", cfg.CountdownDays)
	}
	if cfg.ReminderAfterDays != 15 {
		t.Errorf("expected 15 reminder days, got %d", cfg.ReminderAfterDays)
	}
	if cfg.EscalationAfterDays != 30 {
		t.Errorf("expected 30 escalation days, got %d", cfg.EscalationAfterDays)
	}
}
