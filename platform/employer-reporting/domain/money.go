// Package domain — monetary arithmetic helpers using math/big.Rat.
// All pension contribution validation must use exact rational arithmetic
// to avoid float64 rounding errors on salary × rate calculations.
package domain

import (
	"math/big"
)

// penny is the $0.01 tolerance threshold for contribution validation.
var penny = new(big.Rat).SetFrac64(1, 100)

// parseRat parses a decimal string into a *big.Rat.
// Returns nil if the string is not a valid number.
func parseRat(s string) *big.Rat {
	r, ok := new(big.Rat).SetString(s)
	if !ok {
		return nil
	}
	return r
}

// ratFmt formats a *big.Rat to a 2-decimal-place string.
func ratFmt(r *big.Rat) string {
	return r.FloatString(2)
}

// ratAbs returns the absolute value of r (new allocation, does not mutate r).
func ratAbs(r *big.Rat) *big.Rat {
	a := new(big.Rat).Set(r)
	if a.Sign() < 0 {
		a.Neg(a)
	}
	return a
}

// ratSub returns a - b (new allocation).
func ratSub(a, b *big.Rat) *big.Rat {
	return new(big.Rat).Sub(a, b)
}

// ratAdd returns a + b (new allocation).
func ratAdd(a, b *big.Rat) *big.Rat {
	return new(big.Rat).Add(a, b)
}

// ratMul returns a * b (new allocation).
func ratMul(a, b *big.Rat) *big.Rat {
	return new(big.Rat).Mul(a, b)
}

// withinPenny returns true if |a - b| <= $0.01.
func withinPenny(a, b *big.Rat) bool {
	return ratAbs(ratSub(a, b)).Cmp(penny) <= 0
}

// SumContributions adds the six contribution component strings and returns
// a 2-decimal-place string. Invalid components are treated as zero.
func SumContributions(member, employer, aed, saed, aap, dcSupp string) string {
	total := new(big.Rat)
	for _, s := range []string{member, employer, aed, saed, aap, dcSupp} {
		if r := parseRat(s); r != nil {
			total = ratAdd(total, r)
		}
	}
	return ratFmt(total)
}
