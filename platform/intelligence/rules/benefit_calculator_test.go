package rules

import (
	"testing"
	"time"

	"github.com/noui/platform/intelligence/models"
	"github.com/noui/platform/intelligence/money"
)

func parseDate(s string) time.Time {
	t, _ := time.Parse("2006-01-02", s)
	return t
}

func TestCalculateBenefit_Case1_Martinez(t *testing.T) {
	// Case 1: Robert Martinez — Tier 1, Rule of 75, leave payout
	// Hand calc: $7,330.72 × 0.020 × 28.75 = $4,215.164 → $4,215.16
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
	ams := models.AMSData{
		WindowMonths:    36,
		Amount:          money.FromFloat64(7330.72),
		LeavePayoutIncl: true,
		LeavePayoutAmt:  money.FromFloat64(52000.0),
	}
	retDate := parseDate("2026-04-01")

	result := CalculateBenefit(member, svcCredit, ams, nil, retDate)

	if result.Tier != 1 {
		t.Errorf("Martinez tier = %d, want 1", result.Tier)
	}
	if result.Formula.Multiplier != 0.020 {
		t.Errorf("Martinez multiplier = %.4f, want 0.0200", result.Formula.Multiplier)
	}
	if result.Formula.ServiceYears != 28.75 {
		t.Errorf("Martinez service years = %.2f, want 28.75", result.Formula.ServiceYears)
	}
	if result.Reduction.Applies {
		t.Error("Martinez should have no reduction (Rule of 75 met)")
	}

	// Exact: 7330.72 × 0.020 × 28.75 = 4215.164 → $4,215.16
	if got := result.Formula.GrossBenefit.String(); got != "4215.16" {
		t.Errorf("Martinez gross = %s, want 4215.16", got)
	}
	if got := result.MaximumBenefit.String(); got != "4215.16" {
		t.Errorf("Martinez maximum = %s, want 4215.16", got)
	}

	// Death benefit: normal retirement = $5,000
	if got := result.DeathBenefit.Amount.String(); got != "5000.00" {
		t.Errorf("Martinez death benefit = %s, want 5000.00", got)
	}
}

func TestCalculateBenefit_Case2_Kim(t *testing.T) {
	// Case 2: Jennifer Kim — Tier 2, early retirement, purchased service, 30% reduction
	// Hand calc: $7,347.62 × 0.015 × 21.17 = $2,333.236731
	//   Gross rounded: $2,333.24
	//   Reduced: $2,333.236731 × 0.70 = $1,633.265712 → $1,633.27
	// NOTE: Old float64 code gave $2,332.96 / $1,633.07 — both wrong by $0.28/$0.20
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
		Amount:       money.FromFloat64(7347.62),
	}
	retDate := parseDate("2026-05-01")

	result := CalculateBenefit(member, svcCredit, ams, nil, retDate)

	if result.Tier != 2 {
		t.Errorf("Kim tier = %d, want 2", result.Tier)
	}
	if result.Formula.Multiplier != 0.015 {
		t.Errorf("Kim multiplier = %.4f, want 0.0150", result.Formula.Multiplier)
	}
	if result.Formula.ServiceYears != 21.17 {
		t.Errorf("Kim service years = %.2f, want 21.17", result.Formula.ServiceYears)
	}

	// Exact gross: 7347.62 × 0.015 × 21.17 = 2333.236731 → $2,333.24
	if got := result.Formula.GrossBenefit.String(); got != "2333.24" {
		t.Errorf("Kim gross = %s, want 2333.24", got)
	}

	if !result.Reduction.Applies {
		t.Error("Kim should have early retirement reduction")
	}
	if result.Reduction.ReductionFactor != 0.70 {
		t.Errorf("Kim reduction factor = %.4f, want 0.7000", result.Reduction.ReductionFactor)
	}

	// Exact reduced: 2333.236731 × 0.70 = 1633.265712 → $1,633.27
	if got := result.MaximumBenefit.String(); got != "1633.27" {
		t.Errorf("Kim maximum benefit = %s, want 1633.27", got)
	}

	// Death benefit for early retirement age 55
	if got := result.DeathBenefit.Amount.String(); got != "2500.00" {
		t.Errorf("Kim death benefit = %s, want 2500.00", got)
	}

	// IPR uses earned service only: 18.17 × $12.50 = $227.125 → $227.13
	if got := result.IPR.NonMedicareMonthly.String(); got != "227.13" {
		t.Errorf("Kim IPR = %s, want 227.13 (earned service only)", got)
	}
}

func TestCalculateBenefit_Case3_Washington(t *testing.T) {
	// Case 3: David Washington — Tier 3, early retirement, 12% reduction
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
		Amount:       money.FromFloat64(7200.00),
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
	if got := result.DeathBenefit.Amount.String(); got != "4000.00" {
		t.Errorf("Washington death benefit = %s, want 4000.00", got)
	}
}

