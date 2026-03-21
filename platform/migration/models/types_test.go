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
