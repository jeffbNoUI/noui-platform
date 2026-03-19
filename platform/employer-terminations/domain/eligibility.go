// Package domain contains termination business logic — eligibility checks,
// certification hold management, and penny-accurate refund calculations.
package domain

import (
	"fmt"
	"time"
)

// DefaultSeparationWaitDays is the configurable waiting period after separation
// before a refund can be processed. COPERA confirmation pending — using 60 days.
const DefaultSeparationWaitDays = 60

// VestingYears is the minimum service years for vesting (all tiers).
const VestingYears = 5

// DisabilityBlockYears is the window in which a disability application blocks refund.
const DisabilityBlockYears = 2

// EligibilityResult holds the outcome of eligibility checking.
type EligibilityResult struct {
	Eligible bool     `json:"eligible"`
	Reasons  []string `json:"reasons"`
}

// CheckRefundEligibility evaluates whether a member can receive a refund.
//
// Rules:
//   - Separation waiting period: member must have been separated for at least
//     DefaultSeparationWaitDays from their termination/separation date.
//   - Vesting: if the member has ≥5 years of service, they are vested and must
//     acknowledge forfeiture of future benefits before receiving a refund.
//   - Disability: if a disability application was filed within the past 2 years,
//     refund is blocked (member may still qualify for disability benefits).
func CheckRefundEligibility(
	terminationDate *string,
	separationDate *string,
	yearsOfService float64,
	isVested bool,
	hasDisabilityApp bool,
	disabilityAppDate *string,
	checkDate time.Time,
) EligibilityResult {
	result := EligibilityResult{Eligible: true}

	// 1. Must have a termination or separation date
	effectiveDate := resolveEffectiveDate(terminationDate, separationDate)
	if effectiveDate == nil {
		result.Eligible = false
		result.Reasons = append(result.Reasons, "No termination or separation date on record")
		return result
	}

	// 2. Separation waiting period
	waitEnd := effectiveDate.AddDate(0, 0, DefaultSeparationWaitDays)
	if checkDate.Before(waitEnd) {
		result.Eligible = false
		daysRemaining := int(waitEnd.Sub(checkDate).Hours() / 24)
		result.Reasons = append(result.Reasons,
			fmt.Sprintf("Separation waiting period not met: %d days remaining (ends %s)",
				daysRemaining, waitEnd.Format("2006-01-02")))
	}

	// 3. Disability application block
	if hasDisabilityApp && disabilityAppDate != nil {
		dDate, err := time.Parse("2006-01-02", *disabilityAppDate)
		if err == nil {
			blockEnd := dDate.AddDate(DisabilityBlockYears, 0, 0)
			if checkDate.Before(blockEnd) {
				result.Eligible = false
				result.Reasons = append(result.Reasons,
					fmt.Sprintf("Disability application filed %s — refund blocked until %s",
						dDate.Format("2006-01-02"), blockEnd.Format("2006-01-02")))
			}
		}
	}

	// 4. Vesting acknowledgment required (not a blocker, but flagged)
	if isVested || yearsOfService >= VestingYears {
		result.Reasons = append(result.Reasons,
			"Member is vested — forfeiture acknowledgment required before refund disbursement")
	}

	return result
}

// resolveEffectiveDate picks the best available date for separation timing.
func resolveEffectiveDate(terminationDate, separationDate *string) *time.Time {
	// Prefer separation date if available, fall back to termination date
	candidates := []*string{separationDate, terminationDate}
	for _, c := range candidates {
		if c != nil {
			t, err := time.Parse("2006-01-02", *c)
			if err == nil {
				return &t
			}
		}
	}
	return nil
}

// ValidTerminationReasons lists the allowed termination reason values.
var ValidTerminationReasons = []string{
	"RESIGNATION", "RETIREMENT", "LAYOFF", "TERMINATION",
	"DEATH", "DISABILITY", "OTHER",
}

// IsValidTerminationReason checks if a reason is in the allowed set.
func IsValidTerminationReason(reason string) bool {
	for _, r := range ValidTerminationReasons {
		if r == reason {
			return true
		}
	}
	return false
}

// ValidPaymentMethods lists the allowed refund payment methods.
var ValidPaymentMethods = []string{
	"DIRECT_DEPOSIT", "ROLLOVER", "PARTIAL_ROLLOVER", "CHECK",
}

// IsValidPaymentMethod checks if a method is in the allowed set.
func IsValidPaymentMethod(method string) bool {
	for _, m := range ValidPaymentMethods {
		if m == method {
			return true
		}
	}
	return false
}
