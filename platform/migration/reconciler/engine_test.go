package reconciler

import (
	"math/big"
	"testing"
)

func TestClassifyVariance(t *testing.T) {
	tests := []struct {
		name     string
		amount   string // decimal string
		expected VarianceCategory
	}{
		{"zero", "0.00", CategoryMatch},
		{"exactly_half_dollar", "0.50", CategoryMatch},
		{"negative_half_dollar", "-0.50", CategoryMatch},
		{"just_above_match", "0.51", CategoryMinor},
		{"negative_just_above_match", "-0.51", CategoryMinor},
		{"one_dollar", "1.00", CategoryMinor},
		{"just_below_major", "24.99", CategoryMinor},
		{"negative_just_below_major", "-24.99", CategoryMinor},
		{"exactly_25", "25.00", CategoryMajor},
		{"negative_exactly_25", "-25.00", CategoryMajor},
		{"large_variance", "1000.00", CategoryMajor},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := new(big.Rat)
			if _, ok := r.SetString(tc.amount); !ok {
				t.Fatalf("failed to parse amount %q", tc.amount)
			}
			got := ClassifyVariance(r)
			if got != tc.expected {
				t.Errorf("ClassifyVariance(%s) = %s, want %s", tc.amount, got, tc.expected)
			}
		})
	}
}
