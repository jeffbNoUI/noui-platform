// Package models defines domain types for the DERP data connector service.
// These models map legacy database schema to clean domain representations.
package models

import "time"

// Member represents a DERP plan member with demographics and employment info.
type Member struct {
	MemberID     int        `json:"member_id"`
	FirstName    string     `json:"first_name"`
	LastName     string     `json:"last_name"`
	MiddleName   string     `json:"middle_name,omitempty"`
	DOB          time.Time  `json:"dob"`
	Gender       string     `json:"gender,omitempty"`
	MaritalStat  string     `json:"marital_status"`
	HireDate     time.Time  `json:"hire_date"`
	TermDate     *time.Time `json:"term_date,omitempty"`
	RehireDate   *time.Time `json:"rehire_date,omitempty"`
	StatusCode   string     `json:"status_code"`
	TierCode     int        `json:"tier_code"`
	DeptCode     string     `json:"dept_code,omitempty"`
	DeptName     string     `json:"dept_name,omitempty"`
	PosCode      string     `json:"pos_code,omitempty"`
	PosTitle     string     `json:"pos_title,omitempty"`
	MedicareFlag string     `json:"medicare_flag,omitempty"`
	Email        string     `json:"email,omitempty"`
}

// EmploymentEvent represents a single employment history record.
type EmploymentEvent struct {
	EventID       int       `json:"event_id"`
	MemberID      int       `json:"member_id"`
	EventType     string    `json:"event_type"`
	EventDate     time.Time `json:"event_date"`
	DeptCode      string    `json:"dept_code,omitempty"`
	PosCode       string    `json:"pos_code,omitempty"`
	AnnualSalary  *float64  `json:"annual_salary,omitempty"`
	SeparationCD  string    `json:"separation_code,omitempty"`
	SeparationRsn string    `json:"separation_reason,omitempty"`
}

// SalaryRecord represents a single pay period's salary data.
type SalaryRecord struct {
	SalaryID       int       `json:"salary_id"`
	MemberID       int       `json:"member_id"`
	PayPeriodEnd   time.Time `json:"pay_period_end"`
	PayPeriodNum   int       `json:"pay_period_num"`
	AnnualSalary   float64   `json:"annual_salary"`
	GrossPay       float64   `json:"gross_pay"`
	PensionablePay float64   `json:"pensionable_pay"`
	OTPay          float64   `json:"ot_pay"`
	LeavePayoutAmt float64   `json:"leave_payout_amt"`
	FurloughDeduct float64   `json:"furlough_deduct"`
	FYYear         int       `json:"fy_year"`
}

// AMSResult contains the Average Monthly Salary calculation details.
type AMSResult struct {
	WindowMonths      int            `json:"window_months"`
	WindowStart       string         `json:"window_start"`
	WindowEnd         string         `json:"window_end"`
	Amount            float64        `json:"amount"`
	LeavePayoutIncl   bool           `json:"leave_payout_included"`
	LeavePayoutAmt    float64        `json:"leave_payout_amount"`
	LeavePayoutImpact float64        `json:"leave_payout_ams_impact"`
	FurloughInWindow  bool           `json:"furlough_in_window"`
	MonthlyTotals     []MonthlyTotal `json:"monthly_totals,omitempty"`
}

// MonthlyTotal is a single month's aggregated salary for AMS calculation.
type MonthlyTotal struct {
	YearMonth      string  `json:"year_month"`
	PensionablePay float64 `json:"pensionable_pay"`
	LeavePayoutAmt float64 `json:"leave_payout_amt"`
	TotalForAMS    float64 `json:"total_for_ams"`
}

// Beneficiary represents a beneficiary designation.
type Beneficiary struct {
	BeneID       int        `json:"bene_id"`
	MemberID     int        `json:"member_id"`
	BeneType     string     `json:"bene_type"`
	FirstName    string     `json:"first_name"`
	LastName     string     `json:"last_name"`
	Relationship string     `json:"relationship,omitempty"`
	DOB          *time.Time `json:"dob,omitempty"`
	AllocPct     float64    `json:"alloc_pct"`
	EffDate      time.Time  `json:"eff_date"`
	EndDate      *time.Time `json:"end_date,omitempty"`
}

// DRORecord represents a domestic relations order.
type DRORecord struct {
	DROID          int        `json:"dro_id"`
	MemberID       int        `json:"member_id"`
	CourtOrderNum  string     `json:"court_order_num,omitempty"`
	MarriageDate   *time.Time `json:"marriage_date,omitempty"`
	DivorceDate    *time.Time `json:"divorce_date,omitempty"`
	AltPayeeFirst  string     `json:"alt_payee_first_name"`
	AltPayeeLast   string     `json:"alt_payee_last_name"`
	AltPayeeDOB    *time.Time `json:"alt_payee_dob,omitempty"`
	DivisionMethod string     `json:"division_method"`
	DivisionValue  float64    `json:"division_value"`
	Status         string     `json:"status"`
}

