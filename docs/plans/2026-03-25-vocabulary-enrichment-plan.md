# Vocabulary YAML + Mapper Enrichment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the 25-system pension glossary into structured YAML vocabulary and enrich the migration mapper's ExpectedNames from 299 to ~550+ entries.

**Architecture:** A `vocabulary.yaml` file in `domains/pension/terminology/` holds all terms, abbreviations, source systems, and false cognate warnings extracted from `docs/pension-glossary.md`. A Go loader in `platform/migration/mapper/vocabulary.go` parses this YAML and provides an `EnrichRegistry()` function that merges vocabulary terms into the registry's ExpectedNames arrays. The registry baseline remains hardcoded; vocabulary is additive.

**Tech Stack:** Go 1.25, `gopkg.in/yaml.v3` (already in go.mod), YAML

---

## Task 1: Create vocabulary.yaml from glossary extraction

**Files:**
- Create: `domains/pension/terminology/vocabulary.yaml`

**Context:** The pension glossary (`docs/pension-glossary.md`) contains three domains of terminology across 25 pension systems. Extract all terms into structured YAML. Every term name must be lowercase with underscores (matching ExpectedNames convention). Include abbreviations and false cognates.

**Step 1: Create the directory and vocabulary file**

Create `domains/pension/terminology/vocabulary.yaml` with the following structure. Extract terms from ALL THREE glossary domains (service credit, compensation, contributions). Every `name` field must be lowercase with underscores.

