package domain

import (
	"testing"
)

// COPERA State Division non-safety rates (Jan 2026).
var stateRates = RateInput{
	MemberRate:        "0.110000",
	EmployerBaseRate:  "0.104000",
	AEDRate:           "0.050000",
	SAEDRate:          "0.050000",
	AAPRate:           "0.010000",
	DCSupplementRate:  "0.002500",
	EmployerTotalRate: "0.216500",
}

func TestValidateRecord_ValidDB(t *testing.T) {
	// Salary: $5,000. All amounts match State Division rates exactly.
	record := RecordInput{
		GrossSalary:          "5000.00",
		MemberContribution:   "550.00",  // 5000 * 0.11
		EmployerContribution: "520.00",  // 5000 * 0.104
		AEDAmount:            "250.00",  // 5000 * 0.05
		SAEDAmount:           "250.00",  // 5000 * 0.05
		AAPAmount:            "50.00",   // 5000 * 0.01
		DCSupplementAmount:   "12.50",   // 5000 * 0.0025
		TotalAmount:          "1632.50", // sum of above
		IsORP:                false,
	}

	errors := ValidateRecord(record, stateRates)
	if len(errors) != 0 {
		t.Errorf("expected no errors for valid DB record, got %d: %v", len(errors), errors)
	}
}

func TestValidateRecord_RateMismatch(t *testing.T) {
	// Member contribution is wrong: 600 instead of 550.
	record := RecordInput{
		GrossSalary:          "5000.00",
		MemberContribution:   "600.00", // wrong
		EmployerContribution: "520.00",
		AEDAmount:            "250.00",
		SAEDAmount:           "250.00",
		AAPAmount:            "50.00",
		DCSupplementAmount:   "12.50",
		TotalAmount:          "1682.50",
		IsORP:                false,
	}

	errors := ValidateRecord(record, stateRates)
	if len(errors) == 0 {
		t.Fatal("expected rate mismatch errors, got none")
	}

	foundMemberError := false
	for _, e := range errors {
		if e.Field == "member_contribution" && e.Code == "RATE_MISMATCH" {
			foundMemberError = true
		}
	}
	if !foundMemberError {
		t.Error("expected RATE_MISMATCH on member_contribution")
	}
}

func TestValidateRecord_ORP_OnlyAEDSAED(t *testing.T) {
	// ORP members: only AED and SAED are validated.
	record := RecordInput{
		GrossSalary:          "5000.00",
		MemberContribution:   "0.00", // ORP — goes to ORP provider
		EmployerContribution: "0.00", // ORP — not to COPERA
		AEDAmount:            "250.00",
		SAEDAmount:           "250.00",
		AAPAmount:            "0.00",
		DCSupplementAmount:   "0.00",
		TotalAmount:          "500.00",
		IsORP:                true,
	}

	errors := ValidateRecord(record, stateRates)
	if len(errors) != 0 {
		t.Errorf("expected no errors for valid ORP record, got %d: %v", len(errors), errors)
	}
}

func TestValidateRecord_ORP_WrongAED(t *testing.T) {
	record := RecordInput{
		GrossSalary:          "5000.00",
		MemberContribution:   "0.00",
		EmployerContribution: "0.00",
		AEDAmount:            "100.00", // wrong: should be 250
		SAEDAmount:           "250.00",
		AAPAmount:            "0.00",
		DCSupplementAmount:   "0.00",
		TotalAmount:          "350.00",
		IsORP:                true,
	}

	errors := ValidateRecord(record, stateRates)
	if len(errors) == 0 {
		t.Fatal("expected AED mismatch for ORP, got none")
	}
	if errors[0].Field != "aed_amount" {
		t.Errorf("expected error on aed_amount, got %s", errors[0].Field)
	}
}

func TestValidateRecord_ZeroSalary(t *testing.T) {
	// Zero salary rows are valid (leave without pay).
	record := RecordInput{
		GrossSalary:          "0.00",
		MemberContribution:   "0.00",
		EmployerContribution: "0.00",
		AEDAmount:            "0.00",
		SAEDAmount:           "0.00",
		AAPAmount:            "0.00",
		DCSupplementAmount:   "0.00",
		TotalAmount:          "0.00",
		IsORP:                false,
	}

	errors := ValidateRecord(record, stateRates)
	if len(errors) != 0 {
		t.Errorf("expected no errors for zero salary, got %d", len(errors))
	}
}

func TestValidateRecord_NegativeSalary(t *testing.T) {
	record := RecordInput{
		GrossSalary:          "-1000.00",
		MemberContribution:   "0.00",
		EmployerContribution: "0.00",
		AEDAmount:            "0.00",
		SAEDAmount:           "0.00",
		AAPAmount:            "0.00",
		DCSupplementAmount:   "0.00",
		TotalAmount:          "0.00",
		IsORP:                false,
	}

	errors := ValidateRecord(record, stateRates)
	if len(errors) == 0 {
		t.Fatal("expected error for negative salary")
	}
	if errors[0].Code != "INVALID_SALARY" {
		t.Errorf("expected INVALID_SALARY, got %s", errors[0].Code)
	}
}

