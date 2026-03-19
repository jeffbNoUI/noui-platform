// Package employershared provides shared types, constants, and division
// configuration used by all employer-domain services.
package employershared

import "time"

// ---------------------------------------------------------------------------
// Portal Roles (Spec Section 1: Role Model)
// ---------------------------------------------------------------------------

// PortalRole represents an employer portal user role.
type PortalRole string

const (
	RoleSuperUser      PortalRole = "SUPER_USER"
	RolePayrollContact PortalRole = "PAYROLL_CONTACT"
	RoleHRContact      PortalRole = "HR_CONTACT"
	RoleReadOnly       PortalRole = "READ_ONLY"
)

// ---------------------------------------------------------------------------
// Contribution Categories (Spec Section 2)
// ---------------------------------------------------------------------------

// ContributionCategory identifies a contribution line item.
type ContributionCategory string

const (
	CategoryEmployee       ContributionCategory = "EMPLOYEE"
	CategoryEmployerNormal ContributionCategory = "EMPLOYER_NORMAL"
	CategoryAED            ContributionCategory = "AED"
	CategorySAED           ContributionCategory = "SAED"
	CategoryWARET          ContributionCategory = "WARET"
	CategoryWARRC          ContributionCategory = "WARRC"
	CategoryORP            ContributionCategory = "ORP"
)

// ---------------------------------------------------------------------------
// Plan Types
// ---------------------------------------------------------------------------

// PlanType identifies the retirement plan structure.
type PlanType string

const (
	PlanDB  PlanType = "DB"
	PlanDC  PlanType = "DC"
	PlanORP PlanType = "ORP"
)

// ---------------------------------------------------------------------------
// Benefit Tiers
// ---------------------------------------------------------------------------

// Tier identifies the benefit tier based on member hire date.
type Tier string

const (
	TierT1 Tier = "T1"
	TierT2 Tier = "T2"
	TierT3 Tier = "T3"
)

// ---------------------------------------------------------------------------
// File Submission Lifecycle (10 states)
// ---------------------------------------------------------------------------

// FileStatus represents the state of a payroll file submission.
type FileStatus string

const (
	FileUploaded       FileStatus = "UPLOADED"
	FileValidating     FileStatus = "VALIDATING"
	FileValidated      FileStatus = "VALIDATED"
	FilePartialPost    FileStatus = "PARTIAL_POST"
	FileException      FileStatus = "EXCEPTION"
	FilePaymentSetup   FileStatus = "PAYMENT_SETUP"
	FilePaymentPending FileStatus = "PAYMENT_PENDING"
	FileProcessed      FileStatus = "PROCESSED"
	FileReplaced       FileStatus = "REPLACED"
	FileRejected       FileStatus = "REJECTED"
)

// ---------------------------------------------------------------------------
// Exception Status
// ---------------------------------------------------------------------------

// ExceptionStatus represents the resolution state of a validation exception.
type ExceptionStatus string

const (
	ExceptionUnresolved      ExceptionStatus = "UNRESOLVED"
	ExceptionPendingResponse ExceptionStatus = "PENDING_RESPONSE"
	ExceptionEscalated       ExceptionStatus = "ESCALATED"
	ExceptionResolved        ExceptionStatus = "RESOLVED"
	ExceptionDCRouted        ExceptionStatus = "DC_ROUTED"
)

// ---------------------------------------------------------------------------
// Enrollment Types
// ---------------------------------------------------------------------------

// EnrollmentType identifies how a member enrollment was initiated.
type EnrollmentType string

const (
	EnrollmentEmployerInitiated EnrollmentType = "EMPLOYER_INITIATED"
	EnrollmentMemberInitiated   EnrollmentType = "MEMBER_INITIATED"
	EnrollmentRehire            EnrollmentType = "REHIRE"
)

// ---------------------------------------------------------------------------
// Designation Types (Spec Section 5: WARET)
// ---------------------------------------------------------------------------

// DesignationType identifies the employer designation for WARET purposes.
type DesignationType string

const (
	DesignationStandard              DesignationType = "STANDARD"
	Designation140Day                DesignationType = "140_DAY"
	DesignationCriticalShortage      DesignationType = "CRITICAL_SHORTAGE"
	DesignationCriticalShortageBOCES DesignationType = "CRITICAL_SHORTAGE_BOCES"
)

// ---------------------------------------------------------------------------
// Service Credit Types
// ---------------------------------------------------------------------------

// ServiceCreditType identifies the kind of purchased service credit.
type ServiceCreditType string

const (
	ServiceCreditRefundedPriorPERA     ServiceCreditType = "REFUNDED_PRIOR_PERA"
	ServiceCreditMilitaryUSERRA        ServiceCreditType = "MILITARY_USERRA"
	ServiceCreditPriorPublicEmployment ServiceCreditType = "PRIOR_PUBLIC_EMPLOYMENT"
	ServiceCreditLeaveOfAbsence        ServiceCreditType = "LEAVE_OF_ABSENCE"
	ServiceCreditPERAChoiceTransfer    ServiceCreditType = "PERACHOICE_TRANSFER"
)

// ---------------------------------------------------------------------------
// Division
// ---------------------------------------------------------------------------

// Division represents a COPERA employer division.
type Division struct {
	DivisionCode     string `json:"division_code"`
	DivisionName     string `json:"division_name"`
	GoverningStatute string `json:"governing_statute"`
}

// ---------------------------------------------------------------------------
// Rate Table Types (schema only — actual data lives in DB)
// ---------------------------------------------------------------------------

// ContributionRateRow represents a single row in the contribution rate table.
// The composite key is division x safety_officer_flag x effective_date.
// All rate fields use string representation for decimal precision ("0.1100").
type ContributionRateRow struct {
	DivisionCode        string     `json:"division_code"`
	IsSafetyOfficer     bool       `json:"is_safety_officer"`
	EffectiveFrom       time.Time  `json:"effective_from"`
	EffectiveTo         *time.Time `json:"effective_to"`
	MemberRate          string     `json:"member_rate"`
	EmployerBaseRate    string     `json:"employer_base_rate"`
	AEDRate             string     `json:"aed_rate"`
	SAEDRate            string     `json:"saed_rate"`
	AAPRate             string     `json:"aap_rate"`
	DCSupplementRate    string     `json:"dc_supplement_rate"`
	EmployerTotalRate   string     `json:"employer_total_rate"`
	HealthCareTrustRate string     `json:"health_care_trust_rate"`
	BoardResolutionRef  string     `json:"board_resolution_ref"`
}

// LateInterestRate represents the interest rate applied to late contributions.
// All monetary/rate fields use string representation for decimal precision.
type LateInterestRate struct {
	DivisionCode  string     `json:"division_code"`
	EffectiveFrom time.Time  `json:"effective_from"`
	EffectiveTo   *time.Time `json:"effective_to"`
	Rate          string     `json:"rate"`
	MinimumCharge string     `json:"minimum_charge"`
}
