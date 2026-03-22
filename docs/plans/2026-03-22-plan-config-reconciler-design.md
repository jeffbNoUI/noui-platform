# Design: Configurable Plan Parameters for Migration Reconciliation

**Created:** 2026-03-22
**Conforms to:** `docs/architecture/UNIVERSAL_PLAN_TIER_MODEL.md` (Tier 1 Governing Document)
**Scope:** Migration reconciler plan configuration — loading, lookup, and benefit recomputation
**Sprint context:** Fixes gate score = 0 in Two-Source Proof by replacing hardcoded plan registry

---

## Problem

The migration reconciler has a hardcoded 2-plan registry (`formula.go:planRegistry`) that is
disconnected from the canonical plan configuration. This causes:

1. Only 2 of 3 tiers supported (no TIER_3)
2. Multiplier values wrong (0.20 instead of 0.020 — 10x error)
3. Early retirement uses formula-based penalty instead of statutory lookup tables
4. Every new client deployment would require code changes to the reconciler
5. Gate scores = 0 for both PRISM and PAS sources (all members show MAJOR variance)

---

## Architecture

The reconciler loads plan configuration from `plan-config.yaml` at startup, conforming to the
Universal Plan/Tier Entity Model hierarchy: System > Plan > Tier > 7 Modules.

```
domains/{client}/
  plan-config.yaml                  # hierarchy + scalar params
  tables/                           # referenced CSV lookup tables
    tier1_reduction.csv
    tier3_reduction.csv

platform/migration/
  reconciler/
    planconfig.go                   # YAML parser + CSV loader → PlanConfig
    formula.go                      # CalcRetirementBenefit (adapted)
    tier1.go                        # segment-aware reconciliation
  main.go                           # loads PlanConfig at startup
```

### Data Flow

```
plan-config.yaml + tables/*.csv
        │
        ▼
   LoadPlanConfig()  ← startup, once
        │
        ▼
   PlanConfig (in-memory)
        │
        ▼
   LookupTier("TIER_1")  ← per member/segment
        │
        ▼
   TierParams { formula, reduction, fas, ... }
        │
        ▼
   CalcRetirementBenefit()  ← recompute
        │
        ▼
   Compare recomputed vs stored → ReconciliationResult
```

---

## Plan Config YAML Schema (Migration Reconciler Subset)

The full entity model defines 7 modules per tier. The migration reconciler uses a
**subset** — only the modules needed for benefit recomputation and reconciliation.
Other modules (COLA, Contribution, Assignment Rules) are relevant to the intelligence
service and will be consumed when that integration happens.

### Reconciler-relevant modules per tier:

| Module | Used by reconciler? | Purpose in reconciliation |
|--------|-------------------|--------------------------|
| Formula Strategy | Yes | Recompute gross monthly benefit |
| FAS/AMS/HAS Strategy | Metadata only | Validate FAS period matches stored calc |
| Reduction Schedule | Yes | Apply early retirement reduction |
| Eligibility Pathways | No (future) | Verify retirement eligibility |
| COLA Strategy | No | Post-retirement; not relevant to initial benefit |
| Contribution Strategy | No | Not part of benefit calculation |
| Assignment Rules | No | Tier already resolved in source data |

### YAML structure (reconciler-relevant fields):

```yaml
system:
  name: "Colorado PERA"
  short_name: "PERA"
  normal_retirement_age: 65          # system-wide default

plans:
  - id: "state_division"
    name: "State Division Trust"
    benefit_floor: 800.00             # optional minimum monthly benefit
    benefit_cap_pct: null             # e.g., 0.80 = 80% of FAS

    ss_integration:
      enabled: false
      # offset_table: "tables/ss_offset.csv"  # for SDCERA-style

    tiers:
      - id: "TIER_1"
        name: "Tier 1"
        status: "active"              # active | soft_frozen | hard_frozen
        cloned_from: null             # legislative lineage

        formula:
          type: "flat_multiplier"     # flat_multiplier | age_curve | step_by_service
          multiplier: 0.020           # 2.0% per year
          # age_curve_table: "tables/tier1_age_factors.csv"
          # steps: [{max_years: 20, rate: 0.0167}, {max_years: null, rate: 0.020}]

        fas:
          method: "highest_consecutive"
          window_months: 36
          anti_spiking_cap_pct: null
          compensation_cap: null

        reduction:
          method: "lookup_table"      # lookup_table | per_year_rate | null
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
          # table_file: "tables/tier1_reduction.csv"  # alternative for large tables
          # per_year_rate: 0.03
          # max_reduction: 0.30

        purchased_service:
          counts_toward_benefit: true
          counts_toward_eligibility: false
```