```yaml
# Pension system terminology vocabulary
# Source: docs/pension-glossary.md (25-system crosswalk)
# Used by: platform/migration/mapper to enrich ExpectedNames
version: "1.0"
source: "docs/pension-glossary.md"

systems:
  - COPERA
  - DERP
  - CalPERS
  - NYCERS
  - OPERS
  - TRS_Texas
  - LACERA
  - IMRF
  - VRS
  - TMRS
  - LAGERS
  - IPERS
  - PSPRS
  - Oregon_PERS
  - Nevada_PERS
  - MSRS
  - Utah_RS
  - Montana_PERA
  - FRS
  - STRS_Ohio
  - PSERS
  - KPERS
  - NHRS
  - SDCERS
  - HMEPS

concepts:
  # -------------------------------------------------------------------
  # SERVICE CREDIT domain (Glossary Layer 1, Domain 1)
  # -------------------------------------------------------------------
  service-credit:
    credited_years_total:
      terms:
        # Primary terms for pensionable time
        - name: service_credit
          abbrev: SC
          systems: [COPERA, DERP, CalPERS, LACERA, SDCERS, OPERS, IMRF, IPERS, TRS_Texas, TMRS, VRS, KPERS, Nevada_PERS, Utah_RS, Montana_PERA]
        - name: credited_service
          abbrev: CS
          systems: [NYCERS, PSERS, NHRS, HMEPS, LAGERS, PSPRS, DERP]
        - name: creditable_service
          systems: [NHRS, FRS, VRS, Oregon_PERS, PSERS, IMRF]
        - name: retirement_credit
          systems: [Oregon_PERS]
        - name: allowable_service
          systems: [MSRS, NYCERS]
        - name: years_of_service
          abbrev: YOS
          systems: [KPERS, Utah_RS, TRS_Texas]
        - name: qualifying_service_credit
          abbrev: QSC
          systems: [STRS_Ohio, PSERS]
        - name: contributing_months
          systems: [OPERS]
        - name: earned_service_credit
          systems: [COPERA, LACERA]
        - name: eligibility_points
          abbrev: EP
          systems: [PSERS]
        - name: service_units
          systems: [IPERS]
        - name: svc_cr_bal
          systems: []
      false_cognates:
        - term: membership_service
          warning: "NYCERS/LAGERS = earned service after joining; Montana PERA = eligibility-only service (not for benefit calc)"
          risk: HIGH
        - term: prior_service
          warning: "LAGERS/IMRF/KPERS = pre-system service; VRS/PSPRS = purchased service from previous positions"
          risk: MEDIUM
        - term: allowable_service
          warning: "MSRS = all service credit; NYCERS = special plan eligibility only"
          risk: MEDIUM
        - term: updated_service_credits
          warning: "TMRS only — monetary credit recalculation, NOT temporal service. Highest-risk false cognate."
          risk: HIGH

    service_type:
      terms:
        # Purchased service terms
        - name: purchased_service_credit
          abbrev: PSC
          systems: [COPERA, DERP, CalPERS, LACERA, KPERS, FRS, SDCERS, Nevada_PERS, PSERS, MSRS, Montana_PERA, STRS_Ohio]
        - name: buy_back
          systems: [NYCERS, TMRS, IPERS]
        - name: redeposit
          systems: [CalPERS, LACERA]
        - name: reinstated_service
          systems: [IMRF]
        - name: restored_credit
          systems: [STRS_Ohio]
        - name: optional_service_credit
          systems: [FRS]
        - name: permissive_service_credit
          systems: [Oregon_PERS]
        # Military service terms
        - name: military_service_credit
          systems: [CalPERS, NYCERS, TMRS, KPERS]
        - name: userra_service_credit
          systems: [TRS_Texas, TMRS, FRS]
        - name: granted_military_service
          systems: [KPERS]
        - name: prior_active_military_service
          systems: [PSPRS]
        # Transferred/reciprocal terms
        - name: reciprocal_service
          systems: [CalPERS, LACERA, SDCERS, IMRF]
        - name: transferred_service
          systems: [NYCERS, MSRS]
        - name: joint_service_credit
          systems: [OPERS, STRS_Ohio]
        - name: proportionate_retirement
          abbrev: PRP
          systems: [TRS_Texas, TMRS]
      false_cognates: []

  # -------------------------------------------------------------------
  # SALARY HISTORY domain (Glossary Layer 1, Domain 2)
  # -------------------------------------------------------------------
  salary-history:
    gross_amount:
      terms:
        # Primary FAC / compensation terms that appear as salary column names
        - name: pensionable_pay
          systems: [COPERA]
        - name: compensation_earnable
          systems: [CalPERS]
        - name: pensionable_compensation
          systems: [CalPERS, SDCERS]
        - name: pensionable_salary
          systems: [SDCERS]
        - name: earnable_compensation
          systems: [NHRS]
        - name: covered_wages
          systems: [IPERS]
        - name: covered_salary
          systems: [COPERA]
        - name: creditable_compensation
          systems: [VRS]
        - name: reportable_compensation
          systems: [PSERS]
        - name: pensionable_comp
          systems: [CalPERS]
        - name: base_pay
          systems: []
        - name: annual_salary
          systems: []
      false_cognates:
        - term: compensation_earnable
          warning: "CalPERS classic members only; PEPRA members use 'pensionable compensation' with different inclusion rules"
          risk: MEDIUM

    pensionable_amount:
      terms:
        # Final average salary abbreviations that may appear as column names
        - name: highest_average_salary
          abbrev: HAS
          systems: [COPERA]
        - name: average_monthly_salary
          abbrev: AMS
          systems: [DERP, HMEPS]
        - name: final_average_compensation
          abbrev: FAC
          systems: [LACERA]
        - name: final_average_salary
          abbrev: FAS
          systems: [NYCERS, PSERS, OPERS, STRS_Ohio, LAGERS, KPERS, Oregon_PERS, Utah_RS, SDCERS]
        - name: average_final_compensation
          abbrev: AFC
          systems: [NHRS, FRS, VRS]
        - name: final_rate_of_earnings
          abbrev: FRE
          systems: [IMRF]
        - name: average_monthly_compensation
          abbrev: AMC
          systems: [PSPRS]
        - name: highest_average_compensation
          abbrev: HAC
          systems: [Montana_PERA]
        - name: high_five_salary
          systems: [MSRS]
      false_cognates:
        - term: AFC
          warning: "NHRS (3/5 highest years) vs FRS (5/8 fiscal years) vs VRS (36/60 consecutive months) — same abbreviation, different windows"
          risk: HIGH
        - term: FAS
          warning: "Window ranges from 36 to 96 months across systems; consecutive vs non-consecutive varies"
          risk: MEDIUM
        - term: FRE
          warning: "IMRF only — 48/96 month windows with 125% anti-spiking rule; unique calculation"
          risk: MEDIUM

    period_start:
      terms:
        - name: sal_eff_dt
          systems: []
        - name: pay_start_date
          systems: []
        - name: salary_effective_date
          systems: []
        - name: earnings_start_date
          systems: []
        - name: comp_period_start
          systems: []
      false_cognates: []

    period_end:
      terms:
        - name: sal_end_dt
          systems: []
        - name: pay_end_date
          systems: []
        - name: salary_end_date
          systems: []
        - name: earnings_end_date
          systems: []
        - name: comp_period_end
          systems: []
      false_cognates: []

  # -------------------------------------------------------------------
  # BENEFIT DEDUCTION / CONTRIBUTION domain (Glossary Layer 1, Domain 3)
  # -------------------------------------------------------------------
  benefit-deduction:
    ee_amount:
      terms:
        # Member/employee contribution term variants
        - name: basic_member_contributions
          abbrev: BMC
          systems: [NYCERS]
        - name: retirement_deductions
          systems: [MSRS]
        - name: member_deposits
          systems: [TMRS]
        - name: mandatory_contributions
          systems: [NHRS]
        - name: regular_contributions
          systems: [Montana_PERA]
        - name: member_contribution_amount
          systems: []
      false_cognates: []

    er_amount:
      terms:
        # Employer contribution term variants
        - name: state_contribution
          systems: [TRS_Texas]
        - name: city_contributions
          systems: [HMEPS]
        - name: city_matching_funds
          systems: [TMRS]
        - name: aed
          systems: [COPERA]
        - name: saed
          systems: [COPERA]
        - name: normal_cost
          systems: [CalPERS, LACERA]
        - name: uniform_contribution_rate
          systems: [FRS]
      false_cognates:
        - term: city_matching_funds
          warning: "TMRS only — applied at retirement as lump match (1:1, 1.5:1, or 2:1), not ongoing payroll deduction"
          risk: MEDIUM

  # -------------------------------------------------------------------
  # BENEFIT PAYMENT domain
  # -------------------------------------------------------------------
  benefit-payment:
    gross_amount:
      terms:
        - name: benefit_amount
          systems: []
        - name: monthly_benefit
          systems: []
        - name: pension_payment
          systems: []
        - name: retirement_benefit
          systems: []
        - name: annuity_payment
          systems: [NYCERS]
        - name: monthly_allowance
          systems: [CalPERS, LACERA]
        - name: benefit_payment_amount
          systems: []
        - name: gross_benefit
          systems: []
      false_cognates: []

  # -------------------------------------------------------------------
  # EMPLOYEE MASTER domain (hire date enrichment)
  # -------------------------------------------------------------------
  employee-master:
    original_hire_date:
      terms:
        - name: membership_date
          systems: [COPERA, DERP, Montana_PERA]
        - name: enrollment_date
          systems: [TMRS, TRS_Texas]
        - name: system_entry_date
          systems: [NHRS, FRS]
        - name: participation_date
          systems: [PSERS]
      false_cognates: []
```

