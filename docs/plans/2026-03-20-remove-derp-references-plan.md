# Remove DERP References — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all DERP references from the codebase, making the platform fully generic and plan-agnostic.

**Architecture:** Extract hardcoded plan-specific values from Go code into `domains/pension/plan-config.yaml`. Update frontend `plan-profile.yaml` to use generic names. Replace all `derp` DB credentials with `noui`. Archive DERP-specific prototype docs.

**Tech Stack:** Go 1.22, React/TypeScript, YAML, Docker Compose, Helm, PostgreSQL/PgBouncer

---

### Task 1: Create plan-config.yaml with all plan-specific values

**Files:**
- Create: `domains/pension/plan-config.yaml`

**Step 1: Create the plan config file**

```yaml
# Plan Configuration — all plan-specific parameters
# This file is the single source of truth for plan rules.
# The rules engine loads these values at startup.

plan:
  name: "Retirement Plan"
  short_name: "the Plan"

tiers:
  - id: 1
    hire_date_before: "2004-09-01"    # Tier 1: hired before this date
  - id: 2
    hire_date_before: "2011-07-01"    # Tier 2: hired before this date
  - id: 3
    hire_date_before: null             # Tier 3: everyone else

benefit_multipliers:
  1: 0.020   # 2.0%
  2: 0.015   # 1.5%
  3: 0.015   # 1.5%

ams_window_months:
  1: 36
  2: 36
  3: 60

rule_of_n:
  thresholds:
    1: 75.0
    2: 75.0
    3: 85.0
  min_ages:
    1: 55
    2: 55
    3: 60

early_retirement:
  min_ages:
    1: 55
    2: 55
    3: 60
  reduction_tables:
    tiers_1_2:   # 3% per year under 65
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
    tier_3:      # 6% per year under 65
      60: 0.70
      61: 0.76
      62: 0.82
      63: 0.88
      64: 0.94
      65: 1.00
  reduction_rate_per_year:
    1: 3.0
    2: 3.0
    3: 6.0

death_benefits:
  tiers_1_2:     # $250/year reduction under 65
    55: 2500
    56: 2750
    57: 3000
    58: 3250
    59: 3500
    60: 3750
    61: 4000
    62: 4250
    63: 4500
    64: 4750
    65: 5000
  tier_3:        # $500/year reduction under 65
    60: 2500
    61: 3000
    62: 3500
    63: 4000
    64: 4500
    65: 5000

contributions:
  employee_rate: 0.0845   # 8.45%
  employer_rate: 0.1795   # 17.95%

vesting_years: 5.0
normal_retirement_age: 65

ipr:
  non_medicare: 12.50    # $/year of earned service
  medicare: 6.25         # $/year of earned service

js_factors:              # Illustrative — actual from actuarial tables
  100: 0.8850
  75: 0.9150
  50: 0.9450
```

**Step 2: Commit**

```bash
git add domains/pension/plan-config.yaml
git commit -m "[domains/pension] Add plan-config.yaml — extract plan-specific parameters"
```

---

### Task 2: Create Go config loader for plan-config.yaml

**Files:**
- Create: `platform/intelligence/config/plan_config.go`
- Create: `platform/intelligence/config/plan_config_test.go`

**Step 1: Write the test**

