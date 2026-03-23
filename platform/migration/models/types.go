// Package models defines data types for the migration service.
package models

import (
	"encoding/json"
	"time"
)

// EngagementStatus represents the lifecycle state of a migration engagement.
type EngagementStatus string

const (
	StatusDiscovery    EngagementStatus = "DISCOVERY"
	StatusProfiling    EngagementStatus = "PROFILING"
	StatusMapping      EngagementStatus = "MAPPING"
	StatusTransforming EngagementStatus = "TRANSFORMING"
	StatusReconciling  EngagementStatus = "RECONCILING"
	StatusParallelRun  EngagementStatus = "PARALLEL_RUN"
	StatusComplete     EngagementStatus = "COMPLETE"
)

// ValidTransitions defines allowed forward status transitions for migration engagements.
var ValidTransitions = map[EngagementStatus][]EngagementStatus{
	StatusDiscovery:    {StatusProfiling},
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
	SourcePlatformType        *string           `json:"source_platform_type"`
	QualityBaselineApprovedAt *time.Time        `json:"quality_baseline_approved_at"`
	SourceConnection          *SourceConnection `json:"source_connection"`
	CreatedAt                 time.Time         `json:"created_at"`
	UpdatedAt                 time.Time         `json:"updated_at"`
}

// CreateEngagementRequest is the JSON body for creating a new engagement.
type CreateEngagementRequest struct {
	SourceSystemName   string  `json:"source_system_name"`
	SourcePlatformType *string `json:"source_platform_type,omitempty"`
}