**Step 2: Validate YAML is parseable**

```bash
python3 -c "import yaml; yaml.safe_load(open('domains/pension/terminology/vocabulary.yaml')); print('YAML valid')"
```

Expected: `YAML valid`

**Step 3: Commit**

```bash
git add domains/pension/terminology/vocabulary.yaml
git commit -m "[pension/terminology] Extract glossary into vocabulary.yaml — 25 systems, 3 domains"
```

---

## Task 2: Create vocabulary Go loader

**Files:**
- Create: `platform/migration/mapper/vocabulary.go`

**Context:** This file provides `LoadVocabulary()` to parse the YAML and `EnrichRegistry()` to merge vocabulary terms into registry ExpectedNames. Uses `gopkg.in/yaml.v3` which is already in go.mod.

**Step 1: Write vocabulary.go**

```go
package mapper

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

// Vocabulary represents the parsed pension terminology vocabulary.
type Vocabulary struct {
	Version  string                              `yaml:"version"`
	Source   string                              `yaml:"source"`
	Systems  []string                            `yaml:"systems"`
	Concepts map[string]map[string]VocabularySlot `yaml:"concepts"`
}

// VocabularySlot holds terms and false cognates for one canonical column.
type VocabularySlot struct {
	Terms          []VocabularyTerm    `yaml:"terms"`
	FalseCognates  []FalseCognate      `yaml:"false_cognates"`
}

// VocabularyTerm is a single synonym with optional abbreviation and source systems.
type VocabularyTerm struct {
	Name    string   `yaml:"name"`
	Abbrev  string   `yaml:"abbrev,omitempty"`
	Systems []string `yaml:"systems"`
}

// FalseCognate describes a term that means different things at different systems.
type FalseCognate struct {
	Term    string `yaml:"term"`
	Warning string `yaml:"warning"`
	Risk    string `yaml:"risk"` // HIGH, MEDIUM, LOW
}

// LoadVocabulary reads and parses a vocabulary YAML file.
func LoadVocabulary(path string) (*Vocabulary, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading vocabulary file: %w", err)
	}

	var vocab Vocabulary
	if err := yaml.Unmarshal(data, &vocab); err != nil {
		return nil, fmt.Errorf("parsing vocabulary YAML: %w", err)
	}

	// Validate all term names are lowercase
	for concept, slots := range vocab.Concepts {
		for slot, vs := range slots {
			for _, term := range vs.Terms {
				if term.Name != strings.ToLower(term.Name) {
					return nil, fmt.Errorf("vocabulary term %q in %s.%s is not lowercase", term.Name, concept, slot)
				}
			}
		}
	}

	return &vocab, nil
}

// EnrichRegistry adds vocabulary terms to the registry's ExpectedNames arrays.
// Only adds terms that don't already exist in the slot. Returns the count of
// new terms added.
func EnrichRegistry(r *Registry, v *Vocabulary) int {
	added := 0
	for conceptTag, slots := range v.Concepts {
		tmpl, ok := r.Get(conceptTag)
		if !ok {
			continue
		}
		for si := range tmpl.Slots {
			slot := &tmpl.Slots[si]
			vocabSlot, ok := slots[slot.CanonicalColumn]
			if !ok {
				continue
			}

			existing := make(map[string]bool, len(slot.ExpectedNames))
			for _, name := range slot.ExpectedNames {
				existing[name] = true
			}

			for _, term := range vocabSlot.Terms {
				// Add the full name
				if !existing[term.Name] {
					slot.ExpectedNames = append(slot.ExpectedNames, term.Name)
					existing[term.Name] = true
					added++
				}
				// Add the abbreviation (lowercased) if present
				if term.Abbrev != "" {
					abbrevLower := strings.ToLower(term.Abbrev)
					if !existing[abbrevLower] {
						slot.ExpectedNames = append(slot.ExpectedNames, abbrevLower)
						existing[abbrevLower] = true
						added++
					}
				}
			}
		}
		// Write back the modified template
		r.templates[conceptTag] = tmpl
	}
	return added
}

// TermCount returns the total number of ExpectedNames entries across all slots.
func (r *Registry) TermCount() int {
	count := 0
	for _, tag := range r.Tags() {
		tmpl, _ := r.Get(tag)
		for _, slot := range tmpl.Slots {
			count += len(slot.ExpectedNames)
		}
	}
	return count
}
```

