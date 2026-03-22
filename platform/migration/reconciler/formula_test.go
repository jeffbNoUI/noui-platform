package reconciler

import (
	"math/big"
	"os"
	"strconv"
	"testing"

	"gopkg.in/yaml.v3"
)

// fixtureFile is the path to the shared YAML test fixtures.
// Both Go and Python test suites read from this single canonical file.
const fixtureFile = "../../../migration-simulation/fixtures/reconciliation_fixtures.yaml"

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
	TierCode        string `yaml:"tier_code"`
}

type fixtureExpected struct {
	GrossMonthly    string `yaml:"gross_monthly"`
	ReductionFactor string `yaml:"reduction_factor"`
	FinalMonthly    string `yaml:"final_monthly"`
	Error           bool   `yaml:"error"`
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
	if _, err := os.Stat(planConfigPath); os.IsNotExist(err) {
		t.Skip("plan-config.yaml not found; skipping")
	}

	pc, err := LoadPlanConfig(planConfigPath)
	if err != nil {
		t.Fatalf("LoadPlanConfig: %v", err)
	}

	cases := loadFixtures(t)
	for _, tc := range cases {
		t.Run(tc.Name, func(t *testing.T) {
			yos := mustRat(t, tc.Inputs.YOS)
			fas := mustRat(t, tc.Inputs.FAS)

			tier, ok := pc.LookupTier(tc.Inputs.TierCode)
			if !ok {
				if tc.Expected.Error {
					return // expected: unknown tier
				}
				t.Fatalf("unknown tier code %q", tc.Inputs.TierCode)
			}
			if tc.Expected.Error {
				t.Fatal("expected error for unknown tier, but tier was found")
			}

			params, err := tier.ToBenefitParams(pc.System.NormalRetirementAge)
			if err != nil {
				t.Fatalf("ToBenefitParams: %v", err)
			}

			result := CalcRetirementBenefit(yos, fas, tc.Inputs.AgeAtRetirement, *params)

			gotGross := formatRat2dp(result.GrossMonthly)
			if gotGross != tc.Expected.GrossMonthly {
				t.Errorf("GrossMonthly = %s, want %s", gotGross, tc.Expected.GrossMonthly)
			}

			gotReduction := result.ReductionFactor.FloatString(2)
			if gotReduction != tc.Expected.ReductionFactor {
				t.Errorf("ReductionFactor = %s, want %s", gotReduction, tc.Expected.ReductionFactor)
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
	if _, err := os.Stat(planConfigPath); os.IsNotExist(err) {
		t.Skip("plan-config.yaml not found; skipping")
	}

	pc, err := LoadPlanConfig(planConfigPath)
	if err != nil {
		t.Fatalf("LoadPlanConfig: %v", err)
	}

	t.Run("TIER_1_standard", func(t *testing.T) {
		yos := mustRat(t, "25")
		fas := mustRat(t, "5500")
		result := RecomputeFromStoredInputs(yos, fas, 65, "TIER_1", pc)
		if result == nil {
			t.Fatal("expected non-nil result")
		}
		got := formatRat2dp(result)
		// gross = 25*0.020*5500/12 = 229.17, factor=1.00, floor=800.00
		if got != "800.00" {
			t.Errorf("got %s, want 800.00", got)
		}
	})

	t.Run("TIER_1_high_earner", func(t *testing.T) {
		yos := mustRat(t, "30")
		fas := mustRat(t, "25000")
		result := RecomputeFromStoredInputs(yos, fas, 65, "TIER_1", pc)
		if result == nil {
			t.Fatal("expected non-nil result")
		}
		got := formatRat2dp(result)
		// gross = 30*0.020*25000/12 = 1250.00, factor=1.00
		if got != "1250.00" {
			t.Errorf("got %s, want 1250.00", got)
		}
	})

	t.Run("TIER_2_standard", func(t *testing.T) {
		yos := mustRat(t, "25")
		fas := mustRat(t, "5500")
		result := RecomputeFromStoredInputs(yos, fas, 65, "TIER_2", pc)
		if result == nil {
			t.Fatal("expected non-nil result")
		}
		got := formatRat2dp(result)
		// gross = 25*0.015*5500/12 = 171.88, factor=1.00, floor=800.00
		if got != "800.00" {
			t.Errorf("got %s, want 800.00", got)
		}
	})

	t.Run("unknown_tier_returns_nil", func(t *testing.T) {
		yos := mustRat(t, "25")
		fas := mustRat(t, "5500")
		result := RecomputeFromStoredInputs(yos, fas, 65, "UNKNOWN", pc)
		if result != nil {
			t.Errorf("expected nil for unknown tier, got %s", formatRat2dp(result))
		}
	})

	t.Run("nil_planconfig_returns_nil", func(t *testing.T) {
		yos := mustRat(t, "25")
		fas := mustRat(t, "5500")
		result := RecomputeFromStoredInputs(yos, fas, 65, "TIER_1", nil)
		if result != nil {
			t.Errorf("expected nil for nil PlanConfig, got %s", formatRat2dp(result))
		}
	})
}

func TestFormulaManualCalculations(t *testing.T) {
	if _, err := os.Stat(planConfigPath); os.IsNotExist(err) {
		t.Skip("plan-config.yaml not found; skipping")
	}

	pc, err := LoadPlanConfig(planConfigPath)
	if err != nil {
		t.Fatalf("LoadPlanConfig: %v", err)
	}

	t.Run("early_retirement_reduction_calc", func(t *testing.T) {
		// TIER_1, age 55: factor = 0.70
		// gross = 20 * 0.020 * 4800 / 12 = 1920/12 = 160.00
		// after_reduction = 160.00 * 0.70 = 112.00
		// final = max(112.00, 800.00) = 800.00 (floor applies)
		yos := mustRat(t, "20")
		fas := mustRat(t, "4800")
		tier, _ := pc.LookupTier("TIER_1")
		params, _ := tier.ToBenefitParams(pc.System.NormalRetirementAge)
		result := CalcRetirementBenefit(yos, fas, 55, *params)

		gotGross := formatRat2dp(result.GrossMonthly)
		if gotGross != "160.00" {
			t.Errorf("GrossMonthly = %s, want 160.00", gotGross)
		}

		reductionStr := result.ReductionFactor.FloatString(2)
		if reductionStr != "0.70" {
			t.Errorf("ReductionFactor = %s, want 0.70", reductionStr)
		}

		gotFinal := formatRat2dp(result.FinalMonthly)
		if gotFinal != "800.00" {
			t.Errorf("FinalMonthly = %s, want 800.00 (floor)", gotFinal)
		}
	})

	t.Run("age_above_normal_no_reduction", func(t *testing.T) {
		// Age 67 (above NRA 65) → reduction factor = 1.0
		yos := mustRat(t, "30")
		fas := mustRat(t, "25000")
		tier, _ := pc.LookupTier("TIER_1")
		params, _ := tier.ToBenefitParams(pc.System.NormalRetirementAge)
		result := CalcRetirementBenefit(yos, fas, 67, *params)

		if result.ReductionFactor.Cmp(new(big.Rat).SetInt64(1)) != 0 {
			t.Errorf("expected reduction factor 1.00 for age above NRA, got %s",
				result.ReductionFactor.FloatString(2))
		}
	})

	t.Run("tier1_high_earner_early_60", func(t *testing.T) {
		// TIER_1, age 60: factor = 0.85
		// gross = 30 * 0.020 * 25000 / 12 = 1250.00
		// after = 1250.00 * 0.85 = 1062.50
		yos := mustRat(t, "30")
		fas := mustRat(t, "25000")
		tier, _ := pc.LookupTier("TIER_1")
		params, _ := tier.ToBenefitParams(pc.System.NormalRetirementAge)
		result := CalcRetirementBenefit(yos, fas, 60, *params)

		gotFinal := formatRat2dp(result.FinalMonthly)
		if gotFinal != "1062.50" {
			t.Errorf("FinalMonthly = %s, want 1062.50", gotFinal)
		}
	})
}

func BenchmarkCalcRetirementBenefit(b *testing.B) {
	yos := new(big.Rat).SetFrac64(25, 1)
	fas := new(big.Rat).SetFrac64(5500, 1)
	params := BenefitParams{
		FormulaType:         "flat_multiplier",
		Multiplier:          new(big.Rat).SetFloat64(0.020),
		ReductionMethod:     "lookup_table",
		ReductionTable:      map[int]*big.Rat{65: new(big.Rat).SetInt64(1)},
		NormalRetirementAge: 65,
		BenefitFloor:        new(big.Rat).SetFloat64(800.0),
	}

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
