package reconciler

import (
	"math/big"
	"os"
	"strconv"
	"testing"

	"gopkg.in/yaml.v3"
)

// fixtureFile is the path to the shared YAML test fixtures.
const fixtureFile = "testdata/reconciliation_fixtures.yaml"

type fixtureDoc struct {
	TestCases []fixtureCase `yaml:"test_cases"`
}

type fixtureCase struct {
	Name     string          `yaml:"name"`
	Inputs   fixtureInputs   `yaml:"inputs"`
	Expected fixtureExpected `yaml:"expected"`
}

type fixtureInputs struct {
	YOS             string `yaml:"yos"`
	FAS             string `yaml:"fas"`
	AgeAtRetirement int    `yaml:"age_at_retirement"`
	PlanCode        string `yaml:"plan_code"`
}

type fixtureExpected struct {
	GrossMonthly string `yaml:"gross_monthly"`
	PenaltyPct   string `yaml:"penalty_pct"`
	FinalMonthly string `yaml:"final_monthly"`
}

func loadFixtures(t *testing.T) []fixtureCase {
	t.Helper()
	data, err := os.ReadFile(fixtureFile)
	if err != nil {
		t.Fatalf("failed to read fixtures: %v", err)
	}
	var doc fixtureDoc
	if err := yaml.Unmarshal(data, &doc); err != nil {
		t.Fatalf("failed to parse fixtures: %v", err)
	}
	return doc.TestCases
}

func mustRat(t *testing.T, s string) *big.Rat {
	t.Helper()
	r := new(big.Rat)
	if _, ok := r.SetString(s); !ok {
		t.Fatalf("failed to parse %q as big.Rat", s)
	}
	return r
}

func TestCalcRetirementBenefit_Fixtures(t *testing.T) {
	cases := loadFixtures(t)
	for _, tc := range cases {
		t.Run(tc.Name, func(t *testing.T) {
			yos := mustRat(t, tc.Inputs.YOS)
			fas := mustRat(t, tc.Inputs.FAS)

			params, ok := planRegistry[tc.Inputs.PlanCode]
			if !ok {
				t.Fatalf("unknown plan code %q", tc.Inputs.PlanCode)
			}

			result := CalcRetirementBenefit(yos, fas, tc.Inputs.AgeAtRetirement, params)

			gotGross := formatRat2dp(result.GrossMonthly)
			if gotGross != tc.Expected.GrossMonthly {
				t.Errorf("GrossMonthly = %s, want %s", gotGross, tc.Expected.GrossMonthly)
			}

			gotPenalty := result.PenaltyPct.FloatString(2)
			if gotPenalty != tc.Expected.PenaltyPct {
				t.Errorf("PenaltyPct = %s, want %s", gotPenalty, tc.Expected.PenaltyPct)
			}

			gotFinal := formatRat2dp(result.FinalMonthly)
			if gotFinal != tc.Expected.FinalMonthly {
				t.Errorf("FinalMonthly = %s, want %s", gotFinal, tc.Expected.FinalMonthly)
			}
		})
	}
}

func TestRoundHalfUp(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"exact_zero", "0", "0.00"},
		{"exact_integer", "100", "100.00"},
		{"exact_two_dp", "12.34", "12.34"},
		{"half_cent_up", "0.005", "0.01"},
		{"rounds_up_at_half", "2291.665", "2291.67"},
		{"rounds_down_below_half", "2291.664", "2291.66"},
		{"negative_rounds_away", "-1.005", "-1.01"},
		{"large_number", "99999.995", "100000.00"},
		{"one_third", "1/3", "0.33"},
		{"two_thirds", "2/3", "0.67"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := mustRat(t, tc.input)
			got := RoundHalfUp(r)
			if got != tc.expected {
				t.Errorf("RoundHalfUp(%s) = %s, want %s", tc.input, got, tc.expected)
			}
		})
	}
}

