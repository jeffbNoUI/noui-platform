package rules

import (
	"testing"
	"time"

	"github.com/noui/platform/intelligence/models"
)

func TestDetermineTier(t *testing.T) {
	tests := []struct {
		name     string
		hireDate string
		expected int
	}{
		// Tier 1: before Sep 1, 2004
		{"Tier 1 - early hire", "1997-06-15", 1},
		{"Tier 1 - boundary (day before)", "2004-08-31", 1},
		// Tier 2: Sep 1, 2004 - Jun 30, 2011
		{"Tier 2 - boundary (exact)", "2004-09-01", 2},
		{"Tier 2 - mid range", "2008-03-01", 2},
		{"Tier 2 - boundary (last day)", "2011-06-30", 2},
		// Tier 3: on/after Jul 1, 2011
		{"Tier 3 - boundary (exact)", "2011-07-01", 3},
		{"Tier 3 - recent hire", "2012-09-01", 3},
		{"Tier 3 - new hire", "2025-01-15", 3},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hd, _ := time.Parse("2006-01-02", tt.hireDate)
			got := DetermineTier(hd)
			if got != tt.expected {
				t.Errorf("DetermineTier(%s) = %d, want %d", tt.hireDate, got, tt.expected)
			}
		})
	}
}

func TestCalculateAge(t *testing.T) {
	tests := []struct {
		name       string
		dob        string
		atDate     string
		wantYears  int
		wantMonths int
	}{
		// Case 1: Robert Martinez at Apr 1, 2026
		{"Martinez age", "1963-03-08", "2026-04-01", 63, 0},
		// Case 2: Jennifer Kim at May 1, 2026
		{"Kim age", "1970-06-22", "2026-05-01", 55, 10},
		// Case 3: David Washington at Apr 1, 2026
		{"Washington age", "1963-02-14", "2026-04-01", 63, 1},
		// Boundary cases
		{"exact birthday", "1990-06-15", "2026-06-15", 36, 0},
		{"day before birthday", "1990-06-15", "2026-06-14", 35, 11},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dob, _ := time.Parse("2006-01-02", tt.dob)
			atDate, _ := time.Parse("2006-01-02", tt.atDate)
			got := CalculateAge(dob, atDate)
			if got.Years != tt.wantYears || got.Months != tt.wantMonths {
				t.Errorf("CalculateAge(%s, %s) = %d yr %d mo, want %d yr %d mo",
					tt.dob, tt.atDate, got.Years, got.Months, tt.wantYears, tt.wantMonths)
			}
		})
	}
}

func TestCalculateEarnedService(t *testing.T) {
	tests := []struct {
		name      string
		hire      string
		end       string
		expected  float64
		tolerance float64
	}{
		// Case 1: Robert Martinez Jun 15, 1997 to Apr 1, 2026 = 28yr 9mo
		{"Martinez service", "1997-06-15", "2026-04-01", 28.75, 0.05},
		// Case 2: Jennifer Kim Mar 1, 2008 to May 1, 2026 = 18yr 2mo
		{"Kim service", "2008-03-01", "2026-05-01", 18.1667, 0.05},
		// Case 3: David Washington Sep 1, 2012 to Apr 1, 2026 = 13yr 7mo
		{"Washington service", "2012-09-01", "2026-04-01", 13.5833, 0.05},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hire, _ := time.Parse("2006-01-02", tt.hire)
			end, _ := time.Parse("2006-01-02", tt.end)
			got := CalculateEarnedService(hire, end)
			diff := got - tt.expected
			if diff < -tt.tolerance || diff > tt.tolerance {
				t.Errorf("CalculateEarnedService(%s, %s) = %.4f, want ~%.4f (tolerance %.4f)",
					tt.hire, tt.end, got, tt.expected, tt.tolerance)
			}
		})
	}
}

