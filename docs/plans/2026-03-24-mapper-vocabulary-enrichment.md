# Mapper Vocabulary Enrichment (D1) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the mapper registry's ExpectedNames from ~299 to ~600+ entries using the pension glossary crosswalk, externalized into a YAML vocabulary file loaded at init via `//go:embed`.

**Architecture:** New `vocabulary.go` file parses `vocabulary.yaml` via embedded bytes, merges terms into registry slots at `NewRegistry()` time. Two new slots (`purchased_years`, `military_service_years`) added to the service-credit template. False cognate definitions stored in YAML for D2 but not enforced yet.

**Tech Stack:** Go, `gopkg.in/yaml.v3` (already in go.mod), `//go:embed`

**Reference files:**
- Source glossary: `docs/pension-glossary.md` (25-system crosswalk)
- Design doc: `docs/plans/2026-03-24-pension-glossary-integration-design.md`
- Current registry: `platform/migration/mapper/registry.go` (~299 ExpectedNames across 10 pension templates)
- Matcher: `platform/migration/mapper/matcher.go` (4-pass matching: exact → pattern → similarity → type-only)
- Template types: `platform/migration/mapper/template.go` (MappingTemplate, TemplateSlot structs)
- Existing tests: `platform/migration/mapper/registry_test.go`, `matcher_test.go`

---

### Task 1: Create vocabulary.yaml

**Files:**
- Create: `domains/pension/terminology/vocabulary.yaml`

**Step 1: Create the directory**

```bash
mkdir -p domains/pension/terminology
```

**Step 2: Write vocabulary.yaml**

Extract terms from `docs/pension-glossary.md` into structured YAML. The format is:

```yaml
# concept-tag:
#   slot_name:
#     terms: [list of lowercase expected names]
#     false_cognates: [list of {term, warning, risk} for D2]
```

**Concept tags to populate** (mapped to existing registry templates):

| YAML section | Registry concept tag | Slots to enrich |
|---|---|---|
| `service-credit` | `service-credit` | `credited_years_total` (+12), `purchased_years` (NEW +33), `military_service_years` (NEW +9), `transferred_service` (NEW +10), `service_type` (+7) |
| `salary-history` | `salary-history` | `gross_amount` (+11), `pensionable_amount` (+7), `period_start` (+3) |
| `benefit-payment` | `benefit-payment` | `gross_amount` (+5), `pay_period_date` (+2) |
| `employee-master` | `employee-master` | `original_hire_date` (+3) |
| `benefit-deduction` | `benefit-deduction` | `ee_amount` (+9), `er_amount` (+9) |
| `fac-abbreviations` | (maps to salary-history or future FAC table) | `salary_average` (+19) |
| `contribution-accounts` | (maps to benefit-deduction or future account table) | `accumulated_balance` (+18) |

**Term extraction rules:**
- All terms lowercase, underscore-separated (matching registry convention)
- Include abbreviations as separate entries (e.g., `sc`, `cs`, `yos`, `psc`)
- Include false cognate definitions with `warning` and `risk` fields
- Source: Layer 1 term tables, Layer 2 clusters, Layer 3 crosswalk from glossary
- Do NOT include terms already in registry.go base arrays — vocabulary.go will deduplicate at merge

**Key false cognates to define** (8 from design doc):

| Term | Risk | Relevant slots |
|---|---|---|
| `membership_service` | HIGH | credited_years_total |
| `service_credit` (dual meaning) | HIGH | credited_years_total |
| `prior_service` | MEDIUM | purchased_years |
| `allowable_service` | MEDIUM | credited_years_total |
| `afc` | HIGH | salary_average |
| `fas` | MEDIUM | salary_average |
| `updated_service_credits` | HIGH | (TMRS-only, no slot — warn only) |
| `prior_service_credit` | HIGH | purchased_years |

**Step 3: Validate YAML parses**

```bash
cd platform/migration && go test -run TestVocabularyLoads -v
```

(This test doesn't exist yet — it's created in Task 3.)

**Step 4: Commit**

```bash
git add domains/pension/terminology/vocabulary.yaml
git commit -m "[pension/terminology] Add vocabulary.yaml — 25-system glossary crosswalk for mapper enrichment"
```

---

### Task 2: Add new slots to service-credit template in registry.go

