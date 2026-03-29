// Package models defines domain types for the intelligence service.
// The intelligence service implements all business rules as deterministic code.
// AI does NOT execute business rules — per Governing Principle 1.
package models

import (
	"time"

	"github.com/noui/platform/intelligence/money"
)

// MemberData represents the member information needed for calculations.
// Fetched from the connector service, not directly from the database.
type MemberData struct {
	MemberID     int        `json:"member_id"`
	FirstName    string     `json:"first_name"`
	LastName     string     `json:"last_name"`
	DOB          time.Time  `json:"dob"`
	HireDate     time.Time  `json:"hire_date"`
	TermDate     *time.Time `json:"term_date,omitempty"`
	StatusCode   string     `json:"status_code"`
	TierCode     int        `json:"tier_code"`
	MaritalStat  string     `json:"marital_status"`
	MedicareFlag string     `json:"medicare_flag"`
}

// ServiceCreditData contains service credit summary from connector.
// These are year counts (not dollars), so they stay as float64.
type ServiceCreditData struct {
	EarnedYears      float64 `json:"earned_years"`
	PurchasedYears   float64 `json:"purchased_years"`
	MilitaryYears    float64 `json:"military_years"`
	TotalYears       float64 `json:"total_years"`
	EligibilityYears float64 `json:"eligibility_years"` // Earned only
	BenefitYears     float64 `json:"benefit_years"`     // Earned + purchased
}

// AMSData contains AMS calculation result from connector.
type AMSData struct {
	WindowMonths    int         `json:"window_months"`
	WindowStart     string      `json:"window_start"`
	WindowEnd       string      `json:"window_end"`
	Amount          money.Money `json:"amount"`
	LeavePayoutIncl bool        `json:"leave_payout_included"`
	LeavePayoutAmt  money.Money `json:"leave_payout_amount"`
}

// DROData contains DRO information from connector.
type DROData struct {
	HasDRO         bool       `json:"has_dro"`
	MarriageDate   time.Time  `json:"marriage_date"`
	DivorceDate    time.Time  `json:"divorce_date"`
	DivisionMethod string     `json:"division_method"`
	DivisionValue  float64    `json:"division_value"` // Percentage (e.g., 40.0), not dollars
	AltPayeeFirst  string     `json:"alt_payee_first"`
	AltPayeeLast   string     `json:"alt_payee_last"`
	AltPayeeDOB    *time.Time `json:"alt_payee_dob,omitempty"`
}

// --- Request Types ---

// EligibilityRequest is the input for eligibility evaluation.
type EligibilityRequest struct {
	MemberID       int    `json:"member_id"`
	RetirementDate string `json:"retirement_date,omitempty"` // YYYY-MM-DD
}

// BenefitCalcRequest is the input for benefit calculation.
type BenefitCalcRequest struct {
	MemberID       int    `json:"member_id"`
	RetirementDate string `json:"retirement_date"`  // YYYY-MM-DD
	DROID          *int   `json:"dro_id,omitempty"` // Links to specific DRO; nil = no DRO for this case
}

// PaymentOptionsRequest is the input for payment options calculation.
type PaymentOptionsRequest struct {
	MemberID       int    `json:"member_id"`
	RetirementDate string `json:"retirement_date"` // YYYY-MM-DD
	BeneficiaryDOB string `json:"beneficiary_dob,omitempty"`
	DROID          *int   `json:"dro_id,omitempty"` // Links to specific DRO; nil = no DRO for this case
}

// ScenarioRequest is the input for scenario comparison.
type ScenarioRequest struct {
	MemberID        int      `json:"member_id"`
	RetirementDates []string `json:"retirement_dates"` // Array of YYYY-MM-DD
	DROID           *int     `json:"dro_id,omitempty"` // Links to specific DRO; nil = no DRO for this case
}

// DROCalcRequest is the input for DRO calculation.
type DROCalcRequest struct {
	MemberID       int    `json:"member_id"`
	RetirementDate string `json:"retirement_date"` // YYYY-MM-DD
}

// --- Response Types ---

// EligibilityResult contains the full eligibility evaluation.
type EligibilityResult struct {
	MemberID        int               `json:"member_id"`
	RetirementDate  string            `json:"retirement_date"`
	Age             AgeAtRetirement   `json:"age_at_retirement"`
	Tier            int               `json:"tier"`
	TierSource      string            `json:"tier_source"`
	Vested          bool              `json:"vested"`
	ServiceCredit   ServiceCreditData `json:"service_credit"`
	Evaluations     []RuleEvaluation  `json:"evaluations"`
	BestEligible    string            `json:"best_eligible_type"` // NORMAL, RULE_OF_75, RULE_OF_85, EARLY, DEFERRED, NONE
	RuleOfNSum      float64           `json:"rule_of_n_sum"`      // Sum of age + service (not dollars)
	ReductionPct    float64           `json:"reduction_pct"`      // Percentage (not dollars)
	ReductionFactor float64           `json:"reduction_factor"`   // Multiplier (not dollars)
}

// AgeAtRetirement breaks down the member's age at retirement.
type AgeAtRetirement struct {
	Years          int     `json:"years"`
	Months         int     `json:"months"`
	CompletedYears int     `json:"completed_years"`
	Decimal        float64 `json:"decimal"` // Age as decimal (not dollars)
}

// RuleEvaluation records the result of evaluating a single rule.
type RuleEvaluation struct {
	RuleID          string `json:"rule_id"`
	RuleName        string `json:"rule_name"`
	Met             bool   `json:"met"`
	Details         string `json:"details"`
	SourceReference string `json:"source_reference"`
}

