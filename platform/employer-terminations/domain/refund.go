package domain

import (
	"fmt"
	"math/big"
	"time"
)

// FederalTaxWithholdingRate is the mandatory 20% federal tax withholding
// on eligible rollover distributions that are not rolled over.
var FederalTaxWithholdingRate = big.NewRat(20, 100) // 20%

// RefundInput contains all the inputs needed for a refund calculation.
type RefundInput struct {
	EmployeeContributions string // NUMERIC string, e.g. "45230.15"
	InterestRatePercent   string // annual rate as percent string, e.g. "3.0" means 3%
	HireDate              string // YYYY-MM-DD
	TerminationDate       string // YYYY-MM-DD
	DRODeduction          string // NUMERIC string, e.g. "0.00"
}

// RefundResult contains the computed refund breakdown.
// All amounts are string representations of NUMERIC(14,2) values.
type RefundResult struct {
	EmployeeContributions string `json:"employeeContributions"`
	InterestRate          string `json:"interestRate"`
	InterestAmount        string `json:"interestAmount"`
	GrossRefund           string `json:"grossRefund"`
	FederalTaxWithholding string `json:"federalTaxWithholding"`
	DRODeduction          string `json:"droDeduction"`
	NetRefund             string `json:"netRefund"`
}

// CalculateRefund computes a pension refund with penny-accurate arithmetic.
//
// Formula:
//   1. Start with employee contributions
//   2. Compound interest annually on June 30 at the board-set rate
//   3. Gross = contributions + interest
//   4. Federal tax = 20% of gross (for non-rollover portion)
//   5. Net = gross - tax - DRO deduction
//
// All arithmetic uses math/big.Rat. Rounding to cents happens only at final output.
func CalculateRefund(input RefundInput) (*RefundResult, error) {
	// Parse contributions
	contributions, ok := new(big.Rat).SetString(input.EmployeeContributions)
	if !ok {
		return nil, fmt.Errorf("invalid employee contributions: %q", input.EmployeeContributions)
	}

	// Parse interest rate (percent → decimal: "3.0" → 0.03)
	ratePercent, ok := new(big.Rat).SetString(input.InterestRatePercent)
	if !ok {
		return nil, fmt.Errorf("invalid interest rate: %q", input.InterestRatePercent)
	}
	rate := new(big.Rat).Quo(ratePercent, big.NewRat(100, 1))

	// Parse dates — handle both "2006-01-02" and RFC3339 formats (timestamptz).
	hireDate, err := parseFlexDate(input.HireDate)
	if err != nil {
		return nil, fmt.Errorf("invalid hire date: %w", err)
	}
	termDate, err := parseFlexDate(input.TerminationDate)
	if err != nil {
		return nil, fmt.Errorf("invalid termination date: %w", err)
	}

	// Parse DRO deduction
	droDeduction := new(big.Rat)
	if input.DRODeduction != "" && input.DRODeduction != "0" && input.DRODeduction != "0.00" {
		droDeduction, ok = new(big.Rat).SetString(input.DRODeduction)
		if !ok {
			return nil, fmt.Errorf("invalid DRO deduction: %q", input.DRODeduction)
		}
	}

	// Compound interest annually on June 30
	interest := compoundInterestJune30(contributions, rate, hireDate, termDate)

	// Gross refund = contributions + interest
	gross := new(big.Rat).Add(contributions, interest)

	// Federal tax withholding = 20% of gross
	tax := new(big.Rat).Mul(gross, FederalTaxWithholdingRate)

	// Net refund = gross - tax - DRO
	net := new(big.Rat).Sub(gross, tax)
	net.Sub(net, droDeduction)

	// If net is negative (very unlikely, but DRO could exceed), floor at zero
	if net.Sign() < 0 {
		net = new(big.Rat)
	}

	return &RefundResult{
		EmployeeContributions: ratToFixed2(contributions),
		InterestRate:          input.InterestRatePercent,
		InterestAmount:        ratToFixed2(interest),
		GrossRefund:           ratToFixed2(gross),
		FederalTaxWithholding: ratToFixed2(tax),
		DRODeduction:          ratToFixed2(droDeduction),
		NetRefund:             ratToFixed2(net),
	}, nil
}

// compoundInterestJune30 calculates compound interest on a principal,
// compounding annually on June 30 (COPERA fiscal year end).
//
// The principal earns interest for each full June 30 that falls between
// the hire date and termination date. Interest compounds — each year's
// interest earns interest in subsequent years.
//
// Example: hired 2015-03-01, terminated 2020-09-15, rate 3%
//   June 30, 2015: year 1 compounding (partial first year counts)
//   June 30, 2016: year 2
//   June 30, 2017: year 3
//   June 30, 2018: year 4
//   June 30, 2019: year 5
//   June 30, 2020: year 6
//   Total: 6 compounding periods
func compoundInterestJune30(principal, annualRate *big.Rat, hireDate, termDate time.Time) *big.Rat {
	// Count the number of June 30 dates that fall in [hireDate, termDate]
	// Interest compounds on each of these dates.
	compoundingPeriods := countJune30s(hireDate, termDate)

	if compoundingPeriods == 0 {
		return new(big.Rat)
	}

	// Compound: final = principal × (1 + rate)^periods
	// Interest = final - principal
	onePlusRate := new(big.Rat).Add(big.NewRat(1, 1), annualRate)
	factor := ratPow(onePlusRate, compoundingPeriods)

	finalAmount := new(big.Rat).Mul(principal, factor)
	interest := new(big.Rat).Sub(finalAmount, principal)

	return interest
}

// countJune30s counts how many June 30 dates fall strictly between
// hireDate (exclusive) and termDate (inclusive).
// The first compounding date is the June 30 on or after the hire date.
func countJune30s(hireDate, termDate time.Time) int {
	count := 0
	// Start from the June 30 of the hire year
	year := hireDate.Year()
	june30 := time.Date(year, 6, 30, 0, 0, 0, 0, time.UTC)

	// If hire date is after June 30 of that year, start from next year
	if !hireDate.Before(june30) {
		// hireDate is on or after June 30 — first compounding is next year
		june30 = time.Date(year+1, 6, 30, 0, 0, 0, 0, time.UTC)
	}

	for !june30.After(termDate) {
		count++
		june30 = time.Date(june30.Year()+1, 6, 30, 0, 0, 0, 0, time.UTC)
	}

	return count
}

// ratPow computes base^exp for big.Rat using repeated multiplication.
// exp must be non-negative.
func ratPow(base *big.Rat, exp int) *big.Rat {
	if exp == 0 {
		return big.NewRat(1, 1)
	}
	result := new(big.Rat).Set(base)
	for i := 1; i < exp; i++ {
		result.Mul(result, base)
	}
	return result
}

// ratToFixed2 converts a big.Rat to a string with exactly 2 decimal places.
// This is the ONLY place where rounding occurs in the refund calculation.
func ratToFixed2(r *big.Rat) string {
	return r.FloatString(2)
}

// parseFlexDate parses a date string in either RFC3339 ("2020-01-15T00:00:00Z")
// or date-only ("2020-01-15") format. PostgreSQL timestamptz columns return the
// former; date columns return the latter.
func parseFlexDate(s string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02", s)
}
