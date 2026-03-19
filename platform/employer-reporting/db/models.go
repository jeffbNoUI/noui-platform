package db

import "time"

// ContributionFile represents a payroll file submission.
type ContributionFile struct {
	ID                    string     `json:"id"`
	OrgID                 string     `json:"orgId"`
	UploadedBy            string     `json:"uploadedBy"`
	FileName              string     `json:"fileName"`
	FileType              string     `json:"fileType"`
	FileStatus            string     `json:"fileStatus"`
	PeriodStart           string     `json:"periodStart"`
	PeriodEnd             string     `json:"periodEnd"`
	DivisionCode          string     `json:"divisionCode"`
	TotalRecords          int        `json:"totalRecords"`
	ValidRecords          int        `json:"validRecords"`
	FailedRecords         int        `json:"failedRecords"`
	TotalAmount           string     `json:"totalAmount"`
	ValidatedAmount       string     `json:"validatedAmount"`
	ReplacesFileID        *string    `json:"replacesFileId"`
	ValidationStartedAt   *time.Time `json:"validationStartedAt"`
	ValidationCompletedAt *time.Time `json:"validationCompletedAt"`
	CreatedAt             time.Time  `json:"createdAt"`
	UpdatedAt             time.Time  `json:"updatedAt"`
}

// ContributionRecord represents a single contribution line item.
type ContributionRecord struct {
	ID                   string    `json:"id"`
	FileID               string    `json:"fileId"`
	RowNumber            int       `json:"rowNumber"`
	SSNHash              string    `json:"ssnHash"`
	MemberName           *string   `json:"memberName"`
	MemberID             *string   `json:"memberId"`
	DivisionCode         string    `json:"divisionCode"`
	IsSafetyOfficer      bool      `json:"isSafetyOfficer"`
	IsORP                bool      `json:"isOrp"`
	GrossSalary          string    `json:"grossSalary"`
	MemberContribution   string    `json:"memberContribution"`
	EmployerContribution string    `json:"employerContribution"`
	AEDAmount            string    `json:"aedAmount"`
	SAEDAmount           string    `json:"saedAmount"`
	AAPAmount            string    `json:"aapAmount"`
	DCSupplementAmount   string    `json:"dcSupplementAmount"`
	TotalAmount          string    `json:"totalAmount"`
	RecordStatus         string    `json:"recordStatus"`
	ValidationErrors     *string   `json:"validationErrors"`
	CreatedAt            time.Time `json:"createdAt"`
}

// ContributionException represents a validation failure requiring resolution.
type ContributionException struct {
	ID              string     `json:"id"`
	FileID          string     `json:"fileId"`
	RecordID        *string    `json:"recordId"`
	OrgID           string     `json:"orgId"`
	ExceptionType   string     `json:"exceptionType"`
	ExceptionStatus string     `json:"exceptionStatus"`
	Description     string     `json:"description"`
	ExpectedValue   *string    `json:"expectedValue"`
	SubmittedValue  *string    `json:"submittedValue"`
	AssignedTo      *string    `json:"assignedTo"`
	ResolutionNote  *string    `json:"resolutionNote"`
	ResolvedBy      *string    `json:"resolvedBy"`
	ResolvedAt      *time.Time `json:"resolvedAt"`
	EscalatedAt     *time.Time `json:"escalatedAt"`
	DCRoutedAt      *time.Time `json:"dcRoutedAt"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

// ContributionPayment represents a payment for a contribution file.
type ContributionPayment struct {
	ID                string    `json:"id"`
	FileID            string    `json:"fileId"`
	OrgID             string    `json:"orgId"`
	PaymentMethod     string    `json:"paymentMethod"`
	PaymentStatus     string    `json:"paymentStatus"`
	Amount            string    `json:"amount"`
	ScheduledDate     *string   `json:"scheduledDate"`
	ProcessedDate     *string   `json:"processedDate"`
	ReferenceNumber   *string   `json:"referenceNumber"`
	DiscrepancyAmount *string   `json:"discrepancyAmount"`
	CreatedBy         *string   `json:"createdBy"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

// LateInterestAccrual represents late interest charged on a contribution.
type LateInterestAccrual struct {
	ID                   string    `json:"id"`
	OrgID                string    `json:"orgId"`
	FileID               *string   `json:"fileId"`
	PeriodStart          string    `json:"periodStart"`
	PeriodEnd            string    `json:"periodEnd"`
	DaysLate             int       `json:"daysLate"`
	BaseAmount           string    `json:"baseAmount"`
	InterestRate         string    `json:"interestRate"`
	InterestAmount       string    `json:"interestAmount"`
	MinimumChargeApplied bool      `json:"minimumChargeApplied"`
	PaymentID            *string   `json:"paymentId"`
	CreatedAt            time.Time `json:"createdAt"`
}

// --- Request types ---

// UploadFileRequest is used for manual entry submissions.
type UploadFileRequest struct {
	OrgID        string `json:"orgId"`
	PeriodStart  string `json:"periodStart"`
	PeriodEnd    string `json:"periodEnd"`
	DivisionCode string `json:"divisionCode"`
}

// ManualEntryRequest contains rows submitted via the manual grid.
type ManualEntryRequest struct {
	OrgID        string              `json:"orgId"`
	PeriodStart  string              `json:"periodStart"`
	PeriodEnd    string              `json:"periodEnd"`
	DivisionCode string              `json:"divisionCode"`
	Records      []ManualEntryRecord `json:"records"`
}

// ManualEntryRecord is a single row from the manual entry grid.
type ManualEntryRecord struct {
	SSNHash              string `json:"ssnHash"`
	MemberName           string `json:"memberName"`
	IsSafetyOfficer      bool   `json:"isSafetyOfficer"`
	IsORP                bool   `json:"isOrp"`
	GrossSalary          string `json:"grossSalary"`
	MemberContribution   string `json:"memberContribution"`
	EmployerContribution string `json:"employerContribution"`
	AEDAmount            string `json:"aedAmount"`
	SAEDAmount           string `json:"saedAmount"`
	AAPAmount            string `json:"aapAmount"`
	DCSupplementAmount   string `json:"dcSupplementAmount"`
}

// ResolveExceptionRequest is the JSON body for resolving an exception.
type ResolveExceptionRequest struct {
	Note string `json:"note"`
}

// SetupPaymentRequest is the JSON body for configuring payment.
type SetupPaymentRequest struct {
	Method string `json:"method"`
}

// CorrectionRequest is the JSON body for submitting a correction file.
type CorrectionRequest struct {
	OrgID          string `json:"orgId"`
	OriginalFileID string `json:"originalFileId"`
	PeriodStart    string `json:"periodStart"`
	PeriodEnd      string `json:"periodEnd"`
	DivisionCode   string `json:"divisionCode"`
}