// BenefitCalcResult contains the complete benefit calculation worksheet.
type BenefitCalcResult struct {
	MemberID       int                `json:"member_id"`
	RetirementDate string             `json:"retirement_date"`
	Tier           int                `json:"tier"`
	Eligibility    EligibilityResult  `json:"eligibility"`
	AMS            AMSCalcDetail      `json:"ams"`
	Formula        FormulaDetail      `json:"formula"`
	Reduction      ReductionDetail    `json:"reduction"`
	MaximumBenefit money.Money        `json:"maximum_benefit"`
	PaymentOptions PaymentOptions     `json:"payment_options"`
	DRO            *DROCalcResult     `json:"dro,omitempty"`
	DeathBenefit   DeathBenefitDetail `json:"death_benefit"`
	IPR            IPRDetail          `json:"ipr"`
}

// AMSCalcDetail provides full AMS calculation transparency.
type AMSCalcDetail struct {
	WindowMonths      int         `json:"window_months"`
	WindowStart       string      `json:"window_start"`
	WindowEnd         string      `json:"window_end"`
	Amount            money.Money `json:"amount"`
	LeavePayoutIncl   bool        `json:"leave_payout_included"`
	LeavePayoutAmt    money.Money `json:"leave_payout_amount"`
	LeavePayoutImpact money.Money `json:"leave_payout_ams_impact"`
}

// FormulaDetail shows the benefit formula applied.
type FormulaDetail struct {
	AMS            money.Money `json:"ams"`
	Multiplier     float64     `json:"multiplier"` // Factor (not dollars)
	MultiplierPct  string      `json:"multiplier_pct"`
	ServiceYears   float64     `json:"service_years"` // Year count (not dollars)
	ServiceType    string      `json:"service_type"`
	GrossBenefit   money.Money `json:"gross_benefit"`
	FormulaDisplay string      `json:"formula_display"`
}

// ReductionDetail shows early retirement reduction calculation.
type ReductionDetail struct {
	Applies         bool        `json:"applies"`
	RetirementType  string      `json:"retirement_type"`
	AgeAtRetirement int         `json:"age_at_retirement"`
	YearsUnder65    int         `json:"years_under_65"`
	RatePerYear     float64     `json:"rate_per_year"`       // Percentage (not dollars)
	TotalReduction  float64     `json:"total_reduction_pct"` // Percentage (not dollars)
	ReductionFactor float64     `json:"reduction_factor"`    // Multiplier (not dollars)
	ReducedBenefit  money.Money `json:"reduced_benefit"`
	SourceReference string      `json:"source_reference"`
}

// PaymentOptions contains all four payment option amounts.
type PaymentOptions struct {
	BaseAmount money.Money `json:"base_amount"`
	Maximum    money.Money `json:"maximum"`
	JS100      JSOption    `json:"js_100"`
	JS75       JSOption    `json:"js_75"`
	JS50       JSOption    `json:"js_50"`
	Disclaimer string      `json:"disclaimer"`
}

// JSOption represents a Joint & Survivor payment option.
type JSOption struct {
	MemberAmount   money.Money `json:"member_amount"`
	SurvivorAmount money.Money `json:"survivor_amount"`
	SurvivorPct    int         `json:"survivor_pct"`
	Factor         float64     `json:"factor"` // Actuarial factor (not dollars)
}

// DROCalcResult contains DRO impact calculation.
type DROCalcResult struct {
	HasDRO              bool        `json:"has_dro"`
	MarriageDate        string      `json:"marriage_date"`
	DivorceDate         string      `json:"divorce_date"`
	MaritalServiceYears float64     `json:"marital_service_years"` // Year count (not dollars)
	TotalServiceYears   float64     `json:"total_service_years"`   // Year count (not dollars)
	MaritalFraction     float64     `json:"marital_fraction"`      // Ratio (not dollars)
	GrossBenefit        money.Money `json:"gross_benefit"`
	MaritalShare        money.Money `json:"marital_share"`
	AltPayeePct         float64     `json:"alt_payee_pct"` // Percentage (not dollars)
	AltPayeeAmount      money.Money `json:"alt_payee_amount"`
	MemberAfterDRO      money.Money `json:"member_benefit_after_dro"`
	DivisionMethod      string      `json:"division_method"`
}

// DeathBenefitDetail shows lump-sum death benefit calculation.
type DeathBenefitDetail struct {
	Amount         money.Money `json:"amount"`
	Installment50  money.Money `json:"installment_50"`
	Installment100 money.Money `json:"installment_100"`
	RetirementType string      `json:"retirement_type"`
	SourceRef      string      `json:"source_reference"`
}

// IPRDetail shows Insurance Premium Reimbursement calculation.
type IPRDetail struct {
	EarnedServiceYears float64     `json:"earned_service_years"` // Year count (not dollars)
	NonMedicareMonthly money.Money `json:"non_medicare_monthly"`
	MedicareMonthly    money.Money `json:"medicare_monthly"`
	SourceRef          string      `json:"source_reference"`
}

// ScenarioResult contains comparison across multiple retirement dates.
type ScenarioResult struct {
	MemberID  int             `json:"member_id"`
	Scenarios []ScenarioEntry `json:"scenarios"`
}

// ScenarioEntry is one retirement date scenario.
type ScenarioEntry struct {
	RetirementDate  string      `json:"retirement_date"`
	Age             int         `json:"age"`
	EarnedService   float64     `json:"earned_service"` // Year count (not dollars)
	TotalService    float64     `json:"total_service"`  // Year count (not dollars)
	EligibilityType string      `json:"eligibility_type"`
	RuleOfNSum      float64     `json:"rule_of_n_sum"` // Sum (not dollars)
	RuleOfNMet      bool        `json:"rule_of_n_met"`
	ReductionPct    float64     `json:"reduction_pct"` // Percentage (not dollars)
	MonthlyBenefit  money.Money `json:"monthly_benefit"`
}
