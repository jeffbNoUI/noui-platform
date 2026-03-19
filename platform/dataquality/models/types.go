// Data Quality Models — Entity types and API request/response structures.
//
// Conventions (same as CRM service):
//   - Timestamps as time.Time (JSON marshals to RFC 3339)
//   - UUID fields as strings
//   - Pointer fields use omitempty
//   - camelCase JSON tags throughout
package models

import "time"

// ============================================================
// CORE ENTITIES
// ============================================================

// DQCheckDefinition represents a configurable data quality check.
type DQCheckDefinition struct {
	CheckID     string    `json:"checkId"`
	TenantID    string    `json:"tenantId"`
	CheckName   string    `json:"checkName"`
	CheckCode   string    `json:"checkCode"`
	Description *string   `json:"description,omitempty"`
	Category    string    `json:"category"` // completeness, consistency, validity
	Severity    string    `json:"severity"` // critical, warning, info
	TargetTable string    `json:"targetTable"`
	CheckQuery  *string   `json:"checkQuery,omitempty"`
	Threshold   *float64  `json:"threshold,omitempty"`
	IsActive    bool      `json:"isActive"`
	Schedule    string    `json:"schedule"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	CreatedBy   string    `json:"createdBy"`
	UpdatedBy   string    `json:"updatedBy"`

	// Included in detail responses
	LatestResult *DQCheckResult `json:"latestResult,omitempty"`
}

// DQCheckResult represents a single check run result.
type DQCheckResult struct {
	ResultID       string    `json:"resultId"`
	CheckID        string    `json:"checkId"`
	TenantID       string    `json:"tenantId"`
	RunAt          time.Time `json:"runAt"`
	RecordsChecked int       `json:"recordsChecked"`
	RecordsPassed  int       `json:"recordsPassed"`
	RecordsFailed  int       `json:"recordsFailed"`
	PassRate       float64   `json:"passRate"`
	Status         string    `json:"status"` // completed, failed, skipped
	DurationMs     *int      `json:"durationMs,omitempty"`
	ErrorMessage   *string   `json:"errorMessage,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
}

// DQIssue represents a detected data quality issue.
type DQIssue struct {
	IssueID         string     `json:"issueId"`
	ResultID        string     `json:"resultId"`
	CheckID         string     `json:"checkId"`
	TenantID        string     `json:"tenantId"`
	Severity        string     `json:"severity"`
	RecordTable     string     `json:"recordTable"`
	RecordID        string     `json:"recordId"`
	FieldName       *string    `json:"fieldName,omitempty"`
	CurrentValue    *string    `json:"currentValue,omitempty"`
	ExpectedPattern *string    `json:"expectedPattern,omitempty"`
	Description     string     `json:"description"`
	Status          string     `json:"status"` // open, acknowledged, resolved, false_positive
	ResolvedAt      *time.Time `json:"resolvedAt,omitempty"`
	ResolvedBy      *string    `json:"resolvedBy,omitempty"`
	ResolutionNote  *string    `json:"resolutionNote,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

// DQScore represents the aggregate data quality score.
type DQScore struct {
	OverallScore   float64            `json:"overallScore"`
	TotalChecks    int                `json:"totalChecks"`
	PassingChecks  int                `json:"passingChecks"`
	OpenIssues     int                `json:"openIssues"`
	CriticalIssues int                `json:"criticalIssues"`
	CategoryScores map[string]float64 `json:"categoryScores"`
	LastRunAt      *time.Time         `json:"lastRunAt,omitempty"`
}

// DQScoreTrend represents a point in the score trend over time.
type DQScoreTrend struct {
	Date  string  `json:"date"`
	Score float64 `json:"score"`
}

// ============================================================
// API REQUEST TYPES
// ============================================================

// EmployerDQSummary provides a DQ score scoped to employer domain tables.
type EmployerDQSummary struct {
	OrgID          string  `json:"orgId"`
	OverallScore   float64 `json:"overallScore"`
	TotalChecks    int     `json:"totalChecks"`
	PassingChecks  int     `json:"passingChecks"`
	OpenIssues     int     `json:"openIssues"`
	CriticalIssues int     `json:"criticalIssues"`
}

// Employer DQ check categories for employer-domain-specific quality checks.
const (
	EmpCheckContributionAmount   = "CONTRIBUTION_AMOUNT"
	EmpCheckEnrollmentTimeliness = "ENROLLMENT_TIMELINESS"
	EmpCheckReportingCompliance  = "REPORTING_COMPLIANCE"
	EmpCheckTerminationComplete  = "TERMINATION_COMPLETENESS"
)

// EmployerTargetTables lists the DB tables that belong to the employer domain.
var EmployerTargetTables = []string{
	"contribution_file", "contribution_record", "contribution_exception",
	"enrollment_submission", "termination_certification", "certification_hold",
}

// UpdateIssueRequest contains the mutable fields for updating a DQ issue.
type UpdateIssueRequest struct {
	Status         *string `json:"status,omitempty"`
	ResolutionNote *string `json:"resolutionNote,omitempty"`
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

// APIMeta contains per-request metadata returned with every API response.
type APIMeta struct {
	RequestID string    `json:"request_id"`
	Timestamp time.Time `json:"timestamp"`
	Service   string    `json:"service"`
	Version   string    `json:"version"`
}

// Pagination contains offset-based pagination metadata.
type Pagination struct {
	Total   int  `json:"total"`
	Limit   int  `json:"limit"`
	Offset  int  `json:"offset"`
	HasMore bool `json:"hasMore"`
}
