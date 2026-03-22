package reconciler

import (
	"fmt"
	"math/big"
	"os"

	"gopkg.in/yaml.v3"
)

// yamlRoot is the top-level YAML structure. The reconciler config is nested
// under the "reconciler:" key alongside other plan-config sections that we
// ignore here.
type yamlRoot struct {
	Reconciler struct {
		System SystemDef `yaml:"system"`
		Plans  []PlanDef `yaml:"plans"`
	} `yaml:"reconciler"`
}

// SystemDef identifies the pension system (e.g., Colorado PERA).
type SystemDef struct {
	Name                string `yaml:"name"`
	ShortName           string `yaml:"short_name"`
	NormalRetirementAge int    `yaml:"normal_retirement_age"`
}

// PlanDef represents a single plan within the system (e.g., State Division Trust).
type PlanDef struct {
	ID           string    `yaml:"id"`
	Name         string    `yaml:"name"`
	BenefitFloor *float64  `yaml:"benefit_floor"`
	Tiers        []TierDef `yaml:"tiers"`
}

// TierDef represents a benefit tier within a plan.
type TierDef struct {
	ID         string          `yaml:"id"`
	Name       string          `yaml:"name"`
	Status     string          `yaml:"status"`
	ClonedFrom *string         `yaml:"cloned_from"`
	Formula    FormulaStrategy `yaml:"formula"`
	FAS        FASStrategy     `yaml:"fas"`
	Reduction  ReductionDef    `yaml:"reduction"`

	// plan is a back-reference to the parent PlanDef, set at load time.
	plan *PlanDef
}

// FormulaStrategy defines how the base benefit is calculated.
type FormulaStrategy struct {
	Type       string   `yaml:"type"`
	Multiplier *float64 `yaml:"multiplier"`
}

// FASStrategy defines the Final Average Salary calculation method.
type FASStrategy struct {
	Method       string `yaml:"method"`
	WindowMonths int    `yaml:"window_months"`
}

// ReductionDef defines the early retirement reduction approach.
type ReductionDef struct {
	Method string          `yaml:"method"`
	Table  map[int]float64 `yaml:"table"`
}

// PlanConfig is the fully loaded and indexed configuration.
type PlanConfig struct {
	System  SystemDef
	Plans   []PlanDef
	tierMap map[string]*TierDef
}

// BenefitParams holds exact-arithmetic parameters derived from a TierDef,
// ready for use by the reconciler's benefit calculation functions.
type BenefitParams struct {
	FormulaType         string
	Multiplier          *big.Rat
	ReductionMethod     string
	ReductionTable      map[int]*big.Rat
	NormalRetirementAge int
	BenefitFloor        *big.Rat
}

// LoadPlanConfig reads the plan-config YAML file and builds the tier lookup map.
func LoadPlanConfig(path string) (*PlanConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("planconfig: read %s: %w", path, err)
	}

	var root yamlRoot
	if err := yaml.Unmarshal(data, &root); err != nil {
		return nil, fmt.Errorf("planconfig: parse YAML: %w", err)
	}

	pc := &PlanConfig{
		System:  root.Reconciler.System,
		Plans:   root.Reconciler.Plans,
		tierMap: make(map[string]*TierDef),
	}

	totalTiers := 0
	for i := range pc.Plans {
		plan := &pc.Plans[i]
		for j := range plan.Tiers {
			tier := &plan.Tiers[j]
			tier.plan = plan
			pc.tierMap[tier.ID] = tier
			totalTiers++
		}
	}

	if totalTiers == 0 {
		return nil, fmt.Errorf("planconfig: no tiers found in %s", path)
	}

	return pc, nil
}

// LookupTier returns the TierDef for the given tier ID in O(1) time.
func (pc *PlanConfig) LookupTier(tierID string) (*TierDef, bool) {
	t, ok := pc.tierMap[tierID]
	return t, ok
}

// ToBenefitParams converts a TierDef into exact-arithmetic BenefitParams
// suitable for benefit calculations.
func (t *TierDef) ToBenefitParams(normalRetirementAge int) (*BenefitParams, error) {
	bp := &BenefitParams{
		FormulaType:         t.Formula.Type,
		ReductionMethod:     t.Reduction.Method,
		NormalRetirementAge: normalRetirementAge,
	}

	// Multiplier
	if t.Formula.Multiplier != nil {
		bp.Multiplier = new(big.Rat).SetFloat64(*t.Formula.Multiplier)
	} else {
		return nil, fmt.Errorf("planconfig: tier %s has no multiplier", t.ID)
	}

	// Reduction table
	if len(t.Reduction.Table) > 0 {
		bp.ReductionTable = make(map[int]*big.Rat, len(t.Reduction.Table))
		for age, factor := range t.Reduction.Table {
			bp.ReductionTable[age] = new(big.Rat).SetFloat64(factor)
		}
	}

	// Benefit floor from parent plan
	if t.plan != nil && t.plan.BenefitFloor != nil {
		bp.BenefitFloor = new(big.Rat).SetFloat64(*t.plan.BenefitFloor)
	}

	return bp, nil
}