---

## Go Types

### PlanConfig (loaded from YAML)

```go
// PlanConfig represents the complete plan configuration loaded from YAML.
type PlanConfig struct {
    System  SystemDef `yaml:"system"`
    Plans   []PlanDef `yaml:"plans"`
    tierMap map[string]*TierDef  // built at load time for O(1) lookup
}

type SystemDef struct {
    Name                string `yaml:"name"`
    ShortName           string `yaml:"short_name"`
    NormalRetirementAge int    `yaml:"normal_retirement_age"`
}

type PlanDef struct {
    ID            string         `yaml:"id"`
    Name          string         `yaml:"name"`
    BenefitFloor  *float64       `yaml:"benefit_floor"`
    BenefitCapPct *float64       `yaml:"benefit_cap_pct"`
    SSIntegration *SSIntegration `yaml:"ss_integration"`
    Tiers         []TierDef      `yaml:"tiers"`
}

type TierDef struct {
    ID         string          `yaml:"id"`
    Name       string          `yaml:"name"`
    Status     string          `yaml:"status"`      // active | soft_frozen | hard_frozen
    ClonedFrom *string         `yaml:"cloned_from"`
    Formula    FormulaStrategy `yaml:"formula"`
    FAS        FASStrategy     `yaml:"fas"`
    Reduction  *ReductionDef   `yaml:"reduction"`
    Purchased  *PurchasedDef   `yaml:"purchased_service"`

    // Parent reference (set at load time)
    plan *PlanDef
}

// FormulaStrategy defines the benefit calculation formula.
// Only one of the type-specific fields is populated based on Type.
type FormulaStrategy struct {
    Type          string          `yaml:"type"`           // flat_multiplier | age_curve | step_by_service
    Multiplier    *float64        `yaml:"multiplier"`     // for flat_multiplier
    AgeCurveTable string          `yaml:"age_curve_table"` // CSV path for age_curve
    Steps         []StepDef       `yaml:"steps"`          // for step_by_service
}

type StepDef struct {
    MaxYears *int    `yaml:"max_years"` // null = unlimited
    Rate     float64 `yaml:"rate"`
}

type FASStrategy struct {
    Method            string   `yaml:"method"`  // highest_consecutive | highest_periods | career_average
    WindowMonths      int      `yaml:"window_months"`
    AntiSpikingCapPct *float64 `yaml:"anti_spiking_cap_pct"`
    CompensationCap   *float64 `yaml:"compensation_cap"`
}

type ReductionDef struct {
    Method       string             `yaml:"method"` // lookup_table | per_year_rate | null
    Table        map[int]float64    `yaml:"table"`
    TableFile    string             `yaml:"table_file"` // CSV alternative
    PerYearRate  *float64           `yaml:"per_year_rate"`
    MaxReduction *float64           `yaml:"max_reduction"`
}

type SSIntegration struct {
    Enabled     bool   `yaml:"enabled"`
    OffsetTable string `yaml:"offset_table"` // CSV path
}

type PurchasedDef struct {
    CountsTowardBenefit     bool `yaml:"counts_toward_benefit"`
    CountsTowardEligibility bool `yaml:"counts_toward_eligibility"`
}
```

### Key Methods

```go
// LoadPlanConfig reads plan-config.yaml and any referenced CSV tables.
// Builds the tierMap for O(1) lookup by tier ID.
func LoadPlanConfig(yamlPath string) (*PlanConfig, error)

// LookupTier returns the tier definition for a canonical tier ID.
func (pc *PlanConfig) LookupTier(tierID string) (*TierDef, bool)

// ToBenefitParams converts a TierDef to the parameters needed by
// CalcRetirementBenefit, using math/big.Rat for exact arithmetic.
func (t *TierDef) ToBenefitParams() (*BenefitParams, error)
```

