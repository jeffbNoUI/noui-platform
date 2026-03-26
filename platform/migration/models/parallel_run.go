package models

import (
	"fmt"
	"time"
)

// ParallelRunStatus represents the lifecycle state of a parallel run.
type ParallelRunStatus string

const (
	ParallelRunPending   ParallelRunStatus = "PENDING"
	ParallelRunRunning   ParallelRunStatus = "RUNNING"
	ParallelRunPaused    ParallelRunStatus = "PAUSED"
	ParallelRunCompleted ParallelRunStatus = "COMPLETED"
	ParallelRunFailed    ParallelRunStatus = "FAILED"
	ParallelRunCancelled ParallelRunStatus = "CANCELLED"
)

// parallelRunTransitions defines allowed status transitions for a parallel run.
// PENDING→RUNNING, RUNNING→PAUSED|COMPLETED|FAILED|CANCELLED, PAUSED→RUNNING|CANCELLED.
var parallelRunTransitions = map[ParallelRunStatus][]ParallelRunStatus{
	ParallelRunPending:   {ParallelRunRunning},
	ParallelRunRunning:   {ParallelRunPaused, ParallelRunCompleted, ParallelRunFailed, ParallelRunCancelled},
	ParallelRunPaused:    {ParallelRunRunning, ParallelRunCancelled},
	ParallelRunCompleted: {},
	ParallelRunFailed:    {},
	ParallelRunCancelled: {},
}

// CanTransitionTo returns true if the parallel run status can transition to the target.
func (s ParallelRunStatus) CanTransitionTo(target ParallelRunStatus) bool {
	for _, allowed := range parallelRunTransitions[s] {
		if allowed == target {
			return true
		}
	}
	return false
}

// ValidateTransition returns an error if the transition from s to target is not allowed.
func (s ParallelRunStatus) ValidateTransition(target ParallelRunStatus) error {
	if !s.CanTransitionTo(target) {
		return fmt.Errorf("invalid parallel run status transition: %s → %s", s, target)
	}
	return nil
}

// ComparisonMode represents the comparison strategy for a parallel run.
type ComparisonMode string

const (
	ComparisonModeSample ComparisonMode = "SAMPLE"
	ComparisonModeFull   ComparisonMode = "FULL"
	// ComparisonModeContinuous requires CDC integration, not yet built.
	// When CDC is available, CONTINUOUS mode will stream changes in real time.
	ComparisonModeContinuous ComparisonMode = "CONTINUOUS"
)

// ParallelRun represents a migration.parallel_run row.
type ParallelRun struct {
	RunID           string            `json:"run_id"`
	EngagementID    string            `json:"engagement_id"`
	Name            string            `json:"name"`
	Description     *string           `json:"description"`
	Status          ParallelRunStatus `json:"status"`
	LegacySource    string            `json:"legacy_source"`
	CanonicalSource string            `json:"canonical_source"`
	ComparisonMode  ComparisonMode    `json:"comparison_mode"`
	SampleRate      *float64          `json:"sample_rate"`
	StartedBy       string            `json:"started_by"`
	StartedAt       *time.Time        `json:"started_at"`
	CompletedAt     *time.Time        `json:"completed_at"`
	CreatedAt       time.Time         `json:"created_at"`
}

// ParallelRunResult represents a migration.parallel_run_result row.
type ParallelRunResult struct {
	ResultID        string   `json:"result_id"`
	RunID           string   `json:"run_id"`
	MemberID        string   `json:"member_id"`
	CanonicalEntity string   `json:"canonical_entity"`
	FieldName       string   `json:"field_name"`
	LegacyValue     *string  `json:"legacy_value"`
	NewValue        *string  `json:"new_value"`
	Match           bool     `json:"match"`
	VarianceAmount  *float64 `json:"variance_amount"`
	VariancePct     *float64 `json:"variance_pct"`
	CheckedAt       string   `json:"checked_at"`
}

// EntityMatchSummary holds match/mismatch counts for a single canonical entity.
type EntityMatchSummary struct {
	MatchCount    int `json:"match_count"`
	MismatchCount int `json:"mismatch_count"`
}

// ParallelRunSummary provides aggregate comparison metrics for a parallel run.
type ParallelRunSummary struct {
	TotalCompared int                           `json:"total_compared"`
	MatchCount    int                           `json:"match_count"`
	MismatchCount int                           `json:"mismatch_count"`
	MatchRatePct  float64                       `json:"match_rate_pct"`
	ByEntity      map[string]EntityMatchSummary `json:"by_entity"`
}
