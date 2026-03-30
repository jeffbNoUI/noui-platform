// Package money provides exact decimal arithmetic for monetary calculations.
// All pension benefit calculations must use this type — never float64 for dollar amounts.
// Uses math/big.Rat internally, matching the pattern in platform/migration/reconciler/formula.go.
package money

import (
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
)

// Money represents an exact decimal monetary value backed by big.Rat.
// The zero value is $0.00 and is safe to use.
type Money struct {
	rat big.Rat
}

// Zero returns a Money with value 0.
func Zero() Money {
	return Money{}
}

// New creates a Money from a string like "10639.45".
// Panics on invalid input — use Parse for fallible conversion.
func New(s string) Money {
	m, ok := Parse(s)
	if !ok {
		panic(fmt.Sprintf("money.New: invalid value %q", s))
	}
	return m
}

// Parse creates a Money from a string. Returns false if parsing fails.
func Parse(s string) (Money, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return Zero(), true
	}
	var m Money
	if _, ok := m.rat.SetString(s); !ok {
		return Money{}, false
	}
	return m, true
}

// FromFloat64 creates a Money from a float64. This is the migration path for
// values received from external services (connector) that return JSON numbers.
// The float is converted via its exact string representation to avoid
// introducing additional precision artifacts beyond what float64 already has.
func FromFloat64(f float64) Money {
	// Use the exact decimal representation of the float64
	s := fmt.Sprintf("%.10f", f)
	s = strings.TrimRight(s, "0")
	s = strings.TrimRight(s, ".")
	if s == "" || s == "-" {
		return Zero()
	}
	var m Money
	m.rat.SetString(s)
	return m
}

// FromInt creates a Money from an integer (e.g., 5000 → $5,000.00).
func FromInt(n int) Money {
	var m Money
	m.rat.SetInt64(int64(n))
	return m
}

// Add returns a + b.
func (a Money) Add(b Money) Money {
	var result Money
	result.rat.Add(&a.rat, &b.rat)
	return result
}

// Sub returns a - b.
func (a Money) Sub(b Money) Money {
	var result Money
	result.rat.Sub(&a.rat, &b.rat)
	return result
}

// Mul returns a × f where f is a scalar factor (rate, multiplier, etc.).
// Use this for operations like: amount × 0.015 × 28.75.
// The float64 is converted via its shortest decimal string representation
// to get the intended value, not the exact IEEE 754 bit pattern.
// This means Mul(0.015) multiplies by exactly 15/1000, not by
// 0.01499999999999999944... which is what float64 actually stores.
func (a Money) Mul(f float64) Money {
	s := fmt.Sprintf("%g", f)
	var factor big.Rat
	factor.SetString(s)
	var result Money
	result.rat.Mul(&a.rat, &factor)
	return result
}

// MulRat returns a × (n/d) using exact rational arithmetic.
// Use this when both numerator and denominator are known integers,
// e.g., marital fraction = maritalYears / totalYears.
func (a Money) MulRat(num, denom int64) Money {
	var frac big.Rat
	frac.SetFrac64(num, denom)
	var result Money
	result.rat.Mul(&a.rat, &frac)
	return result
}

// Div returns a ÷ f.
func (a Money) Div(f float64) Money {
	if f == 0 {
		panic("money.Div: division by zero")
	}
	s := fmt.Sprintf("%g", f)
	var divisor big.Rat
	divisor.SetString(s)
	var result Money
	result.rat.Quo(&a.rat, &divisor)
	return result
}

// Round returns the value rounded to 2 decimal places using half-up rounding.
// This is the ONLY rounding operation — carry full precision through all
// intermediates and round only the final result.
func (a Money) Round() Money {
	// Multiply by 100, add 0.5, truncate, divide by 100
	hundred := new(big.Rat).SetInt64(100)
	half := new(big.Rat).SetFrac64(1, 2)

	scaled := new(big.Rat).Mul(&a.rat, hundred)

	// Determine sign for correct rounding direction
	neg := scaled.Sign() < 0
	if neg {
		scaled.Neg(scaled)
	}

	// Add 0.5 and truncate
	scaled.Add(scaled, half)
	truncated := new(big.Int).Div(scaled.Num(), scaled.Denom())

	if neg {
		truncated.Neg(truncated)
	}

	var result Money
	result.rat.SetFrac(truncated, new(big.Int).SetInt64(100))
	return result
}

// Float64 returns the value as a float64. Use only for non-critical display
// purposes or for interop with code that hasn't been migrated yet.
func (a Money) Float64() float64 {
	f, _ := a.rat.Float64()
	return f
}

// String returns the value as a decimal string with exactly 2 decimal places.
func (a Money) String() string {
	// Get the rounded value
	rounded := a.Round()

	// Extract integer and fractional parts
	hundred := new(big.Int).SetInt64(100)
	num := new(big.Int).Set(rounded.rat.Num())
	denom := new(big.Int).Set(rounded.rat.Denom())

	// Compute cents = num * 100 / denom
	cents := new(big.Int).Mul(num, hundred)
	cents.Div(cents, denom)

	neg := cents.Sign() < 0
	if neg {
		cents.Neg(cents)
	}

	dollars := new(big.Int).Div(cents, hundred)
	remainder := new(big.Int).Mod(cents, hundred)

	sign := ""
	if neg {
		sign = "-"
	}
	return fmt.Sprintf("%s%s.%02d", sign, dollars.String(), remainder.Int64())
}

// MarshalJSON emits the value as a JSON string: "10639.45".
func (a Money) MarshalJSON() ([]byte, error) {
	return json.Marshal(a.String())
}

// UnmarshalJSON accepts both "10639.45" (string) and 10639.45 (number)
// for backwards compatibility with existing API consumers.
func (a *Money) UnmarshalJSON(data []byte) error {
	// Try string first
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		parsed, ok := Parse(s)
		if !ok {
			return fmt.Errorf("money: invalid value %q", s)
		}
		*a = parsed
		return nil
	}

	// Fall back to number
	var f float64
	if err := json.Unmarshal(data, &f); err != nil {
		return fmt.Errorf("money: cannot unmarshal %s", string(data))
	}
	*a = FromFloat64(f)
	return nil
}

// IsZero returns true if the value is exactly zero.
func (a Money) IsZero() bool {
	return a.rat.Sign() == 0
}

// IsPositive returns true if the value is greater than zero.
func (a Money) IsPositive() bool {
	return a.rat.Sign() > 0
}

// Cmp compares a and b: -1 if a < b, 0 if a == b, +1 if a > b.
func (a Money) Cmp(b Money) int {
	return a.rat.Cmp(&b.rat)
}