func TestEvaluateEligibility_Case1_Martinez(t *testing.T) {
	// Case 1: Robert Martinez — Tier 1, Rule of 75, no reduction
	// Age 63 + earned service 28.75 = 91.75 >= 75 ✓
	member := models.MemberData{
		MemberID: 10001,
		DOB:      parseDate("1963-03-08"),
		HireDate: parseDate("1997-06-15"),
		TierCode: 1,
	}
	svcCredit := models.ServiceCreditData{
		EarnedYears:      28.75,
		PurchasedYears:   0,
		EligibilityYears: 28.75,
		BenefitYears:     28.75,
		TotalYears:       28.75,
	}
	retDate := parseDate("2026-04-01")

	result := EvaluateEligibility(member, svcCredit, retDate)

	if result.Tier != 1 {
		t.Errorf("Martinez tier = %d, want 1", result.Tier)
	}
	if result.BestEligible != "RULE_OF_75" {
		t.Errorf("Martinez eligibility = %s, want RULE_OF_75", result.BestEligible)
	}
	if result.ReductionPct != 0 {
		t.Errorf("Martinez reduction = %.2f%%, want 0%%", result.ReductionPct)
	}
	if result.ReductionFactor != 1.0 {
		t.Errorf("Martinez reduction factor = %.4f, want 1.0000", result.ReductionFactor)
	}
	// RuleOfNSum must be populated (age 63.07 + service 28.75 ≈ 91.82)
	if result.RuleOfNSum < 90.0 || result.RuleOfNSum > 93.0 {
		t.Errorf("Martinez RuleOfNSum = %.2f, want ~91.8", result.RuleOfNSum)
	}
}

func TestEvaluateEligibility_Case2_Kim(t *testing.T) {
	// Case 2: Jennifer Kim — Tier 2, early retirement, 30% reduction
	// Age 55 + earned service 18.17 = 73.17 < 75 → Rule of 75 NOT met
	// Age >= 55 and vested → early retirement
	// Reduction: 3% × 10 years = 30% → factor 0.70
	member := models.MemberData{
		MemberID: 10002,
		DOB:      parseDate("1970-06-22"),
		HireDate: parseDate("2008-03-01"),
		TierCode: 2,
	}
	svcCredit := models.ServiceCreditData{
		EarnedYears:      18.17,
		PurchasedYears:   3.0,
		EligibilityYears: 18.17, // Earned only for eligibility
		BenefitYears:     21.17, // Earned + purchased for benefit formula
		TotalYears:       21.17,
	}
	retDate := parseDate("2026-05-01")

	result := EvaluateEligibility(member, svcCredit, retDate)

	if result.Tier != 2 {
		t.Errorf("Kim tier = %d, want 2", result.Tier)
	}
	if result.BestEligible != "EARLY" {
		t.Errorf("Kim eligibility = %s, want EARLY", result.BestEligible)
	}
	if result.ReductionPct != 30.0 {
		t.Errorf("Kim reduction = %.2f%%, want 30.00%%", result.ReductionPct)
	}
	if result.ReductionFactor != 0.70 {
		t.Errorf("Kim reduction factor = %.4f, want 0.7000", result.ReductionFactor)
	}
	// RuleOfNSum must be populated (age 55.86 + service 18.17 ≈ 74.03)
	if result.RuleOfNSum < 73.0 || result.RuleOfNSum > 75.0 {
		t.Errorf("Kim RuleOfNSum = %.2f, want ~74.0", result.RuleOfNSum)
	}
}

func TestEvaluateEligibility_Case3_Washington(t *testing.T) {
	// Case 3: David Washington — Tier 3, early retirement, 12% reduction
	// Age 63 + earned service 13.58 = 76.58 < 85 → Rule of 85 NOT met
	// Age >= 60 and vested → early retirement
	// Reduction: 6% × 2 years = 12% → factor 0.88
	member := models.MemberData{
		MemberID: 10003,
		DOB:      parseDate("1963-02-14"),
		HireDate: parseDate("2012-09-01"),
		TierCode: 3,
	}
	svcCredit := models.ServiceCreditData{
		EarnedYears:      13.58,
		PurchasedYears:   0,
		EligibilityYears: 13.58,
		BenefitYears:     13.58,
		TotalYears:       13.58,
	}
	retDate := parseDate("2026-04-01")

	result := EvaluateEligibility(member, svcCredit, retDate)

	if result.Tier != 3 {
		t.Errorf("Washington tier = %d, want 3", result.Tier)
	}
	if result.BestEligible != "EARLY" {
		t.Errorf("Washington eligibility = %s, want EARLY", result.BestEligible)
	}
	if result.ReductionPct != 12.0 {
		t.Errorf("Washington reduction = %.2f%%, want 12.00%%", result.ReductionPct)
	}
	if result.ReductionFactor != 0.88 {
		t.Errorf("Washington reduction factor = %.4f, want 0.8800", result.ReductionFactor)
	}
}

