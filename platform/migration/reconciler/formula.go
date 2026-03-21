package reconciler

import (
	"fmt"
	"math/big"
)

// PlanParams defines the parameters for a defined-benefit pension plan's
// retirement benefit formula.
type PlanParams struct {
	Multiplier          *big.Rat // e.g., 0.20 (20% = 2% per YOS effectively)
	FASPeriodMonths     int      // e.g., 60 (5 years)
	ERYPenaltyRate      *big.Rat // e.g., 0.06 per year early
	MaxPenalty          *big.Rat // e.g., 0.30 (30%)
	NormalRetirementAge int      // e.g., 65
	BenefitFloor        *big.Rat // e.g., 800.00
}

// BenefitCalcResult holds the output of a retirement benefit calculation.
type BenefitCalcResult struct {
	GrossMonthly *big.Rat
	PenaltyPct   *big.Rat
	FinalMonthly *big.Rat
}

// planRegistry maps plan codes to their parameters. In production this would
// come from a database; for now it is a hardcoded map.
var planRegistry = map[string]PlanParams{
	"DB_MAIN": {
		Multiplier:          ratFromString("1/5"),  // 0.20 (2% per year of service)
		FASPeriodMonths:     60,                    // 5-year FAS
		ERYPenaltyRate:      ratFromString("3/50"), // 0.06 per year early
		MaxPenalty:          ratFromString("3/10"), // 0.30 cap
		NormalRetirementAge: 65,
		BenefitFloor:        ratFromString("800/1"), // $800.00
	},
	"DB_T2": {
		Multiplier:          ratFromString("9/50"), // 0.18 (1.8% per year of service)
		FASPeriodMonths:     36,                    // 3-year FAS
		ERYPenaltyRate:      ratFromString("3/50"), // 0.06 per year early
		MaxPenalty:          ratFromString("3/10"), // 0.30 cap
		NormalRetirementAge: 65,
		BenefitFloor:        ratFromString("800/1"), // $800.00
	},
}

// ratFromString parses a fraction string like "1/5" into a *big.Rat.
// Panics on invalid input — only used for compile-time constants.
func ratFromString(s string) *big.Rat {
	r := new(big.Rat)
	if _, ok := r.SetString(s); !ok {
		panic(fmt.Sprintf("reconciler: invalid rational constant %q", s))
	}
	return r
}

// twelve is the constant 12 as a *big.Rat, used to convert annual to monthly.
var twelve = new(big.Rat).SetInt64(12)

// CalcRetirementBenefit computes a defined-benefit pension using exact
// rational arithmetic. All intermediate values use math/big.Rat; only
// the final results are rounded to 2 decimal places with HALF_UP.
//
// Formula:
//
//	gross_monthly = yos * multiplier * fas / 12
//	penalty_years = max(0, normal_retirement_age - age_at_retirement)
//	penalty_pct   = min(penalty_years * ery_penalty_rate, max_penalty)
//	after_penalty = gross_monthly * (1 - penalty_pct)
//	final_monthly = max(after_penalty, benefit_floor)
func CalcRetirementBenefit(yos, fas *big.Rat, ageAtRetirement int, params PlanParams) BenefitCalcResult {
	// gross_monthly = yos * multiplier * fas / 12
	gross := new(big.Rat).Mul(yos, params.Multiplier)
	gross.Mul(gross, fas)
	gross.Quo(gross, twelve)

	// penalty_years = max(0, normal_retirement_age - age_at_retirement)
	penaltyYears := params.NormalRetirementAge - ageAtRetirement
	if penaltyYears < 0 {
		penaltyYears = 0
	}

	// penalty_pct = min(penalty_years * ery_penalty_rate, max_penalty)
	penaltyPct := new(big.Rat).Mul(
		new(big.Rat).SetInt64(int64(penaltyYears)),
		params.ERYPenaltyRate,
	)
	if penaltyPct.Cmp(params.MaxPenalty) > 0 {
		penaltyPct.Set(params.MaxPenalty)
	}

	// after_penalty = gross_monthly * (1 - penalty_pct)
	oneMinus := new(big.Rat).Sub(new(big.Rat).SetInt64(1), penaltyPct)
	afterPenalty := new(big.Rat).Mul(gross, oneMinus)

	// final_monthly = max(after_penalty, benefit_floor)
	finalMonthly := new(big.Rat).Set(afterPenalty)
	if finalMonthly.Cmp(params.BenefitFloor) < 0 {
		finalMonthly.Set(params.BenefitFloor)
	}

	// Round gross and final for display (HALF_UP to 2 decimal places).
	// PenaltyPct stays exact.
	grossRounded := roundHalfUpRat(gross)
	finalRounded := roundHalfUpRat(finalMonthly)

	return BenefitCalcResult{
		GrossMonthly: grossRounded,
		PenaltyPct:   new(big.Rat).Set(penaltyPct),
		FinalMonthly: finalRounded,
	}
}

// RoundHalfUp rounds a *big.Rat to 2 decimal places using HALF_UP rounding
// and returns the result as a string with exactly 2 decimal places.
func RoundHalfUp(r *big.Rat) string {
	rounded := roundHalfUpRat(r)
	return formatRat2dp(rounded)
}

// roundHalfUpRat implements HALF_UP rounding to 2 decimal places:
// multiply by 100, add 0.5, truncate to integer, divide by 100.
func roundHalfUpRat(r *big.Rat) *big.Rat {
	hundred := new(big.Rat).SetInt64(100)
	half := new(big.Rat).SetFrac64(1, 2)

	// scaled = r * 100
	scaled := new(big.Rat).Mul(r, hundred)

	// For negative values, subtract 0.5 (round away from zero)
	if scaled.Sign() >= 0 {
		scaled.Add(scaled, half)
	} else {
		scaled.Sub(scaled, half)
	}

	// Truncate to integer via integer division
	num := scaled.Num()
	den := scaled.Denom()
	truncated := new(big.Int).Quo(num, den)

	// Result = truncated / 100
	result := new(big.Rat).SetFrac(truncated, new(big.Int).SetInt64(100))
	return result
}

// formatRat2dp formats a *big.Rat (assumed already rounded to 2 dp) as a
// string with exactly 2 decimal places.
func formatRat2dp(r *big.Rat) string {
	// Convert to integer cents
	hundred := new(big.Rat).SetInt64(100)
	cents := new(big.Rat).Mul(r, hundred)
	centsInt := cents.Num()
	// cents.Denom() should be 1 after rounding, but be safe
	if cents.Denom().Cmp(big.NewInt(1)) != 0 {
		centsInt = new(big.Int).Quo(cents.Num(), cents.Denom())
	}

	sign := ""
	abs := new(big.Int).Set(centsInt)
	if abs.Sign() < 0 {
		sign = "-"
		abs.Neg(abs)
	}

	dollars := new(big.Int).Quo(abs, big.NewInt(100))
	remainder := new(big.Int).Rem(abs, big.NewInt(100))

	return fmt.Sprintf("%s%s.%02d", sign, dollars.String(), remainder.Int64())
}

// RecomputeFromStoredInputs looks up plan parameters by planCode and
// recomputes the final monthly benefit from the stored calculation inputs.
// Returns nil if the planCode is unknown.
func RecomputeFromStoredInputs(yosUsed, fasUsed *big.Rat, ageAtCalc int, planCode string) *big.Rat {
	params, ok := planRegistry[planCode]
	if !ok {
		return nil
	}
	result := CalcRetirementBenefit(yosUsed, fasUsed, ageAtCalc, params)
	return result.FinalMonthly
}