### BenefitParams (replaces old PlanParams)

```go
type BenefitParams struct {
    FormulaType         string               // flat_multiplier | age_curve | step_by_service
    Multiplier          *big.Rat             // for flat_multiplier
    AgeCurveTable       map[float64]*big.Rat // for age_curve (age → factor)
    Steps               []StepParam          // for step_by_service
    ReductionMethod     string               // lookup_table | per_year_rate | none
    ReductionTable      map[int]*big.Rat     // age → factor (for lookup_table)
    ReductionPerYear    *big.Rat             // for per_year_rate
    MaxReduction        *big.Rat             // cap for per_year_rate
    NormalRetirementAge int
    BenefitFloor        *big.Rat
    BenefitCapPct       *big.Rat             // optional max % of FAS
}
```

---

## Changes to CalcRetirementBenefit

The formula function becomes dispatch-based on FormulaType:

```go
func CalcRetirementBenefit(yos, fas *big.Rat, ageAtRetirement int, params BenefitParams) BenefitCalcResult {
    // Step 1: Compute gross monthly benefit based on formula type
    var gross *big.Rat
    switch params.FormulaType {
    case "flat_multiplier":
        gross = flatMultiplierGross(yos, fas, params.Multiplier)
    case "age_curve":
        gross = ageCurveGross(yos, fas, ageAtRetirement, params.AgeCurveTable)
    case "step_by_service":
        gross = stepByServiceGross(yos, fas, params.Steps)
    default:
        // Unsupported formula type — return error result
    }

    // Step 2: Apply early retirement reduction
    reductionFactor := computeReduction(ageAtRetirement, params)
    afterReduction := new(big.Rat).Mul(gross, reductionFactor)

    // Step 3: Apply benefit floor
    finalMonthly := applyFloorAndCap(afterReduction, fas, params)

    return BenefitCalcResult{...}
}
```

**Implement now:** `flat_multiplier` + `lookup_table` reduction.
**Schema-ready but not implemented:** `age_curve`, `step_by_service`.

---

## Source Plan Code Normalization

### New column: stored_calculations.source_plan_code

```sql
ALTER TABLE migration.stored_calculations
  ADD COLUMN source_plan_code TEXT;
```

### Source loader normalization

Each source loader maps source-system plan codes to canonical tier IDs:

```go
// PRISM plan code mapping
var prismPlanCodeMap = map[string]string{
    "DB_MAIN": "TIER_1",
    "DB_T1":   "TIER_1",
    "DB_T2":   "TIER_2",
    "DB_T3":   "TIER_3",
}

// PAS plan code mapping
var pasPlanCodeMap = map[string]string{
    "DB-T1": "TIER_1",
    "DB-T2": "TIER_2",
    "DB-T3": "TIER_3",
}
```

The source loader:
1. Reads the source plan code from the legacy DB
2. Maps to canonical tier ID via the source-specific map
3. Stores both: `plan_code = "TIER_1"` (canonical) + `source_plan_code = "DB-T1"` (original)
4. If no mapping found, stores the original code and logs a warning

The UI displays `source_plan_code` so the client sees their own terminology.

---

## Seed Generator Alignment

Both generators updated to use the same formula as `CalcRetirementBenefit`:

### PRISM generator (`prism_data_generator.py`)

```python
# Before (wrong):
mult = 0.018 if m["tier"] == "T2" else 0.020
benefit = max(min(gross * (1 - penalty), fas / 12.0 * 0.75), 800.0)

# After (matches reconciler):
mult = 0.015 if m["tier"] in ("T2", "T3") else 0.020
gross = mult * actual_yos * fas / 12.0
reduction = reduction_table.get(int(age_at_ret), 1.0)  # lookup table
benefit = max(gross * reduction, 800.0)  # no FAS cap
```

### PAS generator (`generate_pas_scenarios.py`)

