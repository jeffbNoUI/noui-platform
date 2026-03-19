package domain

import (
	"fmt"
	"math/big"
)

// Penalty types.
const (
	PenaltyOverLimit        = "OVER_LIMIT"
	PenaltyFirstBusinessDay = "FIRST_BUSINESS_DAY"
	PenaltyNonDisclosure    = "NON_DISCLOSURE"
)

// PenaltyRatePerDay is 5% of monthly benefit per day over the limit.
var PenaltyRatePerDay = big.NewRat(5, 100) // 0.05

// FullMonthCancellation is 100% — used when work occurs on the first business day.
var FullMonthCancellation = big.NewRat(1, 1) // 1.00

// PenaltyInput contains all inputs for penalty calculation.
type PenaltyInput struct {
	PenaltyType    string // OVER_LIMIT, FIRST_BUSINESS_DAY, NON_DISCLOSURE
	MonthlyBenefit string // NUMERIC string, e.g. "4832.17"
	DaysOverLimit  int    // number of days over (OVER_LIMIT only)
	SpreadMonths   int    // spread deduction across N months (minimum 1)

	// NON_DISCLOSURE: recover both retiree + employer contributions
	RetireeContributions  string // NUMERIC string
	EmployerContributions string // NUMERIC string
}

// PenaltyResult contains the computed penalty breakdown.
// All amounts are string representations of NUMERIC(14,2) values.
type PenaltyResult struct {
	PenaltyType      string `json:"penaltyType"`
	MonthlyBenefit   string `json:"monthlyBenefit"`
	DaysOverLimit    int    `json:"daysOverLimit"`
	PenaltyRate      string `json:"penaltyRate"`
	PenaltyAmount    string `json:"penaltyAmount"`
	EmployerRecovery string `json:"employerRecovery"`
	RetireeRecovery  string `json:"retireeRecovery"`
	SpreadMonths     int    `json:"spreadMonths"`
	MonthlyDeduction string `json:"monthlyDeduction"`
}

// CalculatePenalty computes a WARET penalty with penny-accurate arithmetic.
//
// Rules:
//   - OVER_LIMIT: 5% of monthly benefit per day over the limit
//   - FIRST_BUSINESS_DAY: full benefit cancellation for the month (100%)
//   - NON_DISCLOSURE: recover both retiree + employer contributions
//
// All arithmetic uses math/big.Rat. Rounding to cents happens only at final output.
func CalculatePenalty(input PenaltyInput) (*PenaltyResult, error) {
	benefit, ok := new(big.Rat).SetString(input.MonthlyBenefit)
	if !ok {
		return nil, fmt.Errorf("invalid monthly benefit: %q", input.MonthlyBenefit)
	}

	spreadMonths := input.SpreadMonths
	if spreadMonths < 1 {
		spreadMonths = 1
	}

	result := &PenaltyResult{
		PenaltyType:    input.PenaltyType,
		MonthlyBenefit: ratToFixed2(benefit),
		DaysOverLimit:  input.DaysOverLimit,
		SpreadMonths:   spreadMonths,
	}

	var penaltyAmount *big.Rat
	employerRecovery := new(big.Rat)
	retireeRecovery := new(big.Rat)

	switch input.PenaltyType {
	case PenaltyOverLimit:
		// 5% of monthly benefit × days over limit
		if input.DaysOverLimit <= 0 {
			return nil, fmt.Errorf("days over limit must be positive for OVER_LIMIT penalty")
		}
		days := new(big.Rat).SetInt64(int64(input.DaysOverLimit))
		penaltyAmount = new(big.Rat).Mul(benefit, PenaltyRatePerDay)
		penaltyAmount.Mul(penaltyAmount, days)
		result.PenaltyRate = ratToFixed4(PenaltyRatePerDay)

	case PenaltyFirstBusinessDay:
		// Full month cancellation — 100% of monthly benefit
		penaltyAmount = new(big.Rat).Set(benefit)
		result.PenaltyRate = ratToFixed4(FullMonthCancellation)

	case PenaltyNonDisclosure:
		// Recover both retiree + employer contributions
		if input.RetireeContributions == "" || input.EmployerContributions == "" {
			return nil, fmt.Errorf("retiree and employer contributions required for NON_DISCLOSURE penalty")
		}
		var rok, eok bool
		retireeRecovery, rok = new(big.Rat).SetString(input.RetireeContributions)
		if !rok {
			return nil, fmt.Errorf("invalid retiree contributions: %q", input.RetireeContributions)
		}
		employerRecovery, eok = new(big.Rat).SetString(input.EmployerContributions)
		if !eok {
			return nil, fmt.Errorf("invalid employer contributions: %q", input.EmployerContributions)
		}
		penaltyAmount = new(big.Rat).Add(
			new(big.Rat).Set(retireeRecovery),
			new(big.Rat).Set(employerRecovery),
		)
		result.PenaltyRate = "0.0000" // not rate-based

	default:
		return nil, fmt.Errorf("invalid penalty type: %q", input.PenaltyType)
	}

	// Calculate monthly deduction based on spread
	spread := new(big.Rat).SetInt64(int64(spreadMonths))
	monthlyDeduction := new(big.Rat).Quo(penaltyAmount, spread)

	result.PenaltyAmount = ratToFixed2(penaltyAmount)
	result.EmployerRecovery = ratToFixed2(employerRecovery)
	result.RetireeRecovery = ratToFixed2(retireeRecovery)
	result.MonthlyDeduction = ratToFixed2(monthlyDeduction)

	return result, nil
}

// ratToFixed4 converts a big.Rat to a string with exactly 4 decimal places.
func ratToFixed4(r *big.Rat) string {
	return r.FloatString(4)
}