func TestCalculateDRO_Case4(t *testing.T) {
	// Case 4: Robert Martinez DRO variant
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

	grossBenefit := money.FromFloat64(4215.16)

	result := CalculateDRO(dro, hireDate, retDate, svcCredit, grossBenefit)

	if !result.HasDRO {
		t.Error("Should have DRO")
	}

	// Marital service: ~12.67 years
	if result.MaritalServiceYears < 12.5 || result.MaritalServiceYears > 12.9 {
		t.Errorf("Marital service years = %.2f, want ~12.67", result.MaritalServiceYears)
	}

	// Marital fraction: ~0.4407
	if result.MaritalFraction < 0.43 || result.MaritalFraction > 0.45 {
		t.Errorf("Marital fraction = %.4f, want ~0.4407", result.MaritalFraction)
	}

	if result.AltPayeePct != 40.0 {
		t.Errorf("Alt payee pct = %.2f, want 40.00", result.AltPayeePct)
	}

	// Member's benefit after DRO should be less than gross
	if result.MemberAfterDRO.Cmp(grossBenefit) >= 0 {
		t.Error("Member benefit after DRO should be less than gross benefit")
	}
	if !result.MemberAfterDRO.IsPositive() {
		t.Error("Member benefit after DRO should be positive")
	}
}

func TestCalculatePaymentOptions(t *testing.T) {
	base := money.FromFloat64(4215.16)

	options := CalculatePaymentOptions(base)

	if got := options.Maximum.String(); got != "4215.16" {
		t.Errorf("Maximum = %s, want 4215.16", got)
	}

	// JS 100%: 4215.16 × 0.8850 = 3730.4166 → $3,730.42
	if got := options.JS100.MemberAmount.String(); got != "3730.42" {
		t.Errorf("JS 100%% member = %s, want 3730.42", got)
	}

	// Survivor at 100% J&S gets same as member
	if options.JS100.SurvivorAmount.String() != options.JS100.MemberAmount.String() {
		t.Errorf("JS 100%% survivor = %s, want %s", options.JS100.SurvivorAmount, options.JS100.MemberAmount)
	}

	if options.Disclaimer == "" {
		t.Error("Payment options should include illustrative disclaimer")
	}
}

func TestCalculateIPR(t *testing.T) {
	// CRITICAL: IPR uses earned service only, purchased excluded
	tests := []struct {
		name                string
		earnedYears         float64
		expectedNonMedicare string
		expectedMedicare    string
	}{
		// Case 1: Martinez, 28.75 earned years → 28.75 × $12.50 = $359.375 → $359.38
		{"Martinez IPR", 28.75, "359.38", "179.69"},
		// Case 2: Kim, 18.17 earned years → 18.17 × $12.50 = $227.125 → $227.13
		{"Kim IPR (earned only)", 18.17, "227.13", "113.56"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ipr := CalculateIPR(tt.earnedYears)
			if got := ipr.NonMedicareMonthly.String(); got != tt.expectedNonMedicare {
				t.Errorf("Non-Medicare IPR = %s, want %s", got, tt.expectedNonMedicare)
			}
			if got := ipr.MedicareMonthly.String(); got != tt.expectedMedicare {
				t.Errorf("Medicare IPR = %s, want %s", got, tt.expectedMedicare)
			}
		})
	}
}

func TestDeathBenefit_StatutoryTables(t *testing.T) {
	// Tiers 1&2: $250 increment from $2,500 (age 55) to $5,000 (age 65)
	for age := 55; age <= 65; age++ {
		expected := money.FromInt(2500 + (age-55)*250)
		db := CalculateDeathBenefit(1, age, "EARLY")
		if db.Amount.String() != expected.String() {
			t.Errorf("T12 death benefit at age %d = %s, want %s", age, db.Amount, expected)
		}
	}

	// Tier 3: $500 increment from $2,500 (age 60) to $5,000 (age 65)
	for age := 60; age <= 65; age++ {
		expected := money.FromInt(2500 + (age-60)*500)
		db := CalculateDeathBenefit(3, age, "EARLY")
		if db.Amount.String() != expected.String() {
			t.Errorf("T3 death benefit at age %d = %s, want %s", age, db.Amount, expected)
		}
	}

	// Normal retirement always $5,000
	db := CalculateDeathBenefit(1, 65, "NORMAL")
	if got := db.Amount.String(); got != "5000.00" {
		t.Errorf("Normal retirement death benefit = %s, want 5000.00", got)
	}

	// Rule of 75 also $5,000
	db = CalculateDeathBenefit(1, 63, "RULE_OF_75")
	if got := db.Amount.String(); got != "5000.00" {
		t.Errorf("Rule of 75 death benefit = %s, want 5000.00", got)
	}
}
