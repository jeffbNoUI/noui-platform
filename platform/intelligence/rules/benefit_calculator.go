package rules

import (
	"fmt"
	"math"
	"time"

	"github.com/noui/platform/intelligence/models"
)

// CalculateBenefit performs the complete benefit calculation for a member.
// Every calculation step is traceable to the governing document provision.
// The rules engine calculates the benefit — AI does NOT execute business rules.
func CalculateBenefit(
	member models.MemberData,
	svcCredit models.ServiceCreditData,
	ams models.AMSData,
	dro *models.DROData,
	retirementDate time.Time,
) models.BenefitCalcResult {
	eligibility := EvaluateEligibility(member, svcCredit, retirementDate)
	tier := eligibility.Tier

	// Benefit formula: AMS × multiplier × service years
	// Source: RMC §18-408
	multiplier := TierMultiplier[tier]

	// CRITICAL: Use benefit years (earned + purchased) for the formula
	// Purchased service counts for BENEFIT CALCULATION but NOT eligibility
	serviceYears := svcCredit.BenefitYears

	// Gross (unreduced) benefit — carry full precision
	grossBenefit := ams.Amount * multiplier * serviceYears

	// Apply early retirement reduction if applicable
	reduction := models.ReductionDetail{
		Applies:         eligibility.ReductionPct > 0,
		RetirementType:  eligibility.BestEligible,
		AgeAtRetirement: eligibility.Age.CompletedYears,
	}

	var maximumBenefit float64
	if reduction.Applies {
		yearsUnder65 := NormalRetAge - eligibility.Age.CompletedYears
		ratePerYear := 3.0
		if tier == 3 {
			ratePerYear = 6.0
		}
		reduction.YearsUnder65 = yearsUnder65
		reduction.RatePerYear = ratePerYear
		reduction.TotalReduction = eligibility.ReductionPct
		reduction.ReductionFactor = eligibility.ReductionFactor
		reduction.ReducedBenefit = grossBenefit * eligibility.ReductionFactor
		reduction.SourceReference = "RMC §18-409(b) — Statutory table lookup"

		// RULE-ROUNDING: Round only the final monthly benefit to cents
		// ASSUMPTION: [Q-CALC-01] Using banker's rounding.
		maximumBenefit = roundToCents(reduction.ReducedBenefit)
	} else {
		reduction.ReductionFactor = 1.0
		maximumBenefit = roundToCents(grossBenefit)
	}

	// Payment options — apply J&S factors to the maximum benefit
	// RULE-DRO-SEQUENCE: DRO split applied BEFORE payment option selection
	baseForOptions := maximumBenefit
	var droResult *models.DROCalcResult

	if dro != nil && dro.HasDRO {
		droCalc := CalculateDRO(*dro, member.HireDate, retirementDate, svcCredit, maximumBenefit)
		droResult = &droCalc
		baseForOptions = droCalc.MemberAfterDRO
	}

	paymentOptions := CalculatePaymentOptions(baseForOptions)

	// Death benefit — statutory table lookup
	deathBenefit := CalculateDeathBenefit(tier, eligibility.Age.CompletedYears, eligibility.BestEligible)

	// IPR — earned service only, purchased excluded
	ipr := CalculateIPR(svcCredit.EligibilityYears)

	multiplierPct := fmt.Sprintf("%.1f%%", multiplier*100)
	formulaDisplay := fmt.Sprintf("$%.2f × %s × %.2f years = $%.2f", ams.Amount, multiplierPct, serviceYears, grossBenefit)
	if reduction.Applies {
		formulaDisplay += fmt.Sprintf(" × %.4f (reduction) = $%.2f", reduction.ReductionFactor, maximumBenefit)
	}

	return models.BenefitCalcResult{
		MemberID:       member.MemberID,
		RetirementDate: retirementDate.Format("2006-01-02"),
		Tier:           tier,
		Eligibility:    eligibility,
		AMS: models.AMSCalcDetail{
			WindowMonths:      ams.WindowMonths,
			WindowStart:       ams.WindowStart,
			WindowEnd:         ams.WindowEnd,
			Amount:            ams.Amount,
			LeavePayoutIncl:   ams.LeavePayoutIncl,
			LeavePayoutAmt:    ams.LeavePayoutAmt,
		},
		Formula: models.FormulaDetail{
			AMS:            ams.Amount,
			Multiplier:     multiplier,
			MultiplierPct:  multiplierPct,
			ServiceYears:   serviceYears,
			ServiceType:    "earned + purchased (RULE-SVC-PURCHASED: purchased counts for benefit formula)",
			GrossBenefit:   grossBenefit,
			FormulaDisplay: formulaDisplay,
		},
		Reduction:      reduction,
		MaximumBenefit: maximumBenefit,
		PaymentOptions: paymentOptions,
		DRO:           droResult,
		DeathBenefit:   deathBenefit,
		IPR:           ipr,
	}
}

