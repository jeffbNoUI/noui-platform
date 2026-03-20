// Package rules implements the deterministic rules engine for benefit calculations.
// ALL business rules are implemented as deterministic, auditable code executing
// certified rule configurations. AI does NOT execute business rules.
// Source: Governing Principle 1 (noui-architecture-decisions.docx)
package rules

import (
	"time"

	"github.com/noui/platform/intelligence/config"
)

// Statutory lookup tables — use tables from the RMC, NOT formulas.
// Per CLAUDE_CODE_PROTOCOL.md: "The statute defines tables, not formulas."

// EarlyRetReductionT12 is the early retirement reduction factor for Tiers 1 & 2.
// Source: RMC §18-409(b) — 3% per year under age 65.
// CRITICAL: This is 3% for Tiers 1&2, NOT 6%. See CRITICAL-001-resolution.md.
var EarlyRetReductionT12 = map[int]float64{
	55: 0.70,
	56: 0.73,
	57: 0.76,
	58: 0.79,
	59: 0.82,
	60: 0.85,
	61: 0.88,
	62: 0.91,
	63: 0.94,
	64: 0.97,
	65: 1.00,
}

// EarlyRetReductionT3 is the early retirement reduction factor for Tier 3.
// Source: RMC §18-409(b) — 6% per year under age 65.
var EarlyRetReductionT3 = map[int]float64{
	60: 0.70,
	61: 0.76,
	62: 0.82,
	63: 0.88,
	64: 0.94,
	65: 1.00,
}

// DeathBenefitT12 is the lump-sum death benefit for Tiers 1 & 2.
// Source: RMC §18-411(d) — $5,000 at normal retirement, reduced by $250 per year under 65.
var DeathBenefitT12 = map[int]float64{
	55: 2500,
	56: 2750,
	57: 3000,
	58: 3250,
	59: 3500,
	60: 3750,
	61: 4000,
	62: 4250,
	63: 4500,
	64: 4750,
	65: 5000,
}

// DeathBenefitT3 is the lump-sum death benefit for Tier 3.
// Source: RMC §18-411(d) — $5,000 at normal retirement, reduced by $500 per year under 65.
var DeathBenefitT3 = map[int]float64{
	60: 2500,
	61: 3000,
	62: 3500,
	63: 4000,
	64: 4500,
	65: 5000,
}

// TierMultiplier returns the benefit multiplier for each tier.
// Source: RMC §18-408
var TierMultiplier = map[int]float64{
	1: 0.020, // 2.0%
	2: 0.015, // 1.5%
	3: 0.015, // 1.5%
}

// AMSWindowMonths returns the AMS window size for each tier.
// Source: RMC §18-408
var AMSWindowMonths = map[int]int{
	1: 36, // 36 consecutive months
	2: 36, // 36 consecutive months
	3: 60, // 60 consecutive months
}

// RuleOfNThreshold returns the Rule of N threshold for each tier.
// Source: RMC §18-409(a)
var RuleOfNThreshold = map[int]float64{
	1: 75.0, // Rule of 75
	2: 75.0, // Rule of 75
	3: 85.0, // Rule of 85
}

// RuleOfNMinAge returns the minimum age for Rule of N for each tier.
// Source: RMC §18-409(a)
var RuleOfNMinAge = map[int]int{
	1: 55,
	2: 55,
	3: 60,
}

// EarlyRetMinAge returns the minimum early retirement age for each tier.
// Source: RMC §18-409(a)
var EarlyRetMinAge = map[int]int{
	1: 55,
	2: 55,
	3: 60,
}

// ASSUMPTION: [Q-CALC-04] Illustrative J&S factors. Actual factors from plan actuarial tables.
// These placeholders are labeled as illustrative per BUILD_HISTORY Decision 17/19.
var JSFactors = map[int]float64{
	100: 0.8850,
	75:  0.9150,
	50:  0.9450,
}

// Contribution rates and plan constants — initialized with defaults, overridden by InitFromConfig.
var (
	EmployeeContribRate float64 = 0.0845 // 8.45% — RMC §18-407(c)
	EmployerContribRate float64 = 0.1795 // 17.95% — Plan Handbook
	VestingYears        float64 = 5.0    // 5 years all tiers — RMC §18-403
	NormalRetAge        int     = 65     // Age 65 all tiers — RMC §18-409(a)(1)
	IPRNonMedicare      float64 = 12.50  // $12.50/year of earned service
	IPRMedicare         float64 = 6.25   // $6.25/year of earned service
)

// Tier cutoff dates — initialized by InitFromConfig.
var (
	Tier2Start time.Time // Tier 1 hire_date_before — start of Tier 2
	Tier3Start time.Time // Tier 2 hire_date_before — start of Tier 3
)

// InitFromConfig populates all package-level vars from the loaded plan config.
// This replaces hardcoded values with config-driven values while keeping the
// same variable names so all downstream code continues to work unchanged.
func InitFromConfig(cfg *config.PlanConfig) error {
	// Lookup tables
	EarlyRetReductionT12 = cfg.EarlyRetirement.ReductionTables.Tiers12
	EarlyRetReductionT3 = cfg.EarlyRetirement.ReductionTables.Tier3
	DeathBenefitT12 = cfg.DeathBenefits.Tiers12
	DeathBenefitT3 = cfg.DeathBenefits.Tier3
	TierMultiplier = cfg.BenefitMultipliers
	AMSWindowMonths = cfg.AMSWindowMonths
	RuleOfNThreshold = cfg.RuleOfN.Thresholds
	RuleOfNMinAge = cfg.RuleOfN.MinAges
	EarlyRetMinAge = cfg.EarlyRetirement.MinAges
	JSFactors = cfg.JSFactors

	// Scalar constants
	EmployeeContribRate = cfg.Contributions.EmployeeRate
	EmployerContribRate = cfg.Contributions.EmployerRate
	VestingYears = cfg.VestingYears
	NormalRetAge = cfg.NormalRetirementAge
	IPRNonMedicare = cfg.IPR.NonMedicare
	IPRMedicare = cfg.IPR.Medicare

	// Tier cutoff dates
	tier2, tier3, err := cfg.TierCutoffDates()
	if err != nil {
		return err
	}
	Tier2Start = tier2
	Tier3Start = tier3

	return nil
}
