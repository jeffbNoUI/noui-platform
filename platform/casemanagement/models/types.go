package models

import "time"

// StageDefinition represents one of the 7 workflow stages.
type StageDefinition struct {
	StageIdx    int    `json:"stageIdx"`
	StageName   string `json:"stageName"`
	Description string `json:"description,omitempty"`
	SortOrder   int    `json:"sortOrder"`
}

// RetirementCase is the main case entity, enriched with member info from JOINs.
type RetirementCase struct {
	CaseID          string    `json:"caseId"`
	TenantID        string    `json:"tenantId"`
	MemberID        int       `json:"memberId"`
	CaseType        string    `json:"caseType"`
	RetirementDate  string    `json:"retDate"`
	Priority        string    `json:"priority"`
	SLAStatus       string    `json:"sla"`
	CurrentStage    string    `json:"stage"`
	CurrentStageIdx int       `json:"stageIdx"`
	AssignedTo      string    `json:"assignedTo"`
	DaysOpen        int       `json:"daysOpen"`
	Status          string    `json:"status"`
	DROID           *int      `json:"droId,omitempty"`
	SLATargetDays   int       `json:"slaTargetDays"`
	SLADeadlineAt   time.Time `json:"slaDeadlineAt"`
	Flags           []string  `json:"flags"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`

	// Joined from member/employment tables
	Name string `json:"name"`
	Tier int    `json:"tier"`
	Dept string `json:"dept"`
}

// CaseFlag represents a flag attached to a case.
type CaseFlag struct {
	ID       int    `json:"id"`
	CaseID   string `json:"caseId"`
	FlagCode string `json:"flagCode"`
}

// StageTransition records a stage advancement.
type StageTransition struct {
	ID             int       `json:"id"`
	CaseID         string    `json:"caseId"`
	FromStageIdx   *int      `json:"fromStageIdx"`
	ToStageIdx     int       `json:"toStageIdx"`
	FromStage      *string   `json:"fromStage"`
	ToStage        string    `json:"toStage"`
	TransitionedBy string    `json:"transitionedBy"`
	Note           string    `json:"note,omitempty"`
	TransitionedAt time.Time `json:"transitionedAt"`
}

// CaseFilter holds query params for listing cases.
type CaseFilter struct {
	Status     string
	Priority   string
	AssignedTo string
	Stage      string // filter by current_stage
	MemberID   int
	Limit      int
	Offset     int
}

// CreateCaseRequest is the JSON body for creating a case.
type CreateCaseRequest struct {
	CaseID         string   `json:"caseId"`
	MemberID       int      `json:"memberId"`
	CaseType       string   `json:"caseType"`
	RetirementDate string   `json:"retirementDate"`
	Priority       string   `json:"priority"`
	AssignedTo     string   `json:"assignedTo"`
	DROID          *int     `json:"droId,omitempty"`
	Flags          []string `json:"flags"`
}

// UpdateCaseRequest is the JSON body for updating a case.
type UpdateCaseRequest struct {
	Priority   *string `json:"priority,omitempty"`
	SLAStatus  *string `json:"slaStatus,omitempty"`
	AssignedTo *string `json:"assignedTo,omitempty"`
	Status     *string `json:"status,omitempty"`
}

// AdvanceStageRequest is the JSON body for advancing to the next stage.
type AdvanceStageRequest struct {
	TransitionedBy string `json:"transitionedBy"`
	Note           string `json:"note,omitempty"`
}

// CaseNote is a note attached to a case.
type CaseNote struct {
	ID        int       `json:"id"`
	CaseID    string    `json:"caseId"`
	Author    string    `json:"author"`
	Content   string    `json:"content"`
	Category  string    `json:"category"`
	CreatedAt time.Time `json:"createdAt"`
}

// CreateNoteRequest is the JSON body for creating a case note.
type CreateNoteRequest struct {
	Author   string `json:"author"`
	Content  string `json:"content"`
	Category string `json:"category"`
}

// CaseDocument is document metadata attached to a case.
type CaseDocument struct {
	ID           int       `json:"id"`
	CaseID       string    `json:"caseId"`
	DocumentType string    `json:"documentType"`
	Filename     string    `json:"filename"`
	MimeType     string    `json:"mimeType"`
	SizeBytes    int       `json:"sizeBytes"`
	UploadedBy   string    `json:"uploadedBy"`
	UploadedAt   time.Time `json:"uploadedAt"`
}

// CreateDocumentRequest is the JSON body for recording document metadata.
type CreateDocumentRequest struct {
	DocumentType string `json:"documentType"`
	Filename     string `json:"filename"`
	MimeType     string `json:"mimeType"`
	SizeBytes    int    `json:"sizeBytes"`
	UploadedBy   string `json:"uploadedBy"`
}

// CaseDetail extends RetirementCase with note and document counts.
type CaseDetail struct {
	RetirementCase
	NoteCount     int `json:"noteCount"`
	DocumentCount int `json:"documentCount"`
}

// CaseStats holds aggregated case metrics for supervisor dashboards.
type CaseStats struct {
	TotalActive     int              `json:"totalActive"`
	CompletedMTD    int              `json:"completedMTD"`
	AtRiskCount     int              `json:"atRiskCount"`
	CaseloadByStage []StageCaseCount `json:"caseloadByStage"`
	CasesByStatus   []StatusCount    `json:"casesByStatus"`
	CasesByPriority []PriorityCount  `json:"casesByPriority"`
	CasesByAssignee []AssigneeStats  `json:"casesByAssignee"`
}

// StageCaseCount is a stage name with its active case count.
type StageCaseCount struct {
	Stage    string `json:"stage"`
	StageIdx int    `json:"stageIdx"`
	Count    int    `json:"count"`
}

// StatusCount is a status value with its case count.
type StatusCount struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

// PriorityCount is a priority value with its case count.
type PriorityCount struct {
	Priority string `json:"priority"`
	Count    int    `json:"count"`
}

// AssigneeStats is per-assignee case count and average days open.
type AssigneeStats struct {
	AssignedTo  string  `json:"assignedTo"`
	Count       int     `json:"count"`
	AvgDaysOpen float64 `json:"avgDaysOpen"`
}

// SLAStats holds SLA health metrics for active cases.
type SLAStats struct {
	OnTrack           int           `json:"onTrack"`
	AtRisk            int           `json:"atRisk"`
	Overdue           int           `json:"overdue"`
	AvgProcessingDays float64       `json:"avgProcessingDays"`
	Thresholds        SLAThresholds `json:"thresholds"`
}

// SLAThresholds shows the at-risk warning days per priority.
type SLAThresholds struct {
	Urgent   int `json:"urgent"`
	High     int `json:"high"`
	Standard int `json:"standard"`
}
