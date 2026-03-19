package domain

import "testing"

func TestCalculatePenalty_OverLimit_Basic(t *testing.T) {
	result, err := CalculatePenalty(PenaltyInput{
		PenaltyType:    PenaltyOverLimit,
		MonthlyBenefit: "4832.17",
		DaysOverLimit:  3,
		SpreadMonths:   1,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// 5% × $4832.17 × 3 = $724.8255 → $724.83 (rounded to 2dp)
	if result.PenaltyAmount != "724.83" {
		t.Errorf("expected penalty $724.83, got %s", result.PenaltyAmount)
	}
	if result.PenaltyRate != "0.0500" {
		t.Errorf("expected rate 0.0500, got %s", result.PenaltyRate)
	}
	if result.MonthlyDeduction != "724.83" {
		t.Errorf("expected monthly deduction $724.83, got %s", result.MonthlyDeduction)
	}
}

func TestCalculatePenalty_OverLimit_SingleDay(t *testing.T) {
	result, err := CalculatePenalty(PenaltyInput{
		PenaltyType:    PenaltyOverLimit,
		MonthlyBenefit: "3500.00",
		DaysOverLimit:  1,
		SpreadMonths:   1,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 5% × $3500.00 × 1 = $175.00
	if result.PenaltyAmount != "175.00" {
		t.Errorf("expected $175.00, got %s", result.PenaltyAmount)
	}
}

func TestCalculatePenalty_OverLimit_Spread(t *testing.T) {
	result, err := CalculatePenalty(PenaltyInput{
		PenaltyType:    PenaltyOverLimit,
		MonthlyBenefit: "4000.00",
		DaysOverLimit:  10,
		SpreadMonths:   4,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 5% × $4000.00 × 10 = $2000.00
	if result.PenaltyAmount != "2000.00" {
		t.Errorf("expected $2000.00, got %s", result.PenaltyAmount)
	}
	// Spread across 4 months: $2000 / 4 = $500.00
	if result.MonthlyDeduction != "500.00" {
		t.Errorf("expected $500.00 monthly deduction, got %s", result.MonthlyDeduction)
	}
}

func TestCalculatePenalty_FirstBusinessDay(t *testing.T) {
	result, err := CalculatePenalty(PenaltyInput{
		PenaltyType:    PenaltyFirstBusinessDay,
		MonthlyBenefit: "4832.17",
		SpreadMonths:   1,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Full month cancellation = 100% of benefit
	if result.PenaltyAmount != "4832.17" {
		t.Errorf("expected full benefit $4832.17, got %s", result.PenaltyAmount)
	}
	if result.PenaltyRate != "1.0000" {
		t.Errorf("expected rate 1.0000, got %s", result.PenaltyRate)
	}
}

func TestCalculatePenalty_NonDisclosure(t *testing.T) {
	result, err := CalculatePenalty(PenaltyInput{
		PenaltyType:           PenaltyNonDisclosure,
		MonthlyBenefit:        "4000.00",
		RetireeContributions:  "45230.15",
		EmployerContributions: "95850.75",
		SpreadMonths:          12,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Total recovery = $45230.15 + $95850.75 = $141080.90
	if result.PenaltyAmount != "141080.90" {
		t.Errorf("expected $141080.90, got %s", result.PenaltyAmount)
	}
	if result.RetireeRecovery != "45230.15" {
		t.Errorf("expected retiree recovery $45230.15, got %s", result.RetireeRecovery)
	}
	if result.EmployerRecovery != "95850.75" {
		t.Errorf("expected employer recovery $95850.75, got %s", result.EmployerRecovery)
	}
	// Monthly deduction: $141080.90 / 12 = $11756.74 (rounded)
	if result.MonthlyDeduction != "11756.74" {
		t.Errorf("expected $11756.74 monthly deduction, got %s", result.MonthlyDeduction)
	}
}

func TestCalculatePenalty_OverLimit_ZeroDays(t *testing.T) {
	_, err := CalculatePenalty(PenaltyInput{
		PenaltyType:    PenaltyOverLimit,
		MonthlyBenefit: "4000.00",
		DaysOverLimit:  0,
	})
	if err == nil {
		t.Error("expected error for zero days over limit")
	}
}

func TestCalculatePenalty_InvalidType(t *testing.T) {
	_, err := CalculatePenalty(PenaltyInput{
		PenaltyType:    "BOGUS",
		MonthlyBenefit: "4000.00",
	})
	if err == nil {
		t.Error("expected error for invalid penalty type")
	}
}

func TestCalculatePenalty_InvalidBenefit(t *testing.T) {
	_, err := CalculatePenalty(PenaltyInput{
		PenaltyType:    PenaltyOverLimit,
		MonthlyBenefit: "abc",
		DaysOverLimit:  1,
	})
	if err == nil {
		t.Error("expected error for invalid benefit")
	}
}

func TestCalculatePenalty_NonDisclosure_MissingContributions(t *testing.T) {
	_, err := CalculatePenalty(PenaltyInput{
		PenaltyType:    PenaltyNonDisclosure,
		MonthlyBenefit: "4000.00",
	})
	if err == nil {
		t.Error("expected error for missing contributions in NON_DISCLOSURE")
	}
}

func TestCalculatePenalty_DefaultSpreadToOne(t *testing.T) {
	result, err := CalculatePenalty(PenaltyInput{
		PenaltyType:    PenaltyOverLimit,
		MonthlyBenefit: "3000.00",
		DaysOverLimit:  2,
		SpreadMonths:   0, // should default to 1
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// $3000 × 5% × 2 = $300
	if result.SpreadMonths != 1 {
		t.Errorf("expected spread months defaulted to 1, got %d", result.SpreadMonths)
	}
	if result.MonthlyDeduction != "300.00" {
		t.Errorf("expected $300.00, got %s", result.MonthlyDeduction)
	}
}

// Penny-accuracy test: ensure no float64 rounding errors
func TestCalculatePenalty_PennyAccuracy(t *testing.T) {
	// $4999.99 × 5% × 7 = $1749.9965 → $1750.00 (banker's rounding)
	result, err := CalculatePenalty(PenaltyInput{
		PenaltyType:    PenaltyOverLimit,
		MonthlyBenefit: "4999.99",
		DaysOverLimit:  7,
		SpreadMonths:   1,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// big.Rat: 4999.99 × 5/100 × 7 = 499999/100 × 5/100 × 7 = 17499965/10000 = 1749.9965
	// FloatString(2) rounds to "1750.00"
	if result.PenaltyAmount != "1750.00" {
		t.Errorf("expected $1750.00 (penny accurate), got %s", result.PenaltyAmount)
	}
}

// Test large spread: ensure no precision loss in division
func TestCalculatePenalty_LargeSpread(t *testing.T) {
	result, err := CalculatePenalty(PenaltyInput{
		PenaltyType:    PenaltyOverLimit,
		MonthlyBenefit: "5000.00",
		DaysOverLimit:  20,
		SpreadMonths:   36,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// $5000 × 5% × 20 = $5000
	if result.PenaltyAmount != "5000.00" {
		t.Errorf("expected $5000.00, got %s", result.PenaltyAmount)
	}
	// $5000 / 36 = $138.888... → $138.89
	if result.MonthlyDeduction != "138.89" {
		t.Errorf("expected $138.89, got %s", result.MonthlyDeduction)
	}
}