// CalculatePaymentOptions computes all four payment option amounts.
// ASSUMPTION: [Q-CALC-04] Using illustrative J&S factors.
func CalculatePaymentOptions(baseAmount float64) models.PaymentOptions {
	return models.PaymentOptions{
		BaseAmount: baseAmount,
		Maximum:    baseAmount,
		JS100: models.JSOption{
			MemberAmount:   roundToCents(baseAmount * JSFactors[100]),
			SurvivorAmount: roundToCents(baseAmount * JSFactors[100]),
			SurvivorPct:    100,
			Factor:         JSFactors[100],
		},
		JS75: models.JSOption{
			MemberAmount:   roundToCents(baseAmount * JSFactors[75]),
			SurvivorAmount: roundToCents(baseAmount * JSFactors[75] * 0.75),
			SurvivorPct:    75,
			Factor:         JSFactors[75],
		},
		JS50: models.JSOption{
			MemberAmount:   roundToCents(baseAmount * JSFactors[50]),
			SurvivorAmount: roundToCents(baseAmount * JSFactors[50] * 0.50),
			SurvivorPct:    50,
			Factor:         JSFactors[50],
		},
		Disclaimer: "ILLUSTRATIVE — Actual J&S factors from DERP actuarial tables based on member and beneficiary ages at retirement.",
	}
}

// CalculateDRO computes the DRO impact on a member's benefit.
// RULE-DRO-MARITAL-SHARE: marital fraction = service during marriage / total service
// RULE-DRO-SEQUENCE: DRO split applied BEFORE payment option selection
func CalculateDRO(
	dro models.DROData,
	hireDate, retirementDate time.Time,
	svcCredit models.ServiceCreditData,
	grossBenefit float64,
) models.DROCalcResult {
	// Calculate marital service: from later of (hire date, marriage date) to divorce date
	maritalStart := hireDate
	if dro.MarriageDate.After(hireDate) {
		maritalStart = dro.MarriageDate
	}
	maritalEnd := dro.DivorceDate

	maritalServiceYears := CalculateEarnedService(maritalStart, maritalEnd)
	totalServiceYears := svcCredit.BenefitYears

	// Marital fraction
	maritalFraction := maritalServiceYears / totalServiceYears
	maritalShare := grossBenefit * maritalFraction

	// Apply division percentage
	altPayeeAmount := maritalShare * (dro.DivisionValue / 100.0)
	memberAfterDRO := grossBenefit - altPayeeAmount

	return models.DROCalcResult{
		HasDRO:              true,
		MarriageDate:        dro.MarriageDate.Format("2006-01-02"),
		DivorceDate:         dro.DivorceDate.Format("2006-01-02"),
		MaritalServiceYears: maritalServiceYears,
		TotalServiceYears:   totalServiceYears,
		MaritalFraction:     maritalFraction,
		GrossBenefit:        grossBenefit,
		MaritalShare:        roundToCents(maritalShare),
		AltPayeePct:         dro.DivisionValue,
		AltPayeeAmount:      roundToCents(altPayeeAmount),
		MemberAfterDRO:      roundToCents(memberAfterDRO),
		DivisionMethod:      dro.DivisionMethod,
	}
}