func TestValidateRecord_TotalMismatch(t *testing.T) {
	record := RecordInput{
		GrossSalary:          "5000.00",
		MemberContribution:   "550.00",
		EmployerContribution: "520.00",
		AEDAmount:            "250.00",
		SAEDAmount:           "250.00",
		AAPAmount:            "50.00",
		DCSupplementAmount:   "12.50",
		TotalAmount:          "9999.99", // wrong total
		IsORP:                false,
	}

	errors := ValidateRecord(record, stateRates)
	foundTotal := false
	for _, e := range errors {
		if e.Code == "TOTAL_MISMATCH" {
			foundTotal = true
		}
	}
	if !foundTotal {
		t.Error("expected TOTAL_MISMATCH error")
	}
}

func TestValidateRecord_PennyTolerance(t *testing.T) {
	// 1 penny rounding difference should still pass.
	record := RecordInput{
		GrossSalary:          "3333.33",
		MemberContribution:   "366.67", // 3333.33 * 0.11 = 366.6663 → rounds to 366.67
		EmployerContribution: "346.67", // 3333.33 * 0.104 = 346.66632 → 346.67
		AEDAmount:            "166.67", // 3333.33 * 0.05 = 166.6665 → 166.67
		SAEDAmount:           "166.67",
		AAPAmount:            "33.33", // 3333.33 * 0.01 = 33.3333
		DCSupplementAmount:   "8.33",  // 3333.33 * 0.0025 = 8.333325
		TotalAmount:          "1088.34",
		IsORP:                false,
	}

	errors := ValidateRecord(record, stateRates)
	if len(errors) != 0 {
		t.Errorf("expected no errors within penny tolerance, got %d: %v", len(errors), errors)
	}
}

func TestValidateNegativeAmounts(t *testing.T) {
	record := RecordInput{
		GrossSalary:          "5000.00",
		MemberContribution:   "-100.00", // negative
		EmployerContribution: "520.00",
		AEDAmount:            "250.00",
		SAEDAmount:           "250.00",
		AAPAmount:            "50.00",
		DCSupplementAmount:   "12.50",
		TotalAmount:          "982.50",
		IsORP:                false,
	}

	errors := ValidateNegativeAmounts(record)
	if len(errors) == 0 {
		t.Fatal("expected negative amount error")
	}
	if errors[0].Code != "NEGATIVE_AMOUNT" {
		t.Errorf("expected NEGATIVE_AMOUNT, got %s", errors[0].Code)
	}
}

func TestValidateRecord_LocalGovRates(t *testing.T) {
	// Local Government Jan 2026 rates (non-safety).
	lgRates := RateInput{
		MemberRate:        "0.090000",
		EmployerBaseRate:  "0.100000",
		AEDRate:           "0.027000",
		SAEDRate:          "0.020000",
		AAPRate:           "0.010000",
		DCSupplementRate:  "0.001000",
		EmployerTotalRate: "0.158000",
	}

	// Salary: $4,000
	record := RecordInput{
		GrossSalary:          "4000.00",
		MemberContribution:   "360.00", // 4000 * 0.09
		EmployerContribution: "400.00", // 4000 * 0.10
		AEDAmount:            "108.00", // 4000 * 0.027
		SAEDAmount:           "80.00",  // 4000 * 0.02
		AAPAmount:            "40.00",  // 4000 * 0.01
		DCSupplementAmount:   "4.00",   // 4000 * 0.001
		TotalAmount:          "992.00",
		IsORP:                false,
	}

	errors := ValidateRecord(record, lgRates)
	if len(errors) != 0 {
		t.Errorf("expected no errors for Local Gov record, got %d: %v", len(errors), errors)
	}
}

func TestValidateRecord_SafetyOfficerRates(t *testing.T) {
	// State Safety Officer Jan 2026 rates.
	safetyRates := RateInput{
		MemberRate:        "0.130000",
		EmployerBaseRate:  "0.131000",
		AEDRate:           "0.050000",
		SAEDRate:          "0.050000",
		AAPRate:           "0.010000",
		DCSupplementRate:  "0.002500",
		EmployerTotalRate: "0.243500",
	}

	// Salary: $6,000
	record := RecordInput{
		GrossSalary:          "6000.00",
		MemberContribution:   "780.00", // 6000 * 0.13
		EmployerContribution: "786.00", // 6000 * 0.131
		AEDAmount:            "300.00", // 6000 * 0.05
		SAEDAmount:           "300.00",
		AAPAmount:            "60.00",
		DCSupplementAmount:   "15.00", // 6000 * 0.0025
		TotalAmount:          "2241.00",
		IsORP:                false,
	}

	errors := ValidateRecord(record, safetyRates)
	if len(errors) != 0 {
		t.Errorf("expected no errors for Safety Officer record, got %d: %v", len(errors), errors)
	}
}
