package reconciler

import (
	"fmt"
	"math/big"
)

// BenefitCalcResult holds the output of a retirement benefit calculation.
type BenefitCalcResult struct {
	GrossMonthly    *big.Rat
	ReductionFactor *big.Rat
	FinalMonthly    *big.Rat
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
//	gross_monthly    = yos * multiplier * fas / 12
//	reduction_factor = lookup from ReductionTable by age (1.0 if at or above NRA)
//	after_reduction  = gross_monthly * reduction_factor
//	final_monthly    = max(after_reduction, benefit_floor)
func CalcRetirementBenefit(yos, fas *big.Rat, ageAtRetirement int, params BenefitParams) BenefitCalcResult {
	// gross_monthly = yos * multiplier * fas / 12
	gross := new(big.Rat).Mul(yos, params.Multiplier)
	gross.Mul(gross, fas)
	gross.Quo(gross, twelve)

	// Determine the reduction factor from the lookup table.
	one := new(big.Rat).SetInt64(1)
	reductionFactor := new(big.Rat).Set(one) // default: no reduction

	if params.ReductionMethod == "lookup_table" && params.ReductionTable != nil {
		if factor, ok := params.ReductionTable[ageAtRetirement]; ok {
			reductionFactor.Set(factor)
		} else if ageAtRetirement >= params.NormalRetirementAge {
			// At or above NRA with no explicit table entry: no reduction.
			reductionFactor.Set(one)
		}
		// If below NRA and no table entry, reductionFactor stays 1.0 (no data).
	}

	// after_reduction = gross_monthly * reduction_factor
	afterReduction := new(big.Rat).Mul(gross, reductionFactor)

	// final_monthly = max(after_reduction, benefit_floor)
	finalMonthly := new(big.Rat).Set(afterReduction)
	if params.BenefitFloor != nil && finalMonthly.Cmp(params.BenefitFloor) < 0 {
		finalMonthly.Set(params.BenefitFloor)
	}

	// Round gross and final for display (HALF_UP to 2 decimal places).
	// ReductionFactor stays exact.
	grossRounded := roundHalfUpRat(gross)
	finalRounded := roundHalfUpRat(finalMonthly)

	return BenefitCalcResult{
		GrossMonthly:    grossRounded,
		ReductionFactor: new(big.Rat).Set(reductionFactor),
		FinalMonthly:    finalRounded,
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

// RecomputeFromStoredInputs looks up tier parameters from PlanConfig and
// recomputes the final monthly benefit from the stored calculation inputs.
// Returns nil if the tierCode is unknown or ToBenefitParams fails.
func RecomputeFromStoredInputs(yosUsed, fasUsed *big.Rat, ageAtCalc int, tierCode string, planConfig *PlanConfig) *big.Rat {
	if planConfig == nil {
		return nil
	}
	tier, ok := planConfig.LookupTier(tierCode)
	if !ok {
		return nil
	}
	params, err := tier.ToBenefitParams(planConfig.System.NormalRetirementAge)
	if err != nil {
		return nil
	}
	result := CalcRetirementBenefit(yosUsed, fasUsed, ageAtCalc, *params)
	return result.FinalMonthly
}