// CalculateDeathBenefit looks up the lump-sum death benefit from statutory tables.
// Source: RMC §18-411(d)
func CalculateDeathBenefit(tier, age int, retirementType string) models.DeathBenefitDetail {
	var amount float64
	sourceRef := "RMC §18-411(d)"

	if retirementType == "NORMAL" || retirementType == "RULE_OF_75" || retirementType == "RULE_OF_85" {
		amount = 5000.00
	} else if retirementType == "EARLY" {
		if tier == 3 {
			if val, ok := DeathBenefitT3[age]; ok {
				amount = val
			}
		} else {
			if val, ok := DeathBenefitT12[age]; ok {
				amount = val
			}
		}
	}

	return models.DeathBenefitDetail{
		Amount:         amount,
		Installment50:  roundToCents(amount / 50.0),
		Installment100: roundToCents(amount / 100.0),
		RetirementType: retirementType,
		SourceRef:      sourceRef,
	}
}

// CalculateIPR computes the Insurance Premium Reimbursement.
// CRITICAL: Uses earned service years ONLY — purchased service excluded.
// Source: RMC §18-412
func CalculateIPR(earnedServiceYears float64) models.IPRDetail {
	return models.IPRDetail{
		EarnedServiceYears: earnedServiceYears,
		NonMedicareMonthly: roundToCents(IPRNonMedicare * earnedServiceYears),
		MedicareMonthly:    roundToCents(IPRMedicare * earnedServiceYears),
		SourceRef:          "RMC §18-412 — IPR uses earned service only; purchased service excluded",
	}
}

// CalculateScenarios evaluates benefits at multiple retirement dates.
func CalculateScenarios(
	member models.MemberData,
	svcCredit models.ServiceCreditData,
	ams models.AMSData,
	dro *models.DROData,
	dates []time.Time,
) models.ScenarioResult {
	result := models.ScenarioResult{
		MemberID: member.MemberID,
	}

	for _, date := range dates {
		// Estimate service at each future date
		additionalMonths := monthsBetween(time.Now(), date)
		projectedSvc := svcCredit
		projectedSvc.EarnedYears += float64(additionalMonths) / 12.0
		projectedSvc.EligibilityYears += float64(additionalMonths) / 12.0
		projectedSvc.BenefitYears += float64(additionalMonths) / 12.0
		projectedSvc.TotalYears += float64(additionalMonths) / 12.0

		eligibility := EvaluateEligibility(member, projectedSvc, date)
		age := CalculateAge(member.DOB, date)

		tier := eligibility.Tier
		multiplier := TierMultiplier[tier]
		grossBenefit := ams.Amount * multiplier * projectedSvc.BenefitYears
		monthlyBenefit := roundToCents(grossBenefit * eligibility.ReductionFactor)

		ruleOfNSum := age.Decimal + projectedSvc.EligibilityYears

		entry := models.ScenarioEntry{
			RetirementDate:  date.Format("2006-01-02"),
			Age:             age.CompletedYears,
			EarnedService:   projectedSvc.EligibilityYears,
			TotalService:    projectedSvc.BenefitYears,
			EligibilityType: eligibility.BestEligible,
			RuleOfNSum:      ruleOfNSum,
			RuleOfNMet:      eligibility.ReductionPct == 0 && eligibility.BestEligible != "EARLY",
			ReductionPct:    eligibility.ReductionPct,
			MonthlyBenefit:  monthlyBenefit,
		}
		result.Scenarios = append(result.Scenarios, entry)
	}

	return result
}

// roundToCents rounds a float64 to 2 decimal places using banker's rounding.
// ASSUMPTION: [Q-CALC-01] Using banker's rounding. DERP's actual method unconfirmed.
func roundToCents(amount float64) float64 {
	return math.Round(amount*100) / 100
}

func monthsBetween(from, to time.Time) int {
	if to.Before(from) {
		return 0
	}
	years := to.Year() - from.Year()
	months := int(to.Month()) - int(from.Month())
	total := years*12 + months
	if total < 0 {
		return 0
	}
	return total
}
