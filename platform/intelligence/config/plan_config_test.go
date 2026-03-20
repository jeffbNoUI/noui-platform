package config

import (
	"testing"
)

func TestLoadPlanConfig(t *testing.T) {
	cfg, err := LoadPlanConfig("../../../domains/pension/plan-config.yaml")
	if err != nil {
		t.Fatalf("LoadPlanConfig failed: %v", err)
	}

	// Plan identity
	if cfg.Plan.Name != "Retirement Plan" {
		t.Errorf("plan name = %q, want %q", cfg.Plan.Name, "Retirement Plan")
	}

	// Tiers
	if len(cfg.Tiers) != 3 {
		t.Fatalf("expected 3 tiers, got %d", len(cfg.Tiers))
	}
	if cfg.Tiers[0].HireDateBefore == nil || *cfg.Tiers[0].HireDateBefore != "2004-09-01" {
		t.Errorf("tier 1 hire_date_before = %v, want 2004-09-01", cfg.Tiers[0].HireDateBefore)
	}
	if cfg.Tiers[2].HireDateBefore != nil {
		t.Errorf("tier 3 hire_date_before should be nil, got %v", *cfg.Tiers[2].HireDateBefore)
	}

	// Benefit multipliers
	if cfg.BenefitMultipliers[1] != 0.020 {
		t.Errorf("tier 1 multiplier = %v, want 0.020", cfg.BenefitMultipliers[1])
	}
	if cfg.BenefitMultipliers[3] != 0.015 {
		t.Errorf("tier 3 multiplier = %v, want 0.015", cfg.BenefitMultipliers[3])
	}

	// AMS window
	if cfg.AMSWindowMonths[1] != 36 {
		t.Errorf("tier 1 AMS window = %d, want 36", cfg.AMSWindowMonths[1])
	}
	if cfg.AMSWindowMonths[3] != 60 {
		t.Errorf("tier 3 AMS window = %d, want 60", cfg.AMSWindowMonths[3])
	}

	// Rule of N
	if cfg.RuleOfN.Thresholds[1] != 75.0 {
		t.Errorf("tier 1 rule of N = %v, want 75.0", cfg.RuleOfN.Thresholds[1])
	}
	if cfg.RuleOfN.Thresholds[3] != 85.0 {
		t.Errorf("tier 3 rule of N = %v, want 85.0", cfg.RuleOfN.Thresholds[3])
	}
	if cfg.RuleOfN.MinAges[3] != 60 {
		t.Errorf("tier 3 rule of N min age = %d, want 60", cfg.RuleOfN.MinAges[3])
	}

	// Contributions
	if cfg.Contributions.EmployeeRate != 0.0845 {
		t.Errorf("employee rate = %v, want 0.0845", cfg.Contributions.EmployeeRate)
	}
	if cfg.Contributions.EmployerRate != 0.1795 {
		t.Errorf("employer rate = %v, want 0.1795", cfg.Contributions.EmployerRate)
	}

	// Constants
	if cfg.VestingYears != 5.0 {
		t.Errorf("vesting years = %v, want 5.0", cfg.VestingYears)
	}
	if cfg.NormalRetirementAge != 65 {
		t.Errorf("normal ret age = %d, want 65", cfg.NormalRetirementAge)
	}

	// IPR
	if cfg.IPR.NonMedicare != 12.50 {
		t.Errorf("IPR non-medicare = %v, want 12.50", cfg.IPR.NonMedicare)
	}
	if cfg.IPR.Medicare != 6.25 {
		t.Errorf("IPR medicare = %v, want 6.25", cfg.IPR.Medicare)
	}

	// JS Factors
	if cfg.JSFactors[100] != 0.8850 {
		t.Errorf("JS factor 100 = %v, want 0.8850", cfg.JSFactors[100])
	}

	// Early retirement reduction tables
	if cfg.EarlyRetirement.ReductionTables.Tiers12[55] != 0.70 {
		t.Errorf("T12 reduction at 55 = %v, want 0.70", cfg.EarlyRetirement.ReductionTables.Tiers12[55])
	}
	if cfg.EarlyRetirement.ReductionTables.Tier3[60] != 0.70 {
		t.Errorf("T3 reduction at 60 = %v, want 0.70", cfg.EarlyRetirement.ReductionTables.Tier3[60])
	}

	// Death benefits
	if cfg.DeathBenefits.Tiers12[65] != 5000 {
		t.Errorf("T12 death benefit at 65 = %v, want 5000", cfg.DeathBenefits.Tiers12[65])
	}

	// Tier cutoff dates
	tier2Start, tier3Start, err := cfg.TierCutoffDates()
	if err != nil {
		t.Fatalf("TierCutoffDates failed: %v", err)
	}
	if tier2Start.Format("2006-01-02") != "2004-09-01" {
		t.Errorf("tier2Start = %v, want 2004-09-01", tier2Start)
	}
	if tier3Start.Format("2006-01-02") != "2011-07-01" {
		t.Errorf("tier3Start = %v, want 2011-07-01", tier3Start)
	}
}

func TestLoadPlanConfig_FileNotFound(t *testing.T) {
	_, err := LoadPlanConfig("/nonexistent/path.yaml")
	if err == nil {
		t.Error("expected error for nonexistent file")
	}
}