**Files:**
- Modify: `platform/migration/mapper/registry.go:252-283` (service-credit template)

The service-credit template currently has 4 slots: `member_id`, `as_of_date`, `credited_years_total`, `service_type`. Add 3 new slots.

**Step 1: Write the failing test**

Add to `platform/migration/mapper/registry_test.go`:

```go
func TestServiceCreditHasNewSlots(t *testing.T) {
	r := NewRegistry()
	tmpl, ok := r.Get("service-credit")
	if !ok {
		t.Fatal("service-credit not found")
	}

	wantSlots := []string{"purchased_years", "military_service_years", "transferred_service"}
	slotMap := make(map[string]bool)
	for _, slot := range tmpl.Slots {
		slotMap[slot.CanonicalColumn] = true
	}

	for _, want := range wantSlots {
		if !slotMap[want] {
			t.Errorf("service-credit missing slot %q", want)
		}
	}
}
```

**Step 2: Run test to verify it fails**

```bash
cd platform/migration && go test ./mapper/ -run TestServiceCreditHasNewSlots -v
```

Expected: FAIL — slots don't exist yet.

**Step 3: Add new slots to registry.go**

In `registry.go`, inside the service-credit template (after the `service_type` slot), add:

```go
{
    CanonicalColumn: "purchased_years",
    DataTypeFamily:  "DECIMAL",
    Required:        false,
    ExpectedNames:   []string{"purchased_years", "purchased_service", "buy_back", "psc"},
},
{
    CanonicalColumn: "military_service_years",
    DataTypeFamily:  "DECIMAL",
    Required:        false,
    ExpectedNames:   []string{"military_service_years", "military_service", "userra_service"},
},
{
    CanonicalColumn: "transferred_service",
    DataTypeFamily:  "DECIMAL",
    Required:        false,
    ExpectedNames:   []string{"transferred_service", "reciprocal_service", "transfer_service"},
},
```

Note: These base ExpectedNames are minimal — vocabulary.go will merge in the full set from YAML.

**Step 4: Run test to verify it passes**

```bash
cd platform/migration && go test ./mapper/ -run TestServiceCreditHasNewSlots -v
```

Expected: PASS

**Step 5: Run all registry tests to check for regressions**

```bash
cd platform/migration && go test ./mapper/ -run TestAll -v
```

Expected: All existing tests still pass. Note: `TestAllEighteenConceptTagsRegistered` should still pass (we added slots, not new templates).

**Step 6: Commit**

```bash
git add platform/migration/mapper/registry.go platform/migration/mapper/registry_test.go
git commit -m "[migration/mapper] Add purchased_years, military_service_years, transferred_service slots to service-credit template"
```

---

### Task 3: Create vocabulary.go — YAML loader + merge logic

**Files:**
- Create: `platform/migration/mapper/vocabulary.go`

**Step 1: Write the failing test**

Create `platform/migration/mapper/vocabulary_test.go`:

