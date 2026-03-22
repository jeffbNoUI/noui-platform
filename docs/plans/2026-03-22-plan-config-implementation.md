# Plan Config Reconciler Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the hardcoded reconciler plan registry with YAML-loaded plan configuration, align seed generators, and bring gate scores above 0.

**Architecture:** The reconciler loads `plan-config.yaml` at startup into an in-memory `PlanConfig` struct. `RecomputeFromStoredInputs` looks up tier parameters via `PlanConfig.LookupTier()` instead of the hardcoded `planRegistry` map. Source loaders normalize plan codes to canonical tier IDs. Seed generators are updated to use the same formula as the reconciler.

**Tech Stack:** Go 1.22, `gopkg.in/yaml.v3` (already in go.mod), `math/big` for exact arithmetic, Python 3 for seed generators.

**Governing documents:**
- `docs/architecture/UNIVERSAL_PLAN_TIER_MODEL.md` — entity model
- `docs/plans/2026-03-22-plan-config-reconciler-design.md` — detailed design
- `domains/pension/plan-config.yaml` — plan parameters (source of truth)

---

## Task 1: Extend plan-config.yaml with reconciler-relevant fields

The existing YAML has tier IDs as integers and uses `benefit_multipliers` as a flat map.
The reconciler needs string tier IDs (`TIER_1`, `TIER_2`, `TIER_3`) and benefit_floor.
We extend the file without breaking the intelligence service's existing consumption.

**Files:**
- Modify: `domains/pension/plan-config.yaml`

**Step 1: Add reconciler section to plan-config.yaml**

Add a `reconciler` section at the bottom of the existing file. This keeps backward
compatibility — the intelligence service ignores keys it doesn't know.

```yaml
# --- Reconciler Configuration ---
# Used by migration reconciler to recompute benefits for data verification.
# Conforms to UNIVERSAL_PLAN_TIER_MODEL.md entity hierarchy.

reconciler:
  system:
    name: "Colorado PERA"
    short_name: "PERA"
    normal_retirement_age: 65

  plans:
    - id: "state_division"
      name: "State Division Trust"
      benefit_floor: 800.00

      tiers:
        - id: "TIER_1"
          name: "Tier 1"
          status: "active"
          cloned_from: null
          formula:
            type: "flat_multiplier"
            multiplier: 0.020
          fas:
            method: "highest_consecutive"
            window_months: 36
          reduction:
            method: "lookup_table"
            table:
              55: 0.70
              56: 0.73
              57: 0.76
              58: 0.79
              59: 0.82
              60: 0.85
              61: 0.88
              62: 0.91
              63: 0.94
              64: 0.97
              65: 1.00

        - id: "TIER_2"
          name: "Tier 2"
          status: "active"
          cloned_from: "TIER_1"
          formula:
            type: "flat_multiplier"
            multiplier: 0.015
          fas:
            method: "highest_consecutive"
            window_months: 36
          reduction:
            method: "lookup_table"
            table:
              55: 0.70
              56: 0.73
              57: 0.76
              58: 0.79
              59: 0.82
              60: 0.85
              61: 0.88
              62: 0.91
              63: 0.94
              64: 0.97
              65: 1.00

        - id: "TIER_3"
          name: "Tier 3"
          status: "active"
          cloned_from: "TIER_2"
          formula:
            type: "flat_multiplier"
            multiplier: 0.015
          fas:
            method: "highest_consecutive"
            window_months: 60
          reduction:
            method: "lookup_table"
            table:
              60: 0.70
              61: 0.76
              62: 0.82
              63: 0.88
              64: 0.94
              65: 1.00
```

**Step 2: Commit**

```bash
git add domains/pension/plan-config.yaml
git commit -m "[domains/pension] Extend plan-config.yaml with reconciler tier configuration"
```

---

## Task 2: Create planconfig.go — YAML loader and tier lookup

**Files:**
- Create: `platform/migration/reconciler/planconfig.go`
- Create: `platform/migration/reconciler/planconfig_test.go`

**Step 1: Write the failing test**

Create `platform/migration/reconciler/planconfig_test.go`:

```go
package reconciler

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadPlanConfig(t *testing.T) {
	path := filepath.Join("..", "..", "..", "domains", "pension", "plan-config.yaml")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Skip("plan-config.yaml not found at", path)
	}

	pc, err := LoadPlanConfig(path)
	if err != nil {
		t.Fatalf("LoadPlanConfig failed: %v", err)
	}

	if pc.System.Name != "Colorado PERA" {
		t.Errorf("system name = %q, want %q", pc.System.Name, "Colorado PERA")
	}

	if pc.System.NormalRetirementAge != 65 {
		t.Errorf("normal_retirement_age = %d, want 65", pc.System.NormalRetirementAge)
	}
}

func TestLookupTier(t *testing.T) {
	path := filepath.Join("..", "..", "..", "domains", "pension", "plan-config.yaml")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Skip("plan-config.yaml not found at", path)
	}

	pc, err := LoadPlanConfig(path)
	if err != nil {
		t.Fatalf("LoadPlanConfig failed: %v", err)
	}

	tests := []struct {
		tierID     string
		wantFound  bool
		wantFloor  string
		wantMethod string
	}{
		{"TIER_1", true, "800.00", "lookup_table"},
		{"TIER_2", true, "800.00", "lookup_table"},
		{"TIER_3", true, "800.00", "lookup_table"},
		{"UNKNOWN", false, "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.tierID, func(t *testing.T) {
			tier, found := pc.LookupTier(tt.tierID)
			if found != tt.wantFound {
				t.Fatalf("LookupTier(%q) found = %v, want %v", tt.tierID, found, tt.wantFound)
			}
			if !found {
				return
			}
			if tier.Reduction == nil {
				t.Fatal("reduction is nil")
			}
			if tier.Reduction.Method != tt.wantMethod {
				t.Errorf("reduction method = %q, want %q", tier.Reduction.Method, tt.wantMethod)
			}
		})
	}
}

func TestTierToBenefitParams(t *testing.T) {
	path := filepath.Join("..", "..", "..", "domains", "pension", "plan-config.yaml")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Skip("plan-config.yaml not found at", path)
	}

	pc, err := LoadPlanConfig(path)
	if err != nil {
		t.Fatalf("LoadPlanConfig failed: %v", err)
	}

	tests := []struct {
		tierID         string
		wantMultiplier string // as decimal string
	}{
		{"TIER_1", "1/50"},  // 0.020
		{"TIER_2", "3/200"}, // 0.015
		{"TIER_3", "3/200"}, // 0.015
	}

	for _, tt := range tests {
		t.Run(tt.tierID, func(t *testing.T) {
			tier, _ := pc.LookupTier(tt.tierID)
			params, err := tier.ToBenefitParams(pc.System.NormalRetirementAge)
			if err != nil {
				t.Fatalf("ToBenefitParams failed: %v", err)
			}
			if params.Multiplier.RatString() != tt.wantMultiplier {
				t.Errorf("multiplier = %s, want %s", params.Multiplier.RatString(), tt.wantMultiplier)
			}
		})
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd platform/migration && go test ./reconciler/ -run TestLoadPlanConfig -v`
Expected: FAIL — `LoadPlanConfig` not defined

**Step 3: Write planconfig.go implementation**

Create `platform/migration/reconciler/planconfig.go`:

