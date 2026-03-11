package rules

import (
	"fmt"
	"math"
	"time"

	"github.com/noui/platform/intelligence/models"
)

// DetermineTier returns the tier code based on hire date.
// Source: RMC §18-401 (definitions)
// Tier 1: Hired before Sep 1, 2004 AND terminated after Dec 31, 1999
// Tier 2: Hired Sep 1, 2004 through Jun 30, 2011
// Tier 3: Hired on or after Jul 1, 2011
func DetermineTier(hireDate time.Time) int {
	tier2Start := time.Date(2004, 9, 1, 0, 0, 0, 0, time.UTC)
	tier3Start := time.Date(2011, 7, 1, 0, 0, 0, 0, time.UTC)

	if hireDate.Before(tier2Start) {
		return 1
	}
	if hireDate.Before(tier3Start) {
		return 2
	}
	return 3
}

// CalculateAge returns the age at a given date, broken down into years, months, and completed years.
func CalculateAge(dob, atDate time.Time) models.AgeAtRetirement {
	years := atDate.Year() - dob.Year()
	months := int(atDate.Month()) - int(dob.Month())

	if atDate.Day() < dob.Day() {
		months--
	}
	if months < 0 {
		years--
		months += 12
	}

	return models.AgeAtRetirement{
		Years:          years,
		Months:         months,
		CompletedYears: years,
		Decimal:        float64(years) + float64(months)/12.0,
	}
}

// ASSUMPTION: [Q-CALC-02] Using year-month method (months/12) for partial service years.
// DERP may use exact-day method. See RULE-SVC-EARNED.
func CalculateEarnedService(hireDate time.Time, endDate time.Time) float64 {
	years := endDate.Year() - hireDate.Year()
	months := int(endDate.Month()) - int(hireDate.Month())

	if endDate.Day() < hireDate.Day() {
		months--
	}
	if months < 0 {
		years--
		months += 12
	}

	return float64(years) + float64(months)/12.0
}

