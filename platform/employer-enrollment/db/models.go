package db

import "time"

// EnrollmentSubmission represents a new member enrollment request.
type EnrollmentSubmission struct {
	ID               string `json:"id"`
	OrgID            string `json:"orgId"`
	SubmittedBy      string `json:"submittedBy"`
	EnrollmentType   string `json:"enrollmentType"`
	SubmissionStatus string `json:"submissionStatus"`

	// Member identity
	SSNHash     string `json:"ssnHash"`
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	DateOfBirth string `json:"dateOfBirth"`
	HireDate    string `json:"hireDate"`

	// Plan assignment
	PlanCode     string  `json:"planCode"`
	DivisionCode string  `json:"divisionCode"`
	Tier         *string `json:"tier"`

	// Optional fields
	MiddleName      *string `json:"middleName"`
	Suffix          *string `json:"suffix"`
	Gender          *string `json:"gender"`
	AddressLine1    *string `json:"addressLine1"`
	AddressLine2    *string `json:"addressLine2"`
	City            *string `json:"city"`
	State           *string `json:"state"`
	ZipCode         *string `json:"zipCode"`
	Email           *string `json:"email"`
	Phone           *string `json:"phone"`
	IsSafetyOfficer bool    `json:"isSafetyOfficer"`
	JobTitle        *string `json:"jobTitle"`
	AnnualSalary    *string `json:"annualSalary"`

	// Rehire
	IsRehire         bool    `json:"isRehire"`
	PriorMemberID    *string `json:"priorMemberId"`
	PriorRefundTaken *bool   `json:"priorRefundTaken"`

	// Conflict resolution
	ConflictStatus     *string    `json:"conflictStatus"`
	ConflictFields     *string    `json:"conflictFields"`
	ConflictResolvedBy *string    `json:"conflictResolvedBy"`
	ConflictResolvedAt *time.Time `json:"conflictResolvedAt"`

	// Validation
	ValidationErrors *string    `json:"validationErrors"`
	ValidatedAt      *time.Time `json:"validatedAt"`
	ApprovedBy       *string    `json:"approvedBy"`
	ApprovedAt       *time.Time `json:"approvedAt"`
	RejectedBy       *string    `json:"rejectedBy"`
	RejectedAt       *time.Time `json:"rejectedAt"`
	RejectionReason  *string    `json:"rejectionReason"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// DuplicateFlag represents a potential duplicate detection result.
type DuplicateFlag struct {
	ID                  string     `json:"id"`
	SubmissionID        string     `json:"submissionId"`
	MatchType           string     `json:"matchType"`
	MatchedMemberID     *string    `json:"matchedMemberId"`
	MatchedSubmissionID *string    `json:"matchedSubmissionId"`
	ConfidenceScore     string     `json:"confidenceScore"`
	MatchDetails        *string    `json:"matchDetails"`
	ResolutionStatus    string     `json:"resolutionStatus"`
	ResolvedBy          *string    `json:"resolvedBy"`
	ResolvedAt          *time.Time `json:"resolvedAt"`
	ResolutionNote      *string    `json:"resolutionNote"`
	CreatedAt           time.Time  `json:"createdAt"`
}

// PERAChoiceElection represents a PERAChoice DC election window.
type PERAChoiceElection struct {
	ID                 string     `json:"id"`
	SubmissionID       string     `json:"submissionId"`
	MemberID           *string    `json:"memberId"`
	HireDate           string     `json:"hireDate"`
	WindowOpens        string     `json:"windowOpens"`
	WindowCloses       string     `json:"windowCloses"`
	ElectionStatus     string     `json:"electionStatus"`
	ElectedAt          *time.Time `json:"electedAt"`
	ElectedPlan        *string    `json:"electedPlan"`
	NotificationSentAt *time.Time `json:"notificationSentAt"`
	DCTeamNotified     bool       `json:"dcTeamNotified"`
	ReminderSentAt     *time.Time `json:"reminderSentAt"`
	MemberAcknowledged bool       `json:"memberAcknowledged"`
	CreatedAt          time.Time  `json:"createdAt"`
	UpdatedAt          time.Time  `json:"updatedAt"`
}

// --- Request types ---

// CreateSubmissionRequest is the JSON body for creating an enrollment submission.
type CreateSubmissionRequest struct {
	OrgID            string  `json:"orgId"`
	EnrollmentType   string  `json:"enrollmentType"`
	SSNHash          string  `json:"ssnHash"`
	FirstName        string  `json:"firstName"`
	LastName         string  `json:"lastName"`
	DateOfBirth      string  `json:"dateOfBirth"`
	HireDate         string  `json:"hireDate"`
	PlanCode         string  `json:"planCode"`
	DivisionCode     string  `json:"divisionCode"`
	MiddleName       *string `json:"middleName"`
	Suffix           *string `json:"suffix"`
	Gender           *string `json:"gender"`
	AddressLine1     *string `json:"addressLine1"`
	AddressLine2     *string `json:"addressLine2"`
	City             *string `json:"city"`
	State            *string `json:"state"`
	ZipCode          *string `json:"zipCode"`
	Email            *string `json:"email"`
	Phone            *string `json:"phone"`
	IsSafetyOfficer  bool    `json:"isSafetyOfficer"`
	JobTitle         *string `json:"jobTitle"`
	AnnualSalary     *string `json:"annualSalary"`
	IsRehire         bool    `json:"isRehire"`
	PriorMemberID    *string `json:"priorMemberId"`
	PriorRefundTaken *bool   `json:"priorRefundTaken"`
}

// ResolveDuplicateRequest is the JSON body for resolving a duplicate flag.
type ResolveDuplicateRequest struct {
	Resolution string `json:"resolution"` // CONFIRMED_DUPLICATE | FALSE_POSITIVE
	Note       string `json:"note"`
}

// ElectPERAChoiceRequest is the JSON body for making a PERAChoice election.
type ElectPERAChoiceRequest struct {
	Plan string `json:"plan"` // DB | DC
}

// ApproveSubmissionRequest is the JSON body for approving a submission.
type ApproveSubmissionRequest struct {
	// Empty — approval is just a status change
}

// RejectSubmissionRequest is the JSON body for rejecting a submission.
type RejectSubmissionRequest struct {
	Reason string `json:"reason"`
}
