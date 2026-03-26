package worker

import (
	"testing"

	"github.com/noui/platform/migration/models"
)

// TestDriftDetectionExecutor validates the executor's type registration and interface compliance.
func TestDriftDetectionExecutor(t *testing.T) {
	t.Run("implements_executor_interface", func(t *testing.T) {
		var _ Executor = (*DriftDetectionExecutor)(nil)
	})

	t.Run("job_type_constant", func(t *testing.T) {
		if JobTypeDriftDetection != "drift_detection" {
			t.Errorf("expected drift_detection, got %s", JobTypeDriftDetection)
		}
	})

	t.Run("broadcast_nil_safe", func(t *testing.T) {
		e := &DriftDetectionExecutor{Broadcast: nil}
		// Should not panic.
		e.broadcastEvent("eng-001", "test_event", map[string]string{"key": "value"})
	})

	t.Run("broadcast_invoked", func(t *testing.T) {
		var called bool
		e := &DriftDetectionExecutor{
			Broadcast: func(engagementID, eventType string, payload interface{}) {
				called = true
				if engagementID != "eng-001" {
					t.Errorf("expected eng-001, got %s", engagementID)
				}
				if eventType != "test" {
					t.Errorf("expected test, got %s", eventType)
				}
			},
		}
		e.broadcastEvent("eng-001", "test", nil)
		if !called {
			t.Error("broadcast function was not called")
		}
	})

	t.Run("drift_input_struct_fields", func(t *testing.T) {
		input := DriftDetectionInput{
			RunID:        "run-001",
			EngagementID: "eng-001",
			DriftType:    string(models.DriftTypeBoth),
			BaselineID:   "sv-001",
		}
		if input.RunID != "run-001" {
			t.Errorf("unexpected run_id: %s", input.RunID)
		}
		if input.DriftType != "BOTH" {
			t.Errorf("unexpected drift_type: %s", input.DriftType)
		}
	})
}