// UpdateEngagementRequest is the JSON body for updating an engagement.
type UpdateEngagementRequest struct {
	Status             string  `json:"status,omitempty"`
	SourcePlatformType *string `json:"source_platform_type,omitempty"`
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

// PhaseGateTransition records an audited phase transition.
type PhaseGateTransition struct {
	ID               string             `json:"id"`
	EngagementID     string             `json:"engagement_id"`
	FromPhase        string             `json:"from_phase"`
	ToPhase          string             `json:"to_phase"`
	Direction        string             `json:"direction"` // ADVANCE or REGRESS
	GateMetrics      map[string]float64 `json:"gate_metrics"`
	AIRecommendation string             `json:"ai_recommendation"`
	Overrides        []string           `json:"overrides"`
	AuthorizedBy     string             `json:"authorized_by"`
	AuthorizedAt     time.Time          `json:"authorized_at"`
	Notes            string             `json:"notes,omitempty"`
}

// AdvancePhaseRequest is the JSON body for advancing an engagement phase.
type AdvancePhaseRequest struct {
	Notes     string   `json:"notes,omitempty"`
	Overrides []string `json:"overrides,omitempty"`
}

// RegressPhaseRequest is the JSON body for regressing an engagement phase.
type RegressPhaseRequest struct {
	TargetPhase string `json:"target_phase"`
	Notes       string `json:"notes"`
}

// GateStatusResponse contains gate metrics and AI recommendation for a phase.
type GateStatusResponse struct {
	Metrics        map[string]float64 `json:"metrics"`
	Recommendation *AIRecommendation  `json:"recommendation"`
}

// AIRecommendation contains a deterministic recommendation for a phase gate.
type AIRecommendation struct {
	Phase            string            `json:"phase"`
	Type             string            `json:"type"`
	Summary          string            `json:"summary"`
	Detail           string            `json:"detail"`
	Confidence       float64           `json:"confidence"`
	Actionable       bool              `json:"actionable"`
	SuggestedActions []SuggestedAction `json:"suggested_actions"`
}

// SuggestedAction describes an action the analyst can take.
type SuggestedAction struct {
	Label  string `json:"label"`
	Action string `json:"action"`
}

// AttentionItem represents a unified item requiring analyst attention.
type AttentionItem struct {
	ID              string `json:"id"`
	Source          string `json:"source"` // TRANSFORMATION, RECONCILIATION, RISK, QUALITY
	Phase           string `json:"phase"`
	Priority        string `json:"priority"` // P1, P2, P3
	Summary         string `json:"summary"`
	Detail          string `json:"detail"`
	SuggestedAction string `json:"suggested_action,omitempty"`
	BatchID         string `json:"batch_id,omitempty"`
	EngagementID    string `json:"engagement_id"`
	CreatedAt       string `json:"created_at"`
	Resolved        bool   `json:"resolved"`
}

// AttentionSummary provides aggregate counts for attention items.
type AttentionSummary struct {
	Total        int            `json:"total"`
	P1           int            `json:"p1"`
	P2           int            `json:"p2"`
	P3           int            `json:"p3"`
	ByEngagement map[string]int `json:"by_engagement"`
}

// Notification represents a user-facing notification.
type Notification struct {
	ID             string    `json:"id"`
	TenantID       string    `json:"tenant_id"`
	EngagementID   string    `json:"engagement_id"`
	EngagementName string    `json:"engagement_name"`
	Type           string    `json:"type"`
	Summary        string    `json:"summary"`
	Read           bool      `json:"read"`
	CreatedAt      time.Time `json:"created_at"`
}

// RootCauseResponse contains a root-cause analysis for reconciliation mismatches.
type RootCauseResponse struct {
	Analysis      string                  `json:"analysis"`
	AffectedCount int                     `json:"affected_count"`
	Confidence    float64                 `json:"confidence"`
	Patterns      []ReconciliationPattern `json:"patterns,omitempty"`
}

// ReconciliationPattern represents a systematic mismatch pattern detected by
// the intelligence service after reconciliation.
type ReconciliationPattern struct {
	PatternID        string   `json:"pattern_id"`
	BatchID          string   `json:"batch_id"`
	SuspectedDomain  string   `json:"suspected_domain"`
	PlanCode         string   `json:"plan_code"`
	Direction        string   `json:"direction"`
	MemberCount      int      `json:"member_count"`
	MeanVariance     string   `json:"mean_variance"`
	CoefficientOfVar float64  `json:"coefficient_of_var"`
	AffectedMembers  []string `json:"affected_members"`
	CorrectionType   *string  `json:"correction_type"`
	AffectedField    *string  `json:"affected_field"`
	Confidence       *float64 `json:"confidence"`
	Evidence         *string  `json:"evidence"`
	Resolved         bool     `json:"resolved"`
	ResolvedAt       *string  `json:"resolved_at"`
	CreatedAt        string   `json:"created_at"`
}

// MigrationBatch represents a transformation batch.
type MigrationBatch struct {
	BatchID           string     `json:"batch_id"`
	EngagementID      string     `json:"engagement_id"`
	BatchScope        string     `json:"batch_scope"`
	Status            string     `json:"status"`
	MappingVersion    string     `json:"mapping_version"`
	RowCountSource    *int       `json:"row_count_source"`
	RowCountLoaded    *int       `json:"row_count_loaded"`
	RowCountException *int       `json:"row_count_exception"`
	ErrorRate         *float64   `json:"error_rate"`
	HaltedReason      *string    `json:"halted_reason"`
	CheckpointKey     *string    `json:"checkpoint_key"`
	StartedAt         *time.Time `json:"started_at"`
	CompletedAt       *time.Time `json:"completed_at"`
}

// MigrationException represents a single transformation exception.
type MigrationException struct {
	ExceptionID        string     `json:"exception_id"`
	BatchID            string     `json:"batch_id"`
	SourceTable        string     `json:"source_table"`
	SourceID           string     `json:"source_id"`
	CanonicalTable     *string    `json:"canonical_table"`
	FieldName          string     `json:"field_name"`
	ExceptionType      string     `json:"exception_type"`
	AttemptedValue     *string    `json:"attempted_value"`
	ConstraintViolated string     `json:"constraint_violated"`
	Disposition        string     `json:"disposition"`
	ResolutionNote     *string    `json:"resolution_note"`
	ResolvedBy         *string    `json:"resolved_by"`
	ResolvedAt         *time.Time `json:"resolved_at"`
}

// CertificationRecord represents a parallel run Go/No-Go certification.
type CertificationRecord struct {
	ID            string                 `json:"id"`
	EngagementID  string                 `json:"engagement_id"`
	GateScore     float64                `json:"gate_score"`
	P1Count       int                    `json:"p1_count"`
	ChecklistJSON map[string]interface{} `json:"checklist_json"`
	CertifiedBy   string                 `json:"certified_by"`
	CertifiedAt   time.Time              `json:"certified_at"`
	Notes         string                 `json:"notes,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
}

// CertifyRequest is the JSON body for creating a certification record.
type CertifyRequest struct {
	GateScore float64                `json:"gate_score"`
	P1Count   int                    `json:"p1_count"`
	Checklist map[string]interface{} `json:"checklist"`
	Notes     string                 `json:"notes,omitempty"`
}

// CreateBatchRequest is the JSON body for creating a transformation batch.
type CreateBatchRequest struct {
	BatchScope     string `json:"batch_scope"`
	MappingVersion string `json:"mapping_version"`
}