**Step 2: Verify it compiles**

```bash
cd platform/migration && go build ./mapper/
```

Expected: no errors

**Step 3: Commit**

```bash
git add platform/migration/mapper/vocabulary.go
git commit -m "[migration/mapper] Add vocabulary YAML loader and registry enrichment"
```

---

## Task 3: Write vocabulary tests

**Files:**
- Create: `platform/migration/mapper/vocabulary_test.go`

**Context:** Tests validate: YAML parses, enrichment adds terms without duplicates, all vocab terms end up in registry, lowercase enforcement, and baseline count increases.

**Step 1: Write vocabulary_test.go**

```go
package mapper

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// vocabPath returns the absolute path to vocabulary.yaml from the test file location.
func vocabPath(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot determine test file path")
	}
	// Navigate from platform/migration/mapper/ to repo root
	repoRoot := filepath.Join(filepath.Dir(thisFile), "..", "..", "..", "..")
	path := filepath.Join(repoRoot, "domains", "pension", "terminology", "vocabulary.yaml")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Skipf("vocabulary.yaml not found at %s (run from repo root)", path)
	}
	return path
}

func TestLoadVocabulary(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	if vocab.Version != "1.0" {
		t.Errorf("expected version 1.0, got %q", vocab.Version)
	}
	if len(vocab.Systems) != 25 {
		t.Errorf("expected 25 systems, got %d", len(vocab.Systems))
	}
}

func TestVocabularyConceptsMatchRegistry(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	r := NewRegistry()
	for conceptTag, slots := range vocab.Concepts {
		tmpl, ok := r.Get(conceptTag)
		if !ok {
			t.Errorf("vocabulary concept %q not found in registry", conceptTag)
			continue
		}
		slotNames := make(map[string]bool)
		for _, slot := range tmpl.Slots {
			slotNames[slot.CanonicalColumn] = true
		}
		for slotName := range slots {
			if !slotNames[slotName] {
				t.Errorf("vocabulary slot %s.%s not found in registry template", conceptTag, slotName)
			}
		}
	}
}

func TestEnrichRegistryAddsTerms(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	r := NewRegistry()
	before := r.TermCount()
	added := EnrichRegistry(r, vocab)

	if added == 0 {
		t.Error("EnrichRegistry added zero terms — expected enrichment")
	}
	after := r.TermCount()
	if after != before+added {
		t.Errorf("TermCount mismatch: before=%d + added=%d != after=%d", before, added, after)
	}
	t.Logf("Enrichment: %d → %d (+%d terms)", before, after, added)
}

func TestEnrichRegistryNoDuplicates(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	r := NewRegistry()
	EnrichRegistry(r, vocab)

	for _, tag := range r.Tags() {
		tmpl, _ := r.Get(tag)
		for _, slot := range tmpl.Slots {
			seen := make(map[string]bool)
			for _, name := range slot.ExpectedNames {
				if seen[name] {
					t.Errorf("duplicate ExpectedName %q in %s.%s", name, tag, slot.CanonicalColumn)
				}
				seen[name] = true
			}
		}
	}
}

func TestEnrichRegistryIdempotent(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	r := NewRegistry()
	added1 := EnrichRegistry(r, vocab)
	added2 := EnrichRegistry(r, vocab)

	if added2 != 0 {
		t.Errorf("second EnrichRegistry call added %d terms (expected 0 — not idempotent)", added2)
	}
	if added1 == 0 {
		t.Error("first call added 0 terms — vocabulary may be empty or all duplicates")
	}
}

func TestAllVocabTermsAreLowercase(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	for concept, slots := range vocab.Concepts {
		for slot, vs := range slots {
			for _, term := range vs.Terms {
				if term.Name != strings.ToLower(term.Name) {
					t.Errorf("non-lowercase term %q in %s.%s", term.Name, concept, slot)
				}
			}
		}
	}
}

func TestVocabularyBaselineCount(t *testing.T) {
	r := NewRegistry()
	baseline := r.TermCount()
	if baseline < 290 {
		t.Errorf("baseline TermCount too low: %d (expected ~299)", baseline)
	}
	t.Logf("Baseline TermCount: %d", baseline)
}

func TestEnrichedCountAbove400(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	r := NewRegistry()
	EnrichRegistry(r, vocab)
	total := r.TermCount()
	if total < 400 {
		t.Errorf("enriched TermCount too low: %d (expected 400+)", total)
	}
	t.Logf("Enriched TermCount: %d", total)
}

func TestFalseCognatesLoaded(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	// Service credit should have false cognates
	scSlots, ok := vocab.Concepts["service-credit"]
	if !ok {
		t.Fatal("service-credit concept not in vocabulary")
	}
	cyt, ok := scSlots["credited_years_total"]
	if !ok {
		t.Fatal("credited_years_total slot not in service-credit")
	}
	if len(cyt.FalseCognates) == 0 {
		t.Error("expected false cognates for service-credit.credited_years_total")
	}
	// Check membership_service is flagged HIGH
	found := false
	for _, fc := range cyt.FalseCognates {
		if fc.Term == "membership_service" && fc.Risk == "HIGH" {
			found = true
		}
	}
	if !found {
		t.Error("membership_service HIGH-risk false cognate not found")
	}
}
```

