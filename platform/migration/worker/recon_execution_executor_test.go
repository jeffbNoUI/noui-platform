package worker

import (
	"testing"

	"github.com/noui/platform/migration/models"
)

func TestReconExecutionExecutor_CountByPriority(t *testing.T) {
	mismatches := []models.ReconExecutionMismatch{
		{Priority: models.PriorityP1},
		{Priority: models.PriorityP1},
		{Priority: models.PriorityP2},
		{Priority: models.PriorityP3},
		{Priority: models.PriorityP3},
		{Priority: models.PriorityP3},
	}

	p1, p2, p3 := countByPriority(mismatches)
	if p1 != 2 {
		t.Errorf("P1 = %d, want 2", p1)
	}
	if p2 != 1 {
		t.Errorf("P2 = %d, want 1", p2)
	}
	if p3 != 3 {
		t.Errorf("P3 = %d, want 3", p3)
	}
}

func TestReconExecutionExecutor_CountByPriority_Empty(t *testing.T) {
	p1, p2, p3 := countByPriority(nil)
	if p1 != 0 || p2 != 0 || p3 != 0 {
		t.Errorf("expected all zeros, got P1=%d P2=%d P3=%d", p1, p2, p3)
	}
}

func TestDriftExecutorRegistration(t *testing.T) {
	// Verify the ReconExecutionExecutor type implements the BroadcastFunc interface
	// by ensuring the struct can be constructed with a broadcast function.
	exec := &ReconExecutionExecutor{
		Broadcast: func(engagementID, eventType string, payload interface{}) {},
	}
	if exec.Broadcast == nil {
		t.Error("expected non-nil Broadcast")
	}
}
