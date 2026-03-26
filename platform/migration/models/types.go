// Package models defines data types for the migration service.
package models

import (
	"encoding/json"
	"time"
)

// EngagementStatus represents the lifecycle state of a migration engagement.
type EngagementStatus string

const (
	StatusDiscovery         EngagementStatus = "DISCOVERY"
	StatusProfiling         EngagementStatus = "PROFILING"
	StatusMapping           EngagementStatus = "MAPPING"
	StatusTransforming      EngagementStatus = "TRANSFORMING"
	StatusReconciling       EngagementStatus = "RECONCILING"
	StatusParallelRun       EngagementStatus = "PARALLEL_RUN"
	StatusComplete          EngagementStatus = "COMPLETE"
	StatusCutoverInProgress EngagementStatus = "CUTOVER_IN_PROGRESS"
	StatusGoLive            EngagementStatus = "GO_LIVE"
)

// ValidTransitions defines allowed status transitions for migration engagements.
var ValidTransitions = map[EngagementStatus][]EngagementStatus{
	StatusDiscovery:         {StatusProfiling},
	StatusProfiling:         {StatusMapping},
	StatusMapping:           {StatusTransforming},
	StatusTransforming:      {StatusReconciling},
	StatusReconciling:       {StatusParallelRun, StatusComplete},
	StatusParallelRun:       {StatusComplete},
	StatusComplete:          {StatusCutoverInProgress},
	StatusCutoverInProgress: {StatusGoLive, StatusComplete},
	StatusGoLive:            {},
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
	ContributionModel         string            `json:"contribution_model"`
	QualityBaselineApprovedAt *time.Time        `json:"quality_baseline_approved_at"`
	SourceConnection          *SourceConnection `json:"source_connection"`
	CreatedAt                 time.Time         `json:"created_at"`
	UpdatedAt                 time.Time         `json:"updated_at"`
}

// CreateEngagementRequest is the JSON body for creating a new engagement.
type CreateEngagementRequest struct {
	SourceSystemName   string  `json:"source_system_name"`
	SourcePlatformType *string `json:"source_platform_type,omitempty"`
	ContributionModel  string  `json:"contribution_model,omitempty"`
}