**Step 2: Run tests**

```bash
cd platform/migration && go test ./mapper/ -v -run TestVocab -count=1
cd platform/migration && go test ./mapper/ -v -run TestEnrich -count=1
cd platform/migration && go test ./mapper/ -v -run TestFalseCognates -count=1
cd platform/migration && go test ./mapper/ -v -run TestAllVocab -count=1
```

Expected: ALL PASS

**Step 3: Run full mapper test suite to verify no regressions**

```bash
cd platform/migration && go test ./mapper/ -v -count=1
```

Expected: ALL existing tests + new tests pass

**Step 4: Commit**

```bash
git add platform/migration/mapper/vocabulary_test.go
git commit -m "[migration/mapper] Add vocabulary loader tests — parse, enrichment, idempotent, false cognates"
```

---

## Task 4: Enrich registry.go ExpectedNames inline

**Files:**
- Modify: `platform/migration/mapper/registry.go`

**Context:** While the YAML enrichment works at runtime, we also want the most common glossary terms baked into the registry baseline. This ensures the mapper works well even without the YAML file loaded. Add the highest-value terms directly to registry.go ExpectedNames arrays.

Focus on the 7 slots identified in the design doc. Add terms that are common across multiple systems (not single-system edge cases — those stay in YAML only).

**Step 1: Add terms to service-credit.credited_years_total**