func TestRuleOf75_Boundary(t *testing.T) {
	// Exact boundary: age 55, earned service 20.00, sum = 75.00 → met
	member := models.MemberData{
		MemberID: 99999,
		DOB:      parseDate("1971-01-01"),
		HireDate: parseDate("2000-01-01"),
		TierCode: 1,
	}
	svcCredit := models.ServiceCreditData{
		EarnedYears:      20.0,
		EligibilityYears: 20.0,
		BenefitYears:     20.0,
		TotalYears:       20.0,
	}
	retDate := parseDate("2026-01-01")

	result := EvaluateEligibility(member, svcCredit, retDate)

	if result.BestEligible != "RULE_OF_75" {
		t.Errorf("Boundary Rule of 75 eligibility = %s, want RULE_OF_75", result.BestEligible)
	}
}

func TestRuleOf75_JustBelow(t *testing.T) {
	// Just below: age 55, earned service 19.99, sum = 74.99 → NOT met
	member := models.MemberData{
		MemberID: 99998,
		DOB:      parseDate("1971-01-01"),
		HireDate: parseDate("2000-01-01"),
		TierCode: 1,
	}
	svcCredit := models.ServiceCreditData{
		EarnedYears:      19.99,
		EligibilityYears: 19.99,
		BenefitYears:     19.99,
		TotalYears:       19.99,
	}
	retDate := parseDate("2026-01-01")

	result := EvaluateEligibility(member, svcCredit, retDate)

	if result.BestEligible == "RULE_OF_75" {
		t.Error("Should NOT meet Rule of 75 with sum 74.99")
	}
}

func TestPurchasedServiceExcludedFromRuleOf75(t *testing.T) {
	// CRITICAL test: Purchased service must NOT count toward Rule of 75
	// Age 55, earned 17.0, purchased 4.0 → eligible sum = 55+17 = 72 (NOT 55+21=76)
	member := models.MemberData{
		MemberID: 99997,
		DOB:      parseDate("1971-01-01"),
		HireDate: parseDate("2000-01-01"),
		TierCode: 2,
	}
	svcCredit := models.ServiceCreditData{
		EarnedYears:      17.0,
		PurchasedYears:   4.0,
		EligibilityYears: 17.0, // Earned only
		BenefitYears:     21.0, // Earned + purchased
		TotalYears:       21.0,
	}
	retDate := parseDate("2026-01-01")

	result := EvaluateEligibility(member, svcCredit, retDate)

	if result.BestEligible == "RULE_OF_75" {
		t.Error("CRITICAL: Purchased service must NOT count toward Rule of 75")
	}
	if result.BestEligible != "EARLY" {
		t.Errorf("Expected EARLY, got %s", result.BestEligible)
	}
}

func TestEarlyRetReduction_StatutoryTable(t *testing.T) {
	// Verify all statutory table entries for Tiers 1&2
	expectedT12 := map[int]float64{
		55: 0.70, 56: 0.73, 57: 0.76, 58: 0.79, 59: 0.82,
		60: 0.85, 61: 0.88, 62: 0.91, 63: 0.94, 64: 0.97, 65: 1.00,
	}
	for age, expected := range expectedT12 {
		got := lookupReductionFactor(1, age)
		if got != expected {
			t.Errorf("T12 reduction at age %d = %.4f, want %.4f", age, got, expected)
		}
	}

	// Verify Tier 3 table
	expectedT3 := map[int]float64{
		60: 0.70, 61: 0.76, 62: 0.82, 63: 0.88, 64: 0.94, 65: 1.00,
	}
	for age, expected := range expectedT3 {
		got := lookupReductionFactor(3, age)
		if got != expected {
			t.Errorf("T3 reduction at age %d = %.4f, want %.4f", age, got, expected)
		}
	}
}

func parseDate(s string) time.Time {
	t, _ := time.Parse("2006-01-02", s)
	return t
}
