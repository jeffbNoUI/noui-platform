package rules

import (
	"math"
	"testing"

	"github.com/noui/platform/intelligence/models"
)

func TestRoundToCents(t *testing.T) {
	tests := []struct {
		input    float64
		expected float64
	}{
		{1633.074, 1633.07},
		{1633.075, 1633.08}, // Banker's rounding rounds .5 up for odd
		{1633.076, 1633.08},
		{2332.955, 2332.96},
		{100.005, 100.01},
		{0.00, 0.00},
	}

	for _, tt := range tests {
		got := roundToCents(tt.input)
		if got != tt.expected {
			t.Errorf("roundToCents(%.4f) = %.2f, want %.2f", tt.input, got, tt.expected)
		}
	}
}

func TestCalculateBenefit_Case1_Martinez(t *testing.T) {
	// Case 1: Robert Martinez — Tier 1, Rule of 75, leave payout
	// AMS: hand-calculated value
	// Formula: AMS × 2.0% × 28.75 years
	// No reduction (Rule of 75 met)
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
	// Using a representative AMS for testing
	ams := models.AMSData{
		WindowMonths:    36,
		Amount:          7330.72, // Representative AMS for Robert
		LeavePayoutIncl: true,
		LeavePayoutAmt:  52000.0,
	}
	retDate := parseDate("2026-04-01")

	result := CalculateBenefit(member, svcCredit, ams, nil, retDate)

	// Verify tier
	if result.Tier != 1 {
		t.Errorf("Martinez tier = %d, want 1", result.Tier)
	}

	// Verify multiplier
	if result.Formula.Multiplier != 0.020 {
		t.Errorf("Martinez multiplier = %.4f, want 0.0200", result.Formula.Multiplier)
	}

	// Verify service years used
	if result.Formula.ServiceYears != 28.75 {
		t.Errorf("Martinez service years = %.2f, want 28.75", result.Formula.ServiceYears)
	}

	// Verify no reduction
	if result.Reduction.Applies {
		t.Error("Martinez should have no reduction (Rule of 75 met)")
	}

	// Verify gross benefit formula: AMS × 0.020 × 28.75
	expectedGross := 7330.72 * 0.020 * 28.75
	if math.Abs(result.Formula.GrossBenefit-expectedGross) > 0.01 {
		t.Errorf("Martinez gross benefit = %.2f, want %.2f", result.Formula.GrossBenefit, expectedGross)
	}

	// Death benefit: normal retirement = $5,000
	if result.DeathBenefit.Amount != 5000.00 {
		t.Errorf("Martinez death benefit = %.2f, want 5000.00", result.DeathBenefit.Amount)
	}
}

func TestCalculateBenefit_Case2_Kim(t *testing.T) {
	// Case 2: Jennifer Kim — Tier 2, early retirement, purchased service, 30% reduction
	// AMS: $7,347.62 (36-month window)
	// Total for calc: 21.17 years (18.17 earned + 3.00 purchased)
	// Unreduced: $7,347.62 × 0.015 × 21.17 = $2,332.96
	// Reduced: $2,332.96 × 0.70 = $1,633.07
	member := models.MemberData{
		MemberID: 10002,
		DOB:      parseDate("1970-06-22"),
		HireDate: parseDate("2008-03-01"),
		TierCode: 2,
	}
	svcCredit := models.ServiceCreditData{
		EarnedYears:      18.17,
		PurchasedYears:   3.00,
		EligibilityYears: 18.17,
		BenefitYears:     21.17,
		TotalYears:       21.17,
	}
	ams := models.AMSData{
		WindowMonths: 36,
		Amount:       7347.62,
	}
	retDate := parseDate("2026-05-01")

	result := CalculateBenefit(member, svcCredit, ams, nil, retDate)

	// Verify tier
	if result.Tier != 2 {
		t.Errorf("Kim tier = %d, want 2", result.Tier)
	}

	// Verify multiplier
	if result.Formula.Multiplier != 0.015 {
		t.Errorf("Kim multiplier = %.4f, want 0.0150", result.Formula.Multiplier)
	}

	// Verify benefit years includes purchased service
	if result.Formula.ServiceYears != 21.17 {
		t.Errorf("Kim service years = %.2f, want 21.17", result.Formula.ServiceYears)
	}

	// Verify unreduced benefit: $7,347.62 × 0.015 × 21.17
	expectedGross := 7347.62 * 0.015 * 21.17
	if math.Abs(result.Formula.GrossBenefit-expectedGross) > 0.01 {
		t.Errorf("Kim gross benefit = %.2f, want %.2f", result.Formula.GrossBenefit, expectedGross)
	}

	// Verify reduction applies
	if !result.Reduction.Applies {
		t.Error("Kim should have early retirement reduction")
	}

	// Verify reduction factor
	if result.Reduction.ReductionFactor != 0.70 {
		t.Errorf("Kim reduction factor = %.4f, want 0.7000", result.Reduction.ReductionFactor)
	}

	// Verify reduced benefit: $2,332.96 × 0.70 = $1,633.07
	// The exact value depends on rounding, but should be close
	expectedReduced := roundToCents(expectedGross * 0.70)
	if math.Abs(result.MaximumBenefit-expectedReduced) > 0.02 {
		t.Errorf("Kim maximum benefit = %.2f, want ~%.2f", result.MaximumBenefit, expectedReduced)
	}

	// Verify death benefit for early retirement age 55
	if result.DeathBenefit.Amount != 2500.00 {
		t.Errorf("Kim death benefit = %.2f, want 2500.00", result.DeathBenefit.Amount)
	}

	// Verify IPR uses earned service only
	expectedIPR := roundToCents(12.50 * 18.17)
	if math.Abs(result.IPR.NonMedicareMonthly-expectedIPR) > 0.02 {
		t.Errorf("Kim IPR = %.2f, want ~%.2f (earned service only)", result.IPR.NonMedicareMonthly, expectedIPR)
	}
}

