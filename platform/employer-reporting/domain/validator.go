// Package domain implements contribution validation business rules for the
// employer-reporting service.
package domain

import (
	"fmt"
	"math/big"
)

// ValidationResult captures per-record validation output.
type ValidationResult struct {
	RecordID string
	Status   string // "VALID" or "FAILED"
	Errors   []ValidationError
}

// ValidationError describes a single validation failure.
type ValidationError struct {
	Code           string `json:"code"`
	Field          string `json:"field"`
	Description    string `json:"description"`
	ExpectedValue  string `json:"expectedValue,omitempty"`
	SubmittedValue string `json:"submittedValue,omitempty"`
}

// RateInput holds the rate values from the rate table for comparison.
type RateInput struct {
	MemberRate        string
	EmployerBaseRate  string
	AEDRate           string
	SAEDRate          string
	AAPRate           string
	DCSupplementRate  string
	EmployerTotalRate string
}

// RecordInput holds a contribution record's submitted values for validation.
type RecordInput struct {
	GrossSalary          string
	MemberContribution   string
	EmployerContribution string
	AEDAmount            string
	SAEDAmount           string
	AAPAmount            string
	DCSupplementAmount   string
	TotalAmount          string
	IsORP                bool
}

// ValidateRecord checks a contribution record against the expected rates.
// Returns a list of validation errors (empty = valid).
func ValidateRecord(record RecordInput, rates RateInput) []ValidationError {
	var errors []ValidationError

	grossSalary := parseRat(record.GrossSalary)
	if grossSalary == nil || grossSalary.Sign() < 0 {
		errors = append(errors, ValidationError{
			Code:        "INVALID_SALARY",
			Field:       "gross_salary",
			Description: "Gross salary must be a non-negative number",
		})
		return errors // can't validate amounts without valid salary
	}

	if grossSalary.Sign() == 0 {
		return errors // zero salary row is valid (e.g. leave without pay)
	}

	// ORP members: only validate AED and SAED (employer-paid on total payroll).
	// ORP member contributions go to ORP provider, not COPERA.
	if record.IsORP {
		errors = append(errors, validateAmount("aed_amount", record.AEDAmount, grossSalary, rates.AEDRate)...)
		errors = append(errors, validateAmount("saed_amount", record.SAEDAmount, grossSalary, rates.SAEDRate)...)
		return errors
	}

	// DB members: validate all contribution components against rate table.
	errors = append(errors, validateAmount("member_contribution", record.MemberContribution, grossSalary, rates.MemberRate)...)
	errors = append(errors, validateAmount("employer_contribution", record.EmployerContribution, grossSalary, rates.EmployerBaseRate)...)
	errors = append(errors, validateAmount("aed_amount", record.AEDAmount, grossSalary, rates.AEDRate)...)
	errors = append(errors, validateAmount("saed_amount", record.SAEDAmount, grossSalary, rates.SAEDRate)...)
	errors = append(errors, validateAmount("aap_amount", record.AAPAmount, grossSalary, rates.AAPRate)...)
	errors = append(errors, validateAmount("dc_supplement_amount", record.DCSupplementAmount, grossSalary, rates.DCSupplementRate)...)

	// Validate total is sum of components.
	errors = append(errors, validateTotal(record)...)

	return errors
}

// validateAmount checks that a submitted amount matches salary × rate within $0.01 tolerance.
func validateAmount(field, submittedStr string, grossSalary *big.Rat, rateStr string) []ValidationError {
	submitted := parseRat(submittedStr)
	if submitted == nil {
		return []ValidationError{{
			Code:        "INVALID_AMOUNT",
			Field:       field,
			Description: fmt.Sprintf("%s is not a valid number", field),
		}}
	}

	rate := parseRat(rateStr)
	if rate == nil {
		return nil // no rate to compare against (gap data)
	}

	expected := ratMul(grossSalary, rate)
	// Tolerance: $0.01 (one penny) to accommodate rounding differences.
	if !withinPenny(submitted, expected) {
		return []ValidationError{{
			Code:           "RATE_MISMATCH",
			Field:          field,
			Description:    fmt.Sprintf("%s does not match expected rate", field),
			ExpectedValue:  ratFmt(expected),
			SubmittedValue: ratFmt(submitted),
		}}
	}

	return nil
}

// validateTotal checks that the total amount is the sum of all components.
func validateTotal(record RecordInput) []ValidationError {
	components := []string{
		record.MemberContribution,
		record.EmployerContribution,
		record.AEDAmount,
		record.SAEDAmount,
		record.AAPAmount,
		record.DCSupplementAmount,
	}

	expectedTotal := new(big.Rat)
	for _, s := range components {
		r := parseRat(s)
		if r != nil {
			expectedTotal = ratAdd(expectedTotal, r)
		}
	}

	total := parseRat(record.TotalAmount)
	if total == nil {
		return []ValidationError{{
			Code:        "INVALID_TOTAL",
			Field:       "total_amount",
			Description: "Total amount is not a valid number",
		}}
	}

	if !withinPenny(total, expectedTotal) {
		return []ValidationError{{
			Code:           "TOTAL_MISMATCH",
			Field:          "total_amount",
			Description:    "Total does not match sum of components",
			ExpectedValue:  ratFmt(expectedTotal),
			SubmittedValue: ratFmt(total),
		}}
	}

	return nil
}

// ValidateNegativeAmounts checks that no submitted amounts are negative.
func ValidateNegativeAmounts(record RecordInput) []ValidationError {
	var errors []ValidationError
	fields := map[string]string{
		"member_contribution":   record.MemberContribution,
		"employer_contribution": record.EmployerContribution,
		"aed_amount":            record.AEDAmount,
		"saed_amount":           record.SAEDAmount,
		"aap_amount":            record.AAPAmount,
		"dc_supplement_amount":  record.DCSupplementAmount,
		"total_amount":          record.TotalAmount,
	}

	for field, valStr := range fields {
		r := parseRat(valStr)
		if r != nil && r.Sign() < 0 {
			errors = append(errors, ValidationError{
				Code:        "NEGATIVE_AMOUNT",
				Field:       field,
				Description: fmt.Sprintf("%s cannot be negative", field),
			})
		}
	}

	return errors
}