// UpdateEngagementRequest is the JSON body for updating an engagement.
type UpdateEngagementRequest struct {
	Status             string  `json:"status,omitempty"`
	SourcePlatformType *string `json:"source_platform_type,omitempty"`
	ContributionModel  *string `json:"contribution_model,omitempty"`
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

// GateStatusResponse contains gate metrics, AI recommendation, and evaluation for a phase.
type GateStatusResponse struct {
	Metrics        map[string]float64    `json:"metrics"`
	Recommendation *AIRecommendation     `json:"recommendation"`
	Evaluation     *GateEvaluationResult `json:"evaluation"`
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
	ID            string          `json:"id"`
	EngagementID  string          `json:"engagement_id"`
	GateScore     float64         `json:"gate_score"`
	P1Count       int             `json:"p1_count"`
	ChecklistJSON map[string]any  `json:"checklist_json"`
	AutoEvaluated json.RawMessage `json:"auto_evaluated,omitempty"`
	CertifiedBy   string          `json:"certified_by"`
	CertifiedAt   time.Time       `json:"certified_at"`
	Notes         string          `json:"notes,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
}

// CertifyRequest is the JSON body for creating a certification record.
// Auto-evaluated items (gate_score, p1_count) are computed server-side.
// The request only carries human-attested items.
type CertifyRequest struct {
	StakeholderSignoff bool   `json:"stakeholder_signoff"`
	RollbackPlan       bool   `json:"rollback_plan"`
	Notes              string `json:"notes,omitempty"`
}

// CertificationListResponse is the paginated response for listing certifications.
type CertificationListResponse struct {
	Certifications []CertificationRecord `json:"certifications"`
	Total          int                   `json:"total"`
	Page           int                   `json:"page"`
	PerPage        int                   `json:"per_page"`
}

// ChecklistItem represents one item in the certification checklist.
type ChecklistItem struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Passed      bool   `json:"passed"`
	AutoEval    bool   `json:"auto_eval"`
	Description string `json:"description,omitempty"`
}

// ChecklistEvaluation holds the full evaluation result for a certification attempt.
type ChecklistEvaluation struct {
	Items     []ChecklistItem `json:"items"`
	AllPassed bool            `json:"all_passed"`
}

// CreateBatchRequest is the JSON body for creating a transformation batch.
type CreateBatchRequest struct {
	BatchScope     string `json:"batch_scope"`
	MappingVersion string `json:"mapping_version"`
}

// LineageRecord represents a single data lineage entry tracking a transformation.
type LineageRecord struct {
	LineageID   string `json:"lineage_id"`
	BatchID     string `json:"batch_id"`
	RowKey      string `json:"row_key"`
	HandlerName string `json:"handler_name"`
	ColumnName  string `json:"column_name"`
	SourceValue string `json:"source_value"`
	ResultValue string `json:"result_value"`
	CreatedAt   string `json:"created_at"`
}

// LineageSummary provides aggregate statistics for lineage records in a batch.
type LineageSummary struct {
	TotalRecords        int      `json:"total_records"`
	UniqueMembers       int      `json:"unique_members"`
	FieldsCovered       int      `json:"fields_covered"`
	TransformationTypes []string `json:"transformation_types"`
	ExceptionCount      int      `json:"exception_count"`
}

// ---------------------------------------------------------------------------
// Progressive Profiling (5-Level Model)
// ---------------------------------------------------------------------------

// ProfilingRunStatus represents the lifecycle state of a profiling run.
type ProfilingRunStatus string

const (
	ProfilingStatusInitiated           ProfilingRunStatus = "INITIATED"
	ProfilingStatusRunningL1           ProfilingRunStatus = "RUNNING_L1"
	ProfilingStatusRunningL2           ProfilingRunStatus = "RUNNING_L2"
	ProfilingStatusRunningL3           ProfilingRunStatus = "RUNNING_L3"
	ProfilingStatusRunningL4           ProfilingRunStatus = "RUNNING_L4"
	ProfilingStatusRunningL5           ProfilingRunStatus = "RUNNING_L5"
	ProfilingStatusCoverageReportReady ProfilingRunStatus = "COVERAGE_REPORT_READY"
	ProfilingStatusMapperPrePopulated  ProfilingRunStatus = "MAPPER_PRE_POPULATED"
	ProfilingStatusRulesEngineerReview ProfilingRunStatus = "RULES_ENGINEER_REVIEW"
	ProfilingStatusFailed              ProfilingRunStatus = "FAILED"
)

// TableProfileStatus represents the profiling progress of an individual source table.
type TableProfileStatus string

const (
	TableProfilePending TableProfileStatus = "PENDING"
	TableProfileL1Done  TableProfileStatus = "L1_DONE"
	TableProfileL2Done  TableProfileStatus = "L2_DONE"
	TableProfileL3Done  TableProfileStatus = "L3_DONE"
	TableProfileL4Done  TableProfileStatus = "L4_DONE"
	TableProfileL5Done  TableProfileStatus = "L5_DONE"
	TableProfileSkipped TableProfileStatus = "SKIPPED"
	TableProfileFailed  TableProfileStatus = "FAILED"
)

// ProfilingRun represents a migration.profiling_run row.
type ProfilingRun struct {
	ID                   string             `json:"id"`
	EngagementID         string             `json:"engagement_id"`
	SourcePlatform       string             `json:"source_platform"`
	InitiatedBy          string             `json:"initiated_by"`
	Status               ProfilingRunStatus `json:"status"`
	LevelReached         *int               `json:"level_reached"`
	TotalSourceColumns   *int               `json:"total_source_columns"`
	TotalCanonicalFields *int               `json:"total_canonical_fields"`
	AutoMappedCount      *int               `json:"auto_mapped_count"`
	ReviewRequiredCount  *int               `json:"review_required_count"`
	UnmappedCount        *int               `json:"unmapped_count"`
	OverallCoveragePct   *float64           `json:"overall_coverage_pct"`
	RuleSignalsFound     *int               `json:"rule_signals_found"`
	ReadinessAssessment  *string            `json:"readiness_assessment"`
	ErrorMessage         *string            `json:"error_message"`
	InitiatedAt          time.Time          `json:"initiated_at"`
	CompletedAt          *time.Time         `json:"completed_at"`
}

// SourceTableProfile represents a migration.source_table row (Level 1 inventory).
type SourceTableProfile struct {
	ID              string             `json:"id"`
	ProfilingRunID  string             `json:"profiling_run_id"`
	SchemaName      *string            `json:"schema_name"`
	TableName       string             `json:"table_name"`
	RowCount        *int64             `json:"row_count"`
	RowCountExact   bool               `json:"row_count_exact"`
	EntityClass     *string            `json:"entity_class"`
	ClassConfidence *float64           `json:"class_confidence"`
	IsLikelyLookup  bool               `json:"is_likely_lookup"`
	IsLikelyArchive bool               `json:"is_likely_archive"`
	ProfileStatus   TableProfileStatus `json:"profile_status"`
	Notes           *string            `json:"notes"`
}

// SourceColumnProfile represents a migration.source_column row (Level 1+2).
type SourceColumnProfile struct {
	ID              string `json:"id"`
	SourceTableID   string `json:"source_table_id"`
	ColumnName      string `json:"column_name"`
	OrdinalPosition *int   `json:"ordinal_position"`
	DataType        string `json:"data_type"`
	MaxLength       *int   `json:"max_length"`
	IsNullable      bool   `json:"is_nullable"`
	IsPrimaryKey    bool   `json:"is_primary_key"`
	IsUnique        bool   `json:"is_unique"`
	// Level 2 statistics
	RowCount      *int64          `json:"row_count"`
	NullCount     *int64          `json:"null_count"`
	NullPct       *float64        `json:"null_pct"`
	DistinctCount *int64          `json:"distinct_count"`
	DistinctPct   *float64        `json:"distinct_pct"`
	MinValue      *string         `json:"min_value"`
	MaxValue      *string         `json:"max_value"`
	MeanValue     *float64        `json:"mean_value"`
	StddevValue   *float64        `json:"stddev_value"`
	TopValues     json.RawMessage `json:"top_values"`
	PatternFreqs  json.RawMessage `json:"pattern_frequencies"`
	SampleValues  json.RawMessage `json:"sample_values"`
	SampleSize    *int64          `json:"sample_size"`
	IsSampled     bool            `json:"is_sampled"`
}

// TopValueEntry is a single entry in the top_values JSONB array.
type TopValueEntry struct {
	Value string  `json:"value"`
	Count int64   `json:"count"`
	Pct   float64 `json:"pct"`
}

// PatternFreqEntry is a single entry in the pattern_frequencies JSONB array.
type PatternFreqEntry struct {
	Pattern string  `json:"pattern"`
	Label   string  `json:"label"`
	Count   int64   `json:"count"`
	Pct     float64 `json:"pct"`
}

// CreateProfilingRunRequest is the JSON body for initiating a new profiling run.
type CreateProfilingRunRequest struct {
	SourcePlatform string `json:"source_platform"`
}

// ProfilingRunSummaryResponse is the API response for a profiling run with inventory.
type ProfilingRunSummaryResponse struct {
	Run    ProfilingRun         `json:"run"`
	Tables []SourceTableProfile `json:"tables,omitempty"`
}

// InventoryResponse returns L1+L2 data for a profiling run.
type InventoryResponse struct {
	Tables  []SourceTableProfile  `json:"tables"`
	Columns []SourceColumnProfile `json:"columns"`
}

// ---------------------------------------------------------------------------
// Schema Versioning
// ---------------------------------------------------------------------------

// SchemaVersion represents a canonical schema version record.
type SchemaVersion struct {
	VersionID   string    `json:"version_id"`
	TenantID    string    `json:"tenant_id"`
	Label       string    `json:"label"`
	Description *string   `json:"description"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// SchemaVersionField represents a single field in a schema version.
type SchemaVersionField struct {
	FieldID     string    `json:"field_id"`
	VersionID   string    `json:"version_id"`
	Entity      string    `json:"entity"`
	FieldName   string    `json:"field_name"`
	DataType    string    `json:"data_type"`
	IsRequired  bool      `json:"is_required"`
	Description *string   `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

// SchemaVersionDiff represents the difference between two schema versions.
type SchemaVersionDiff struct {
	FromVersion string               `json:"from_version"`
	ToVersion   string               `json:"to_version"`
	Added       []SchemaVersionField `json:"added"`
	Removed     []SchemaVersionField `json:"removed"`
	TypeChanged []FieldTypeChange    `json:"type_changed"`
}

// FieldTypeChange represents a field whose data type changed between versions.
type FieldTypeChange struct {
	Entity    string `json:"entity"`
	FieldName string `json:"field_name"`
	OldType   string `json:"old_type"`
	NewType   string `json:"new_type"`
}

// CreateSchemaVersionRequest is the JSON body for creating a new schema version.
type CreateSchemaVersionRequest struct {
	Label       string                        `json:"label"`
	Description *string                       `json:"description,omitempty"`
	Fields      []CreateSchemaVersionFieldReq `json:"fields"`
}

// CreateSchemaVersionFieldReq defines a field to include in a new schema version.
type CreateSchemaVersionFieldReq struct {
	Entity      string  `json:"entity"`
	FieldName   string  `json:"field_name"`
	DataType    string  `json:"data_type"`
	IsRequired  bool    `json:"is_required"`
	Description *string `json:"description,omitempty"`
}

// SchemaVersionWithFields bundles a version with its fields for API responses.
type SchemaVersionWithFields struct {
	Version SchemaVersion        `json:"version"`
	Fields  []SchemaVersionField `json:"fields"`
}

// ---------------------------------------------------------------------------
// Reconciliation Rules (M09a)
// ---------------------------------------------------------------------------

// ReconRuleSetStatus represents the lifecycle state of a reconciliation rule set.
type ReconRuleSetStatus string

const (
	ReconRuleSetDraft      ReconRuleSetStatus = "DRAFT"
	ReconRuleSetActive     ReconRuleSetStatus = "ACTIVE"
	ReconRuleSetSuperseded ReconRuleSetStatus = "SUPERSEDED"
	ReconRuleSetArchived   ReconRuleSetStatus = "ARCHIVED"
)

// ValidReconRuleSetStatuses is the set of valid status values for a ReconRuleSet.
var ValidReconRuleSetStatuses = map[ReconRuleSetStatus]bool{
	ReconRuleSetDraft:      true,
	ReconRuleSetActive:     true,
	ReconRuleSetSuperseded: true,
	ReconRuleSetArchived:   true,
}

// ReconComparisonType defines how a reconciliation rule compares source vs target.
type ReconComparisonType string

const (
	ComparisonExact            ReconComparisonType = "EXACT"
	ComparisonToleranceAbs     ReconComparisonType = "TOLERANCE_ABS"
	ComparisonTolerancePct     ReconComparisonType = "TOLERANCE_PCT"
	ComparisonRoundThenCompare ReconComparisonType = "ROUND_THEN_COMPARE"
)

// ValidComparisonTypes is the set of valid comparison types.
var ValidComparisonTypes = map[ReconComparisonType]bool{
	ComparisonExact:            true,
	ComparisonToleranceAbs:     true,
	ComparisonTolerancePct:     true,
	ComparisonRoundThenCompare: true,
}

// ReconPriority defines the priority assigned when a rule mismatch occurs.
type ReconPriority string

const (
	PriorityP1 ReconPriority = "P1"
	PriorityP2 ReconPriority = "P2"
	PriorityP3 ReconPriority = "P3"
)

// ValidPriorities is the set of valid mismatch priorities.
var ValidPriorities = map[ReconPriority]bool{
	PriorityP1: true,
	PriorityP2: true,
	PriorityP3: true,
}

// ReconRule is a single reconciliation rule within a rule set.
// Stored in JSONB — tolerance_value is a string for decimal precision.
type ReconRule struct {
	RuleID             string              `json:"rule_id"`
	Tier               int                 `json:"tier"`
	CalcName           string              `json:"calc_name"`
	ComparisonType     ReconComparisonType `json:"comparison_type"`
	ToleranceValue     string              `json:"tolerance_value"`
	PriorityIfMismatch ReconPriority       `json:"priority_if_mismatch"`
	Enabled            bool                `json:"enabled"`
}

// ReconRuleSet represents a versioned set of reconciliation rules for an engagement.
type ReconRuleSet struct {
	RulesetID    string             `json:"ruleset_id"`
	EngagementID string             `json:"engagement_id"`
	Version      int                `json:"version"`
	Label        string             `json:"label"`
	Status       ReconRuleSetStatus `json:"status"`
	Rules        []ReconRule        `json:"rules"`
	CreatedBy    string             `json:"created_by"`
	CreatedAt    time.Time          `json:"created_at"`
	ActivatedAt  *time.Time         `json:"activated_at"`
	SupersededAt *time.Time         `json:"superseded_at"`
}

// CreateReconRuleSetRequest is the JSON body for creating a new reconciliation rule set.
type CreateReconRuleSetRequest struct {
	Label string               `json:"label"`
	Rules []CreateReconRuleReq `json:"rules"`
}

// CreateReconRuleReq defines a single rule in a create request.
type CreateReconRuleReq struct {
	Tier               int                 `json:"tier"`
	CalcName           string              `json:"calc_name"`
	ComparisonType     ReconComparisonType `json:"comparison_type"`
	ToleranceValue     string              `json:"tolerance_value"`
	PriorityIfMismatch ReconPriority       `json:"priority_if_mismatch"`
	Enabled            bool                `json:"enabled"`
}

// UpdateReconRuleSetRequest is the JSON body for updating a DRAFT reconciliation rule set.
type UpdateReconRuleSetRequest struct {
	Label *string               `json:"label,omitempty"`
	Rules *[]CreateReconRuleReq `json:"rules,omitempty"`
}

// ReconRuleDiff represents the structural difference between two reconciliation rule sets.
type ReconRuleDiff struct {
	FromRulesetID string            `json:"from_ruleset_id"`
	FromVersion   int               `json:"from_version"`
	ToRulesetID   string            `json:"to_ruleset_id"`
	ToVersion     int               `json:"to_version"`
	Added         []ReconRule       `json:"added"`
	Removed       []ReconRule       `json:"removed"`
	Modified      []ReconRuleChange `json:"modified"`
}

// ReconRuleChange describes how a single rule changed between two rule sets.
type ReconRuleChange struct {
	RuleID string    `json:"rule_id"`
	From   ReconRule `json:"from"`
	To     ReconRule `json:"to"`
}

// ---------------------------------------------------------------------------
// Cutover Execution Engine (M04b)
// ---------------------------------------------------------------------------

// CutoverPlanStatus represents the lifecycle state of a cutover plan.
type CutoverPlanStatus string

const (
	CutoverStatusDraft      CutoverPlanStatus = "DRAFT"
	CutoverStatusApproved   CutoverPlanStatus = "APPROVED"
	CutoverStatusExecuting  CutoverPlanStatus = "EXECUTING"
	CutoverStatusCompleted  CutoverPlanStatus = "COMPLETED"
	CutoverStatusRolledBack CutoverPlanStatus = "ROLLED_BACK"
	CutoverStatusFailed     CutoverPlanStatus = "FAILED"
)

// CutoverStepStatus represents the state of an individual cutover step.
type CutoverStepStatus string

const (
	StepStatusPending    CutoverStepStatus = "PENDING"
	StepStatusInProgress CutoverStepStatus = "IN_PROGRESS"
	StepStatusCompleted  CutoverStepStatus = "COMPLETED"
	StepStatusFailed     CutoverStepStatus = "FAILED"
	StepStatusSkipped    CutoverStepStatus = "SKIPPED"
)

// CutoverStepType distinguishes automated vs. manual steps.
type CutoverStepType string

const (
	StepTypeAutomated CutoverStepType = "AUTOMATED"
	StepTypeManual    CutoverStepType = "MANUAL"
)

// CutoverStep represents one step in a cutover plan.
type CutoverStep struct {
	StepID       string            `json:"step_id"`
	Label        string            `json:"label"`
	Order        int               `json:"order"`
	Type         CutoverStepType   `json:"type"`
	Status       CutoverStepStatus `json:"status"`
	StartedAt    *time.Time        `json:"started_at,omitempty"`
	CompletedAt  *time.Time        `json:"completed_at,omitempty"`
	ErrorMessage *string           `json:"error_message,omitempty"`
}

// CutoverPlan represents a cutover plan record.
type CutoverPlan struct {
	PlanID        string            `json:"plan_id"`
	EngagementID  string            `json:"engagement_id"`
	Status        CutoverPlanStatus `json:"status"`
	Steps         []CutoverStep     `json:"steps"`
	RollbackSteps []CutoverStep     `json:"rollback_steps"`
	ApprovedBy    *string           `json:"approved_by,omitempty"`
	ApprovedAt    *time.Time        `json:"approved_at,omitempty"`
	StartedAt     *time.Time        `json:"started_at,omitempty"`
	CompletedAt   *time.Time        `json:"completed_at,omitempty"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
}

// CreateCutoverStepRequest is the step definition in a create plan request.
type CreateCutoverStepRequest struct {
	Label string          `json:"label"`
	Order int             `json:"order"`
	Type  CutoverStepType `json:"type"`
}

// CreateCutoverPlanRequest is the JSON body for creating a new cutover plan.
type CreateCutoverPlanRequest struct {
	Steps         []CreateCutoverStepRequest `json:"steps"`
	RollbackSteps []CreateCutoverStepRequest `json:"rollback_steps"`
}

// UpdateCutoverStepRequest is the JSON body for updating a step's status.
type UpdateCutoverStepRequest struct {
	Status       CutoverStepStatus `json:"status"`
	ErrorMessage *string           `json:"error_message,omitempty"`
}

// RollbackRequest is the JSON body for initiating a rollback.
type RollbackRequest struct {
	RollbackReason string `json:"rollback_reason"`
}

// ---------------------------------------------------------------------------
// Drift Detection (M05a)
// ---------------------------------------------------------------------------

// DriftDetectionRunStatus represents the lifecycle state of a drift detection run.
type DriftDetectionRunStatus string

const (
	DriftRunPending   DriftDetectionRunStatus = "PENDING"
	DriftRunRunning   DriftDetectionRunStatus = "RUNNING"
	DriftRunCompleted DriftDetectionRunStatus = "COMPLETED"
	DriftRunFailed    DriftDetectionRunStatus = "FAILED"
)

// DriftType specifies what kind of drift to detect.
type DriftType string

const (
	DriftTypeSchema DriftType = "SCHEMA"
	DriftTypeData   DriftType = "DATA"
	DriftTypeBoth   DriftType = "BOTH"
)

// DriftChangeType categorizes the kind of schema or data change detected.
type DriftChangeType string

const (
	DriftColumnAdded       DriftChangeType = "COLUMN_ADDED"
	DriftColumnRemoved     DriftChangeType = "COLUMN_REMOVED"
	DriftColumnTypeChanged DriftChangeType = "COLUMN_TYPE_CHANGED"
	DriftTableAdded        DriftChangeType = "TABLE_ADDED"
	DriftTableRemoved      DriftChangeType = "TABLE_REMOVED"
	DriftRowCountDrift     DriftChangeType = "ROW_COUNT_DRIFT"
)

// DriftSeverity indicates the impact level of a detected drift.
type DriftSeverity string

const (
	DriftSeverityCritical DriftSeverity = "CRITICAL"
	DriftSeverityHigh     DriftSeverity = "HIGH"
	DriftSeverityMedium   DriftSeverity = "MEDIUM"
	DriftSeverityLow      DriftSeverity = "LOW"
)

// DriftRowCountThresholdPct is the minimum row count delta percentage to flag as drift.
// Default 0.10 = 10%.
const DriftRowCountThresholdPct = 0.10

// DriftDetectionRun represents a drift detection run record.
type DriftDetectionRun struct {
	RunID              string                  `json:"run_id"`
	EngagementID       string                  `json:"engagement_id"`
	Status             DriftDetectionRunStatus `json:"status"`
	DriftType          DriftType               `json:"drift_type"`
	BaselineSnapshotID string                  `json:"baseline_snapshot_id"`
	DetectedChanges    int                     `json:"detected_changes"`
	CriticalChanges    int                     `json:"critical_changes"`
	StartedAt          *time.Time              `json:"started_at,omitempty"`
	CompletedAt        *time.Time              `json:"completed_at,omitempty"`
	ErrorMessage       *string                 `json:"error_message,omitempty"`
	CreatedAt          time.Time               `json:"created_at"`
}

// DriftRecord represents a single detected drift entry.
type DriftRecord struct {
	RecordID       string          `json:"record_id"`
	RunID          string          `json:"run_id"`
	ChangeType     DriftChangeType `json:"change_type"`
	Entity         string          `json:"entity"`
	Detail         json.RawMessage `json:"detail"`
	Severity       DriftSeverity   `json:"severity"`
	AffectsMapping bool            `json:"affects_mapping"`
	CreatedAt      time.Time       `json:"created_at"`
}

// CreateDriftDetectionRequest is the JSON body for initiating a drift detection run.
type CreateDriftDetectionRequest struct {
	DriftType DriftType `json:"drift_type"`
}

// DriftDetectionRunWithRecords bundles a run with its records for API responses.
type DriftDetectionRunWithRecords struct {
	Run     DriftDetectionRun `json:"run"`
	Records []DriftRecord     `json:"records"`
}

// ---------------------------------------------------------------------------
// Reconciliation Execution Engine (M09b)
// ---------------------------------------------------------------------------

// ReconExecutionRunStatus represents the lifecycle state of a recon execution run.
type ReconExecutionRunStatus string

const (
	ReconExecPending   ReconExecutionRunStatus = "PENDING"
	ReconExecRunning   ReconExecutionRunStatus = "RUNNING"
	ReconExecCompleted ReconExecutionRunStatus = "COMPLETED"
	ReconExecFailed    ReconExecutionRunStatus = "FAILED"
)

// ReconExecutionRun represents a single execution of a ruleset against parallel run results.
type ReconExecutionRun struct {
	ExecutionID    string                  `json:"execution_id"`
	EngagementID   string                  `json:"engagement_id"`
	RulesetID      string                  `json:"ruleset_id"`
	ParallelRunID  string                  `json:"parallel_run_id"`
	Status         ReconExecutionRunStatus `json:"status"`
	TotalEvaluated int                     `json:"total_evaluated"`
	MatchCount     int                     `json:"match_count"`
	MismatchCount  int                     `json:"mismatch_count"`
	P1Count        int                     `json:"p1_count"`
	P2Count        int                     `json:"p2_count"`
	P3Count        int                     `json:"p3_count"`
	StartedAt      *time.Time              `json:"started_at,omitempty"`
	CompletedAt    *time.Time              `json:"completed_at,omitempty"`
	ErrorMessage   *string                 `json:"error_message,omitempty"`
	CreatedAt      time.Time               `json:"created_at"`
}

// ReconExecutionMismatch represents a single mismatch detected during execution.
type ReconExecutionMismatch struct {
	MismatchID      string              `json:"mismatch_id"`
	ExecutionID     string              `json:"execution_id"`
	RuleID          string              `json:"rule_id"`
	MemberID        string              `json:"member_id"`
	CanonicalEntity string              `json:"canonical_entity"`
	FieldName       string              `json:"field_name"`
	LegacyValue     *string             `json:"legacy_value"`
	NewValue        *string             `json:"new_value"`
	VarianceAmount  *string             `json:"variance_amount"`
	ComparisonType  ReconComparisonType `json:"comparison_type"`
	ToleranceValue  *string             `json:"tolerance_value"`
	Priority        ReconPriority       `json:"priority"`
	CreatedAt       time.Time           `json:"created_at"`
}

// CreateReconExecutionRequest is the JSON body for triggering a new recon execution.
type CreateReconExecutionRequest struct {
	ParallelRunID string  `json:"parallel_run_id"`
	RulesetID     *string `json:"ruleset_id,omitempty"`
}

// ReconExecutionSummary provides aggregate metrics for the most recent execution.
type ReconExecutionSummary struct {
	TotalEvaluated int     `json:"total_evaluated"`
	MatchCount     int     `json:"match_count"`
	MismatchCount  int     `json:"mismatch_count"`
	P1Count        int     `json:"p1_count"`
	P2Count        int     `json:"p2_count"`
	P3Count        int     `json:"p3_count"`
	MatchRatio     float64 `json:"match_ratio"`
}

// ---------------------------------------------------------------------------
// Drift Monitoring (M05b)
// ---------------------------------------------------------------------------

// DriftSchedule represents a scheduled drift detection configuration for an engagement.
type DriftSchedule struct {
	ScheduleID      string     `json:"schedule_id"`
	EngagementID    string     `json:"engagement_id"`
	IntervalHours   int        `json:"interval_hours"`
	Enabled         bool       `json:"enabled"`
	LastTriggeredAt *time.Time `json:"last_triggered_at,omitempty"`
	NextTriggerAt   *time.Time `json:"next_trigger_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// CreateDriftScheduleRequest is the JSON body for creating/updating a drift schedule.
type CreateDriftScheduleRequest struct {
	IntervalHours int  `json:"interval_hours"`
	Enabled       bool `json:"enabled"`
}

// UpdateDriftScheduleRequest is the JSON body for patching a drift schedule.
type UpdateDriftScheduleRequest struct {
	IntervalHours *int  `json:"interval_hours,omitempty"`
	Enabled       *bool `json:"enabled,omitempty"`
}

// DriftStatus represents the aggregate drift state for an engagement.
type DriftStatus string

const (
	DriftStatusClean    DriftStatus = "CLEAN"
	DriftStatusDrifted  DriftStatus = "DRIFTED"
	DriftStatusCritical DriftStatus = "CRITICAL"
)

// DriftSummary provides aggregate drift metrics for an engagement.
type DriftSummary struct {
	LastRunAt       *time.Time     `json:"last_run_at,omitempty"`
	LastRunID       *string        `json:"last_run_id,omitempty"`
	TotalRuns       int            `json:"total_runs"`
	DriftStatus     DriftStatus    `json:"drift_status"`
	BySeverity      map[string]int `json:"by_severity"`
	ScheduleEnabled bool           `json:"schedule_enabled"`
	NextScheduledAt *time.Time     `json:"next_scheduled_at,omitempty"`
}

// ---------------------------------------------------------------------------
// Source Relationships — L3 Profiling (M10a)
// ---------------------------------------------------------------------------

// RelationshipType categorizes how a relationship was discovered.
type RelationshipType string

const (
	RelationshipFKDeclared RelationshipType = "FK_DECLARED"
	RelationshipFKInferred RelationshipType = "FK_INFERRED"
)

// SourceRelationship represents a cross-table referential relationship
// discovered during L3 profiling. May be declared (via information_schema FK)
// or inferred (by column-name heuristics).
type SourceRelationship struct {
	RelationshipID   string           `json:"relationship_id"`
	ProfilingRunID   string           `json:"profiling_run_id"`
	ParentTable      string           `json:"parent_table"` // schema.table
	ParentColumn     string           `json:"parent_column"`
	ChildTable       string           `json:"child_table"` // schema.table
	ChildColumn      string           `json:"child_column"`
	RelationshipType RelationshipType `json:"relationship_type"`
	Confidence       float64          `json:"confidence"` // 0.0–1.0
	OrphanCount      int              `json:"orphan_count"`
	OrphanPct        float64          `json:"orphan_pct"`
	CreatedAt        time.Time        `json:"created_at"`
}

// OrphanSummary provides aggregate orphan metrics for a profiling run.
type OrphanSummary struct {
	TotalRelationships  int     `json:"total_relationships"`
	OrphanRelationships int     `json:"orphan_relationships"`
	TotalOrphanRows     int     `json:"total_orphan_rows"`
	HighestOrphanPct    float64 `json:"highest_orphan_pct"`
}

// ---------------------------------------------------------------------------
// Phase Gate Evaluation (M11a)
// ---------------------------------------------------------------------------

// GateMetricResult holds the evaluation result for a single gate metric.
type GateMetricResult struct {
	Name         string  `json:"name"`
	CurrentValue float64 `json:"current_value"`
	Threshold    float64 `json:"threshold"`
	Passed       bool    `json:"passed"`
	Description  string  `json:"description"`
}

// GateEvaluationResult holds the complete gate evaluation result for a phase transition.
type GateEvaluationResult struct {
	Passed           bool                        `json:"passed"`
	Metrics          map[string]GateMetricResult `json:"metrics"`
	BlockingFailures []string                    `json:"blocking_failures"`
}

// GateMetricDefinition defines a gate metric's threshold and comparison logic.
// These are hardcoded constants — not configurable per engagement.
type GateMetricDefinition struct {
	Name        string
	Description string
	Threshold   float64
	// GreaterOrEqual: true means current >= threshold to pass,
	// false means current <= threshold to pass (e.g., p1_count must be 0).
	GreaterOrEqual bool
}
