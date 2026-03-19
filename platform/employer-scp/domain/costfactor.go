// Package domain implements business logic for the SCP (Service Credit Purchase) service.
package domain

import (
	"fmt"
	"math/big"
	"time"
)

// QuoteExpiryDays is the number of days a cost quote is valid after generation.
const QuoteExpiryDays = 60

// CostQuoteResult is the result of generating a cost quote.
type CostQuoteResult struct {
	CostFactor     string `json:"costFactor"`
	AnnualSalary   string `json:"annualSalary"`
	YearsRequested string `json:"yearsRequested"`
	TotalCost      string `json:"totalCost"`
	QuoteDate      string `json:"quoteDate"`
	QuoteExpires   string `json:"quoteExpires"`
}

// CalculateCost computes the total cost of a service credit purchase.
//
// Formula: totalCost = yearsRequested × annualSalary × costFactor
//
// All arithmetic uses math/big.Rat for penny-accurate results.
func CalculateCost(costFactor, annualSalary, yearsRequested string) (*CostQuoteResult, error) {
	cf, ok := new(big.Rat).SetString(costFactor)
	if !ok {
		return nil, fmt.Errorf("invalid cost factor: %q", costFactor)
	}

	salary, ok := new(big.Rat).SetString(annualSalary)
	if !ok {
		return nil, fmt.Errorf("invalid annual salary: %q", annualSalary)
	}
	if salary.Sign() <= 0 {
		return nil, fmt.Errorf("annual salary must be positive")
	}

	years, ok := new(big.Rat).SetString(yearsRequested)
	if !ok {
		return nil, fmt.Errorf("invalid years requested: %q", yearsRequested)
	}
	if years.Sign() <= 0 {
		return nil, fmt.Errorf("years requested must be positive")
	}

	// totalCost = years × salary × costFactor
	total := new(big.Rat).Mul(years, salary)
	total.Mul(total, cf)

	now := time.Now()
	quoteDate := now.Format("2006-01-02")
	quoteExpires := now.AddDate(0, 0, QuoteExpiryDays).Format("2006-01-02")

	return &CostQuoteResult{
		CostFactor:     costFactor,
		AnnualSalary:   annualSalary,
		YearsRequested: yearsRequested,
		TotalCost:      ratToFixed2(total),
		QuoteDate:      quoteDate,
		QuoteExpires:   quoteExpires,
	}, nil
}

// IsQuoteExpired checks whether a quote has passed its expiration date.
func IsQuoteExpired(quoteExpires string) (bool, error) {
	exp, err := time.Parse("2006-01-02", quoteExpires)
	if err != nil {
		return false, fmt.Errorf("invalid expiry date: %q", quoteExpires)
	}
	return time.Now().After(exp), nil
}

// ratToFixed2 converts a big.Rat to a string with exactly 2 decimal places.
func ratToFixed2(r *big.Rat) string {
	return r.FloatString(2)
}