```go
package mapper

import (
	"testing"
)

func TestVocabularyLoads(t *testing.T) {
	vocab, err := LoadVocabulary()
	if err != nil {
		t.Fatalf("LoadVocabulary() error: %v", err)
	}
	if len(vocab) == 0 {
		t.Fatal("vocabulary is empty")
	}
}

func TestVocabularyHasServiceCredit(t *testing.T) {
	vocab, err := LoadVocabulary()
	if err != nil {
		t.Fatalf("LoadVocabulary() error: %v", err)
	}
	sc, ok := vocab["service-credit"]
	if !ok {
		t.Fatal("vocabulary missing service-credit section")
	}
	cyt, ok := sc["credited_years_total"]
	if !ok {
		t.Fatal("service-credit missing credited_years_total slot")
	}
	if len(cyt.Terms) < 10 {
		t.Errorf("expected at least 10 terms for credited_years_total, got %d", len(cyt.Terms))
	}
}

func TestVocabularyTermsAreLowercase(t *testing.T) {
	vocab, err := LoadVocabulary()
	if err != nil {
		t.Fatalf("LoadVocabulary() error: %v", err)
	}
	for section, slots := range vocab {
		for slotName, slot := range slots {
			for _, term := range slot.Terms {
				if term != strings.ToLower(term) {
					t.Errorf("section %q slot %q has non-lowercase term %q",
						section, slotName, term)
				}
			}
		}
	}
}

func TestMergeVocabularyExpandsRegistry(t *testing.T) {
	r := NewRegistry()
	tmpl, _ := r.Get("service-credit")

	// Count base ExpectedNames for credited_years_total
	var baseCYT int
	for _, slot := range tmpl.Slots {
		if slot.CanonicalColumn == "credited_years_total" {
			baseCYT = len(slot.ExpectedNames)
			break
		}
	}

	// After merge (which happens in NewRegistry), should be larger
	if baseCYT < 10 {
		t.Errorf("credited_years_total should have 10+ names after merge, got %d", baseCYT)
	}
}

func TestMergeDeduplicates(t *testing.T) {
	r := NewRegistry()
	tmpl, _ := r.Get("service-credit")

	for _, slot := range tmpl.Slots {
		seen := make(map[string]bool)
		for _, name := range slot.ExpectedNames {
			if seen[name] {
				t.Errorf("slot %q has duplicate expected name %q", slot.CanonicalColumn, name)
			}
			seen[name] = true
		}
	}
}

func TestVocabularyFalseCognatesPresent(t *testing.T) {
	vocab, err := LoadVocabulary()
	if err != nil {
		t.Fatalf("LoadVocabulary() error: %v", err)
	}
	sc := vocab["service-credit"]
	cyt := sc["credited_years_total"]
	if len(cyt.FalseCognates) == 0 {
		t.Error("credited_years_total should have false cognate definitions")
	}
	// Verify membership_service is flagged
	found := false
	for _, fc := range cyt.FalseCognates {
		if fc.Term == "membership_service" {
			found = true
			if fc.Risk != "HIGH" {
				t.Errorf("membership_service should be HIGH risk, got %q", fc.Risk)
			}
		}
	}
	if !found {
		t.Error("membership_service false cognate not found in vocabulary")
	}
}
```

Note: add `"strings"` to the import block for the lowercase test.

**Step 2: Run tests to verify they fail**

```bash
cd platform/migration && go test ./mapper/ -run TestVocabulary -v
```

Expected: FAIL — `LoadVocabulary` doesn't exist.

**Step 3: Implement vocabulary.go**

Create `platform/migration/mapper/vocabulary.go`:

```go
package mapper

import (
	"embed"
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

//go:embed vocabulary.yaml
var vocabData []byte

// VocabSlot holds terms and false cognates for one canonical slot.
type VocabSlot struct {
	Terms         []string       `yaml:"terms"`
	FalseCognates []FalseCognate `yaml:"false_cognates,omitempty"`
}

// FalseCognate defines a term that looks equivalent but differs across systems.
type FalseCognate struct {
	Term    string `yaml:"term"`
	Warning string `yaml:"warning"`
	Risk    string `yaml:"risk"` // HIGH, MEDIUM, LOW
}

// Vocabulary maps concept-tag → slot-name → VocabSlot.
type Vocabulary map[string]map[string]VocabSlot

// LoadVocabulary parses the embedded vocabulary.yaml.
func LoadVocabulary() (Vocabulary, error) {
	var vocab Vocabulary
	if err := yaml.Unmarshal(vocabData, &vocab); err != nil {
		return nil, fmt.Errorf("parse vocabulary.yaml: %w", err)
	}
	return vocab, nil
}

// mergeVocabulary expands ExpectedNames in registry slots using vocabulary terms.
// It matches vocabulary sections to registry templates by concept tag, then
// matches vocabulary slot names to template slot CanonicalColumn names.
// Duplicate terms are removed. Terms not matching any slot are silently ignored
// (they may map to future templates like fac-abbreviations or contribution-accounts).
func mergeVocabulary(r *Registry) error {
	vocab, err := LoadVocabulary()
	if err != nil {
		return err
	}

	for section, slots := range vocab {
		tmpl, ok := r.Get(section)
		if !ok {
			continue // section like fac-abbreviations has no template yet
		}

		for slotName, vocabSlot := range slots {
			for i, ts := range tmpl.Slots {
				if ts.CanonicalColumn != slotName {
					continue
				}
				// Build set of existing names
				existing := make(map[string]bool, len(ts.ExpectedNames))
				for _, n := range ts.ExpectedNames {
					existing[n] = true
				}
				// Append new terms (deduplicated)
				for _, term := range vocabSlot.Terms {
					t := strings.ToLower(term)
					if !existing[t] {
						tmpl.Slots[i].ExpectedNames = append(tmpl.Slots[i].ExpectedNames, t)
						existing[t] = true
					}
				}
				break
			}
		}

		// Re-register the modified template
		r.register(tmpl)
	}

	return nil
}
```

