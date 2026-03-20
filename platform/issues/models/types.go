package models

import "time"

// Issue is the main issue entity for the Issue Management service.
type Issue struct {
	ID              int        `json:"id"`
	IssueID         string     `json:"issueId"`
	TenantID        string     `json:"tenantId"`
	Title           string     `json:"title"`
	Description     string     `json:"description"`
	Severity        string     `json:"severity"`
	Category        string     `json:"category"`
	Status          string     `json:"status"`
	AffectedService string     `json:"affectedService"`
	ReportedBy      string     `json:"reportedBy"`
	AssignedTo      *string    `json:"assignedTo"`
	ReportedAt      time.Time  `json:"reportedAt"`
	ResolvedAt      *time.Time `json:"resolvedAt"`
	ResolutionNote  *string    `json:"resolutionNote"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

// IssueComment is a comment attached to an issue.
type IssueComment struct {
	ID        int       `json:"id"`
	IssueID   int       `json:"issueId"`
	Author    string    `json:"author"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

// IssueStats holds aggregated issue metrics.
type IssueStats struct {
	OpenCount     int     `json:"openCount"`
	CriticalCount int     `json:"criticalCount"`
	AvgResolution float64 `json:"avgResolution"`
	ResolvedCount int     `json:"resolvedCount"`
}

// IssueFilter holds query params for listing issues.
type IssueFilter struct {
	Status     string
	Severity   string
	Category   string
	AssignedTo string
	Limit      int
	Offset     int
}

// CreateIssueRequest is the JSON body for creating an issue.
type CreateIssueRequest struct {
	Title           string `json:"title"`
	Description     string `json:"description"`
	Severity        string `json:"severity"`
	Category        string `json:"category"`
	AffectedService string `json:"affectedService"`
	ReportedBy      string `json:"reportedBy"`
	AssignedTo      string `json:"assignedTo"`
}

// UpdateIssueRequest is the JSON body for updating an issue.
type UpdateIssueRequest struct {
	Title           *string `json:"title,omitempty"`
	Description     *string `json:"description,omitempty"`
	Severity        *string `json:"severity,omitempty"`
	Category        *string `json:"category,omitempty"`
	Status          *string `json:"status,omitempty"`
	AffectedService *string `json:"affectedService,omitempty"`
	AssignedTo      *string `json:"assignedTo,omitempty"`
	ResolutionNote  *string `json:"resolutionNote,omitempty"`
}

// CreateCommentRequest is the JSON body for creating a comment on an issue.
type CreateCommentRequest struct {
	Author  string `json:"author"`
	Content string `json:"content"`
}

// ErrorReport is the JSON body for the frontend error reporter.
type ErrorReport struct {
	RequestID      string `json:"requestId"`
	URL            string `json:"url"`
	HTTPStatus     int    `json:"httpStatus"`
	ErrorCode      string `json:"errorCode"`
	ErrorMessage   string `json:"errorMessage"`
	Portal         string `json:"portal"`
	Route          string `json:"route"`
	ComponentStack string `json:"componentStack,omitempty"`
}

// Severity enum values.
var SeverityValues = []string{"critical", "high", "medium", "low"}

// Category enum values.
var CategoryValues = []string{"defect", "incident", "enhancement", "question", "error-report"}

// Status enum values.
var StatusValues = []string{"open", "triaged", "in-work", "resolved", "closed"}
