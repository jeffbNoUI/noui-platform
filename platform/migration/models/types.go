// Package models defines data types for the migration service.
package models

import (
	"encoding/json"
	"time"
)

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

// SourceConnection holds connection parameters for a source database.
type SourceConnection struct {
	Driver   string `json:"driver"` // "postgres", "mysql", "mssql"
	Host     string `json:"host"`
	Port     string `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
	DBName   string `json:"dbname"`
	SSLMode  string `json:"sslmode,omitempty"`
}

// SourceTable describes a table discovered in the source database.
type SourceTable struct {
	SchemaName  string `json:"schema_name"`
	TableName   string `json:"table_name"`
	RowCount    int64  `json:"row_count"`
	ColumnCount int    `json:"column_count"`
}

// Engagement represents a migration engagement record.
type Engagement struct {
	EngagementID              string            `json:"engagement_id"`
	TenantID                  string            `json:"tenant_id"`
	SourceSystemName          string            `json:"source_system_name"`
	CanonicalSchemaVersion    string            `json:"canonical_schema_version"`
	Status                    EngagementStatus  `json:"status"`
	QualityBaselineApprovedAt *time.Time        `json:"quality_baseline_approved_at"`
	SourceConnection          *SourceConnection `json:"source_connection"`
	CreatedAt                 time.Time         `json:"created_at"`
	UpdatedAt                 time.Time         `json:"updated_at"`
}

// CreateEngagementRequest is the JSON body for creating a new engagement.
type CreateEngagementRequest struct {
	SourceSystemName string `json:"source_system_name"`
}

// UpdateEngagementRequest is the JSON body for updating an engagement.
type UpdateEngagementRequest struct {
	Status string `json:"status,omitempty"`
}

// Risk represents a migration risk (dynamic or analyst-created).
type Risk struct {
	RiskID         string     `json:"risk_id"`
	EngagementID   *string    `json:"engagement_id"` // nil = global risk
	TenantID       string     `json:"tenant_id"`
	Source         string     `json:"source"`
	Severity       string     `json:"severity"`
	Description    string     `json:"description"`
	Evidence       *string    `json:"evidence"`
	Mitigation     *string    `json:"mitigation"`
	Status         string     `json:"status"`
	DetectedAt     time.Time  `json:"detected_at"`
	AcknowledgedBy *string    `json:"acknowledged_by"`
	ClosedAt       *time.Time `json:"closed_at"`
}

// CreateRiskRequest is the JSON body for creating a new risk.
type CreateRiskRequest struct {
	EngagementID *string `json:"engagement_id"`
	Severity     string  `json:"severity"`
	Description  string  `json:"description"`
	Evidence     *string `json:"evidence"`
	Mitigation   *string `json:"mitigation"`
}

// UpdateRiskRequest is the JSON body for updating a risk.
type UpdateRiskRequest struct {
	Status     *string `json:"status,omitempty"`
	Mitigation *string `json:"mitigation,omitempty"`
}

// Event represents an activity log entry for an engagement.
type Event struct {
	EventID      string          `json:"event_id"`
	EngagementID string          `json:"engagement_id"`
	EventType    string          `json:"event_type"`
	Payload      json.RawMessage `json:"payload"`
	CreatedAt    time.Time       `json:"created_at"`
}

// ExceptionCluster represents AI-grouped exceptions sharing a pattern.
type ExceptionCluster struct {
	ClusterID            string          `json:"cluster_id"`
	BatchID              string          `json:"batch_id"`
	ExceptionType        string          `json:"exception_type"`
	FieldName            string          `json:"field_name"`
	Count                int             `json:"count"`
	SampleSourceIDs      json.RawMessage `json:"sample_source_ids"`
	RootCausePattern     *string         `json:"root_cause_pattern"`
	SuggestedResolution  *string         `json:"suggested_resolution"`
	SuggestedDisposition *string         `json:"suggested_disposition"`
	Confidence           float64         `json:"confidence"`
	Applied              bool            `json:"applied"`
	AppliedAt            *time.Time      `json:"applied_at"`
}

// ApplyClusterRequest is the JSON body for applying a cluster resolution.
type ApplyClusterRequest struct {
	Disposition string `json:"disposition"`
}

// DashboardSummary provides aggregate metrics across all engagements.
type DashboardSummary struct {
	ActiveEngagements int     `json:"active_engagements"`
	BatchesRunning    int     `json:"batches_running"`
	AvgErrorRate      float64 `json:"avg_error_rate"`
	BestReconScore    float64 `json:"best_recon_score"`
	OpenRisksP1       int     `json:"open_risks_p1"`
	OpenRisksTotal    int     `json:"open_risks_total"`
}

// SystemHealthStatus provides service health information.
type SystemHealthStatus struct {
	MigrationService    string `json:"migration_service"`
	IntelligenceService string `json:"intelligence_service"`
	DatabaseConnected   bool   `json:"database_connected"`
}

// ReconciliationSummaryResult provides aggregate reconciliation metrics.
type ReconciliationSummaryResult struct {
	TotalRecords int     `json:"total_records"`
	MatchCount   int     `json:"match_count"`
	MinorCount   int     `json:"minor_count"`
	MajorCount   int     `json:"major_count"`
	ErrorCount   int     `json:"error_count"`
	GateScore    float64 `json:"gate_score"` // match_count / total_records
	P1Count      int     `json:"p1_count"`
	Tier1Score   float64 `json:"tier1_score"`
	Tier2Score   float64 `json:"tier2_score"`
	Tier3Score   float64 `json:"tier3_score"`
}

// CompareResult provides side-by-side engagement metrics.
type CompareResult struct {
	Engagements []CompareEngagement `json:"engagements"`
}

// CompareEngagement holds metrics for a single engagement in a comparison.
type CompareEngagement struct {
	EngagementID     string         `json:"engagement_id"`
	SourceSystemName string         `json:"source_system_name"`
	Status           string         `json:"status"`
	QualityScores    *QualityScores `json:"quality_scores"`
	BatchCount       int            `json:"batch_count"`
	ErrorRate        float64        `json:"error_rate"`
	ReconGateScore   float64        `json:"recon_gate_score"`
}

// QualityScores holds the six quality dimensions.
type QualityScores struct {
	Accuracy     float64 `json:"accuracy"`
	Completeness float64 `json:"completeness"`
	Consistency  float64 `json:"consistency"`
	Timeliness   float64 `json:"timeliness"`
	Validity     float64 `json:"validity"`
	Uniqueness   float64 `json:"uniqueness"`
}