func TestRecomputeFromStoredInputs(t *testing.T) {
	t.Run("DB_MAIN_standard", func(t *testing.T) {
		yos := mustRat(t, "25")
		fas := mustRat(t, "5500")
		result := RecomputeFromStoredInputs(yos, fas, 65, "DB_MAIN")
		if result == nil {
			t.Fatal("expected non-nil result")
		}
		got := formatRat2dp(result)
		if got != "2291.67" {
			t.Errorf("got %s, want 2291.67", got)
		}
	})

	t.Run("DB_T2_standard", func(t *testing.T) {
		yos := mustRat(t, "25")
		fas := mustRat(t, "5500")
		result := RecomputeFromStoredInputs(yos, fas, 65, "DB_T2")
		if result == nil {
			t.Fatal("expected non-nil result")
		}
		got := formatRat2dp(result)
		if got != "2062.50" {
			t.Errorf("got %s, want 2062.50", got)
		}
	})

	t.Run("unknown_plan_returns_nil", func(t *testing.T) {
		yos := mustRat(t, "25")
		fas := mustRat(t, "5500")
		result := RecomputeFromStoredInputs(yos, fas, 65, "UNKNOWN")
		if result != nil {
			t.Errorf("expected nil for unknown plan, got %s", formatRat2dp(result))
		}
	})
}

func TestFormulaManualCalculations(t *testing.T) {
	t.Run("early_retirement_penalty_calc", func(t *testing.T) {
		// 5 years early at 6%/yr = 30% penalty (hits cap)
		// gross = 20 * 0.20 * 4800 / 12 = 19200/12 = 1600.00
		// final = 1600 * (1 - 0.30) = 1120.00
		yos := mustRat(t, "20")
		fas := mustRat(t, "4800")
		params := planRegistry["DB_MAIN"]
		result := CalcRetirementBenefit(yos, fas, 60, params)

		gotGross := formatRat2dp(result.GrossMonthly)
		if gotGross != "1600.00" {
			t.Errorf("GrossMonthly = %s, want 1600.00", gotGross)
		}

		penaltyStr := result.PenaltyPct.FloatString(2)
		if penaltyStr != "0.30" {
			t.Errorf("PenaltyPct = %s, want 0.30", penaltyStr)
		}

		gotFinal := formatRat2dp(result.FinalMonthly)
		if gotFinal != "1120.00" {
			t.Errorf("FinalMonthly = %s, want 1120.00", gotFinal)
		}
	})

	t.Run("age_above_normal_no_penalty", func(t *testing.T) {
		yos := mustRat(t, "30")
		fas := mustRat(t, "6000")
		params := planRegistry["DB_MAIN"]
		result := CalcRetirementBenefit(yos, fas, 67, params)

		if result.PenaltyPct.Sign() != 0 {
			t.Errorf("expected zero penalty for age above NRA, got %s",
				result.PenaltyPct.FloatString(2))
		}
	})
}

func BenchmarkCalcRetirementBenefit(b *testing.B) {
	yos := new(big.Rat).SetFrac64(25, 1)
	fas := new(big.Rat).SetFrac64(5500, 1)
	params := planRegistry["DB_MAIN"]

	for i := 0; i < b.N; i++ {
		CalcRetirementBenefit(yos, fas, 65, params)
	}
}

func TestFormatRat2dp(t *testing.T) {
	tests := []struct {
		num, den int64
		expected string
	}{
		{0, 1, "0.00"},
		{100, 1, "100.00"},
		{1234, 100, "12.34"},
		{-500, 100, "-5.00"},
		{1, 100, "0.01"},
	}
	for i, tc := range tests {
		t.Run(strconv.Itoa(i), func(t *testing.T) {
			r := new(big.Rat).SetFrac64(tc.num, tc.den)
			got := formatRat2dp(r)
			if got != tc.expected {
				t.Errorf("formatRat2dp(%d/%d) = %s, want %s", tc.num, tc.den, got, tc.expected)
			}
		})
	}
}