**Important:** The `//go:embed vocabulary.yaml` directive requires the file to be in the same package directory. We need a symlink or copy step. Since Go embed paths are relative to the source file, we need vocabulary.yaml in `platform/migration/mapper/`. Two options:

**Option A (simpler):** Place vocabulary.yaml directly in `platform/migration/mapper/` instead of `domains/pension/terminology/`.

**Option B (keeps YAML in domains/):** Use `//go:embed` with a relative path from a parent package, or copy at build time.

**Decision: Use Option A.** The vocabulary.yaml lives in `platform/migration/mapper/vocabulary.yaml` for Go embed simplicity. The `domains/pension/terminology/` location from the design doc was aspirational — the actual file must be co-located with the Go source for `//go:embed`. Add a comment at top of YAML pointing back to the glossary source.

**Revised Step 1 location:** vocabulary.yaml goes to `platform/migration/mapper/vocabulary.yaml`.

**Step 4: Hook mergeVocabulary into NewRegistry**

Modify `platform/migration/mapper/registry.go:11-15` — update `NewRegistry()`:

```go
func NewRegistry() *Registry {
	r := &Registry{templates: make(map[string]MappingTemplate)}
	r.registerAll()
	// Merge external vocabulary terms into registry slots.
	// Errors are non-fatal — registry works with base names if YAML fails.
	_ = mergeVocabulary(r)
	return r
}
```

**Step 5: Move vocabulary.yaml to mapper package directory**

```bash
mv domains/pension/terminology/vocabulary.yaml platform/migration/mapper/vocabulary.yaml
rmdir domains/pension/terminology  # if empty
```

**Step 6: Run vocabulary tests**

```bash
cd platform/migration && go test ./mapper/ -run TestVocabulary -v
```

Expected: All PASS

**Step 7: Run ALL mapper tests to verify no regressions**

```bash
cd platform/migration && go test ./mapper/ -v -count=1
```

Expected: All existing tests pass. The merge adds names but doesn't remove any, so pattern matches only get better.

**Step 8: Commit**

```bash
git add platform/migration/mapper/vocabulary.go platform/migration/mapper/vocabulary_test.go platform/migration/mapper/vocabulary.yaml platform/migration/mapper/registry.go
git commit -m "[migration/mapper] Add vocabulary loader — merges glossary terms into registry at init"
```

---

### Task 4: Count verification — before/after ExpectedNames

**Files:**
- Create: `platform/migration/mapper/vocabulary_count_test.go`

**Step 1: Write count verification test**

```go
package mapper

import "testing"

func TestExpectedNameCountAfterMerge(t *testing.T) {
	r := NewRegistry()
	total := 0
	for _, tag := range r.Tags() {
		tmpl, _ := r.Get(tag)
		for _, slot := range tmpl.Slots {
			total += len(slot.ExpectedNames)
		}
	}
	// Base registry has ~299. After merge should be 450+.
	// Exact count depends on vocabulary.yaml content.
	t.Logf("Total ExpectedNames after merge: %d", total)
	if total < 450 {
		t.Errorf("expected at least 450 ExpectedNames after vocabulary merge, got %d (base was ~299)", total)
	}
}

func TestServiceCreditEnrichedNames(t *testing.T) {
	r := NewRegistry()
	tmpl, _ := r.Get("service-credit")

	for _, slot := range tmpl.Slots {
		t.Logf("slot %q: %d names", slot.CanonicalColumn, len(slot.ExpectedNames))
	}

	// credited_years_total: base 6 + ~14 from vocabulary = 20+
	for _, slot := range tmpl.Slots {
		if slot.CanonicalColumn == "credited_years_total" && len(slot.ExpectedNames) < 15 {
			t.Errorf("credited_years_total should have 15+ names after merge, got %d", len(slot.ExpectedNames))
		}
		if slot.CanonicalColumn == "purchased_years" && len(slot.ExpectedNames) < 15 {
			t.Errorf("purchased_years should have 15+ names after merge, got %d", len(slot.ExpectedNames))
		}
		if slot.CanonicalColumn == "military_service_years" && len(slot.ExpectedNames) < 8 {
			t.Errorf("military_service_years should have 8+ names after merge, got %d", len(slot.ExpectedNames))
		}
	}
}

func TestSalaryHistoryEnrichedNames(t *testing.T) {
	r := NewRegistry()
	tmpl, _ := r.Get("salary-history")
	for _, slot := range tmpl.Slots {
		if slot.CanonicalColumn == "gross_amount" && len(slot.ExpectedNames) < 15 {
			t.Errorf("gross_amount should have 15+ names after merge, got %d", len(slot.ExpectedNames))
		}
	}
}

func TestContributionEnrichedNames(t *testing.T) {
	r := NewRegistry()
	tmpl, _ := r.Get("benefit-deduction")
	for _, slot := range tmpl.Slots {
		if slot.CanonicalColumn == "ee_amount" && len(slot.ExpectedNames) < 12 {
			t.Errorf("ee_amount should have 12+ names after merge, got %d", len(slot.ExpectedNames))
		}
	}
}
```