In registry.go, find the `credited_years_total` slot and expand ExpectedNames from:
```go
[]string{"credited_years_total", "service_units", "credited_service_years", "years_of_service", "yos", "svc_cr_bal"}
```
to:
```go
[]string{"credited_years_total", "service_units", "credited_service_years", "years_of_service", "yos", "svc_cr_bal", "service_credit", "credited_service", "creditable_service", "retirement_credit", "allowable_service", "qualifying_service_credit", "earned_service_credit", "contributing_months", "eligibility_points", "sc", "cs", "qsc"}
```

**Step 2: Add terms to service-credit.service_type**

Expand from:
```go
[]string{"service_type", "service_unit_type", "credit_type", "svc_typ_cd", "service_type_code"}
```
to:
```go
[]string{"service_type", "service_unit_type", "credit_type", "svc_typ_cd", "service_type_code", "purchased_service_credit", "buy_back", "redeposit", "reinstated_service", "military_service_credit", "userra_service_credit", "reciprocal_service", "transferred_service"}
```

**Step 3: Add terms to salary-history.gross_amount**

Expand from:
```go
[]string{"gross_amount", "salary_amount", "sal_amt", "compensation", "pay_amount", "gross_earn", "gross_pay", "reportable_earnings"}
```
to:
```go
[]string{"gross_amount", "salary_amount", "sal_amt", "compensation", "pay_amount", "gross_earn", "gross_pay", "reportable_earnings", "pensionable_pay", "compensation_earnable", "pensionable_compensation", "pensionable_salary", "earnable_compensation", "covered_wages", "creditable_compensation", "reportable_compensation", "base_pay", "annual_salary"}
```

**Step 4: Add terms to salary-history.pensionable_amount**

Expand from:
```go
[]string{"pensionable_amount", "base_salary", "base_amount", "covered_salary", "pension_earn", "pension_pay", "pensionable_earnings"}
```
to:
```go
[]string{"pensionable_amount", "base_salary", "base_amount", "covered_salary", "pension_earn", "pension_pay", "pensionable_earnings", "highest_average_salary", "average_monthly_salary", "final_average_compensation", "final_average_salary", "average_final_compensation", "final_rate_of_earnings", "average_monthly_compensation", "highest_average_compensation", "high_five_salary", "has", "ams", "fac", "fas", "afc", "fre", "amc", "hac"}
```

**Step 5: Add terms to benefit-deduction.ee_amount**

