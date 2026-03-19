package db

import "time"

// TerminationCertification represents an employer-submitted termination record.
type TerminationCertification struct {
	ID        string  `json:"id"`
	OrgID     string  `json:"orgId"`
	MemberID  *string `json:"memberId"`
	SSNHash   string  `json:"ssnHash"`
	FirstName string  `json:"firstName"`
	LastName  string  `json:"lastName"`

	// Termination details
	LastDayWorked         string  `json:"lastDayWorked"`
	TerminationReason     string  `json:"terminationReason"`
	FinalContributionDate *string `json:"finalContributionDate"`
	FinalSalaryAmount     *string `json:"finalSalaryAmount"`

	// Status
	CertificationStatus string     `json:"certificationStatus"`
	SubmittedBy         string     `json:"submittedBy"`
	VerifiedBy          *string    `json:"verifiedBy"`
	VerifiedAt          *time.Time `json:"verifiedAt"`
	RejectedBy          *string    `json:"rejectedBy"`
	RejectedAt          *time.Time `json:"rejectedAt"`
	RejectionReason     *string    `json:"rejectionReason"`
	Notes               *string    `json:"notes"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// CertificationHold represents a hold on a refund pending employer certification.
type CertificationHold struct {
	ID                  string  `json:"id"`
	RefundApplicationID string  `json:"refundApplicationId"`
	OrgID               string  `json:"orgId"`
	MemberID            *string `json:"memberId"`
	SSNHash             string  `json:"ssnHash"`

	// Hold lifecycle
	HoldStatus    string    `json:"holdStatus"`
	HoldReason    string    `json:"holdReason"`
	CountdownDays int       `json:"countdownDays"`
	ExpiresAt     time.Time `json:"expiresAt"`

	ReminderSentAt *time.Time `json:"reminderSentAt"`
	EscalatedAt    *time.Time `json:"escalatedAt"`

	// Resolution
	ResolvedBy      *string    `json:"resolvedBy"`
	ResolvedAt      *time.Time `json:"resolvedAt"`
	ResolutionNote  *string    `json:"resolutionNote"`
	CertificationID *string    `json:"certificationId"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// RefundApplication represents a member's request for contribution refund.
type RefundApplication struct {
	ID        string  `json:"id"`
	MemberID  *string `json:"memberId"`
	SSNHash   string  `json:"ssnHash"`
	FirstName string  `json:"firstName"`
	LastName  string  `json:"lastName"`

	// Eligibility
	HireDate          string  `json:"hireDate"`
	TerminationDate   *string `json:"terminationDate"`
	SeparationDate    *string `json:"separationDate"`
	YearsOfService    *string `json:"yearsOfService"`
	IsVested          bool    `json:"isVested"`
	HasDisabilityApp  bool    `json:"hasDisabilityApp"`
	DisabilityAppDate *string `json:"disabilityAppDate"`

	// Refund calculation — string for NUMERIC precision
	EmployeeContributions string  `json:"employeeContributions"`
	InterestRate          *string `json:"interestRate"`
	InterestAmount        string  `json:"interestAmount"`
	GrossRefund           string  `json:"grossRefund"`
	FederalTaxWithholding string  `json:"federalTaxWithholding"`
	DRODeduction          string  `json:"droDeduction"`
	NetRefund             string  `json:"netRefund"`

	// Payment
	PaymentMethod       *string `json:"paymentMethod"`
	RolloverAmount      *string `json:"rolloverAmount"`
	DirectAmount        *string `json:"directAmount"`
	ACHRoutingNumber    *string `json:"achRoutingNumber"`
	ACHAccountNumber    *string `json:"achAccountNumber"`
	RolloverInstitution *string `json:"rolloverInstitution"`
	RolloverAccount     *string `json:"rolloverAccount"`

	// Status
	ApplicationStatus string `json:"applicationStatus"`

	// Forfeiture
	ForfeitureAcknowledged   bool       `json:"forfeitureAcknowledged"`
	ForfeitureAcknowledgedAt *time.Time `json:"forfeitureAcknowledgedAt"`

	// Signatures
	MemberSignature bool `json:"memberSignature"`
	Notarized       bool `json:"notarized"`
	W9Received      bool `json:"w9Received"`

	// Processing timestamps
	SubmittedAt          *time.Time `json:"submittedAt"`
	EligibilityCheckedAt *time.Time `json:"eligibilityCheckedAt"`
	CalculatedAt         *time.Time `json:"calculatedAt"`
	PaymentScheduledAt   *time.Time `json:"paymentScheduledAt"`
	PaymentLockedAt      *time.Time `json:"paymentLockedAt"`
	DisbursedAt          *time.Time `json:"disbursedAt"`
	DeniedAt             *time.Time `json:"deniedAt"`
	DenialReason         *string    `json:"denialReason"`
	ProcessedBy          *string    `json:"processedBy"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// --- Request types ---

// CreateCertificationRequest is the JSON body for submitting a termination certification.
type CreateCertificationRequest struct {
	OrgID                 string  `json:"orgId"`
	SSNHash               string  `json:"ssnHash"`
	FirstName             string  `json:"firstName"`
	LastName              string  `json:"lastName"`
	LastDayWorked         string  `json:"lastDayWorked"`
	TerminationReason     string  `json:"terminationReason"`
	FinalContributionDate *string `json:"finalContributionDate"`
	FinalSalaryAmount     *string `json:"finalSalaryAmount"`
	MemberID              *string `json:"memberId"`
	Notes                 *string `json:"notes"`
}

// CreateRefundRequest is the JSON body for creating a refund application.
type CreateRefundRequest struct {
	SSNHash               string  `json:"ssnHash"`
	FirstName             string  `json:"firstName"`
	LastName              string  `json:"lastName"`
	HireDate              string  `json:"hireDate"`
	MemberID              *string `json:"memberId"`
	TerminationDate       *string `json:"terminationDate"`
	SeparationDate        *string `json:"separationDate"`
	YearsOfService        *string `json:"yearsOfService"`
	IsVested              bool    `json:"isVested"`
	HasDisabilityApp      bool    `json:"hasDisabilityApp"`
	DisabilityAppDate     *string `json:"disabilityAppDate"`
	EmployeeContributions string  `json:"employeeContributions"`
}

// SetupPaymentRequest is the JSON body for configuring refund payment.
type SetupPaymentRequest struct {
	PaymentMethod       string  `json:"paymentMethod"`
	RolloverAmount      *string `json:"rolloverAmount"`
	DirectAmount        *string `json:"directAmount"`
	ACHRoutingNumber    *string `json:"achRoutingNumber"`
	ACHAccountNumber    *string `json:"achAccountNumber"`
	RolloverInstitution *string `json:"rolloverInstitution"`
	RolloverAccount     *string `json:"rolloverAccount"`
}

// ResolveHoldRequest is the JSON body for resolving a certification hold.
type ResolveHoldRequest struct {
	CertificationID string `json:"certificationId"`
	Note            string `json:"note"`
}