```go
package reconciler

import (
	"fmt"
	"math/big"
	"os"

	"gopkg.in/yaml.v3"
)

// PlanConfig represents the reconciler-relevant plan configuration
// loaded from plan-config.yaml.
type PlanConfig struct {
	System  SystemDef `yaml:"system"`
	Plans   []PlanDef `yaml:"plans"`
	tierMap map[string]*TierDef // built at load time for O(1) lookup
}

// SystemDef holds system-level configuration.
type SystemDef struct {
	Name                string `yaml:"name"`
	ShortName           string `yaml:"short_name"`
	NormalRetirementAge int    `yaml:"normal_retirement_age"`
}

// PlanDef holds plan-level configuration.
type PlanDef struct {
	ID           string    `yaml:"id"`
	Name         string    `yaml:"name"`
	BenefitFloor *float64  `yaml:"benefit_floor"`
	Tiers        []TierDef `yaml:"tiers"`
}

// TierDef holds tier-level configuration — the fundamental rule unit.
type TierDef struct {
	ID         string          `yaml:"id"`
	Name       string          `yaml:"name"`
	Status     string          `yaml:"status"`
	ClonedFrom *string         `yaml:"cloned_from"`
	Formula    FormulaStrategy `yaml:"formula"`
	FAS        FASStrategy     `yaml:"fas"`
	Reduction  *ReductionDef   `yaml:"reduction"`

	// Parent reference (set at load time, not from YAML)
	plan *PlanDef
}

// FormulaStrategy defines the benefit calculation formula type and parameters.
type FormulaStrategy struct {
	Type       string   `yaml:"type"`       // flat_multiplier | age_curve | step_by_service
	Multiplier *float64 `yaml:"multiplier"` // for flat_multiplier
}

// FASStrategy defines the salary averaging method.
type FASStrategy struct {
	Method       string `yaml:"method"` // highest_consecutive | highest_periods
	WindowMonths int    `yaml:"window_months"`
}

// ReductionDef defines the early retirement reduction schedule.
type ReductionDef struct {
	Method string             `yaml:"method"` // lookup_table | per_year_rate
	Table  map[int]float64    `yaml:"table"`  // age → reduction factor
}

// yamlRoot is the top-level YAML structure. The reconciler config is
// nested under the "reconciler" key to coexist with the intelligence
// service's existing consumption of the same file.
type yamlRoot struct {
	Reconciler struct {
		System SystemDef `yaml:"system"`
		Plans  []PlanDef `yaml:"plans"`
	} `yaml:"reconciler"`
}

// LoadPlanConfig reads plan-config.yaml and builds the tier lookup map.
func LoadPlanConfig(path string) (*PlanConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("planconfig: read %s: %w", path, err)
	}

	var root yamlRoot
	if err := yaml.Unmarshal(data, &root); err != nil {
		return nil, fmt.Errorf("planconfig: parse %s: %w", path, err)
	}

	pc := &PlanConfig{
		System:  root.Reconciler.System,
		Plans:   root.Reconciler.Plans,
		tierMap: make(map[string]*TierDef),
	}

	// Build tier lookup map and set parent references.
	for i := range pc.Plans {
		plan := &pc.Plans[i]
		for j := range plan.Tiers {
			tier := &plan.Tiers[j]
			tier.plan = plan
			pc.tierMap[tier.ID] = tier
		}
	}

	if len(pc.tierMap) == 0 {
		return nil, fmt.Errorf("planconfig: no tiers found in %s", path)
	}

	return pc, nil
}

// LookupTier returns the tier definition for a canonical tier ID.
func (pc *PlanConfig) LookupTier(tierID string) (*TierDef, bool) {
	tier, ok := pc.tierMap[tierID]
	return tier, ok
}

// BenefitParams holds the exact-arithmetic parameters needed by
// CalcRetirementBenefit. Replaces the old PlanParams struct.
type BenefitParams struct {
	FormulaType         string
	Multiplier          *big.Rat
	ReductionMethod     string
	ReductionTable      map[int]*big.Rat // age → factor
	NormalRetirementAge int
	BenefitFloor        *big.Rat
}

// ToBenefitParams converts a TierDef to exact-arithmetic BenefitParams.
func (t *TierDef) ToBenefitParams(normalRetirementAge int) (*BenefitParams, error) {
	bp := &BenefitParams{
		FormulaType:         t.Formula.Type,
		NormalRetirementAge: normalRetirementAge,
	}

	// Multiplier
	if t.Formula.Type == "flat_multiplier" {
		if t.Formula.Multiplier == nil {
			return nil, fmt.Errorf("planconfig: tier %s: flat_multiplier requires multiplier", t.ID)
		}
		bp.Multiplier = new(big.Rat).SetFloat64(*t.Formula.Multiplier)
	}

	// Benefit floor from parent plan
	if t.plan != nil && t.plan.BenefitFloor != nil {
		bp.BenefitFloor = new(big.Rat).SetFloat64(*t.plan.BenefitFloor)
	} else {
		bp.BenefitFloor = new(big.Rat) // zero
	}

	// Reduction schedule
	if t.Reduction != nil {
		bp.ReductionMethod = t.Reduction.Method
		if t.Reduction.Method == "lookup_table" && t.Reduction.Table != nil {
			bp.ReductionTable = make(map[int]*big.Rat, len(t.Reduction.Table))
			for age, factor := range t.Reduction.Table {
				bp.ReductionTable[age] = new(big.Rat).SetFloat64(factor)
			}
		}
	}

	return bp, nil
}
```

**Step 4: Run tests to verify they pass**

Run: `cd platform/migration && go test ./reconciler/ -run "TestLoadPlanConfig|TestLookupTier|TestTierToBenefitParams" -v`
Expected: 3 PASS

**Step 5: Commit**

```bash
git add platform/migration/reconciler/planconfig.go platform/migration/reconciler/planconfig_test.go
git commit -m "[platform/migration] Add planconfig.go: YAML loader and tier lookup"
```

---

## Task 3: Refactor formula.go — use BenefitParams with reduction table lookup

The existing `CalcRetirementBenefit` uses the old `PlanParams` with formula-based penalty.
We refactor to accept `BenefitParams` with lookup-table reduction. The old `PlanParams`
and `planRegistry` are removed.

**Files:**
- Modify: `platform/migration/reconciler/formula.go`
- Modify: `platform/migration/reconciler/formula_test.go`
- Modify: `platform/migration/reconciler/testdata/reconciliation_fixtures.yaml`

**Step 1: Update test fixtures for correct multipliers**

