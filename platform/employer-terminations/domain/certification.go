package domain

import "time"

// DefaultHoldCountdownDays is the default number of days before a certification
// hold expires. Configurable per deployment — 45 days is the COPERA default.
const DefaultHoldCountdownDays = 45

// HoldConfig controls certification hold countdown behavior.
type HoldConfig struct {
	CountdownDays       int
	ReminderAfterDays   int
	EscalationAfterDays int
}

// DefaultHoldConfig returns the default hold configuration.
func DefaultHoldConfig() HoldConfig {
	return HoldConfig{
		CountdownDays:       DefaultHoldCountdownDays,
		ReminderAfterDays:   15,
		EscalationAfterDays: 30,
	}
}

// HoldAction indicates what action should be taken on a certification hold.
type HoldAction string

const (
	HoldActionNone     HoldAction = "NONE"
	HoldActionReminder HoldAction = "SEND_REMINDER"
	HoldActionEscalate HoldAction = "ESCALATE"
	HoldActionExpire   HoldAction = "EXPIRE"
	HoldActionCancel   HoldAction = "CANCEL"
)

// EvaluateHoldAction determines what action should be taken on a hold
// based on its current state and the elapsed time since creation.
//
// Timeline (default 45-day config):
//   - Day 0:   Hold created → status PENDING
//   - Day 15:  Send reminder to employer → status REMINDER_SENT
//   - Day 30:  Escalate to supervisor → status ESCALATED
//   - Day 45:  Hold expires → refund proceeds without certification
func EvaluateHoldAction(
	holdStatus string,
	createdAt time.Time,
	now time.Time,
	cfg HoldConfig,
) HoldAction {
	daysSinceCreation := int(now.Sub(createdAt).Hours() / 24)

	switch holdStatus {
	case "RESOLVED", "CANCELLED", "EXPIRED":
		return HoldActionNone

	case "PENDING":
		if daysSinceCreation >= cfg.CountdownDays {
			return HoldActionExpire
		}
		if daysSinceCreation >= cfg.ReminderAfterDays {
			return HoldActionReminder
		}
		return HoldActionNone

	case "REMINDER_SENT":
		if daysSinceCreation >= cfg.CountdownDays {
			return HoldActionExpire
		}
		if daysSinceCreation >= cfg.EscalationAfterDays {
			return HoldActionEscalate
		}
		return HoldActionNone

	case "ESCALATED":
		if daysSinceCreation >= cfg.CountdownDays {
			return HoldActionExpire
		}
		return HoldActionNone
	}

	return HoldActionNone
}

// ShouldCreateHold determines if a certification hold should be created
// for a refund application that has no verified termination certification.
func ShouldCreateHold(hasVerifiedCertification bool, terminationDate *string) bool {
	// Hold required when: refund submitted but no termination certification exists
	// If termination date is provided directly on the app, hold is still needed
	// because the employer hasn't confirmed it yet.
	return !hasVerifiedCertification
}

// ComputeHoldExpiry calculates the expiration time for a new hold.
func ComputeHoldExpiry(createdAt time.Time, countdownDays int) time.Time {
	return createdAt.AddDate(0, 0, countdownDays)
}