func TestCalculateBenefit_Case3_Washington(t *testing.T) {
	// Case 3: David Washington — Tier 3, early retirement, 12% reduction
	// AMS: 60-month window
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
	ams := models.AMSData{
		WindowMonths: 60,
		Amount:       7200.00, // Representative AMS
	}
	retDate := parseDate("2026-04-01")

	result := CalculateBenefit(member, svcCredit, ams, nil, retDate)

	if result.Tier != 3 {
		t.Errorf("Washington tier = %d, want 3", result.Tier)
	}

	if result.Formula.Multiplier != 0.015 {
		t.Errorf("Washington multiplier = %.4f, want 0.0150", result.Formula.Multiplier)
	}

	if !result.Reduction.Applies {
		t.Error("Washington should have early retirement reduction")
	}

	if result.Reduction.ReductionFactor != 0.88 {
		t.Errorf("Washington reduction factor = %.4f, want 0.8800", result.Reduction.ReductionFactor)
	}

	// Death benefit for Tier 3 early retirement at age 63
	if result.DeathBenefit.Amount != 4000.00 {
		t.Errorf("Washington death benefit = %.2f, want 4000.00", result.DeathBenefit.Amount)
	}
}

func TestCalculateDRO_Case4(t *testing.T) {
	// Case 4: Robert Martinez DRO variant
	// Marriage: Jun 15, 1997 (same as hire), Divorce: Mar 1, 2010
	// Marital service: 12yr 8mo = 12.67 years
	// Total service: 28.75 years
	// Marital fraction: 12.67 / 28.75 = ~0.4407
	// DRO division: 40% of marital share
	dro := models.DROData{
		HasDRO:         true,
		MarriageDate:   parseDate("1997-06-15"),
		DivorceDate:    parseDate("2010-03-01"),
		DivisionMethod: "PERCENTAGE",
		DivisionValue:  40.0,
		AltPayeeFirst:  "Patricia",
		AltPayeeLast:   "Martinez",
	}

	hireDate := parseDate("1997-06-15")
	retDate := parseDate("2026-04-01")
	svcCredit := models.ServiceCreditData{
		EarnedYears:      28.75,
		BenefitYears:     28.75,
		EligibilityYears: 28.75,
		TotalYears:       28.75,
	}

	// Assume a gross benefit of $4,215.16 for testing
	grossBenefit := 4215.16

	result := CalculateDRO(dro, hireDate, retDate, svcCredit, grossBenefit)

	if !result.HasDRO {
		t.Error("Should have DRO")
	}

	// Marital service: hire=1997-06-15, marriage=1997-06-15 (same), divorce=2010-03-01
	// ~12.67 years
	if result.MaritalServiceYears < 12.5 || result.MaritalServiceYears > 12.9 {
		t.Errorf("Marital service years = %.2f, want ~12.67", result.MaritalServiceYears)
	}

	// Marital fraction: ~12.67/28.75 = ~0.4407
	if result.MaritalFraction < 0.43 || result.MaritalFraction > 0.45 {
		t.Errorf("Marital fraction = %.4f, want ~0.4407", result.MaritalFraction)
	}

	// Alt payee gets 40% of marital share
	if result.AltPayeePct != 40.0 {
		t.Errorf("Alt payee pct = %.2f, want 40.00", result.AltPayeePct)
	}

	// Member's benefit after DRO should be less than gross
	if result.MemberAfterDRO >= grossBenefit {
		t.Error("Member benefit after DRO should be less than gross benefit")
	}
	if result.MemberAfterDRO <= 0 {
		t.Error("Member benefit after DRO should be positive")
	}
}