The existing fixtures use the hardcoded multipliers (0.20 for DB_MAIN = gross of 2291.67).
With the correct multiplier (0.020), gross = 25 × 0.020 × 5500 / 12 = 229.17.

Replace `platform/migration/reconciler/testdata/reconciliation_fixtures.yaml`:

```yaml
test_cases:
  - name: tier1_normal_retirement_65
    inputs:
      yos: "25.0000"
      fas: "5500.00"
      age_at_retirement: 65
      plan_code: "TIER_1"
    expected:
      gross_monthly: "229.17"
      reduction_factor: "1.00"
      final_monthly: "800.00"  # benefit floor applies

  - name: tier1_early_retirement_60
    inputs:
      yos: "30.0000"
      fas: "8000.00"
      age_at_retirement: 60
      plan_code: "TIER_1"
    expected:
      gross_monthly: "400.00"  # 30 * 0.020 * 8000 / 12
      reduction_factor: "0.85"
      final_monthly: "800.00"  # floor: 400 * 0.85 = 340, below floor

  - name: tier1_high_earner_normal
    inputs:
      yos: "30.0000"
      fas: "25000.00"
      age_at_retirement: 65
      plan_code: "TIER_1"
    expected:
      gross_monthly: "1250.00"  # 30 * 0.020 * 25000 / 12
      reduction_factor: "1.00"
      final_monthly: "1250.00"

  - name: tier1_high_earner_early_58
    inputs:
      yos: "30.0000"
      fas: "25000.00"
      age_at_retirement: 58
      plan_code: "TIER_1"
    expected:
      gross_monthly: "1250.00"
      reduction_factor: "0.79"  # lookup table at age 58
      final_monthly: "987.50"   # 1250 * 0.79

  - name: tier2_normal_retirement
    inputs:
      yos: "25.0000"
      fas: "5500.00"
      age_at_retirement: 65
      plan_code: "TIER_2"
    expected:
      gross_monthly: "171.88"  # 25 * 0.015 * 5500 / 12
      reduction_factor: "1.00"
      final_monthly: "800.00"  # floor

  - name: tier3_early_retirement_62
    inputs:
      yos: "28.0000"
      fas: "20000.00"
      age_at_retirement: 62
      plan_code: "TIER_3"
    expected:
      gross_monthly: "700.00"  # 28 * 0.015 * 20000 / 12
      reduction_factor: "0.82" # tier 3 table at age 62
      final_monthly: "800.00"  # 700 * 0.82 = 574, below floor

  - name: tier3_high_earner_63
    inputs:
      yos: "30.0000"
      fas: "30000.00"
      age_at_retirement: 63
      plan_code: "TIER_3"
    expected:
      gross_monthly: "1125.00"  # 30 * 0.015 * 30000 / 12
      reduction_factor: "0.88"  # tier 3 table at age 63
      final_monthly: "990.00"   # 1125 * 0.88

  - name: unknown_plan_code
    inputs:
      yos: "25.0000"
      fas: "5500.00"
      age_at_retirement: 65
      plan_code: "UNKNOWN"
    expected:
      error: true
```

**Step 2: Refactor formula.go**

Replace the old `PlanParams`, `planRegistry`, and `CalcRetirementBenefit` with
`BenefitParams`-based versions. Keep all rounding/formatting functions unchanged.

The key changes:
1. Remove `PlanParams` struct and `planRegistry` map
2. Update `CalcRetirementBenefit` to accept `BenefitParams`
3. Use lookup-table reduction instead of formula-based penalty
4. Update `RecomputeFromStoredInputs` to accept `*PlanConfig`

