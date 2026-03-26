package models

import "testing"

func TestParallelRunStatusTransition(t *testing.T) {
	tests := []struct {
		name   string
		from   ParallelRunStatus
		to     ParallelRunStatus
		expect bool
	}{
		// Valid transitions
		{"PENDING to RUNNING", ParallelRunPending, ParallelRunRunning, true},
		{"RUNNING to PAUSED", ParallelRunRunning, ParallelRunPaused, true},
		{"RUNNING to COMPLETED", ParallelRunRunning, ParallelRunCompleted, true},
		{"RUNNING to FAILED", ParallelRunRunning, ParallelRunFailed, true},
		{"RUNNING to CANCELLED", ParallelRunRunning, ParallelRunCancelled, true},
		{"PAUSED to RUNNING", ParallelRunPaused, ParallelRunRunning, true},
		{"PAUSED to CANCELLED", ParallelRunPaused, ParallelRunCancelled, true},

		// Invalid transitions
		{"PENDING to COMPLETED", ParallelRunPending, ParallelRunCompleted, false},
		{"PENDING to PAUSED", ParallelRunPending, ParallelRunPaused, false},
		{"PENDING to FAILED", ParallelRunPending, ParallelRunFailed, false},
		{"COMPLETED to RUNNING", ParallelRunCompleted, ParallelRunRunning, false},
		{"FAILED to RUNNING", ParallelRunFailed, ParallelRunRunning, false},
		{"CANCELLED to RUNNING", ParallelRunCancelled, ParallelRunRunning, false},
		{"PAUSED to COMPLETED", ParallelRunPaused, ParallelRunCompleted, false},
		{"PAUSED to FAILED", ParallelRunPaused, ParallelRunFailed, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.from.CanTransitionTo(tt.to)
			if got != tt.expect {
				t.Errorf("%s.CanTransitionTo(%s) = %v, want %v", tt.from, tt.to, got, tt.expect)
			}
		})
	}
}

func TestParallelRunValidateTransition(t *testing.T) {
	// Valid transition should return nil
	err := ParallelRunPending.ValidateTransition(ParallelRunRunning)
	if err != nil {
		t.Errorf("ValidateTransition(PENDING→RUNNING) unexpected error: %v", err)
	}

	// Invalid transition should return error
	err = ParallelRunCompleted.ValidateTransition(ParallelRunRunning)
	if err == nil {
		t.Error("ValidateTransition(COMPLETED→RUNNING) expected error, got nil")
	}
}
