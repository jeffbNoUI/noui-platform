// Package models defines data types for the migration service.
package models

import "time"

// EngagementStatus represents the lifecycle state of a migration engagement.
type EngagementStatus string

const (
	StatusProfiling    EngagementStatus = "PROFILING"
	StatusMapping      EngagementStatus = "MAPPING"
	StatusTransforming EngagementStatus = "TRANSFORMING"
	StatusReconciling  EngagementStatus = "RECONCILING"
	StatusParallelRun  EngagementStatus = "PARALLEL_RUN"
	StatusComplete     EngagementStatus = "COMPLETE"
)

// ValidTransitions defines allowed status transitions for migration engagements.
var ValidTransitions = map[EngagementStatus][]EngagementStatus{
	StatusProfiling:    {StatusMapping},
	StatusMapping:      {StatusTransforming},
	StatusTransforming: {StatusReconciling},
	StatusReconciling:  {StatusParallelRun, StatusComplete},
	StatusParallelRun:  {StatusComplete},
	StatusComplete:     {},
}

// CanTransitionTo returns true if the current status can transition to the target status.
func (s EngagementStatus) CanTransitionTo(target EngagementStatus) bool {
	for _, allowed := range ValidTransitions[s] {
		if allowed == target {
			return true
		}
	}
	return false
}

// Engagement represents a migration engagement record.
type Engagement struct {
	EngagementID              string           `json:"engagement_id"`
	TenantID                  string           `json:"tenant_id"`
	SourceSystemName          string           `json:"source_system_name"`
	CanonicalSchemaVersion    string           `json:"canonical_schema_version"`
	Status                    EngagementStatus `json:"status"`
	QualityBaselineApprovedAt *time.Time       `json:"quality_baseline_approved_at"`
	CreatedAt                 time.Time        `json:"created_at"`
	UpdatedAt                 time.Time        `json:"updated_at"`
}

// CreateEngagementRequest is the JSON body for creating a new engagement.
type CreateEngagementRequest struct {
	SourceSystemName string `json:"source_system_name"`
}

// UpdateEngagementRequest is the JSON body for updating an engagement.
type UpdateEngagementRequest struct {
	Status string `json:"status,omitempty"`
}
