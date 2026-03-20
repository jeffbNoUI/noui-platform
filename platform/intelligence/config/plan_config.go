// Package config loads plan-specific configuration from YAML.
// The plan config is the single source of truth for all plan parameters
// (tier definitions, multipliers, contribution rates, etc.).
package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// PlanConfig represents the complete plan configuration loaded from YAML.
type PlanConfig struct {
	Plan                PlanIdentity          `yaml:"plan"`
	Tiers               []TierDef             `yaml:"tiers"`
	BenefitMultipliers  map[int]float64       `yaml:"benefit_multipliers"`
	AMSWindowMonths     map[int]int           `yaml:"ams_window_months"`
	RuleOfN             RuleOfNConfig         `yaml:"rule_of_n"`
	EarlyRetirement     EarlyRetirementConfig `yaml:"early_retirement"`
	DeathBenefits       DeathBenefitsConfig   `yaml:"death_benefits"`
	Contributions       ContributionsConfig   `yaml:"contributions"`
	VestingYears        float64               `yaml:"vesting_years"`
	NormalRetirementAge int                   `yaml:"normal_retirement_age"`
	IPR                 IPRConfig             `yaml:"ipr"`
	JSFactors           map[int]float64       `yaml:"js_factors"`
}

// PlanIdentity holds the plan name fields.
type PlanIdentity struct {
	Name      string `yaml:"name"`
	ShortName string `yaml:"short_name"`
}

// TierDef defines a tier with its hire date cutoff.
type TierDef struct {
	ID             int     `yaml:"id"`
	HireDateBefore *string `yaml:"hire_date_before"`
}

// RuleOfNConfig holds Rule of N thresholds and minimum ages per tier.
type RuleOfNConfig struct {
	Thresholds map[int]float64 `yaml:"thresholds"`
	MinAges    map[int]int     `yaml:"min_ages"`
}

// EarlyRetirementConfig holds early retirement parameters per tier.
type EarlyRetirementConfig struct {
	MinAges            map[int]int           `yaml:"min_ages"`
	ReductionTables    ReductionTablesConfig `yaml:"reduction_tables"`
	ReductionRatePerYr map[int]float64       `yaml:"reduction_rate_per_year"`
}

// ReductionTablesConfig holds the reduction factor lookup tables.
type ReductionTablesConfig struct {
	Tiers12 map[int]float64 `yaml:"tiers_1_2"`
	Tier3   map[int]float64 `yaml:"tier_3"`
}

// DeathBenefitsConfig holds death benefit amounts by age.
type DeathBenefitsConfig struct {
	Tiers12 map[int]float64 `yaml:"tiers_1_2"`
	Tier3   map[int]float64 `yaml:"tier_3"`
}

// ContributionsConfig holds employee and employer contribution rates.
type ContributionsConfig struct {
	EmployeeRate float64 `yaml:"employee_rate"`
	EmployerRate float64 `yaml:"employer_rate"`
}

// IPRConfig holds insurance premium reimbursement rates.
type IPRConfig struct {
	NonMedicare float64 `yaml:"non_medicare"`
	Medicare    float64 `yaml:"medicare"`
}

// LoadPlanConfig reads and parses a plan configuration YAML file.
func LoadPlanConfig(path string) (*PlanConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading plan config %s: %w", path, err)
	}

	var cfg PlanConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parsing plan config %s: %w", path, err)
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("validating plan config: %w", err)
	}

	return &cfg, nil
}

// Validate checks that the loaded config has required fields populated.
func (c *PlanConfig) Validate() error {
	if len(c.Tiers) == 0 {
		return fmt.Errorf("no tiers defined")
	}
	if len(c.BenefitMultipliers) == 0 {
		return fmt.Errorf("no benefit multipliers defined")
	}
	if len(c.AMSWindowMonths) == 0 {
		return fmt.Errorf("no AMS window months defined")
	}
	if c.NormalRetirementAge == 0 {
		return fmt.Errorf("normal retirement age not set")
	}
	if c.VestingYears == 0 {
		return fmt.Errorf("vesting years not set")
	}
	if c.Contributions.EmployeeRate == 0 {
		return fmt.Errorf("employee contribution rate not set")
	}
	return nil
}

// TierCutoffDates returns parsed time.Time values for tier boundaries.
// Returns tier2Start and tier3Start based on the tiers configuration.
func (c *PlanConfig) TierCutoffDates() (tier2Start, tier3Start time.Time, err error) {
	for _, t := range c.Tiers {
		if t.HireDateBefore == nil {
			continue
		}
		parsed, parseErr := time.Parse("2006-01-02", *t.HireDateBefore)
		if parseErr != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("parsing tier %d date %q: %w", t.ID, *t.HireDateBefore, parseErr)
		}
		switch t.ID {
		case 1:
			tier2Start = parsed
		case 2:
			tier3Start = parsed
		}
	}
	if tier2Start.IsZero() {
		return time.Time{}, time.Time{}, fmt.Errorf("tier 1 hire_date_before (tier 2 start) not found")
	}
	if tier3Start.IsZero() {
		return time.Time{}, time.Time{}, fmt.Errorf("tier 2 hire_date_before (tier 3 start) not found")
	}
	return tier2Start, tier3Start, nil
}