**Step 2: Run tests**

```bash
cd platform/migration && go test ./mapper/ -run TestExpectedNameCount -v
cd platform/migration && go test ./mapper/ -run TestServiceCreditEnriched -v
cd platform/migration && go test ./mapper/ -run TestSalaryHistoryEnriched -v
cd platform/migration && go test ./mapper/ -run TestContributionEnriched -v
```

Expected: All PASS with logged counts showing the enrichment.

**Step 3: If any counts are too low, add terms to vocabulary.yaml**

Iterate: check glossary, add missing terms, re-run tests.

**Step 4: Commit**

```bash
git add platform/migration/mapper/vocabulary_count_test.go
git commit -m "[migration/mapper] Add vocabulary count verification tests"
```

---

### Task 5: Matcher confidence improvement test

**Files:**
- Modify: `platform/migration/mapper/matcher_test.go`

**Step 1: Write confidence improvement tests**

Add test cases that simulate real pension system column names from the glossary. These columns should now match at Pass 2 (confidence 0.9) instead of falling to Pass 3/4.

```go
func TestMatchColumns_GlossaryTerms_ServiceCredit(t *testing.T) {
	// Simulate a source with glossary terms that should now match at Pass 2
	source := []SourceColumn{
		{Name: "MBR_NBR", DataType: "integer", IsKey: true},
		{Name: "EFFECTIVE_DATE", DataType: "date"},
		{Name: "CREDITABLE_SERVICE", DataType: "decimal(6,2)"}, // NHRS/FRS term
		{Name: "SVC_TYP_CD", DataType: "varchar(10)"},
	}
	reg := NewRegistry()
	tmpl, _ := reg.Get("service-credit")
	matches := MatchColumns(source, tmpl)

	// CREDITABLE_SERVICE should match credited_years_total at confidence 0.9 (pattern match)
	for _, m := range matches {
		if m.SourceColumn == "CREDITABLE_SERVICE" {
			if m.Confidence < 0.9 {
				t.Errorf("CREDITABLE_SERVICE should match at 0.9 (pattern), got %.2f (%s)",
					m.Confidence, m.MatchMethod)
			}
			if m.CanonicalColumn != "credited_years_total" {
				t.Errorf("CREDITABLE_SERVICE should map to credited_years_total, got %q",
					m.CanonicalColumn)
			}
			return
		}
	}
	t.Error("CREDITABLE_SERVICE not matched at all")
}

func TestMatchColumns_GlossaryTerms_SalaryHistory(t *testing.T) {
	source := []SourceColumn{
		{Name: "MBR_NBR", DataType: "integer", IsKey: true},
		{Name: "PAY_START_DATE", DataType: "date"},
		{Name: "PENSIONABLE_COMPENSATION", DataType: "decimal(12,2)"}, // CalPERS PEPRA term
		{Name: "COVERED_WAGES", DataType: "decimal(12,2)"},            // IPERS term
	}
	reg := NewRegistry()
	tmpl, _ := reg.Get("salary-history")
	matches := MatchColumns(source, tmpl)

	assertMatchMethod(t, matches, "PENSIONABLE_COMPENSATION", "pattern")
	assertMatchMethod(t, matches, "COVERED_WAGES", "pattern")
}

func TestMatchColumns_GlossaryTerms_Contributions(t *testing.T) {
	source := []SourceColumn{
		{Name: "MBR_NBR", DataType: "integer", IsKey: true},
		{Name: "PAY_PERIOD", DataType: "date"},
		{Name: "MEMBER_DEPOSITS", DataType: "decimal(10,2)"},     // TMRS term
		{Name: "CITY_CONTRIBUTIONS", DataType: "decimal(10,2)"},  // HMEPS term
		{Name: "MONTHLY", DataType: "varchar(10)"},
	}
	reg := NewRegistry()
	tmpl, _ := reg.Get("benefit-deduction")
	matches := MatchColumns(source, tmpl)

	assertMatchMethod(t, matches, "MEMBER_DEPOSITS", "pattern")
	assertMatchMethod(t, matches, "CITY_CONTRIBUTIONS", "pattern")
}
```