```go
package config

import (
	"testing"
)

func TestLoadPlanConfig(t *testing.T) {
	cfg, err := LoadPlanConfig("../../../domains/pension/plan-config.yaml")
	if err != nil {
		t.Fatalf("failed to load plan config: %v", err)
	}

	// Verify tier cutoff dates
	if len(cfg.Tiers) != 3 {
		t.Errorf("expected 3 tiers, got %d", len(cfg.Tiers))
	}

	// Verify benefit multipliers
	if cfg.BenefitMultipliers[1] != 0.020 {
		t.Errorf("expected tier 1 multiplier 0.020, got %f", cfg.BenefitMultipliers[1])
	}

	// Verify contribution rates
	if cfg.Contributions.EmployeeRate != 0.0845 {
		t.Errorf("expected employee rate 0.0845, got %f", cfg.Contributions.EmployeeRate)
	}

	// Verify normal retirement age
	if cfg.NormalRetirementAge != 65 {
		t.Errorf("expected normal retirement age 65, got %d", cfg.NormalRetirementAge)
	}

	// Verify early retirement reduction tables
	if cfg.EarlyRetirement.ReductionTables.Tiers12[55] != 0.70 {
		t.Errorf("expected T12 age 55 factor 0.70, got %f", cfg.EarlyRetirement.ReductionTables.Tiers12[55])
	}
	if cfg.EarlyRetirement.ReductionTables.Tier3[60] != 0.70 {
		t.Errorf("expected T3 age 60 factor 0.70, got %f", cfg.EarlyRetirement.ReductionTables.Tier3[60])
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd platform/intelligence && go test ./config/... -v -count=1`
Expected: FAIL (package doesn't exist yet)

**Step 3: Write the config loader**

Create `platform/intelligence/config/plan_config.go` with:
- `PlanConfig` struct matching the YAML structure
- `LoadPlanConfig(path string) (*PlanConfig, error)` function using `gopkg.in/yaml.v3`
- A package-level `var Cfg *PlanConfig` for runtime access
- An `Init(path string) error` function called from `main.go`

**Step 4: Run test to verify it passes**

Run: `cd platform/intelligence && go test ./config/... -v -count=1`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/intelligence/config/
git commit -m "[platform/intelligence] Add plan config loader"
```

---

### Task 3: Refactor tables.go to use loaded config

**Files:**
- Modify: `platform/intelligence/rules/tables.go`
- Modify: `platform/intelligence/main.go` (add config init call)

**Step 1: Update tables.go**

Replace all hardcoded maps and constants with functions that read from `config.Cfg`:
- `EarlyRetReductionT12` → `func GetEarlyRetReduction(tier int) map[int]float64`
- `TierMultiplier` → `func GetTierMultiplier(tier int) float64`
- `AMSWindowMonths` → `func GetAMSWindowMonths(tier int) int`
- etc.

OR simpler: keep the package-level vars but populate them from config at init time via an `InitFromConfig(*config.PlanConfig)` function.

The simpler approach minimizes changes to eligibility.go and benefit_calculator.go since they already reference the vars directly.

**Step 2: Add InitFromConfig to tables.go**

```go
// InitFromConfig populates lookup tables from the loaded plan configuration.
// Called once at startup from main.go.
func InitFromConfig(cfg *config.PlanConfig) {
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
	EmployeeContribRate = cfg.Contributions.EmployeeRate
	EmployerContribRate = cfg.Contributions.EmployerRate
	VestingYears = cfg.VestingYears
	NormalRetAge = cfg.NormalRetirementAge
	IPRNonMedicare = cfg.IPR.NonMedicare
	IPRMedicare = cfg.IPR.Medicare
}
```

Note: Constants become `var` since they're now loaded at runtime.

**Step 3: Update main.go to load config**

Add `PLAN_CONFIG_PATH` env var (default: `../../domains/pension/plan-config.yaml`) and call `config.Init()` + `rules.InitFromConfig()` at startup.

**Step 4: Run all existing intelligence tests**

Run: `cd platform/intelligence && go test ./... -v -count=1 -short`
Expected: ALL PASS — values identical, just sourced from config now

**Step 5: Commit**

```bash
git add platform/intelligence/
git commit -m "[platform/intelligence] Load plan parameters from config instead of hardcoded values"
```

---

### Task 4: Refactor eligibility.go tier cutoff dates

**Files:**
- Modify: `platform/intelligence/rules/eligibility.go:17-18`

**Step 1: Add tier dates to tables.go vars**

Add `var Tier2Start time.Time` and `var Tier3Start time.Time` populated from config in `InitFromConfig`.

**Step 2: Update DetermineTier to use the vars**

```go
func DetermineTier(hireDate time.Time) int {
	if hireDate.Before(Tier2Start) {
		return 1
	}
	if hireDate.Before(Tier3Start) {
		return 2
	}
	return 3
}
```

**Step 3: Update benefit_calculator.go comments**

Remove DERP references from:
- Line 144: "DERP actuarial tables" → "plan actuarial tables"
- Line 281: "DERP's actual method" → "The plan's actual method"

**Step 4: Remove DERP from eligibility.go comment**

Line 51: "DERP may use exact-day method" → "The plan may use exact-day method"

**Step 5: Run tests**

Run: `cd platform/intelligence && go test ./... -v -count=1 -short`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add platform/intelligence/
git commit -m "[platform/intelligence] Remove DERP references, load tier dates from config"
```

---

### Task 5: Remove DERP from all Go package docs and comments

**Files:**
- Modify: `platform/intelligence/rules/tables.go:1` — "DERP benefit calculations" → "benefit calculations"
- Modify: `platform/intelligence/rules/tables.go:105` — "DERP actuarial tables" → "plan actuarial tables"
- Modify: `platform/intelligence/rules/tables.go:116` — "DERP Handbook" → "Plan Handbook"
- Modify: `platform/intelligence/api/handlers.go:1` — "DERP intelligence service" → "intelligence service"
- Modify: `platform/intelligence/main.go:1` — "NoUI DERP POC" → "NoUI"
- Modify: `platform/intelligence/models/types.go:1` — "DERP intelligence service" → "intelligence service"
- Modify: `platform/dataaccess/models/member.go:1` — "DERP data connector" → "data connector"
- Modify: `platform/dataaccess/models/member.go:7` — "DERP plan member" → "plan member"
- Modify: `platform/dataaccess/main.go:1` — "NoUI DERP POC" → "NoUI"
- Modify: `platform/dataaccess/api/handlers.go:1` — "DERP data connector" → "data connector"

**Step 1: Make all edits**

Simple find-and-replace of "DERP" in comments across Go files.

**Step 2: Build check**

Run: `cd platform/intelligence && go build ./... && cd ../dataaccess && go build ./...`
Expected: Clean build

**Step 3: Commit**

```bash
git add platform/
git commit -m "[platform] Remove DERP references from Go package docs and comments"
```

---

### Task 6: Update all Go DB defaults from "derp" to "noui"

**Files (17 files):**
- `platform/dataaccess/db/postgres.go:32-34`
- `platform/intelligence/db/postgres.go:42-44`
- `platform/crm/db/postgres.go` (similar lines)
- `platform/casemanagement/db/postgres.go`
- `platform/knowledgebase/db/postgres.go`
- `platform/dataquality/db/postgres.go`
- `platform/correspondence/db/postgres.go`
- `platform/preferences/db/postgres.go`
- `platform/issues/db/postgres.go`
- `platform/security/db/postgres.go`
- `platform/employer-portal/db/config.go`
- `platform/employer-reporting/db/config.go`
- `platform/employer-enrollment/db/config.go`
- `platform/employer-terminations/db/config.go`
- `platform/employer-waret/db/config.go`
- `platform/employer-scp/db/config.go`
- `platform/dataaccess/db/rls_test.go:27` — test DSN string
- `platform/crm/db/postgres_test.go` — if it has "derp" references

**Step 1: Replace "derp" with "noui" in all DB config defaults**

In each file, change:
```go
envutil.GetEnv("DB_USER", "derp")     → envutil.GetEnv("DB_USER", "noui")
envutil.GetEnv("DB_PASSWORD", "derp") → envutil.GetEnv("DB_PASSWORD", "noui")
envutil.GetEnv("DB_NAME", "derp")     → envutil.GetEnv("DB_NAME", "noui")
```

For rls_test.go:
```go
"user=derp password=derp dbname=derp" → "user=noui password=noui dbname=noui"
```

**Step 2: Build all services**

Run: `for d in dataaccess intelligence crm casemanagement knowledgebase dataquality correspondence preferences issues security employer-portal employer-reporting employer-enrollment employer-terminations employer-waret employer-scp; do (cd platform/$d && go build ./...); done`
Expected: All clean

**Step 3: Commit**

```bash
git add platform/
git commit -m "[platform] Change DB defaults from 'derp' to 'noui'"
```

---

### Task 7: Update Docker & PgBouncer configuration

**Files:**
- Modify: `docker-compose.yml` — all `derp` → `noui` (DB env vars, healthcheck)
- Modify: `.env.example:7-9` — `derp` → `noui`
- Modify: `infrastructure/pgbouncer/userlist.txt` — `"derp" "derp"` → `"noui" "noui"`
- Modify: `infrastructure/pgbouncer/pgbouncer.ini:2` — `derp = host=postgres port=5432 dbname=derp` → `noui = host=postgres port=5432 dbname=noui`
- Modify: `infrastructure/pgbouncer/pgbouncer.ini:35` — `admin_users = derp` → `admin_users = noui`

**Step 1: Update docker-compose.yml**

Replace all occurrences of:
- `POSTGRES_DB: derp` → `POSTGRES_DB: noui`
- `POSTGRES_USER: derp` → `POSTGRES_USER: noui`
- `POSTGRES_PASSWORD: derp` → `POSTGRES_PASSWORD: noui`
- `DB_USER: derp` → `DB_USER: noui`
- `DB_PASSWORD: derp` → `DB_PASSWORD: noui`
- `DB_NAME: derp` → `DB_NAME: noui`
- `pg_isready -U derp` → `pg_isready -U noui`
- `pg_isready -h 127.0.0.1 -p 6432 -U derp` → `pg_isready -h 127.0.0.1 -p 6432 -U noui`

**Step 2: Update .env.example, pgbouncer files**

**Step 3: Commit**

```bash
git add docker-compose.yml .env.example infrastructure/pgbouncer/
git commit -m "[infrastructure] Rename DB credentials from 'derp' to 'noui'"
```

---

### Task 8: Update Helm charts

**Files:**
- Modify: `infrastructure/helm/intelligence/Chart.yaml:2-3` — `derp-intelligence` → `noui-intelligence`, remove "DERP POC"
- Modify: `infrastructure/helm/intelligence/values.yaml:4` — `noui/derp-intelligence` → `noui/intelligence`
- Modify: `infrastructure/helm/intelligence/values.yaml:13` — `derp-connector` → `noui-dataaccess`
- Modify: `infrastructure/helm/frontend/Chart.yaml:2-3` — `derp-frontend` → `noui-frontend`, remove "DERP POC"
- Modify: `infrastructure/helm/frontend/values.yaml:4` — `noui/derp-frontend` → `noui/frontend`
- Modify: `infrastructure/helm/crm/Chart.yaml:3` — remove "DERP POC"
- Modify: `infrastructure/helm/crm/values.yaml:4` — `noui-derp-poc/crm` → `noui/crm`
- Modify: `infrastructure/helm/crm/values.yaml:15` — `derp` → `noui`
- Modify: `infrastructure/helm/crm/templates/deployment.yaml:33` — `derp-db-credentials` → `noui-db-credentials`
- Modify: `infrastructure/helm/dataaccess/Chart.yaml:2-3` — `derp-dataaccess` → `noui-dataaccess`, remove "DERP POC"
- Modify: `infrastructure/helm/dataaccess/values.yaml:4` — `noui/derp-dataaccess` → `noui/dataaccess`
- Modify: `infrastructure/helm/dataaccess/values.yaml:15-16` — `derp` → `noui`
- Modify: `infrastructure/helm/dataaccess/templates/deployment.yaml:33` — `derp-db-credentials` → `noui-db-credentials`

**Step 1: Make all Helm edits**

**Step 2: Commit**

```bash
git add infrastructure/helm/
git commit -m "[infrastructure/helm] Remove DERP from chart names and values"
```

---

### Task 9: Update frontend plan-profile.yaml to generic

**Files:**
- Modify: `frontend/src/config/plan-profile.yaml`

**Step 1: Update identity section**

```yaml
# Plan Profile Configuration — drives all plan-specific portal behavior

identity:
  plan_name: "Retirement Plan"
  plan_short_name: "the Plan"
  administrator_name: "Retirement Plan Administration"
  phone: "(555) 555-0100"
  email: "memberservices@example.gov"
  address: "123 Main Street, Suite 400, Anytown, ST 00000"
```

**Step 2: Update notification templates**

Replace `DERP:` prefix in SMS templates with `{plan_short_name}:`:
- Line 198: `"DERP: Your retirement..."` → `"{plan_short_name}: Your retirement..."`
- Line 204: `"DERP: Your application..."` → `"{plan_short_name}: Your application..."`
- Line 210: `"DERP: A document..."` → `"{plan_short_name}: A document..."`

**Step 3: Run frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean

**Step 4: Commit**

```bash
git add frontend/src/config/plan-profile.yaml
git commit -m "[frontend] Genericize plan-profile.yaml — remove DERP identity"
```

---

### Task 10: Update frontend components and tests

**Files:**
- Modify: `frontend/src/components/portal/MemberPortalMessages.tsx:116` — "DERP staff" → dynamic from config
- Modify: `frontend/src/components/portal/EmployerPortalEnrollment.tsx:174` — "DERP staff" → dynamic from config
- Modify: `frontend/src/components/portal/learningHints.ts:18` — "Your DERP benefit" → "Your retirement benefit"
- Modify: `frontend/src/App.tsx:96` — "DERP POC" → "Platform"
- Modify: `frontend/index.html:7` — Remove "DERP POC" from title
- Modify: `frontend/package.json:2` — `"noui-derp-poc"` → `"noui-platform"`

**Step 1: Update MemberPortalMessages.tsx**

Import plan profile and use `planShortName` instead of hardcoded "DERP staff":
```tsx
Send a secure message to {planProfile.identity.plan_short_name} staff
```

**Step 2: Update EmployerPortalEnrollment.tsx**

```tsx
Enrollment submissions are reviewed by {planProfile.identity.plan_short_name} staff within 2 business days.
```

**Step 3: Update learningHints.ts**

```ts
'Your retirement benefit is calculated as: years of service × tier multiplier × average monthly salary...'
```

**Step 4: Update App.tsx**

Line 96: `DERP POC` → `Platform`

**Step 5: Update index.html**

```html
<title>NoUI — Retirement Application Workspace</title>
```

**Step 6: Update package.json**

```json
"name": "noui-platform"
```

**Step 7: Update test references**

- `frontend/src/lib/__tests__/planProfile.test.ts:23` — `'has 3 DERP tiers'` → `'has 3 tiers'`
- `frontend/src/components/__tests__/BenefitCalculationPanel.test.tsx` — Change all `'DERP §24-51-...'` → `'RMC §24-51-...'` (or just remove "DERP" prefix)

**Step 8: Run frontend typecheck + tests**

Run: `cd frontend && npx tsc --noEmit && npm test -- --run`
Expected: Clean typecheck, all tests pass

**Step 9: Commit**

```bash
git add frontend/
git commit -m "[frontend] Remove all DERP references from components and tests"
```

---

### Task 11: Update domains/pension files

**Files:**
- Modify: `domains/pension/CLAUDE.md` — Remove "DERP" references
- Modify: `domains/pension/schema/001_legacy_schema.sql:1` — "NoUI DERP POC" → "NoUI"
- Modify: `domains/pension/seed/002_legacy_seed.sql:2` — "Legacy DERP" → "Legacy"
- Modify: `domains/pension/seed/003_crm_seed.sql` — "DERP staff" → "Staff"
- Modify: `domains/pension/rules/definitions/eligibility.yaml` — Remove "DERP" from governance metadata
- Modify: `domains/pension/rules/definitions/membership.yaml` — Same
- Modify: `domains/pension/rules/definitions/benefit-calculation.yaml` — Same
- Modify: All other YAML rule definitions with DERP references
- Rename: `domains/pension/seed/generate_derp_data.py` → `domains/pension/seed/generate_seed_data.py`

**Step 1: Update CLAUDE.md**

Replace "DERP (Denver Employees Retirement Plan)" with "pension domain".

**Step 2: Update SQL comments**

Simple comment replacements — no logic changes.

**Step 3: Update YAML rule definitions**

In all 9 YAML files under `domains/pension/rules/definitions/`:
- `authority: "DERP Restated Master Contract (RMC)"` → `authority: "Restated Master Contract (RMC)"`
- `Owner: DERP Rules Committee` → `Owner: Plan Rules Committee`
- Remove "DERP" from descriptions, keeping the rule content

**Step 4: Rename seed generator**

```bash
git mv domains/pension/seed/generate_derp_data.py domains/pension/seed/generate_seed_data.py
```

Update internal references in the file.

**Step 5: Commit**

```bash
git add domains/pension/
git commit -m "[domains/pension] Remove DERP references from schema, seeds, and rules"
```

---

### Task 12: Update compose-sim system prompt

**Files:**
- Modify: `tools/compose-sim/compose_sim/prompts/system_prompt.py` — Remove DERP plan reference

**Step 1: Edit**

Replace any "DERP" reference with generic "the plan" or "pension plan".

**Step 2: Commit**

```bash
git add tools/compose-sim/
git commit -m "[tools/compose-sim] Remove DERP reference from system prompt"
```

---

### Task 13: Archive DERP prototype docs

**Files:**
- Move: `docs/prototypes/derp-analysis-questionnaire.docx` → `docs/prototypes/archived-derp/`
- Move: `docs/prototypes/derp-business-rules-inventory.docx` → `docs/prototypes/archived-derp/`
- Move: `docs/prototypes/derp-rmc-verification-analysis.docx` → `docs/prototypes/archived-derp/`
- Move: `docs/prototypes/derp-rmc-verification-analysis-v3.docx` → `docs/prototypes/archived-derp/`
- Move: `docs/prototypes/noui-derp-demo-story.docx` → `docs/prototypes/archived-derp/`
- Move: `docs/prototypes/noui-derp-service-retirement-process.md` → `docs/prototypes/archived-derp/`
- Move: `docs/prototypes/NoUI-DERP-Presentation.md` → `docs/prototypes/archived-derp/`

**Step 1: Create archive directory and move files**

```bash
mkdir -p docs/prototypes/archived-derp
git mv docs/prototypes/derp-*.docx docs/prototypes/archived-derp/
git mv docs/prototypes/noui-derp-*.docx docs/prototypes/archived-derp/
git mv docs/prototypes/noui-derp-service-retirement-process.md docs/prototypes/archived-derp/
git mv docs/prototypes/NoUI-DERP-Presentation.md docs/prototypes/archived-derp/
```

**Step 2: Commit**

```bash
git add docs/prototypes/
git commit -m "[docs] Archive DERP-specific prototype documents"
```

---

### Task 14: Update README.md and CLAUDE.md files

**Files:**
- Modify: `README.md:20,27,60` — Remove DERP references
- Modify: `CLAUDE.md` (repo root) — Remove "DERP Quick Reference" table, update structure comment, remove DERP-specific rules
- Modify: `CLAUDE.md` (worktree/main repo) — Update `pension (DERP)` → `pension`

**Step 1: Update README.md**

- Line 20: `pension (DERP)` → `pension`
- Line 27: `# Start the full DERP stack` → `# Start the full stack`
- Line 60: `DERP pension schemas, rules, seed data, test cases` → `Pension schemas, rules, seed data, test cases`

**Step 2: Update CLAUDE.md**

- Remove the "DERP Quick Reference" table (lines 319-338 in root CLAUDE.md) — these values are now in `plan-config.yaml`
- Update repo structure: `#   DERP pension domain` → `#   Pension domain`
- Remove "Service Purchase Exclusion (CRITICAL)" and "Leave Payout (CRITICAL)" sections that reference DERP-specific rules — these are now documented in the YAML rule definitions and plan config
- Update any remaining "DERP" mentions to "the plan"

**Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "[docs] Remove DERP references from README and CLAUDE.md"
```

---

### Task 15: Final verification sweep

**Step 1: Search for any remaining DERP references**

```bash
grep -ri "derp" --include="*.go" --include="*.ts" --include="*.tsx" --include="*.yaml" --include="*.yml" --include="*.json" --include="*.sql" --include="*.py" --include="*.md" --include="*.html" --include="*.ini" --include="*.txt" . | grep -v "node_modules" | grep -v ".git/" | grep -v "BUILD_HISTORY" | grep -v "docs/plans/" | grep -v "archived-derp" | grep -v "docs/prototypes/doc0"
```

Expected: No results (BUILD_HISTORY, plans, archived-derp, and prototype docs excluded as historical)

**Step 2: Build all Go services**

```bash
for d in dataaccess intelligence crm casemanagement knowledgebase dataquality correspondence preferences issues security employer-portal employer-reporting employer-enrollment employer-terminations employer-waret employer-scp; do echo "=== $d ===" && (cd platform/$d && go build ./...); done
```

Expected: All clean

**Step 3: Run intelligence tests (most critical — formula tests)**

```bash
cd platform/intelligence && go test ./... -v -count=1 -short
```

Expected: ALL PASS with identical outputs

**Step 4: Run frontend typecheck + tests**

```bash
cd frontend && npx tsc --noEmit && npm test -- --run
```

Expected: Clean typecheck, all tests pass

**Step 5: Commit any remaining fixes**

If the sweep found anything, fix and commit.

**Step 6: Final commit**

```bash
git add .
git commit -m "[all] Final DERP reference cleanup — platform fully genericized"
```