// ContributionRecord represents member/employer contribution data.
type ContributionRecord struct {
	ContribID    int       `json:"contrib_id"`
	MemberID     int       `json:"member_id"`
	PayPeriodEnd time.Time `json:"pay_period_end"`
	EEContrib    float64   `json:"ee_contrib"`
	ERContrib    float64   `json:"er_contrib"`
	EEBalance    float64   `json:"ee_balance"`
	ERBalance    float64   `json:"er_balance"`
	InterestAmt  float64   `json:"interest_amt"`
}

// ContributionSummary provides aggregated contribution information.
type ContributionSummary struct {
	MemberID      int     `json:"member_id"`
	TotalEE       float64 `json:"total_ee_contributions"`
	TotalER       float64 `json:"total_er_contributions"`
	TotalInterest float64 `json:"total_interest"`
	CurrentEEBal  float64 `json:"current_ee_balance"`
	CurrentERBal  float64 `json:"current_er_balance"`
	PeriodCount   int     `json:"period_count"`
}

// ServiceCredit represents a service credit record.
type ServiceCredit struct {
	SvcCreditID   int        `json:"svc_credit_id"`
	MemberID      int        `json:"member_id"`
	CreditType    string     `json:"credit_type"`
	BeginDate     *time.Time `json:"begin_date,omitempty"`
	EndDate       *time.Time `json:"end_date,omitempty"`
	YearsCredited float64    `json:"years_credited"`
	Cost          *float64   `json:"cost,omitempty"`
	PurchaseDate  *time.Time `json:"purchase_date,omitempty"`
	Status        string     `json:"status"`
}

// ServiceCreditSummary provides aggregated service credit information.
type ServiceCreditSummary struct {
	MemberID         int     `json:"member_id"`
	EarnedYears      float64 `json:"earned_years"`
	PurchasedYears   float64 `json:"purchased_years"`
	MilitaryYears    float64 `json:"military_years"`
	LeaveYears       float64 `json:"leave_years"`
	TotalYears       float64 `json:"total_years"`
	EligibilityYears float64 `json:"eligibility_years"` // Earned only — for Rule of 75/85, IPR
	BenefitYears     float64 `json:"benefit_years"`     // Earned + purchased — for benefit formula
}

// MemberSearchResult is a lightweight type for search/autocomplete results.
type MemberSearchResult struct {
	MemberID  int    `json:"memberId"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Tier      int    `json:"tier"`
	Dept      string `json:"dept"`
	Status    string `json:"status"`
}

// RefundEstimate contains the refund calculation for an inactive member.
type RefundEstimate struct {
	MemberID              int     `json:"member_id"`
	EmployeeContributions float64 `json:"employee_contributions"`
	Interest              float64 `json:"interest"`
	Total                 float64 `json:"total"`
	MandatoryWithhold20   float64 `json:"mandatory_withhold_20pct"`
	NetAfterWithhold      float64 `json:"net_after_withhold"`
}

// PaymentRecord represents a single benefit payment to a retiree.
type PaymentRecord struct {
	PaymentID     int       `json:"payment_id"`
	MemberID      int       `json:"member_id"`
	PaymentDate   time.Time `json:"payment_date"`
	GrossAmount   float64   `json:"gross_amount"`
	NetAmount     float64   `json:"net_amount"`
	FederalTax    float64   `json:"federal_tax"`
	StateTax      float64   `json:"state_tax"`
	Deductions    float64   `json:"deductions"`
	PaymentMethod string    `json:"payment_method"`
}

// TaxDocument represents a tax document (e.g. 1099-R) for a member.
type TaxDocument struct {
	DocID             int       `json:"doc_id"`
	MemberID          int       `json:"member_id"`
	DocType           string    `json:"doc_type"`
	TaxYear           int       `json:"tax_year"`
	IssuedDate        time.Time `json:"issued_date"`
	GrossDistribution float64   `json:"gross_distribution"`
	TaxableAmount     float64   `json:"taxable_amount"`
	FederalWithheld   float64   `json:"federal_withheld"`
	StateWithheld     float64   `json:"state_withheld"`
}

// EmployerMemberSummary provides aggregate member stats for an employer organization.
type EmployerMemberSummary struct {
	OrgID           string `json:"org_id"`
	TotalMembers    int    `json:"total_members"`
	ActiveCount     int    `json:"active_count"`
	RetiredCount    int    `json:"retired_count"`
	TerminatedCount int    `json:"terminated_count"`
	DeferredCount   int    `json:"deferred_count"`
	Tier1Count      int    `json:"tier1_count"`
	Tier2Count      int    `json:"tier2_count"`
	Tier3Count      int    `json:"tier3_count"`
}

// Address represents a member mailing/residential address.
type Address struct {
	AddressID   int    `json:"address_id"`
	MemberID    int    `json:"member_id"`
	AddressType string `json:"address_type"`
	Line1       string `json:"line1"`
	Line2       string `json:"line2,omitempty"`
	City        string `json:"city"`
	State       string `json:"state"`
	ZipCode     string `json:"zip_code"`
	IsCurrent   bool   `json:"is_current"`
}