```go
// In formula.go — replace the CalcRetirementBenefit function signature and body:

// CalcRetirementBenefit computes a defined-benefit pension using exact
// rational arithmetic with configurable plan parameters.
//
// Formula:
//   gross_monthly    = yos * multiplier * fas / 12
//   reduction_factor = reductionTable[age] (lookup) or 1.0 if age >= normal_retirement_age
//   after_reduction  = gross_monthly * reduction_factor
//   final_monthly    = max(after_reduction, benefit_floor)
func CalcRetirementBenefit(yos, fas *big.Rat, ageAtRetirement int, params BenefitParams) BenefitCalcResult {
	// Step 1: gross_monthly = yos * multiplier * fas / 12
	gross := new(big.Rat).Mul(yos, params.Multiplier)
	gross.Mul(gross, fas)
	gross.Quo(gross, twelve)

	// Step 2: reduction factor from lookup table
	reductionFactor := new(big.Rat).SetInt64(1) // default: no reduction
	if params.ReductionMethod == "lookup_table" && params.ReductionTable != nil {
		if factor, ok := params.ReductionTable[ageAtRetirement]; ok {
			reductionFactor.Set(factor)
		} else if ageAtRetirement < params.NormalRetirementAge {
			// Age not in table but below NRA — find the closest lower entry
			// For safety, use 0 (full reduction) if no entry found
			reductionFactor.SetInt64(0)
			for age, factor := range params.ReductionTable {
				if age <= ageAtRetirement {
					if factor.Cmp(reductionFactor) > 0 {
						reductionFactor.Set(factor)
					}
				}
			}
		}
	}

	// Step 3: after_reduction = gross * reduction_factor
	afterReduction := new(big.Rat).Mul(gross, reductionFactor)

	// Step 4: final_monthly = max(after_reduction, benefit_floor)
	finalMonthly := new(big.Rat).Set(afterReduction)
	if params.BenefitFloor != nil && finalMonthly.Cmp(params.BenefitFloor) < 0 {
		finalMonthly.Set(params.BenefitFloor)
	}

	grossRounded := roundHalfUpRat(gross)
	finalRounded := roundHalfUpRat(finalMonthly)

	return BenefitCalcResult{
		GrossMonthly:    grossRounded,
		ReductionFactor: new(big.Rat).Set(reductionFactor),
		FinalMonthly:    finalRounded,
	}
}

// RecomputeFromStoredInputs looks up tier parameters from the PlanConfig
// and recomputes the final monthly benefit from stored calculation inputs.
// Returns nil if the tierCode is unknown.
func RecomputeFromStoredInputs(yosUsed, fasUsed *big.Rat, ageAtCalc int, tierCode string, planConfig *PlanConfig) *big.Rat {
	tier, ok := planConfig.LookupTier(tierCode)
	if !ok {
		return nil
	}
	params, err := tier.ToBenefitParams(planConfig.System.NormalRetirementAge)
	if err != nil {
		return nil
	}
	result := CalcRetirementBenefit(yosUsed, fasUsed, ageAtCalc, *params)
	return result.FinalMonthly
}
```

Also update `BenefitCalcResult`:

```go
type BenefitCalcResult struct {
	GrossMonthly    *big.Rat
	ReductionFactor *big.Rat // was PenaltyPct
	FinalMonthly    *big.Rat
}
```

**Step 3: Update formula_test.go**

Update tests to load `PlanConfig` from YAML and use the new fixture format. The
fixture-based test loads the YAML, looks up the tier, and calls `CalcRetirementBenefit`.

Key change: `TestRecomputeFromStoredInputs` now passes `*PlanConfig` instead of
relying on `planRegistry`.

**Step 4: Run tests**

