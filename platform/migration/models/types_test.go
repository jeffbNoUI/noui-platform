package models

import "testing"

func TestCanTransitionTo(t *testing.T) {
	tests := []struct {
		name   string
		from   EngagementStatus
		to     EngagementStatus
		expect bool
	}{
		{"PROFILING to MAPPING allowed", StatusProfiling, StatusMapping, true},
		{"PROFILING to TRANSFORMING not allowed", StatusProfiling, StatusTransforming, false},
		{"MAPPING to TRANSFORMING allowed", StatusMapping, StatusTransforming, true},
		{"MAPPING to PROFILING not allowed (no backward)", StatusMapping, StatusProfiling, false},
		{"TRANSFORMING to RECONCILING allowed", StatusTransforming, StatusReconciling, true},
		{"RECONCILING to PARALLEL_RUN allowed", StatusReconciling, StatusParallelRun, true},
		{"RECONCILING to COMPLETE allowed", StatusReconciling, StatusComplete, true},
		{"PARALLEL_RUN to COMPLETE allowed", StatusParallelRun, StatusComplete, true},
		{"COMPLETE to PROFILING not allowed", StatusComplete, StatusProfiling, false},
		{"COMPLETE to COMPLETE not allowed", StatusComplete, StatusComplete, false},
		{"PROFILING to COMPLETE not allowed (skip)", StatusProfiling, StatusComplete, false},
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

// TestCutoverTransitions verifies the new cutover-related status transitions (AC-1).
func TestCutoverTransitions(t *testing.T) {
	t.Run("COMPLETE can transition to CUTOVER_IN_PROGRESS", func(t *testing.T) {
		if !StatusComplete.CanTransitionTo(StatusCutoverInProgress) {
			t.Fatal("expected COMPLETE -> CUTOVER_IN_PROGRESS to be valid")
		}
	})

	t.Run("CUTOVER_IN_PROGRESS can transition to GO_LIVE", func(t *testing.T) {
		if !StatusCutoverInProgress.CanTransitionTo(StatusGoLive) {
			t.Fatal("expected CUTOVER_IN_PROGRESS -> GO_LIVE to be valid")
		}
	})

	t.Run("CUTOVER_IN_PROGRESS can transition to COMPLETE (rollback)", func(t *testing.T) {
		if !StatusCutoverInProgress.CanTransitionTo(StatusComplete) {
			t.Fatal("expected CUTOVER_IN_PROGRESS -> COMPLETE (rollback) to be valid")
		}
	})

	t.Run("GO_LIVE is terminal — no further transitions", func(t *testing.T) {
		for _, target := range []EngagementStatus{
			StatusDiscovery, StatusProfiling, StatusMapping, StatusTransforming,
			StatusReconciling, StatusParallelRun, StatusComplete,
			StatusCutoverInProgress, StatusGoLive,
		} {
			if StatusGoLive.CanTransitionTo(target) {
				t.Fatalf("expected GO_LIVE -> %s to be invalid", target)
			}
		}
	})

	t.Run("COMPLETE cannot transition to GO_LIVE directly", func(t *testing.T) {
		if StatusComplete.CanTransitionTo(StatusGoLive) {
			t.Fatal("expected COMPLETE -> GO_LIVE to be invalid")
		}
	})

	t.Run("existing transitions still valid", func(t *testing.T) {
		cases := []struct {
			from, to EngagementStatus
			valid    bool
		}{
			{StatusDiscovery, StatusProfiling, true},
			{StatusReconciling, StatusParallelRun, true},
			{StatusParallelRun, StatusComplete, true},
		}
		for _, tc := range cases {
			got := tc.from.CanTransitionTo(tc.to)
			if got != tc.valid {
				t.Errorf("CanTransitionTo(%s -> %s) = %v, want %v", tc.from, tc.to, got, tc.valid)
			}
		}
	})
}
