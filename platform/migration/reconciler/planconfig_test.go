package reconciler

import (
	"math/big"
	"os"
	"testing"
)

const planConfigPath = "../../../domains/pension/plan-config.yaml"

func TestLoadPlanConfig(t *testing.T) {
	if _, err := os.Stat(planConfigPath); os.IsNotExist(err) {
		t.Skip("plan-config.yaml not found; skipping")
	}

	pc, err := loadOrFail(t)
	if err != nil {
		return
	}

	if pc.System.Name != "Colorado PERA" {
		t.Errorf("System.Name = %q, want %q", pc.System.Name, "Colorado PERA")
	}
	if pc.System.NormalRetirementAge != 65 {
		t.Errorf("NormalRetirementAge = %d, want 65", pc.System.NormalRetirementAge)
	}
	if len(pc.Plans) == 0 {
		t.Fatal("expected at least one plan")
	}
	if pc.Plans[0].ID != "state_division" {
		t.Errorf("Plans[0].ID = %q, want %q", pc.Plans[0].ID, "state_division")
	}
}

func TestLookupTier(t *testing.T) {
	if _, err := os.Stat(planConfigPath); os.IsNotExist(err) {
		t.Skip("plan-config.yaml not found; skipping")
	}

	pc, err := loadOrFail(t)
	if err != nil {
		return
	}

	tests := []struct {
		tierID        string
		wantFound     bool
		wantReduction string
	}{
		{"TIER_1", true, "lookup_table"},
		{"TIER_2", true, "lookup_table"},
		{"TIER_3", true, "lookup_table"},
		{"UNKNOWN", false, ""},
	}

	for _, tc := range tests {
		t.Run(tc.tierID, func(t *testing.T) {
			tier, found := pc.LookupTier(tc.tierID)
			if found != tc.wantFound {
				t.Fatalf("LookupTier(%q) found = %v, want %v", tc.tierID, found, tc.wantFound)
			}
			if found && tier.Reduction.Method != tc.wantReduction {
				t.Errorf("Tier %s reduction method = %q, want %q", tc.tierID, tier.Reduction.Method, tc.wantReduction)
			}
		})
	}
}

func TestTierToBenefitParams(t *testing.T) {
	if _, err := os.Stat(planConfigPath); os.IsNotExist(err) {
		t.Skip("plan-config.yaml not found; skipping")
	}

	pc, err := loadOrFail(t)
	if err != nil {
		return
	}

	// Test multipliers — compare at 10dp to tolerate SetFloat64 IEEE 754 noise
	multiplierTests := []struct {
		tierID string
		want   string // expected multiplier to 10 decimal places
	}{
		{"TIER_1", "0.0200000000"},
		{"TIER_2", "0.0150000000"},
		{"TIER_3", "0.0150000000"},
	}

	for _, tc := range multiplierTests {
		t.Run(tc.tierID+"_multiplier", func(t *testing.T) {
			tier, _ := pc.LookupTier(tc.tierID)
			bp, err := tier.ToBenefitParams(65)
			if err != nil {
				t.Fatalf("ToBenefitParams: %v", err)
			}

			got := bp.Multiplier.FloatString(10)
			if got != tc.want {
				t.Errorf("Multiplier = %s, want %s", got, tc.want)
			}
		})
	}

	// Test benefit floor
	t.Run("benefit_floor", func(t *testing.T) {
		tier, _ := pc.LookupTier("TIER_1")
		bp, err := tier.ToBenefitParams(65)
		if err != nil {
			t.Fatalf("ToBenefitParams: %v", err)
		}

		wantFloor := new(big.Rat).SetFloat64(800.0)
		if bp.BenefitFloor == nil {
			t.Fatal("BenefitFloor is nil")
		}
		if bp.BenefitFloor.Cmp(wantFloor) != 0 {
			t.Errorf("BenefitFloor = %s, want 800", bp.BenefitFloor.FloatString(2))
		}
	})

	// Test reduction table entries — compare at 10dp to tolerate SetFloat64 noise
	reductionTests := []struct {
		tierID string
		age    int
		want   string // expected to 10 decimal places
	}{
		{"TIER_1", 60, "0.8500000000"},
		{"TIER_1", 65, "1.0000000000"},
		{"TIER_3", 63, "0.8800000000"},
		{"TIER_3", 60, "0.7000000000"},
	}

	for _, tc := range reductionTests {
		name := tc.tierID + "_reduction_" + big.NewInt(int64(tc.age)).String()
		t.Run(name, func(t *testing.T) {
			tier, _ := pc.LookupTier(tc.tierID)
			bp, err := tier.ToBenefitParams(65)
			if err != nil {
				t.Fatalf("ToBenefitParams: %v", err)
			}

			got, ok := bp.ReductionTable[tc.age]
			if !ok {
				t.Fatalf("ReductionTable missing age %d", tc.age)
			}

			gotStr := got.FloatString(10)
			if gotStr != tc.want {
				t.Errorf("ReductionTable[%d] = %s, want %s", tc.age, gotStr, tc.want)
			}
		})
	}

	// Test NormalRetirementAge passthrough
	t.Run("normal_retirement_age", func(t *testing.T) {
		tier, _ := pc.LookupTier("TIER_1")
		bp, err := tier.ToBenefitParams(65)
		if err != nil {
			t.Fatalf("ToBenefitParams: %v", err)
		}
		if bp.NormalRetirementAge != 65 {
			t.Errorf("NormalRetirementAge = %d, want 65", bp.NormalRetirementAge)
		}
	})
}

// loadOrFail is a test helper that loads the plan config or fails the test.
func loadOrFail(t *testing.T) (*PlanConfig, error) {
	t.Helper()
	pc, err := LoadPlanConfig(planConfigPath)
	if err != nil {
		t.Fatalf("LoadPlanConfig: %v", err)
	}
	return pc, nil
}