Expand from:
```go
[]string{"ee_amount", "employee_contribution", "ee_contribution", "member_contribution", "ee_contrib", "ee_contrib_amt", "member_contribution_amount"}
```
to:
```go
[]string{"ee_amount", "employee_contribution", "ee_contribution", "member_contribution", "ee_contrib", "ee_contrib_amt", "member_contribution_amount", "basic_member_contributions", "retirement_deductions", "member_deposits", "mandatory_contributions", "regular_contributions"}
```

**Step 6: Add terms to benefit-deduction.er_amount**

Expand from:
```go
[]string{"er_amount", "employer_contribution", "er_contribution", "er_contrib", "er_contrib_amt", "employer_contribution_amount"}
```
to:
```go
[]string{"er_amount", "employer_contribution", "er_contribution", "er_contrib", "er_contrib_amt", "employer_contribution_amount", "state_contribution", "city_contributions", "city_matching_funds", "normal_cost", "uniform_contribution_rate"}
```

**Step 7: Add terms to benefit-payment.gross_amount**

Expand from:
```go
[]string{"gross_amount", "payment_amount", "gross_payment", "gross_amt"}
```
to:
```go
[]string{"gross_amount", "payment_amount", "gross_payment", "gross_amt", "benefit_amount", "monthly_benefit", "pension_payment", "retirement_benefit", "annuity_payment", "monthly_allowance", "benefit_payment_amount", "gross_benefit"}
```

**Step 8: Add terms to employee-master.original_hire_date**

Expand from:
```go
[]string{"hire_date", "hire_dt", "original_hire_date", "date_of_hire", "employment_date", "original_membership_date", "retirement_system_entry_date"}
```
to:
```go
[]string{"hire_date", "hire_dt", "original_hire_date", "date_of_hire", "employment_date", "original_membership_date", "retirement_system_entry_date", "membership_date", "enrollment_date", "system_entry_date", "participation_date"}
```

**Step 9: Run full test suite**

```bash
cd platform/migration && go test ./mapper/ -v -count=1
```

Expected: ALL PASS (existing + vocabulary tests). The `TestEnrichedCountAbove400` should now report a higher baseline.

**Step 10: Commit**

```bash
git add platform/migration/mapper/registry.go
git commit -m "[migration/mapper] Enrich ExpectedNames from glossary — 299 → ~400+ baseline terms"
```

---

## Task 5: Update registry_test.go with enriched count assertions

**Files:**
- Modify: `platform/migration/mapper/registry_test.go`

**Context:** Now that registry.go has more terms, update the count-based test if needed to reflect the new baseline.

**Step 1: Verify current test suite passes**

```bash
cd platform/migration && go test ./mapper/ -v -count=1 2>&1 | tail -20
```

All tests should pass. No count-based assertions in existing tests need updating (they test structural properties, not counts).

**Step 2: Commit (if any changes needed)**

Only commit if tests needed adjustment.

---

## Task 6: Run full migration test suite and verify

**Files:** None (verification only)

**Step 1: Run all mapper tests**

```bash
cd platform/migration && go test ./mapper/ -v -count=1
```

Expected: ALL PASS

**Step 2: Run full migration module tests (short mode)**

```bash
cd platform/migration && go test ./... -short -count=1
```

Expected: ALL PASS across all migration sub-packages

**Step 3: Log final enrichment stats**

```bash
cd platform/migration && go test ./mapper/ -v -run TestVocabularyBaselineCount -count=1
cd platform/migration && go test ./mapper/ -v -run TestEnrichedCountAbove400 -count=1
```

Log the before/after numbers for BUILD_HISTORY.md.

**Step 4: Commit any remaining changes and verify clean working tree**

```bash
git status --short
git log --oneline -5
```

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| ExpectedNames entries (registry baseline) | 299 | ~400+ |
| ExpectedNames entries (with YAML enrichment) | 299 | ~550+ |
| Vocabulary YAML terms | 0 | ~100 terms across 7 slots |
| False cognate definitions | 0 | ~10 warnings (stored, not acted on) |
| New Go files | 0 | 2 (vocabulary.go, vocabulary_test.go) |
| New YAML files | 0 | 1 (vocabulary.yaml) |
| Test count (mapper package) | ~11 | ~20 |
