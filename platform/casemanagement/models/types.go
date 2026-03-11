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