Add the `assertMatchMethod` helper:

```go
func assertMatchMethod(t *testing.T, matches []ColumnMatch, sourceCol, wantMethod string) {
	t.Helper()
	srcLower := strings.ToLower(sourceCol)
	for _, m := range matches {
		if strings.ToLower(m.SourceColumn) == srcLower {
			if m.MatchMethod != wantMethod {
				t.Errorf("%s: expected match method %q, got %q (confidence %.2f)",
					sourceCol, wantMethod, m.MatchMethod, m.Confidence)
			}
			return
		}
	}
	t.Errorf("%s not matched at all", sourceCol)
}
```

**Step 2: Run the new tests**

```bash
cd platform/migration && go test ./mapper/ -run TestMatchColumns_GlossaryTerms -v
```

Expected: All PASS — glossary terms now match at Pass 2 (pattern, 0.9 confidence).

**Step 3: Run full test suite**

```bash
cd platform/migration && go test ./mapper/ -v -count=1
```

Expected: All tests pass, zero regressions.

**Step 4: Commit**

```bash
git add platform/migration/mapper/matcher_test.go
git commit -m "[migration/mapper] Add glossary term confidence improvement tests"
```

---

### Task 6: Copy glossary into repo + final verification

**Files:**
- Verify: `docs/pension-glossary.md` (should already be there from session start)

**Step 1: Verify glossary is in repo**

```bash
ls -la docs/pension-glossary.md
```

**Step 2: Run full migration package tests**

```bash
cd platform/migration && go test ./... -short -count=1
```

Expected: All packages pass.

**Step 3: Run frontend typecheck (no frontend changes, but verify no breakage)**

```bash
cd frontend && npx tsc --noEmit
```

**Step 4: Commit glossary**

```bash
git add docs/pension-glossary.md
git commit -m "[docs] Add pension terminology glossary — 25-system crosswalk"
```

---

### Task 7: Final commit + session summary

**Step 1: Review all changes**

```bash
git log --oneline HEAD~6..HEAD
git diff --stat main..HEAD
```

**Step 2: Update BUILD_HISTORY.md**

Add session entry documenting:
- vocabulary.yaml created with ~X terms across Y sections
- 3 new service-credit slots added
- vocabulary.go with embed + merge
- Before/after ExpectedNames count
- All tests passing

**Step 3: Commit BUILD_HISTORY.md**

```bash
git add BUILD_HISTORY.md
git commit -m "[docs] Session 32 build history — mapper vocabulary enrichment"
```

---

## Summary

| Task | What | Files | Tests |
|------|------|-------|-------|
| 1 | Create vocabulary.yaml | `platform/migration/mapper/vocabulary.yaml` | (validated in Task 3) |
| 2 | Add new service-credit slots | `registry.go`, `registry_test.go` | `TestServiceCreditHasNewSlots` |
| 3 | vocabulary.go loader + merge | `vocabulary.go`, `vocabulary_test.go`, `registry.go` | 6 new tests |
| 4 | Count verification | `vocabulary_count_test.go` | 4 new tests |
| 5 | Confidence improvement tests | `matcher_test.go` | 3 new test functions + helper |
| 6 | Glossary + final verification | `docs/pension-glossary.md` | Full suite run |
| 7 | Build history + session summary | `BUILD_HISTORY.md` | — |

**Total new tests:** ~13
**Total new/modified files:** 7