func TestCalculatePaymentOptions(t *testing.T) {
	base := 4215.16

	options := CalculatePaymentOptions(base)

	if options.Maximum != base {
		t.Errorf("Maximum = %.2f, want %.2f", options.Maximum, base)
	}

	// JS 100% should be base × 0.8850
	expectedJS100 := roundToCents(base * 0.8850)
	if options.JS100.MemberAmount != expectedJS100 {
		t.Errorf("JS 100%% member = %.2f, want %.2f", options.JS100.MemberAmount, expectedJS100)
	}

	// Survivor at 100% J&S gets same as member
	if options.JS100.SurvivorAmount != expectedJS100 {
		t.Errorf("JS 100%% survivor = %.2f, want %.2f", options.JS100.SurvivorAmount, expectedJS100)
	}

	// Verify disclaimer present
	if options.Disclaimer == "" {
		t.Error("Payment options should include illustrative disclaimer")
	}
}

func TestCalculateIPR(t *testing.T) {
	// CRITICAL: IPR uses earned service only, purchased excluded
	tests := []struct {
		name               string
		earnedYears        float64
		expectedNonMedicare float64
		expectedMedicare   float64
	}{
		// Case 1: Martinez, 28.75 earned years
		{"Martinez IPR", 28.75, roundToCents(12.50 * 28.75), roundToCents(6.25 * 28.75)},
		// Case 2: Kim, 18.17 earned years (NOT 21.17 total)
		{"Kim IPR (earned only)", 18.17, roundToCents(12.50 * 18.17), roundToCents(6.25 * 18.17)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ipr := CalculateIPR(tt.earnedYears)
			if math.Abs(ipr.NonMedicareMonthly-tt.expectedNonMedicare) > 0.02 {
				t.Errorf("Non-Medicare IPR = %.2f, want %.2f", ipr.NonMedicareMonthly, tt.expectedNonMedicare)
			}
			if math.Abs(ipr.MedicareMonthly-tt.expectedMedicare) > 0.02 {
				t.Errorf("Medicare IPR = %.2f, want %.2f", ipr.MedicareMonthly, tt.expectedMedicare)
			}
		})
	}
}

func TestDeathBenefit_StatutoryTables(t *testing.T) {
	// Verify death benefit statutory table lookups
	// Tiers 1&2: $250 increment from $2,500 (age 55) to $5,000 (age 65)
	for age := 55; age <= 65; age++ {
		expected := 2500.0 + float64(age-55)*250.0
		db := CalculateDeathBenefit(1, age, "EARLY")
		if db.Amount != expected {
			t.Errorf("T12 death benefit at age %d = %.2f, want %.2f", age, db.Amount, expected)
		}
	}

	// Tier 3: $500 increment from $2,500 (age 60) to $5,000 (age 65)
	for age := 60; age <= 65; age++ {
		expected := 2500.0 + float64(age-60)*500.0
		db := CalculateDeathBenefit(3, age, "EARLY")
		if db.Amount != expected {
			t.Errorf("T3 death benefit at age %d = %.2f, want %.2f", age, db.Amount, expected)
		}
	}

	// Normal retirement always $5,000
	db := CalculateDeathBenefit(1, 65, "NORMAL")
	if db.Amount != 5000.00 {
		t.Errorf("Normal retirement death benefit = %.2f, want 5000.00", db.Amount)
	}

	// Rule of 75 also $5,000
	db = CalculateDeathBenefit(1, 63, "RULE_OF_75")
	if db.Amount != 5000.00 {
		t.Errorf("Rule of 75 death benefit = %.2f, want 5000.00", db.Amount)
	}
}
