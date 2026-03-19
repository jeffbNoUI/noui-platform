package db

import "time"

// SCPCostFactor represents an actuarial cost factor for service credit purchase.
type SCPCostFactor struct {
	ID             string    `json:"id"`
	Tier           string    `json:"tier"`
	HireDateFrom   string    `json:"hireDateFrom"`
	HireDateTo     string    `json:"hireDateTo"`
	AgeAtPurchase  int       `json:"ageAtPurchase"`
	EffectiveDate  string    `json:"effectiveDate"`
	ExpiryDate     *string   `json:"expiryDate"`
	CostFactor     string    `json:"costFactor"`
	SourceDocument *string   `json:"sourceDocument"`
	Notes          *string   `json:"notes"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// SCPRequest represents a service credit purchase request.
type SCPRequest struct {
	ID        string  `json:"id"`
	OrgID     string  `json:"orgId"`
	MemberID  *string `json:"memberId"`
	SSNHash   string  `json:"ssnHash"`
	FirstName string  `json:"firstName"`
	LastName  string  `json:"lastName"`

	// Service type
	ServiceType string `json:"serviceType"`

	// Purchase details
	Tier                   string  `json:"tier"`
	YearsRequested         string  `json:"yearsRequested"`
	CostFactorID           *string `json:"costFactorId"`
	CostFactor             *string `json:"costFactor"`
	AnnualSalaryAtPurchase *string `json:"annualSalaryAtPurchase"`
	TotalCost              *string `json:"totalCost"`

	// Payment
	PaymentMethod   *string `json:"paymentMethod"`
	AmountPaid      string  `json:"amountPaid"`
	AmountRemaining string  `json:"amountRemaining"`

	// Quote
	QuoteDate         *string `json:"quoteDate"`
	QuoteExpires      *string `json:"quoteExpires"`
	QuoteRecalculated bool    `json:"quoteRecalculated"`

	// Documentation
	DocumentationReceived bool       `json:"documentationReceived"`
	DocumentationVerified bool       `json:"documentationVerified"`
	VerifiedBy            *string    `json:"verifiedBy"`
	VerifiedAt            *time.Time `json:"verifiedAt"`

	// CRITICAL: Exclusion flags — immutable after creation
	ExcludesFromRuleOf7585 bool `json:"excludesFromRuleOf7585"`
	ExcludesFromIPR        bool `json:"excludesFromIpr"`
	ExcludesFromVesting    bool `json:"excludesFromVesting"`

	// Status
	RequestStatus string `json:"requestStatus"`

	// Submission/Review/Approval
	SubmittedBy  *string    `json:"submittedBy"`
	SubmittedAt  *time.Time `json:"submittedAt"`
	ReviewedBy   *string    `json:"reviewedBy"`
	ReviewedAt   *time.Time `json:"reviewedAt"`
	ReviewNote   *string    `json:"reviewNote"`
	ApprovedBy   *string    `json:"approvedBy"`
	ApprovedAt   *time.Time `json:"approvedAt"`
	DeniedBy     *string    `json:"deniedBy"`
	DeniedAt     *time.Time `json:"deniedAt"`
	DenialReason *string    `json:"denialReason"`
	Notes        *string    `json:"notes"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// --- Request types ---

// CreateSCPRequestInput is the JSON body for creating a purchase request.
type CreateSCPRequestInput struct {
	OrgID          string  `json:"orgId"`
	SSNHash        string  `json:"ssnHash"`
	FirstName      string  `json:"firstName"`
	LastName       string  `json:"lastName"`
	ServiceType    string  `json:"serviceType"`
	Tier           string  `json:"tier"`
	YearsRequested string  `json:"yearsRequested"`
	MemberID       *string `json:"memberId"`
	Notes          *string `json:"notes"`
}

// CostQuoteInput is the JSON body for generating a cost quote.
type CostQuoteInput struct {
	Tier           string `json:"tier"`
	HireDate       string `json:"hireDate"`
	AgeAtPurchase  int    `json:"ageAtPurchase"`
	AnnualSalary   string `json:"annualSalary"`
	YearsRequested string `json:"yearsRequested"`
}

// PaymentInput is the JSON body for recording a payment.
type PaymentInput struct {
	Amount        string `json:"amount"`
	PaymentMethod string `json:"paymentMethod"`
}
