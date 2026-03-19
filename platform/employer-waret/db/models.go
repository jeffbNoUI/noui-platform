package db

import "time"

// WaretDesignation represents an employer's request to employ a retiree.
type WaretDesignation struct {
	ID        string  `json:"id"`
	OrgID     string  `json:"orgId"`
	RetireeID *string `json:"retireeId"`
	SSNHash   string  `json:"ssnHash"`
	FirstName string  `json:"firstName"`
	LastName  string  `json:"lastName"`

	// Designation details
	DesignationType  string  `json:"designationType"`
	CalendarYear     int     `json:"calendarYear"`
	DayLimit         *int    `json:"dayLimit"`
	HourLimit        *int    `json:"hourLimit"`
	ConsecutiveYears int     `json:"consecutiveYears"`
	DistrictID       *string `json:"districtId"`
	ORPExempt        bool    `json:"orpExempt"`

	// Status
	DesignationStatus string `json:"designationStatus"`

	// PERACare conflict
	PERACareConflict    bool       `json:"peracareConflict"`
	PERACarLetterSentAt *time.Time `json:"peracareLetterSentAt"`
	PERACareResponseDue *time.Time `json:"peracareResponseDue"`
	PERACareResolved    bool       `json:"peracareResolved"`

	// Approval/Revocation
	ApprovedBy       *string    `json:"approvedBy"`
	ApprovedAt       *time.Time `json:"approvedAt"`
	RevokedBy        *string    `json:"revokedBy"`
	RevokedAt        *time.Time `json:"revokedAt"`
	RevocationReason *string    `json:"revocationReason"`
	Notes            *string    `json:"notes"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// WaretTracking represents a daily work record for a retiree under WARET.
type WaretTracking struct {
	ID            string  `json:"id"`
	DesignationID string  `json:"designationId"`
	OrgID         string  `json:"orgId"`
	RetireeID     *string `json:"retireeId"`

	WorkDate    string `json:"workDate"`
	HoursWorked string `json:"hoursWorked"` // NUMERIC as string
	CountsAsDay bool   `json:"countsAsDay"`

	YTDDays  int    `json:"ytdDays"`
	YTDHours string `json:"ytdHours"` // NUMERIC as string

	EntryStatus string     `json:"entryStatus"`
	SubmittedBy string     `json:"submittedBy"`
	VerifiedBy  *string    `json:"verifiedBy"`
	VerifiedAt  *time.Time `json:"verifiedAt"`
	Notes       *string    `json:"notes"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// WaretYTDSummary is the view row for a designation's year-to-date totals.
type WaretYTDSummary struct {
	DesignationID   string  `json:"designationId"`
	OrgID           string  `json:"orgId"`
	RetireeID       *string `json:"retireeId"`
	SSNHash         string  `json:"ssnHash"`
	CalendarYear    int     `json:"calendarYear"`
	DesignationType string  `json:"designationType"`
	DayLimit        *int    `json:"dayLimit"`
	HourLimit       *int    `json:"hourLimit"`
	ORPExempt       bool    `json:"orpExempt"`
	TotalDays       int     `json:"totalDays"`
	TotalHours      string  `json:"totalHours"` // NUMERIC as string
	DaysRemaining   *int    `json:"daysRemaining"`
	HoursRemaining  *string `json:"hoursRemaining"`
	OverLimit       bool    `json:"overLimit"`
}

// WaretPenalty represents a penalty assessed when a retiree exceeds WARET limits.
type WaretPenalty struct {
	ID            string  `json:"id"`
	DesignationID string  `json:"designationId"`
	RetireeID     *string `json:"retireeId"`
	SSNHash       string  `json:"ssnHash"`

	PenaltyType      string `json:"penaltyType"`
	PenaltyMonth     string `json:"penaltyMonth"` // YYYY-MM-DD (first of month)
	MonthlyBenefit   string `json:"monthlyBenefit"`
	DaysOverLimit    int    `json:"daysOverLimit"`
	PenaltyRate      string `json:"penaltyRate"`
	PenaltyAmount    string `json:"penaltyAmount"`
	EmployerRecovery string `json:"employerRecovery"`
	RetireeRecovery  string `json:"retireeRecovery"`

	SpreadMonths     int    `json:"spreadMonths"`
	MonthlyDeduction string `json:"monthlyDeduction"`

	PenaltyStatus string     `json:"penaltyStatus"`
	AssessedBy    *string    `json:"assessedBy"`
	AssessedAt    time.Time  `json:"assessedAt"`
	AppealedAt    *time.Time `json:"appealedAt"`
	AppealNote    *string    `json:"appealNote"`
	WaivedBy      *string    `json:"waivedBy"`
	WaivedAt      *time.Time `json:"waivedAt"`
	WaiverReason  *string    `json:"waiverReason"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// WaretICDisclosure represents an independent contractor work disclosure.
type WaretICDisclosure struct {
	ID        string  `json:"id"`
	RetireeID *string `json:"retireeId"`
	SSNHash   string  `json:"ssnHash"`
	OrgID     string  `json:"orgId"`

	CalendarYear          int     `json:"calendarYear"`
	ICStartDate           string  `json:"icStartDate"`
	ICEndDate             *string `json:"icEndDate"`
	ICDescription         string  `json:"icDescription"`
	EstimatedHours        *string `json:"estimatedHours"`
	EstimatedCompensation *string `json:"estimatedCompensation"`

	DisclosureStatus string     `json:"disclosureStatus"`
	SubmittedAt      time.Time  `json:"submittedAt"`
	ReviewedBy       *string    `json:"reviewedBy"`
	ReviewedAt       *time.Time `json:"reviewedAt"`
	ReviewNote       *string    `json:"reviewNote"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// --- Request types ---

// CreateDesignationRequest is the JSON body for submitting a WARET designation.
type CreateDesignationRequest struct {
	OrgID           string  `json:"orgId"`
	SSNHash         string  `json:"ssnHash"`
	FirstName       string  `json:"firstName"`
	LastName        string  `json:"lastName"`
	DesignationType string  `json:"designationType"`
	CalendarYear    int     `json:"calendarYear"`
	DistrictID      *string `json:"districtId"`
	ORPExempt       bool    `json:"orpExempt"`
	RetireeID       *string `json:"retireeId"`
	Notes           *string `json:"notes"`
}

// RecordTrackingRequest is the JSON body for recording a work entry.
type RecordTrackingRequest struct {
	DesignationID string  `json:"designationId"`
	OrgID         string  `json:"orgId"`
	WorkDate      string  `json:"workDate"`
	HoursWorked   string  `json:"hoursWorked"`
	RetireeID     *string `json:"retireeId"`
	Notes         *string `json:"notes"`
}

// AssessPenaltyRequest is the JSON body for assessing a penalty.
type AssessPenaltyRequest struct {
	DesignationID  string  `json:"designationId"`
	SSNHash        string  `json:"ssnHash"`
	PenaltyType    string  `json:"penaltyType"`
	PenaltyMonth   string  `json:"penaltyMonth"`
	MonthlyBenefit string  `json:"monthlyBenefit"`
	DaysOverLimit  int     `json:"daysOverLimit"`
	SpreadMonths   int     `json:"spreadMonths"`
	RetireeID      *string `json:"retireeId"`
}

// CreateICDisclosureRequest is the JSON body for submitting an IC disclosure.
type CreateICDisclosureRequest struct {
	SSNHash               string  `json:"ssnHash"`
	OrgID                 string  `json:"orgId"`
	CalendarYear          int     `json:"calendarYear"`
	ICStartDate           string  `json:"icStartDate"`
	ICEndDate             *string `json:"icEndDate"`
	ICDescription         string  `json:"icDescription"`
	EstimatedHours        *string `json:"estimatedHours"`
	EstimatedCompensation *string `json:"estimatedCompensation"`
	RetireeID             *string `json:"retireeId"`
}
