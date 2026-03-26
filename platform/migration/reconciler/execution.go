package reconciler

import (
	"fmt"
	"math/big"
	"strings"

	"github.com/noui/platform/migration/models"
)

// ExecuteRules evaluates each enabled rule in the ruleset against parallel run results
// and produces mismatches. All arithmetic uses math/big.Rat — no float64 for monetary values.
func ExecuteRules(executionID string, ruleset *models.ReconRuleSet, results []models.ParallelRunResult) ([]models.ReconExecutionMismatch, error) {
	if ruleset == nil {
		return nil, fmt.Errorf("ruleset is nil")
	}

	var mismatches []models.ReconExecutionMismatch

	for _, rule := range ruleset.Rules {
		if !rule.Enabled {
			continue
		}

		// Filter results matching this rule's calc_name (field_name match).
		for _, result := range results {
			if !matchesRule(result, rule) {
				continue
			}

			mismatch, err := evaluateRule(executionID, rule, result)
			if err != nil {
				return nil, fmt.Errorf("evaluate rule %s for member %s: %w", rule.RuleID, result.MemberID, err)
			}
			if mismatch != nil {
				mismatches = append(mismatches, *mismatch)
			}
		}
	}

	return mismatches, nil
}

// matchesRule checks if a parallel run result matches the rule's criteria.
func matchesRule(result models.ParallelRunResult, rule models.ReconRule) bool {
	return strings.EqualFold(result.FieldName, rule.CalcName)
}

// evaluateRule applies the comparison logic for a single rule against a single result.
// Returns nil if values match (no mismatch), or a mismatch record if they don't.
func evaluateRule(executionID string, rule models.ReconRule, result models.ParallelRunResult) (*models.ReconExecutionMismatch, error) {
	legacyStr := ptrToStr(result.LegacyValue)
	newStr := ptrToStr(result.NewValue)

	var isMismatch bool
	var varianceStr *string

	switch rule.ComparisonType {
	case models.ComparisonExact:
		isMismatch = legacyStr != newStr

	case models.ComparisonToleranceAbs:
		legacy, ok1 := parseRat(legacyStr)
		new_, ok2 := parseRat(newStr)
		tolerance, ok3 := parseRat(rule.ToleranceValue)
		if !ok1 || !ok2 || !ok3 {
			// Non-numeric values — fall back to exact comparison.
			isMismatch = legacyStr != newStr
		} else {
			diff := new(big.Rat).Sub(legacy, new_)
			diff.Abs(diff)
			isMismatch = diff.Cmp(tolerance) > 0
			v := diff.FloatString(10)
			varianceStr = &v
		}

	case models.ComparisonTolerancePct:
		legacy, ok1 := parseRat(legacyStr)
		new_, ok2 := parseRat(newStr)
		tolerance, ok3 := parseRat(rule.ToleranceValue)
		if !ok1 || !ok2 || !ok3 {
			isMismatch = legacyStr != newStr
		} else {
			if legacy.Sign() == 0 {
				// Zero legacy — any non-zero new value is a mismatch.
				isMismatch = new_.Sign() != 0
			} else {
				diff := new(big.Rat).Sub(legacy, new_)
				diff.Abs(diff)
				pct := new(big.Rat).Quo(diff, new(big.Rat).Abs(legacy))
				isMismatch = pct.Cmp(tolerance) > 0
				v := pct.FloatString(10)
				varianceStr = &v
			}
		}

	case models.ComparisonRoundThenCompare:
		legacy, ok1 := parseRat(legacyStr)
		new_, ok2 := parseRat(newStr)
		if !ok1 || !ok2 {
			isMismatch = legacyStr != newStr
		} else {
			roundedLegacy := roundRatTo2(legacy)
			roundedNew := roundRatTo2(new_)
			isMismatch = roundedLegacy.Cmp(roundedNew) != 0
		}

	default:
		return nil, fmt.Errorf("unknown comparison type: %s", rule.ComparisonType)
	}

	if !isMismatch {
		return nil, nil
	}

	tolVal := rule.ToleranceValue
	return &models.ReconExecutionMismatch{
		ExecutionID:     executionID,
		RuleID:          rule.RuleID,
		MemberID:        result.MemberID,
		CanonicalEntity: result.CanonicalEntity,
		FieldName:       result.FieldName,
		LegacyValue:     result.LegacyValue,
		NewValue:        result.NewValue,
		VarianceAmount:  varianceStr,
		ComparisonType:  rule.ComparisonType,
		ToleranceValue:  &tolVal,
		Priority:        rule.PriorityIfMismatch,
	}, nil
}

// parseRat attempts to parse a string as a big.Rat rational number.
func parseRat(s string) (*big.Rat, bool) {
	if s == "" {
		return nil, false
	}
	r := new(big.Rat)
	if _, ok := r.SetString(s); !ok {
		return nil, false
	}
	return r, true
}

// roundRatTo2 rounds a big.Rat to 2 decimal places using big.Rat arithmetic only.
// This avoids float64 truncation errors.
func roundRatTo2(r *big.Rat) *big.Rat {
	// Multiply by 100, round to nearest integer, divide by 100.
	hundred := new(big.Rat).SetInt64(100)
	scaled := new(big.Rat).Mul(r, hundred)

	// Extract numerator and denominator, compute integer quotient with rounding.
	num := scaled.Num()
	den := scaled.Denom()

	// q = (num + den/2) / den for positive, (num - den/2) / den for negative.
	half := new(big.Int).Quo(den, big.NewInt(2))
	adjusted := new(big.Int).Set(num)
	if num.Sign() >= 0 {
		adjusted.Add(adjusted, half)
	} else {
		adjusted.Sub(adjusted, half)
	}
	rounded := new(big.Int).Quo(adjusted, den)

	result := new(big.Rat).SetFrac(rounded, big.NewInt(1))
	return result.Quo(result, hundred)
}

// ptrToStr dereferences a string pointer, returning empty string for nil.
func ptrToStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