Run: `cd platform/migration && go test ./reconciler/ -v -count=1`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add platform/migration/reconciler/formula.go platform/migration/reconciler/formula_test.go platform/migration/reconciler/testdata/reconciliation_fixtures.yaml
git commit -m "[platform/migration] Refactor formula.go: BenefitParams with lookup-table reduction"
```

---

## Task 4: Update tier1.go to accept PlanConfig

**Files:**
- Modify: `platform/migration/reconciler/tier1.go`

**Step 1: Update ReconcileTier1 signature**

Change `ReconcileTier1` to accept `*PlanConfig`:

```go
func ReconcileTier1(db *sql.DB, batchID string, planConfig *PlanConfig) ([]ReconciliationResult, error) {
```

Update `reconcileTier1Row` to use `RecomputeFromStoredInputs` with `planConfig`:

```go
recomputed := RecomputeFromStoredInputs(yos, fas, r.AgeAtCalc, r.PlanCode, planConfig)
```

**Step 2: Run tests**

Run: `cd platform/migration && go test ./reconciler/ -v -count=1`
Expected: ALL PASS (tier1_test.go uses sqlmock — update mock expectations if needed)

**Step 3: Commit**

```bash
git add platform/migration/reconciler/tier1.go
git commit -m "[platform/migration] Update tier1.go to accept PlanConfig"
```

---

## Task 5: Wire PlanConfig into reconciliation handler and main.go

**Files:**
- Modify: `platform/migration/api/reconciliation_handlers.go`
- Modify: `platform/migration/api/handler.go` (add PlanConfig field to Handler)
- Modify: `platform/migration/main.go`

**Step 1: Add PlanConfig to Handler struct**

In the Handler struct (wherever it's defined), add:

```go
PlanConfig *reconciler.PlanConfig
```

**Step 2: Update ReconcileBatch to pass PlanConfig**

Change the `ReconcileTier1` call from:

```go
tier1Results, err := reconciler.ReconcileTier1(h.DB, batchID)
```

to:

```go
tier1Results, err := reconciler.ReconcileTier1(h.DB, batchID, h.PlanConfig)
```

**Step 3: Load PlanConfig at startup in main.go**

Add after database connection:

```go
planConfigPath := os.Getenv("PLAN_CONFIG_PATH")
if planConfigPath == "" {
    planConfigPath = "../../../domains/pension/plan-config.yaml"
}
planConfig, err := reconciler.LoadPlanConfig(planConfigPath)
if err != nil {
    slog.Error("failed to load plan config", "error", err, "path", planConfigPath)
    os.Exit(1)
}
slog.Info("plan config loaded", "system", planConfig.System.Name, "tiers", len(planConfig.Plans[0].Tiers))
```

And wire it to the handler:

```go
handler := api.NewHandler(database)
handler.PlanConfig = planConfig
```

**Step 4: Run tests**

Run: `cd platform/migration && go build ./... && go test ./... -short -count=1`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add platform/migration/main.go platform/migration/api/reconciliation_handlers.go platform/migration/api/*.go
git commit -m "[platform/migration] Wire PlanConfig into handler and main.go"
```

---

## Task 6: Migration 038 — add source_plan_code column

**Files:**
- Create: `platform/migration/db/migrations/038_source_plan_code.sql`

**Step 1: Write migration**

```sql
-- Migration 038: Add source_plan_code to stored_calculations
-- Preserves the original legacy plan code for UI display while
-- plan_code holds the canonical tier ID used by the reconciler.

ALTER TABLE migration.stored_calculations
  ADD COLUMN IF NOT EXISTS source_plan_code TEXT;

COMMENT ON COLUMN migration.stored_calculations.source_plan_code IS
  'Original plan code from the legacy source system (e.g., DB-T1, DB_MAIN). '
  'Displayed in UI so clients see their own terminology. '
  'The plan_code column holds the canonical tier ID (e.g., TIER_1) used by the reconciler.';
```

**Step 2: Commit**

```bash
git add platform/migration/db/migrations/038_source_plan_code.sql
git commit -m "[platform/migration] Migration 038: add source_plan_code column"
```

---

## Task 7: Update source_loader.go — plan code normalization

**Files:**
- Modify: `platform/migration/batch/source_loader.go`

**Step 1: Add plan code mapping tables**

Add at the top of source_loader.go:

```go
// prismPlanCodeMap normalizes PRISM plan codes to canonical tier IDs.
var prismPlanCodeMap = map[string]string{
	"DB_MAIN": "TIER_1",
	"DB_T1":   "TIER_1",
	"DB_T2":   "TIER_2",
	"DB_T3":   "TIER_3",
}

// pasPlanCodeMap normalizes PAS plan codes to canonical tier IDs.
var pasPlanCodeMap = map[string]string{
	"DB-T1": "TIER_1",
	"DB-T2": "TIER_2",
	"DB-T3": "TIER_3",
}

// normalizePlanCode maps a source plan code to the canonical tier ID.
// Returns the canonical code and the original source code.
func normalizePlanCode(sourceCode string, codeMap map[string]string) (canonical, original string) {
	canonical, ok := codeMap[sourceCode]
	if !ok {
		return sourceCode, sourceCode // pass through if unknown
	}
	return canonical, sourceCode
}
```

**Step 2: Update insertStoredCalculations to include source_plan_code**

Add `source_plan_code` to the INSERT statement and function signature.

**Step 3: Update loadPRISMCalculations and loadPASCalculations**

In each loader, after reading `plan_code` from the source query, call `normalizePlanCode`
and pass both canonical and original to `insertStoredCalculations`.

**Step 4: Run tests**

Run: `cd platform/migration && go test ./batch/ -v -count=1`
Expected: ALL PASS (update sqlmock expectations for new column)

**Step 5: Commit**

```bash
git add platform/migration/batch/source_loader.go
git commit -m "[platform/migration] Source loader: normalize plan codes to canonical tier IDs"
```

---

## Task 8: Align PRISM seed generator

**Files:**
- Modify: `migration-simulation/sources/prism/prism_data_generator.py`

**Step 1: Fix the benefit formula**

At approximately line 318, change:

```python
# OLD:
mult = 0.018 if m["tier"] == "T2" else 0.020
# ...
penalty = min(max((65.0 - age_at_ret) * 0.06, 0.0), 0.30) if age_at_ret < 65 else 0.0
benefit = max(min(gross * (1 - penalty), fas / 12.0 * 0.75), 800.0)
```

To:

```python
# NEW — matches reconciler formula exactly
# Multiplier: 2.0% T1, 1.5% T2/T3 (from plan-config.yaml)
mult = 0.015 if m["tier"] in ("T2", "T3") else 0.020
fas_period = 60 if m["hire_dt"] < datetime.date(2003, 1, 1) else 36
fas = m["base_sal"] * (1.025 ** actual_yos) * random.uniform(1.05, 1.20)
gross = mult * actual_yos * fas / 12.0

# Reduction factor from lookup table (matching plan-config.yaml)
REDUCTION_T12 = {55:0.70, 56:0.73, 57:0.76, 58:0.79, 59:0.82,
                 60:0.85, 61:0.88, 62:0.91, 63:0.94, 64:0.97, 65:1.00}
REDUCTION_T3 = {60:0.70, 61:0.76, 62:0.82, 63:0.88, 64:0.94, 65:1.00}
red_table = REDUCTION_T3 if m["tier"] == "T3" else REDUCTION_T12
age_int = int(age_at_ret)
reduction = red_table.get(age_int, 1.0 if age_int >= 65 else 0.0)
benefit = max(gross * reduction, 800.0)
```

**Step 2: Regenerate PRISM seed SQL**

Run: `cd migration-simulation/sources/prism && python3 prism_data_generator.py > init/02_seed.sql`

**Step 3: Commit**

```bash
git add migration-simulation/sources/prism/prism_data_generator.py
git commit -m "[migration-simulation] Align PRISM generator with reconciler formula"
```

---

## Task 9: Align PAS seed generator

**Files:**
- Modify: `migration-simulation/sources/pas/generate_pas_scenarios.py`

**Step 1: Fix the benefit formula**

At approximately line 774, change:

```python
# OLD:
multiplier = 0.02
benefit = round(final_avg_salary * total_service * multiplier / 12, 2)
```

To:

```python
# NEW — matches reconciler formula exactly
# Tier-specific multiplier (from plan-config.yaml)
multiplier = 0.015 if tier in ("TIER2", "TIER3") else 0.020
gross = final_avg_salary * total_service * multiplier / 12.0

# Reduction factor from lookup table
REDUCTION_T12 = {55:0.70, 56:0.73, 57:0.76, 58:0.79, 59:0.82,
                 60:0.85, 61:0.88, 62:0.91, 63:0.94, 64:0.97, 65:1.00}
REDUCTION_T3 = {60:0.70, 61:0.76, 62:0.82, 63:0.88, 64:0.94, 65:1.00}
red_table = REDUCTION_T3 if tier == "TIER3" else REDUCTION_T12

age_at_ret = (retirement_date - dob).days / 365.25
age_int = int(age_at_ret)
reduction = red_table.get(age_int, 1.0 if age_int >= 65 else 0.0)
benefit = max(round(gross * reduction, 2), 800.0)
```

**Step 2: Fix plan code format**

At approximately line 463, change:

```python
# OLD:
plan_code = {"TIER1": "DB-T1", "TIER2": "DB-T2", "TIER3": "DB-T3"}[tier]
```

No change needed here — the source loader normalizes these to canonical tier IDs.
The PAS generator should keep its source-system-native codes.

**Step 3: Regenerate PAS seed SQL**

Run: `cd migration-simulation/sources/pas && python3 generate_pas_scenarios.py`

**Step 4: Commit**

```bash
git add migration-simulation/sources/pas/generate_pas_scenarios.py
git commit -m "[migration-simulation] Align PAS generator with reconciler formula"
```

---

## Task 10: Wire Tier 3 benchmarks from canonical data

**Files:**
- Modify: `platform/migration/api/reconciliation_handlers.go`

**Step 1: Add benchmark computation**

Add a function that queries canonical tables to build `PlanBenchmarks`:

```go
func computeBenchmarks(db *sql.DB, batchID string) reconciler.PlanBenchmarks {
	benchmarks := reconciler.PlanBenchmarks{}

	// Average salary by year
	rows, err := db.Query(`
		SELECT EXTRACT(YEAR FROM period_start)::INT AS yr, AVG(amount::NUMERIC)
		FROM migration.canonical_salaries
		WHERE batch_id = $1
		GROUP BY yr`, batchID)
	if err == nil {
		defer rows.Close()
		benchmarks.AvgSalaryByYear = make(map[int]float64)
		for rows.Next() {
			var yr int
			var avg float64
			if rows.Scan(&yr, &avg) == nil {
				benchmarks.AvgSalaryByYear[yr] = avg
			}
		}
	}

	// Total contributions
	var total float64
	err = db.QueryRow(`
		SELECT COALESCE(SUM(amount::NUMERIC), 0)
		FROM migration.canonical_contributions
		WHERE batch_id = $1`, batchID).Scan(&total)
	if err == nil {
		benchmarks.TotalContributions = total
	}

	// Member count by status
	rows2, err := db.Query(`
		SELECT member_status, COUNT(*)
		FROM migration.canonical_members
		WHERE batch_id = $1
		GROUP BY member_status`, batchID)
	if err == nil {
		defer rows2.Close()
		benchmarks.MemberCountByStatus = make(map[string]int)
		for rows2.Next() {
			var status string
			var count int
			if rows2.Scan(&status, &count) == nil {
				benchmarks.MemberCountByStatus[status] = count
			}
		}
	}

	return benchmarks
}
```

**Step 2: Replace empty benchmarks in ReconcileBatch**

Change:

```go
tier3Results, err := reconciler.ReconcileTier3(h.DB, batchID, reconciler.PlanBenchmarks{})
```

To:

```go
benchmarks := computeBenchmarks(h.DB, batchID)
tier3Results, err := reconciler.ReconcileTier3(h.DB, batchID, benchmarks)
```

**Step 3: Run tests**

Run: `cd platform/migration && go test ./api/ -v -count=1`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add platform/migration/api/reconciliation_handlers.go
git commit -m "[platform/migration] Wire Tier 3 benchmarks from canonical data"
```

---

## Task 11: Update proof script with gate score assertions

**Files:**
- Modify: `scripts/run_two_source_proof.sh`

**Step 1: Add gate score threshold assertion**

After the existing gate score extraction, add:

```bash
# Assert gate score is above minimum threshold
if [ "$PRISM_GATE" != "N/A" ] && [ "$PRISM_GATE" != "null" ] && [ "$PRISM_GATE" != "" ]; then
    ABOVE=$(echo "$PRISM_GATE > 0.50" | bc -l 2>/dev/null || echo "0")
    if [ "$ABOVE" = "1" ]; then
        pass "PRISM gate score $PRISM_GATE > 0.50"
    else
        fail "PRISM gate score $PRISM_GATE below 0.50 threshold"
    fi
fi
```

Add the same for PAS.

**Step 2: Commit**

```bash
git add scripts/run_two_source_proof.sh
git commit -m "[scripts] Add gate score threshold assertions to proof script"
```

---

## Task 12: Docker integration — mount plan-config.yaml and regenerated seeds

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Add plan-config.yaml volume mount for migration service**

```yaml
migration:
  volumes:
    - ./domains/pension/plan-config.yaml:/app/plan-config.yaml:ro
  environment:
    - PLAN_CONFIG_PATH=/app/plan-config.yaml
```

**Step 2: Add migration 038 volume mount**

```yaml
volumes:
  - ./platform/migration/db/migrations/038_source_plan_code.sql:/docker-entrypoint-initdb.d/038_source_plan_code.sql:ro
```

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "[infrastructure] Mount plan-config.yaml and migration 038 for Docker"
```

---

## Task 13: Full verification — Two-Source Proof

**Step 1: Run unit tests**

```bash
cd platform/migration && go test ./... -short -count=1 -v
```

Expected: ALL PASS across 12 packages

**Step 2: Rebuild Docker containers**

```bash
docker compose down && docker compose up --build -d
```

**Step 3: Run Two-Source Proof**

```bash
bash scripts/run_two_source_proof.sh
```

Expected:
- All existing checks pass (28/28 minimum)
- Gate scores > 0 for both PRISM and PAS
- Target: gate_passed = true (weighted_score >= 0.95)

**Step 4: If gate scores are still not passing, debug**

Check reconciliation detail endpoint for specific member variances.
Common issues:
- Rounding differences between Python `round()` and Go `roundHalfUpRat()`
- Age computation (days/365.25 vs integer age)
- Members below the reduction table minimum age (need fallback handling)

**Step 5: Final commit**

```bash
git add -A
git commit -m "[platform/migration] Gate score tuning: plan config + formula alignment complete"
```

---

## Summary

| Task | What | Files | Risk |
|------|------|-------|------|
| 1 | Extend plan-config.yaml | 1 | Low |
| 2 | planconfig.go + tests | 2 new | Low |
| 3 | Refactor formula.go | 3 modified | Medium — fixture values change |
| 4 | Update tier1.go signature | 1 | Low |
| 5 | Wire into handler + main.go | 3 | Low |
| 6 | Migration 038 | 1 new | Low |
| 7 | Source loader normalization | 1 | Low |
| 8 | PRISM generator alignment | 1 | Medium — regenerate seeds |
| 9 | PAS generator alignment | 1 | Medium — regenerate seeds |
| 10 | Tier 3 benchmarks | 1 | Low |
| 11 | Proof script assertions | 1 | Low |
| 12 | Docker integration | 1 | Low |
| 13 | Full verification | 0 | — |