```python
# Before (wrong):
multiplier = 0.02  # same for all tiers
benefit = round(final_avg_salary * total_service * multiplier / 12, 2)
# No penalty, no floor

# After (matches reconciler):
multiplier = 0.015 if tier in ("TIER2", "TIER3") else 0.020
gross = final_avg_salary * total_service * multiplier / 12.0
reduction = reduction_table[tier].get(int(age), 1.0)
benefit = max(round(gross * reduction, 2), 800.0)
```

### Reduction tables in generators (matching plan-config.yaml):

```python
reduction_tables = {
    "tiers_1_2": {55:0.70, 56:0.73, 57:0.76, 58:0.79, 59:0.82,
                  60:0.85, 61:0.88, 62:0.91, 63:0.94, 64:0.97, 65:1.00},
    "tier_3":    {60:0.70, 61:0.76, 62:0.82, 63:0.88, 64:0.94, 65:1.00},
}
```

---

## Tier 3 Benchmarks

Tier 3 (aggregate) benchmarks computed from canonical data after batch load:

```go
func ComputeBenchmarks(db *sql.DB, batchID string) (PlanBenchmarks, error) {
    benchmarks := PlanBenchmarks{}

    // Average salary by year from canonical_salaries
    benchmarks.AvgSalaryByYear = queryAvgSalaryByYear(db, batchID)

    // Total contributions from canonical_contributions
    benchmarks.TotalContributions = queryTotalContributions(db, batchID)

    // Member count by status from canonical_members
    benchmarks.MemberCountByStatus = queryMemberCountByStatus(db, batchID)

    return benchmarks, nil
}
```

Wired in `ReconcileBatch` handler:
```go
benchmarks, err := ComputeBenchmarks(h.DB, batchID)
tier3Results, err := reconciler.ReconcileTier3(h.DB, batchID, benchmarks)
```

---

## Proof Script Assertions

After gate scores are tuned, add to `run_two_source_proof.sh`:

```bash
# Assert gate score above threshold
if (( $(echo "$PRISM_GATE > 0.50" | bc -l) )); then
    pass "PRISM gate score $PRISM_GATE > 0.50"
else
    fail "PRISM gate score $PRISM_GATE below 0.50"
fi
```

Target: `gate_passed = true` (weighted_score >= 0.95) once all formulas aligned.

---

## Implementation Sequence

| Step | What | Files |
|------|------|-------|
| 1 | Update plan-config.yaml with 3 tiers | `domains/pension/plan-config.yaml` |
| 2 | New: planconfig.go (YAML loader) | `reconciler/planconfig.go` + test |
| 3 | Refactor formula.go (dispatch + BenefitParams) | `reconciler/formula.go` + test |
| 4 | Migration: source_plan_code column | `db/migrations/038_source_plan_code.sql` |
| 5 | Update source_loader.go (plan code mapping) | `batch/source_loader.go` + test |
| 6 | Wire PlanConfig in main.go | `main.go` |
| 7 | Align PRISM seed generator | `prism_data_generator.py` |
| 8 | Align PAS seed generator | `generate_pas_scenarios.py` |
| 9 | Regenerate seed SQL | run generators |
| 10 | Wire Tier 3 benchmarks | `api/reconciliation_handlers.go` |
| 11 | Run Two-Source Proof | verify gate scores > 0 |
| 12 | Add proof script assertions | `run_two_source_proof.sh` |

### Now vs. Later

| Feature | This Sprint | Future |
|---------|------------|--------|
| flat_multiplier formula | Yes | — |
| lookup_table reduction | Yes | — |
| per_year_rate reduction | Yes (fallback) | — |
| age_curve (CalPERS/LACERA) | Schema only | Client onboarding |
| step_by_service (NYSLRS) | Schema only | Client onboarding |
| SS integration offset | Schema only | SDCERA client |
| Membership Segment calc | Schema-aware | Multi-segment members |
| Clone workflow UI | cloned_from field | UI sprint |
| Referenced CSV tables | Loader built | Large age-factor tables |

---

## Verification

1. `go test ./... -short` in `platform/migration/` — all pass
2. New tests: planconfig_test.go (YAML loading, tier lookup, CSV parsing)
3. Updated tests: formula_test.go (BenefitParams-based, 3 tiers)
4. Regenerate seed SQL, rebuild containers
5. Run Two-Source Proof — gate scores > 0
6. Target: gate_passed = true for both sources
