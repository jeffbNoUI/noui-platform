package worker

import (
	"testing"
)

func TestDriftSchedulerConstants(t *testing.T) {
	// Verify the job type constant is the expected string.
	if JobTypeDriftDetection != "drift_detection" {
		t.Errorf("expected job type 'drift_detection', got '%s'", JobTypeDriftDetection)
	}
}

func TestDriftDetectionExecutorInterface(t *testing.T) {
	// Verify DriftDetectionExecutor implements the Executor interface.
	var _ Executor = (*DriftDetectionExecutor)(nil)
}

func TestDriftDetectionExecutorBroadcastNilSafe(t *testing.T) {
	// broadcastEvent should be nil-safe when Broadcast is nil.
	e := &DriftDetectionExecutor{}
	// Should not panic.
	e.broadcastEvent("eng-001", "test_event", map[string]string{"key": "value"})
}