// EvaluateEligibility performs a complete eligibility evaluation for a member.
// Every rule evaluation is traced to its governing document provision.
func EvaluateEligibility(member models.MemberData, svcCredit models.ServiceCreditData, retirementDate time.Time) models.EligibilityResult {
	age := CalculateAge(member.DOB, retirementDate)
	tier := DetermineTier(member.HireDate)

	result := models.EligibilityResult{
		MemberID:       member.MemberID,
		RetirementDate: retirementDate.Format("2006-01-02"),
		Age:            age,
		Tier:           tier,
		TierSource:     fmt.Sprintf("RMC §18-401 — Hire date %s → Tier %d", member.HireDate.Format("2006-01-02"), tier),
		ServiceCredit:  svcCredit,
	}

	// RULE-VESTING: 5 years of service credit — RMC §18-403
	vested := svcCredit.EarnedYears >= VestingYears
	result.Vested = vested
	result.Evaluations = append(result.Evaluations, models.RuleEvaluation{
		RuleID:          "RULE-VESTING",
		RuleName:        "Vesting Requirement",
		Met:             vested,
		Details:         fmt.Sprintf("Earned service %.2f years %s %.2f required", svcCredit.EarnedYears, metStr(vested), VestingYears),
		SourceReference: "RMC §18-403",
	})

	if !vested {
		result.BestEligible = "NONE"
		result.ReductionPct = 0
		result.ReductionFactor = 0
		return result
	}

	// RULE-NORMAL-RET: Age 65, 5 years service — RMC §18-409(a)(1)
	normalMet := age.CompletedYears >= NormalRetAge && vested
	result.Evaluations = append(result.Evaluations, models.RuleEvaluation{
		RuleID:          "RULE-NORMAL-RET",
		RuleName:        "Normal Retirement",
		Met:             normalMet,
		Details:         fmt.Sprintf("Age %d (need %d), vested=%v", age.CompletedYears, NormalRetAge, vested),
		SourceReference: "RMC §18-409(a)(1)",
	})

	if normalMet {
		result.BestEligible = "NORMAL"
		result.ReductionPct = 0
		result.ReductionFactor = 1.0
		return result
	}

	// RULE-RULE-OF-75 / RULE-RULE-OF-85
	// CRITICAL: Use earned service ONLY — purchased service excluded
	ruleOfNSum := age.Decimal + svcCredit.EligibilityYears
	result.RuleOfNSum = ruleOfNSum
	threshold := RuleOfNThreshold[tier]
	minAge := RuleOfNMinAge[tier]
	ruleOfNMet := ruleOfNSum >= threshold && age.CompletedYears >= minAge

	ruleID := "RULE-RULE-OF-75"
	ruleName := "Rule of 75"
	if tier == 3 {
		ruleID = "RULE-RULE-OF-85"
		ruleName = "Rule of 85"
	}

	result.Evaluations = append(result.Evaluations, models.RuleEvaluation{
		RuleID:   ruleID,
		RuleName: ruleName,
		Met:      ruleOfNMet,
		Details: fmt.Sprintf("Age %.2f + earned service %.2f = %.2f (need %.0f, min age %d, actual age %d). Purchased service (%.2f yr) EXCLUDED per RMC §18-409(a)",
			age.Decimal, svcCredit.EligibilityYears, ruleOfNSum, threshold, minAge, age.CompletedYears, svcCredit.PurchasedYears),
		SourceReference: "RMC §18-409(a)(2)",
	})

	if ruleOfNMet {
		if tier == 3 {
			result.BestEligible = "RULE_OF_85"
		} else {
			result.BestEligible = "RULE_OF_75"
		}
		result.ReductionPct = 0
		result.ReductionFactor = 1.0
		return result
	}

	// RULE-EARLY-RET-T12 / RULE-EARLY-RET-T3
	earlyMinAge := EarlyRetMinAge[tier]
	earlyMet := age.CompletedYears >= earlyMinAge && vested

	earlyRuleID := "RULE-EARLY-RET-T12"
	if tier == 3 {
		earlyRuleID = "RULE-EARLY-RET-T3"
	}

	result.Evaluations = append(result.Evaluations, models.RuleEvaluation{
		RuleID:          earlyRuleID,
		RuleName:        "Early Retirement",
		Met:             earlyMet,
		Details:         fmt.Sprintf("Age %d (min %d), vested=%v", age.CompletedYears, earlyMinAge, vested),
		SourceReference: "RMC §18-409(a)(3)",
	})

	if earlyMet {
		result.BestEligible = "EARLY"
		// Apply reduction using statutory tables
		// ASSUMPTION: [Q-CALC-03] Using integer age only (no monthly proration)
		factor := lookupReductionFactor(tier, age.CompletedYears)
		result.ReductionFactor = factor
		result.ReductionPct = math.Round((1.0-factor)*10000) / 100 // Round to 2 decimal places to avoid IEEE 754 drift

		reduceRuleID := "RULE-EARLY-REDUCE-T12"
		if tier == 3 {
			reduceRuleID = "RULE-EARLY-REDUCE-T3"
		}
		ratePerYear := 3.0
		if tier == 3 {
			ratePerYear = 6.0
		}

		result.Evaluations = append(result.Evaluations, models.RuleEvaluation{
			RuleID:   reduceRuleID,
			RuleName: "Early Retirement Reduction",
			Met:      true,
			Details: fmt.Sprintf("Age %d, %.0f%% per year under 65 = %.0f%% reduction (factor %.4f). Statutory table lookup, not formula.",
				age.CompletedYears, ratePerYear, result.ReductionPct, factor),
			SourceReference: "RMC §18-409(b)",
		})
		return result
	}

	// RULE-DEFERRED
	deferredMet := vested && age.CompletedYears < earlyMinAge
	result.Evaluations = append(result.Evaluations, models.RuleEvaluation{
		RuleID:          "RULE-DEFERRED",
		RuleName:        "Deferred Retirement",
		Met:             deferredMet,
		Details:         fmt.Sprintf("Vested=%v, age %d < min early retirement age %d", vested, age.CompletedYears, earlyMinAge),
		SourceReference: "RMC §18-409(d)",
	})

	if deferredMet {
		result.BestEligible = "DEFERRED"
		result.ReductionPct = 0
		result.ReductionFactor = 1.0
		return result
	}

	result.BestEligible = "NONE"
	return result
}

// lookupReductionFactor returns the reduction factor from statutory tables.
// Uses table lookup, NOT formula — per CLAUDE_CODE_PROTOCOL.md.
func lookupReductionFactor(tier, age int) float64 {
	if age >= NormalRetAge {
		return 1.0
	}

	var table map[int]float64
	if tier == 3 {
		table = EarlyRetReductionT3
	} else {
		table = EarlyRetReductionT12
	}

	if factor, ok := table[age]; ok {
		return factor
	}

	// Age below the minimum in the table — should not happen for valid early retirement
	return 0.0
}

func metStr(met bool) string {
	if met {
		return ">="
	}
	return "<"
}
