# Rules & Test Explorer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Rules Explorer (with inline test status) and Demo Cases viewer in the KB service backend and React frontend, providing full traceability from YAML rule definitions through Go test execution to UI display.

**Architecture:** Extend the existing KB service (port 8087) with file-backed endpoints that parse YAML rules, `go test -json` reports, and demo case JSON fixtures. Frontend adds two new view modes (`rules-explorer`, `demo-cases`) with structured rule logic renderers and cross-linked navigation.

**Tech Stack:** Go 1.22 + `gopkg.in/yaml.v3` (backend), React + TypeScript + React Query + Tailwind (frontend)

**Design doc:** `docs/plans/2026-03-19-rules-test-explorer-design.md`

---

## Task 1: Go Types for YAML Rule Definitions

**Files:**
- Create: `platform/knowledgebase/rules/types.go`
- Create: `platform/knowledgebase/rules/types_test.go`

**Step 1: Create the rules package directory**

```bash
mkdir -p platform/knowledgebase/rules
```

**Step 2: Write the types**

```go
// platform/knowledgebase/rules/types.go
package rules

// RuleFile represents the top-level structure of a YAML rule definition file.
type RuleFile struct {
	Domain      string     `yaml:"domain" json:"domain"`
	Version     string     `yaml:"version" json:"version"`
	EffDate     string     `yaml:"effective_date" json:"effectiveDate"`
	Authority   string     `yaml:"authority" json:"authority"`
	Governance  GovHeader  `yaml:"governance" json:"governance"`
	Rules       []Rule     `yaml:"rules" json:"rules"`
}

type GovHeader struct {
	Owner       string `yaml:"owner" json:"owner"`
	Approver    string `yaml:"approver" json:"approver"`
	ReviewCycle string `yaml:"review_cycle" json:"reviewCycle"`
}

type Rule struct {
	ID              string          `yaml:"id" json:"id"`
	Name            string          `yaml:"name" json:"name"`
	Description     string          `yaml:"description" json:"description"`
	SourceReference SourceRef       `yaml:"source_reference" json:"sourceReference"`
	AppliesTo       AppliesTo       `yaml:"applies_to" json:"appliesTo"`
	Inputs          []RuleParam     `yaml:"inputs" json:"inputs"`
	Logic           RuleLogic       `yaml:"logic" json:"logic"`
	Output          []RuleOutput    `yaml:"output" json:"output"`
	Dependencies    []string        `yaml:"dependencies" json:"dependencies"`
	Tags            []string        `yaml:"tags" json:"tags"`
	TestCases       []RuleTestCase  `yaml:"test_cases" json:"testCases"`
	Governance      RuleGovernance  `yaml:"governance" json:"governance"`
	TestStatus      *TestStatus     `yaml:"-" json:"testStatus,omitempty"`
}

type SourceRef struct {
	Document     string `yaml:"document" json:"document"`
	Section      string `yaml:"section" json:"section"`
	LastVerified string `yaml:"last_verified" json:"lastVerified"`
}

type AppliesTo struct {
	Tiers       []string `yaml:"tiers" json:"tiers"`
	MemberTypes []string `yaml:"member_types" json:"memberTypes"`
}

type RuleParam struct {
	Name        string  `yaml:"name" json:"name"`
	Type        string  `yaml:"type" json:"type"`
	Description string  `yaml:"description" json:"description"`
	Constraints *string `yaml:"constraints,omitempty" json:"constraints,omitempty"`
}

type RuleLogic struct {
	Type       string      `yaml:"type" json:"type"` // conditional, formula, procedural, lookup_table
	Conditions []Condition `yaml:"conditions,omitempty" json:"conditions,omitempty"`
	Formula    *string     `yaml:"formula,omitempty" json:"formula,omitempty"`
	Steps      []string    `yaml:"steps,omitempty" json:"steps,omitempty"`
	Table      []TableRow  `yaml:"table,omitempty" json:"table,omitempty"`
	Notes      []string    `yaml:"notes,omitempty" json:"notes,omitempty"`
}

type Condition struct {
	Condition string                 `yaml:"condition" json:"condition"`
	Result    map[string]interface{} `yaml:"result" json:"result"`
	Notes     []string               `yaml:"notes,omitempty" json:"notes,omitempty"`
}

type TableRow struct {
	Key    string                 `yaml:"key" json:"key"`
	Values map[string]interface{} `yaml:"values" json:"values"`
}

type RuleOutput struct {
	Field       string `yaml:"field" json:"field"`
	Type        string `yaml:"type" json:"type"`
	Description string `yaml:"description,omitempty" json:"description,omitempty"`
}

type RuleTestCase struct {
	Name        string                 `yaml:"name" json:"name"`
	DemoCaseRef string                 `yaml:"demo_case_ref,omitempty" json:"demoCaseRef,omitempty"`
	Description string                 `yaml:"description,omitempty" json:"description,omitempty"`
	Inputs      map[string]interface{} `yaml:"inputs" json:"inputs"`
	Expected    map[string]interface{} `yaml:"expected" json:"expected"`
}

type RuleGovernance struct {
	Status        string `yaml:"status" json:"status"`
	LastReviewed  string `yaml:"last_reviewed" json:"lastReviewed"`
	ReviewedBy    string `yaml:"reviewed_by" json:"reviewedBy"`
	EffectiveDate string `yaml:"effective_date" json:"effectiveDate"`
}

type TestStatus struct {
	Total   int    `json:"total"`
	Passing int    `json:"passing"`
	Failing int    `json:"failing"`
	Skipped int    `json:"skipped"`
	LastRun string `json:"lastRun"`
}
```

**Step 3: Write a basic test to verify types compile and can be instantiated**

```go
// platform/knowledgebase/rules/types_test.go
package rules

import "testing"

func TestRuleTypesCompile(t *testing.T) {
	r := Rule{
		ID:   "RULE-TEST",
		Name: "Test Rule",
		Logic: RuleLogic{
			Type: "conditional",
			Conditions: []Condition{
				{Condition: "x > 5", Result: map[string]interface{}{"eligible": true}},
			},
		},
	}
	if r.ID != "RULE-TEST" {
		t.Errorf("expected RULE-TEST, got %s", r.ID)
	}
	if r.Logic.Type != "conditional" {
		t.Errorf("expected conditional, got %s", r.Logic.Type)
	}
}
```

**Step 4: Run the test**

```bash
cd platform/knowledgebase && go test ./rules/... -v -count=1
```

Expected: PASS

**Step 5: Commit**

```bash
git add platform/knowledgebase/rules/
git commit -m "[platform/knowledgebase] Add Go types for YAML rule definitions"
```

---

## Task 2: YAML Rule Loader

**Files:**
- Modify: `platform/knowledgebase/go.mod` (add yaml.v3 dependency)
- Create: `platform/knowledgebase/rules/loader.go`
- Create: `platform/knowledgebase/rules/loader_test.go`
- Create: `platform/knowledgebase/testdata/test-rule.yaml` (test fixture)

**Step 1: Add YAML dependency**

```bash
cd platform/knowledgebase && go get gopkg.in/yaml.v3
```

**Step 2: Create a minimal test fixture YAML file**

```yaml
# platform/knowledgebase/testdata/test-rule.yaml
domain: "test-domain"
version: "1.0.0"
effective_date: "2026-01-01"
authority: "Test Authority"
governance:
  owner: "Test Owner"
  approver: "Test Approver"
  review_cycle: "annual"
rules:
  - id: "RULE-TEST-01"
    name: "Test Rule One"
    description: "A test rule for unit testing"
    source_reference:
      document: "TEST"
      section: "§1.1"
      last_verified: "2026-01-01"
    applies_to:
      tiers: ["tier_1", "tier_2"]
      member_types: ["active"]
    inputs:
      - name: "age"
        type: "number"
        description: "Age in years"
    logic:
      type: "conditional"
      conditions:
        - condition: "age >= 65"
          result:
            eligible: true
    output:
      - field: "eligible"
        type: "boolean"
    dependencies: []
    tags: ["test"]
    test_cases:
      - name: "Happy path"
        inputs:
          age: 65
        expected:
          eligible: true
      - name: "Below threshold"
        inputs:
          age: 64
        expected:
          eligible: false
    governance:
      status: "approved"
      last_reviewed: "2026-01-01"
      reviewed_by: "Test Reviewer"
      effective_date: "2026-01-01"
  - id: "RULE-TEST-02"
    name: "Test Rule Two"
    description: "A second test rule"
    source_reference:
      document: "TEST"
      section: "§1.2"
      last_verified: "2026-01-01"
    applies_to:
      tiers: ["tier_3"]
      member_types: ["active"]
    inputs:
      - name: "service_years"
        type: "number"
        description: "Years of service"
    logic:
      type: "formula"
      formula: "benefit = salary * multiplier * service_years"
    output:
      - field: "benefit"
        type: "number"
    dependencies: ["RULE-TEST-01"]
    tags: ["test"]
    test_cases: []
    governance:
      status: "approved"
      last_reviewed: "2026-01-01"
      reviewed_by: "Test Reviewer"
      effective_date: "2026-01-01"
```

**Step 3: Write the failing test**

```go
// platform/knowledgebase/rules/loader_test.go
package rules

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadRulesFromDir(t *testing.T) {
	dir := filepath.Join("..", "testdata")
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		t.Skip("testdata directory not found")
	}

	allRules, err := LoadRulesFromDir(dir)
	if err != nil {
		t.Fatalf("LoadRulesFromDir failed: %v", err)
	}
	if len(allRules) != 2 {
		t.Errorf("expected 2 rules, got %d", len(allRules))
	}

	// Verify first rule
	var r1 *Rule
	for i := range allRules {
		if allRules[i].ID == "RULE-TEST-01" {
			r1 = &allRules[i]
			break
		}
	}
	if r1 == nil {
		t.Fatal("RULE-TEST-01 not found")
	}
	if r1.Name != "Test Rule One" {
		t.Errorf("expected 'Test Rule One', got %q", r1.Name)
	}
	if r1.Logic.Type != "conditional" {
		t.Errorf("expected conditional logic, got %q", r1.Logic.Type)
	}
	if len(r1.TestCases) != 2 {
		t.Errorf("expected 2 test cases, got %d", len(r1.TestCases))
	}
	if len(r1.AppliesTo.Tiers) != 2 {
		t.Errorf("expected 2 tiers, got %d", len(r1.AppliesTo.Tiers))
	}
}

func TestLoadRulesFromDir_EmptyDir(t *testing.T) {
	dir := t.TempDir()
	allRules, err := LoadRulesFromDir(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(allRules) != 0 {
		t.Errorf("expected 0 rules from empty dir, got %d", len(allRules))
	}
}

func TestLoadRulesFromDir_NotExist(t *testing.T) {
	_, err := LoadRulesFromDir("/nonexistent/path")
	if err == nil {
		t.Error("expected error for nonexistent directory")
	}
}

func TestLoadRulesByDomain(t *testing.T) {
	dir := filepath.Join("..", "testdata")
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		t.Skip("testdata directory not found")
	}

	index, err := LoadRulesByDomain(dir)
	if err != nil {
		t.Fatalf("LoadRulesByDomain failed: %v", err)
	}
	rules, ok := index["test-domain"]
	if !ok {
		t.Fatal("test-domain not found in index")
	}
	if len(rules) != 2 {
		t.Errorf("expected 2 rules in test-domain, got %d", len(rules))
	}
}
```

**Step 4: Run tests to verify they fail**

```bash
cd platform/knowledgebase && go test ./rules/... -v -count=1
```

Expected: FAIL — `LoadRulesFromDir` undefined

**Step 5: Write the loader implementation**

```go
// platform/knowledgebase/rules/loader.go
package rules

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// LoadRulesFromDir reads all .yaml files in dir and returns a flat slice of all rules.
func LoadRulesFromDir(dir string) ([]Rule, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("reading rules directory %s: %w", dir, err)
	}

	var all []Rule
	for _, entry := range entries {
		if entry.IsDir() || !isYAML(entry.Name()) {
			continue
		}
		path := filepath.Join(dir, entry.Name())
		rules, err := loadFile(path)
		if err != nil {
			return nil, fmt.Errorf("parsing %s: %w", entry.Name(), err)
		}
		all = append(all, rules...)
	}
	return all, nil
}

// LoadRulesByDomain returns rules grouped by their domain field.
func LoadRulesByDomain(dir string) (map[string][]Rule, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("reading rules directory %s: %w", dir, err)
	}

	index := make(map[string][]Rule)
	for _, entry := range entries {
		if entry.IsDir() || !isYAML(entry.Name()) {
			continue
		}
		path := filepath.Join(dir, entry.Name())
		rf, err := loadRuleFile(path)
		if err != nil {
			return nil, fmt.Errorf("parsing %s: %w", entry.Name(), err)
		}
		index[rf.Domain] = append(index[rf.Domain], rf.Rules...)
	}
	return index, nil
}

// LoadRuleFile reads a single YAML file and returns the parsed RuleFile.
func LoadRuleFile(path string) (*RuleFile, error) {
	return loadRuleFile(path)
}

func loadRuleFile(path string) (*RuleFile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var rf RuleFile
	if err := yaml.Unmarshal(data, &rf); err != nil {
		return nil, err
	}
	return &rf, nil
}

func loadFile(path string) ([]Rule, error) {
	rf, err := loadRuleFile(path)
	if err != nil {
		return nil, err
	}
	return rf.Rules, nil
}

func isYAML(name string) bool {
	lower := strings.ToLower(name)
	return strings.HasSuffix(lower, ".yaml") || strings.HasSuffix(lower, ".yml")
}
```

**Step 6: Run tests to verify they pass**

```bash
cd platform/knowledgebase && go test ./rules/... -v -count=1
```

Expected: PASS (all 4 tests)

**Step 7: Commit**

```bash
git add platform/knowledgebase/rules/loader.go platform/knowledgebase/rules/loader_test.go platform/knowledgebase/testdata/ platform/knowledgebase/go.mod platform/knowledgebase/go.sum
git commit -m "[platform/knowledgebase] Add YAML rule loader with file-backed parsing"
```

---

## Task 3: Test Report Parser

**Files:**
- Create: `platform/knowledgebase/rules/testreport.go`
- Create: `platform/knowledgebase/rules/testreport_test.go`
- Create: `platform/knowledgebase/testdata/test-report.json`
- Create: `platform/knowledgebase/testdata/test-rule-mapping.json`

**Step 1: Create test fixtures**

`go test -json` outputs one JSON line per event. Create a minimal fixture:

```json
{"Time":"2026-03-19T14:30:00Z","Action":"run","Package":"github.com/noui/platform/intelligence/rules","Test":"TestEvaluateEligibility/Rule_of_75_Robert"}
{"Time":"2026-03-19T14:30:00.01Z","Action":"pass","Package":"github.com/noui/platform/intelligence/rules","Test":"TestEvaluateEligibility/Rule_of_75_Robert","Elapsed":0.012}
{"Time":"2026-03-19T14:30:00.02Z","Action":"run","Package":"github.com/noui/platform/intelligence/rules","Test":"TestEvaluateEligibility/Rule_of_75_purchased_excluded"}
{"Time":"2026-03-19T14:30:00.03Z","Action":"pass","Package":"github.com/noui/platform/intelligence/rules","Test":"TestEvaluateEligibility/Rule_of_75_purchased_excluded","Elapsed":0.008}
{"Time":"2026-03-19T14:30:00.04Z","Action":"run","Package":"github.com/noui/platform/intelligence/rules","Test":"TestCalculateBenefit/Case2_Jennifer_reduced"}
{"Time":"2026-03-19T14:30:00.05Z","Action":"fail","Package":"github.com/noui/platform/intelligence/rules","Test":"TestCalculateBenefit/Case2_Jennifer_reduced","Elapsed":0.015}
{"Time":"2026-03-19T14:30:00.06Z","Action":"run","Package":"github.com/noui/platform/intelligence/rules","Test":"TestCalculateIPR/Case1_Robert"}
{"Time":"2026-03-19T14:30:00.07Z","Action":"skip","Package":"github.com/noui/platform/intelligence/rules","Test":"TestCalculateIPR/Case1_Robert","Elapsed":0.001}
```

Mapping file:

```json
{
  "TestEvaluateEligibility/Rule_of_75_Robert": "RULE-RULE-OF-75",
  "TestEvaluateEligibility/Rule_of_75_purchased_excluded": "RULE-RULE-OF-75",
  "TestCalculateBenefit/Case2_Jennifer_reduced": "RULE-BENEFIT-T2",
  "TestCalculateIPR/Case1_Robert": "RULE-IPR"
}
```

**Step 2: Write the failing test**

```go
// platform/knowledgebase/rules/testreport_test.go
package rules

import (
	"path/filepath"
	"testing"
)

func TestLoadTestReport(t *testing.T) {
	reportPath := filepath.Join("..", "testdata", "test-report.json")
	mappingPath := filepath.Join("..", "testdata", "test-rule-mapping.json")

	report, err := LoadTestReport(reportPath, mappingPath)
	if err != nil {
		t.Fatalf("LoadTestReport failed: %v", err)
	}

	if report.Total != 4 {
		t.Errorf("expected 4 total tests, got %d", report.Total)
	}
	if report.Passing != 2 {
		t.Errorf("expected 2 passing, got %d", report.Passing)
	}
	if report.Failing != 1 {
		t.Errorf("expected 1 failing, got %d", report.Failing)
	}
	if report.Skipped != 1 {
		t.Errorf("expected 1 skipped, got %d", report.Skipped)
	}

	// Check by-rule mapping
	r75 := report.ByRule["RULE-RULE-OF-75"]
	if r75.Total != 2 {
		t.Errorf("expected 2 tests for RULE-RULE-OF-75, got %d", r75.Total)
	}
	if r75.Passing != 2 {
		t.Errorf("expected 2 passing for RULE-RULE-OF-75, got %d", r75.Passing)
	}

	bt2 := report.ByRule["RULE-BENEFIT-T2"]
	if bt2.Failing != 1 {
		t.Errorf("expected 1 failing for RULE-BENEFIT-T2, got %d", bt2.Failing)
	}
}

func TestLoadTestReport_NoMapping(t *testing.T) {
	reportPath := filepath.Join("..", "testdata", "test-report.json")
	report, err := LoadTestReport(reportPath, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if report.Total != 4 {
		t.Errorf("expected 4 total, got %d", report.Total)
	}
	if len(report.ByRule) != 0 {
		t.Errorf("expected empty ByRule without mapping, got %d entries", len(report.ByRule))
	}
}

func TestLoadTestReport_NotExist(t *testing.T) {
	report, err := LoadTestReport("/nonexistent", "")
	if err != nil {
		t.Fatalf("unexpected error for missing report: %v", err)
	}
	if report.Total != 0 {
		t.Errorf("expected 0 total for missing report, got %d", report.Total)
	}
}
```

**Step 3: Run tests to verify they fail**

```bash
cd platform/knowledgebase && go test ./rules/... -v -count=1 -run TestLoadTestReport
```

Expected: FAIL — `LoadTestReport` undefined

**Step 4: Write the implementation**

```go
// platform/knowledgebase/rules/testreport.go
package rules

import (
	"bufio"
	"encoding/json"
	"os"
)

// TestReport is the parsed summary of a go test -json output file.
type TestReport struct {
	LastRun string                      `json:"lastRun"`
	Total   int                         `json:"total"`
	Passing int                         `json:"passing"`
	Failing int                         `json:"failing"`
	Skipped int                         `json:"skipped"`
	Tests   []TestResult                `json:"tests"`
	ByRule  map[string]RuleTestSummary  `json:"byRule"`
}

// RuleTestSummary aggregates test results for a single rule ID.
type RuleTestSummary struct {
	Total   int          `json:"total"`
	Passing int          `json:"passing"`
	Failing int          `json:"failing"`
	Skipped int          `json:"skipped"`
	Tests   []TestResult `json:"tests"`
}

// TestResult is a single test's outcome.
type TestResult struct {
	Name       string  `json:"name"`
	Status     string  `json:"status"` // pass, fail, skip
	DurationMs float64 `json:"durationMs"`
	RuleID     string  `json:"ruleId,omitempty"`
}

// goTestEvent matches the go test -json output line format.
type goTestEvent struct {
	Time    string  `json:"Time"`
	Action  string  `json:"Action"`
	Package string  `json:"Package"`
	Test    string  `json:"Test"`
	Elapsed float64 `json:"Elapsed"`
}

// LoadTestReport parses a go test -json report file and optional rule mapping.
// If reportPath does not exist, returns an empty report (not an error).
// If mappingPath is empty or missing, ByRule will be empty.
func LoadTestReport(reportPath, mappingPath string) (*TestReport, error) {
	report := &TestReport{
		ByRule: make(map[string]RuleTestSummary),
	}

	f, err := os.Open(reportPath)
	if err != nil {
		if os.IsNotExist(err) {
			return report, nil
		}
		return nil, err
	}
	defer f.Close()

	// Load mapping if provided
	mapping := make(map[string]string)
	if mappingPath != "" {
		mapping, _ = loadMapping(mappingPath) // ignore error — mapping is optional
	}

	// Parse go test -json line by line
	results := make(map[string]*TestResult) // test name → result
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		var ev goTestEvent
		if err := json.Unmarshal(scanner.Bytes(), &ev); err != nil {
			continue // skip malformed lines
		}
		if ev.Test == "" {
			continue // package-level events
		}

		switch ev.Action {
		case "run":
			results[ev.Test] = &TestResult{Name: ev.Test}
			if report.LastRun == "" || ev.Time > report.LastRun {
				report.LastRun = ev.Time
			}
		case "pass", "fail", "skip":
			tr, ok := results[ev.Test]
			if !ok {
				tr = &TestResult{Name: ev.Test}
				results[ev.Test] = tr
			}
			tr.Status = ev.Action
			tr.DurationMs = ev.Elapsed * 1000
			if ruleID, ok := mapping[ev.Test]; ok {
				tr.RuleID = ruleID
			}
		}
	}

	// Aggregate
	for _, tr := range results {
		if tr.Status == "" {
			continue // still running or incomplete
		}
		report.Tests = append(report.Tests, *tr)
		report.Total++
		switch tr.Status {
		case "pass":
			report.Passing++
		case "fail":
			report.Failing++
		case "skip":
			report.Skipped++
		}

		if tr.RuleID != "" {
			rs := report.ByRule[tr.RuleID]
			rs.Total++
			switch tr.Status {
			case "pass":
				rs.Passing++
			case "fail":
				rs.Failing++
			case "skip":
				rs.Skipped++
			}
			rs.Tests = append(rs.Tests, *tr)
			report.ByRule[tr.RuleID] = rs
		}
	}

	return report, nil
}

func loadMapping(path string) (map[string]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return make(map[string]string), err
	}
	var m map[string]string
	if err := json.Unmarshal(data, &m); err != nil {
		return make(map[string]string), err
	}
	return m, nil
}
```

**Step 5: Run tests**

```bash
cd platform/knowledgebase && go test ./rules/... -v -count=1
```

Expected: ALL PASS

**Step 6: Commit**

```bash
git add platform/knowledgebase/rules/testreport.go platform/knowledgebase/rules/testreport_test.go platform/knowledgebase/testdata/test-report.json platform/knowledgebase/testdata/test-rule-mapping.json
git commit -m "[platform/knowledgebase] Add go test -json report parser with rule mapping"
```

---

## Task 4: Demo Case Loader

**Files:**
- Create: `platform/knowledgebase/rules/democase.go`
- Create: `platform/knowledgebase/rules/democase_test.go`

The demo case JSON files have a complex structure. Rather than defining every nested field, we use a semi-structured approach: key fields are typed, the rest is `map[string]interface{}` for flexible rendering.

**Step 1: Write the failing test**

```go
// platform/knowledgebase/rules/democase_test.go
package rules

import (
	"path/filepath"
	"testing"
)

func TestLoadDemoCases(t *testing.T) {
	// Use the real demo-cases directory
	dir := filepath.Join("..", "..", "..", "domains", "pension", "demo-cases")
	cases, err := LoadDemoCases(dir)
	if err != nil {
		t.Fatalf("LoadDemoCases failed: %v", err)
	}
	if len(cases) == 0 {
		t.Fatal("expected at least 1 demo case, got 0")
	}

	// Each case should have an ID and member info
	for _, c := range cases {
		if c.CaseID == "" {
			t.Error("demo case has empty CaseID")
		}
		if c.Description == "" {
			t.Error("demo case has empty Description")
		}
	}
}

func TestLoadDemoCases_EmptyDir(t *testing.T) {
	dir := t.TempDir()
	cases, err := LoadDemoCases(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cases) != 0 {
		t.Errorf("expected 0, got %d", len(cases))
	}
}
```

**Step 2: Run test to verify it fails**

```bash
cd platform/knowledgebase && go test ./rules/... -v -count=1 -run TestLoadDemoCase
```

**Step 3: Write the implementation**

```go
// platform/knowledgebase/rules/democase.go
package rules

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// DemoCase represents a parsed demo case fixture.
// Uses semi-structured approach: key fields typed, nested calculation data
// kept as generic maps for flexible frontend rendering.
type DemoCase struct {
	CaseID      string                 `json:"caseId"`
	Description string                 `json:"description"`
	Member      DemoCaseMember         `json:"member"`
	RetDate     string                 `json:"retirementDate"`
	Inputs      map[string]interface{} `json:"inputs"`
	Expected    map[string]interface{} `json:"expected"`
	TestPoints  []string               `json:"testPoints"`
	Full        map[string]interface{} `json:"full"` // entire JSON for detail view
}

type DemoCaseMember struct {
	MemberID  interface{} `json:"memberId"` // can be int or string
	FirstName string      `json:"firstName"`
	LastName  string      `json:"lastName"`
	DOB       string      `json:"dob"`
	HireDate  string      `json:"hireDate"`
	Tier      interface{} `json:"tier"` // can be int or string
}

// LoadDemoCases reads all .json files in dir and returns parsed demo cases.
func LoadDemoCases(dir string) ([]DemoCase, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("reading demo cases directory %s: %w", dir, err)
	}

	var cases []DemoCase
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".json") {
			continue
		}
		path := filepath.Join(dir, entry.Name())
		c, err := loadDemoCase(path)
		if err != nil {
			return nil, fmt.Errorf("parsing %s: %w", entry.Name(), err)
		}
		cases = append(cases, *c)
	}
	return cases, nil
}

func loadDemoCase(path string) (*DemoCase, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	// Parse into generic map first for the full field
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}

	// Parse into typed struct
	var dc DemoCase
	if err := json.Unmarshal(data, &dc); err != nil {
		return nil, err
	}
	dc.Full = raw

	// Extract test_points if present (may be "test_points" in JSON)
	if tp, ok := raw["test_points"]; ok {
		if arr, ok := tp.([]interface{}); ok {
			dc.TestPoints = make([]string, 0, len(arr))
			for _, v := range arr {
				if s, ok := v.(string); ok {
					dc.TestPoints = append(dc.TestPoints, s)
				}
			}
		}
	}

	return &dc, nil
}
```

**Step 4: Run tests**

```bash
cd platform/knowledgebase && go test ./rules/... -v -count=1
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add platform/knowledgebase/rules/democase.go platform/knowledgebase/rules/democase_test.go
git commit -m "[platform/knowledgebase] Add demo case JSON loader"
```

---

## Task 5: KB Service API Handlers for Rules, Test Report, Demo Cases

**Files:**
- Create: `platform/knowledgebase/api/rules_handlers.go`
- Create: `platform/knowledgebase/api/rules_handlers_test.go`
- Modify: `platform/knowledgebase/api/handlers.go` (add RulesHandler to Handler struct)
- Modify: `platform/knowledgebase/main.go` (register new routes, add config for file paths)

This is the largest task. The new handlers read from the file-backed loaders (Task 2-4) and serve them through the standard apiresponse envelope.

**Step 1: Create the rules handler**

```go
// platform/knowledgebase/api/rules_handlers.go
package api

import (
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/knowledgebase/rules"
	"github.com/noui/platform/validation"
)

// RulesHandler serves file-backed rule definitions, test reports, and demo cases.
type RulesHandler struct {
	rulesDir   string
	casesDir   string
	reportPath string
	mappingPath string
	cacheTTL   time.Duration

	mu          sync.RWMutex
	rulesCache  []rules.Rule
	domainCache map[string][]rules.Rule
	reportCache *rules.TestReport
	casesCache  []rules.DemoCase
	cacheTime   time.Time
}

func NewRulesHandler(rulesDir, casesDir, reportPath, mappingPath string, cacheTTL time.Duration) *RulesHandler {
	return &RulesHandler{
		rulesDir:    rulesDir,
		casesDir:    casesDir,
		reportPath:  reportPath,
		mappingPath: mappingPath,
		cacheTTL:    cacheTTL,
	}
}

func (rh *RulesHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/kb/rules/definitions", rh.ListRuleDefinitions)
	mux.HandleFunc("GET /api/v1/kb/rules/definitions/{ruleId}", rh.GetRuleDefinition)
	mux.HandleFunc("GET /api/v1/kb/test-report", rh.GetTestReport)
	mux.HandleFunc("GET /api/v1/kb/test-report/{ruleId}", rh.GetTestReportForRule)
	mux.HandleFunc("GET /api/v1/kb/demo-cases", rh.ListDemoCases)
	mux.HandleFunc("GET /api/v1/kb/demo-cases/{caseId}", rh.GetDemoCase)
}

func (rh *RulesHandler) refresh() error {
	rh.mu.RLock()
	if time.Since(rh.cacheTime) < rh.cacheTTL && rh.rulesCache != nil {
		rh.mu.RUnlock()
		return nil
	}
	rh.mu.RUnlock()

	rh.mu.Lock()
	defer rh.mu.Unlock()

	// Double-check after acquiring write lock
	if time.Since(rh.cacheTime) < rh.cacheTTL && rh.rulesCache != nil {
		return nil
	}

	slog.Info("refreshing rules cache", "rulesDir", rh.rulesDir)

	allRules, err := rules.LoadRulesFromDir(rh.rulesDir)
	if err != nil {
		return err
	}

	domainIndex, err := rules.LoadRulesByDomain(rh.rulesDir)
	if err != nil {
		return err
	}

	report, err := rules.LoadTestReport(rh.reportPath, rh.mappingPath)
	if err != nil {
		return err
	}

	cases, err := rules.LoadDemoCases(rh.casesDir)
	if err != nil {
		slog.Warn("failed to load demo cases", "error", err)
		cases = nil
	}

	// Enrich rules with test status from report
	for i := range allRules {
		if rs, ok := report.ByRule[allRules[i].ID]; ok {
			allRules[i].TestStatus = &rules.TestStatus{
				Total:   rs.Total,
				Passing: rs.Passing,
				Failing: rs.Failing,
				Skipped: rs.Skipped,
				LastRun: report.LastRun,
			}
		}
	}
	for domain := range domainIndex {
		for i := range domainIndex[domain] {
			if rs, ok := report.ByRule[domainIndex[domain][i].ID]; ok {
				domainIndex[domain][i].TestStatus = &rules.TestStatus{
					Total:   rs.Total,
					Passing: rs.Passing,
					Failing: rs.Failing,
					Skipped: rs.Skipped,
					LastRun: report.LastRun,
				}
			}
		}
	}

	rh.rulesCache = allRules
	rh.domainCache = domainIndex
	rh.reportCache = report
	rh.casesCache = cases
	rh.cacheTime = time.Now()
	return nil
}

// ListRuleDefinitions returns all rules, optionally filtered by domain query param.
func (rh *RulesHandler) ListRuleDefinitions(w http.ResponseWriter, r *http.Request) {
	if err := rh.refresh(); err != nil {
		slog.Error("failed to load rules", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "RULES_LOAD_ERROR", "Failed to load rule definitions")
		return
	}

	domain := strings.TrimSpace(r.URL.Query().Get("domain"))

	rh.mu.RLock()
	defer rh.mu.RUnlock()

	if domain != "" {
		rules, ok := rh.domainCache[domain]
		if !ok {
			apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", []rules.Rule{})
			return
		}
		apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", rules)
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", rh.rulesCache)
}

// GetRuleDefinition returns a single rule by ID.
func (rh *RulesHandler) GetRuleDefinition(w http.ResponseWriter, r *http.Request) {
	ruleID := r.PathValue("ruleId")

	var errs validation.Errors
	errs.Required("ruleId", ruleID)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "knowledgebase", "INVALID_REQUEST", errs.Error())
		return
	}

	if err := rh.refresh(); err != nil {
		slog.Error("failed to load rules", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "RULES_LOAD_ERROR", "Failed to load rule definitions")
		return
	}

	rh.mu.RLock()
	defer rh.mu.RUnlock()

	for _, rule := range rh.rulesCache {
		if rule.ID == ruleID {
			apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", rule)
			return
		}
	}

	apiresponse.WriteError(w, http.StatusNotFound, "knowledgebase", "RULE_NOT_FOUND", "Rule not found: "+ruleID)
}

// GetTestReport returns the full test report summary.
func (rh *RulesHandler) GetTestReport(w http.ResponseWriter, r *http.Request) {
	if err := rh.refresh(); err != nil {
		slog.Error("failed to load test report", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "REPORT_LOAD_ERROR", "Failed to load test report")
		return
	}

	rh.mu.RLock()
	defer rh.mu.RUnlock()

	apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", rh.reportCache)
}

// GetTestReportForRule returns test results for a specific rule.
func (rh *RulesHandler) GetTestReportForRule(w http.ResponseWriter, r *http.Request) {
	ruleID := r.PathValue("ruleId")

	if err := rh.refresh(); err != nil {
		slog.Error("failed to load test report", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "REPORT_LOAD_ERROR", "Failed to load test report")
		return
	}

	rh.mu.RLock()
	defer rh.mu.RUnlock()

	if rs, ok := rh.reportCache.ByRule[ruleID]; ok {
		apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", rs)
		return
	}
	apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", rules.RuleTestSummary{})
}

// ListDemoCases returns all demo case summaries.
func (rh *RulesHandler) ListDemoCases(w http.ResponseWriter, r *http.Request) {
	if err := rh.refresh(); err != nil {
		slog.Error("failed to load demo cases", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "CASES_LOAD_ERROR", "Failed to load demo cases")
		return
	}

	rh.mu.RLock()
	defer rh.mu.RUnlock()

	apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", rh.casesCache)
}

// GetDemoCase returns a single demo case by ID.
func (rh *RulesHandler) GetDemoCase(w http.ResponseWriter, r *http.Request) {
	caseID := r.PathValue("caseId")

	if err := rh.refresh(); err != nil {
		slog.Error("failed to load demo cases", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "CASES_LOAD_ERROR", "Failed to load demo cases")
		return
	}

	rh.mu.RLock()
	defer rh.mu.RUnlock()

	for _, c := range rh.casesCache {
		if c.CaseID == caseID {
			apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", c)
			return
		}
	}

	apiresponse.WriteError(w, http.StatusNotFound, "knowledgebase", "CASE_NOT_FOUND", "Demo case not found: "+caseID)
}
```

**Step 2: Modify main.go to wire the new handler**

In `main.go`, after the existing `handler.RegisterRoutes(mux)` call, add:

```go
// File-backed rules handler
rulesDir := envOr("RULES_DIR", "/data/rules")
casesDir := envOr("DEMO_CASES_DIR", "/data/demo-cases")
reportPath := envOr("TEST_REPORT_PATH", "/data/test-results/intelligence-report.json")
mappingPath := envOr("TEST_MAPPING_PATH", "/data/test-results/test-rule-mapping.json")
cacheTTLMin := envOrInt("RULES_CACHE_TTL_MIN", 5)

rulesHandler := api.NewRulesHandler(rulesDir, casesDir, reportPath, mappingPath, time.Duration(cacheTTLMin)*time.Minute)
rulesHandler.RegisterRoutes(mux)
```

Add a helper `envOr` and `envOrInt` if not already present:

```go
func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envOrInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
```

**Step 3: Write handler tests**

```go
// platform/knowledgebase/api/rules_handlers_test.go
package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

func newTestRulesHandler(t *testing.T) *RulesHandler {
	t.Helper()
	rulesDir := filepath.Join("..", "testdata")
	casesDir := filepath.Join("..", "..", "..", "domains", "pension", "demo-cases")
	reportPath := filepath.Join("..", "testdata", "test-report.json")
	mappingPath := filepath.Join("..", "testdata", "test-rule-mapping.json")
	return NewRulesHandler(rulesDir, casesDir, reportPath, mappingPath, 1*time.Minute)
}

func TestListRuleDefinitions(t *testing.T) {
	rh := newTestRulesHandler(t)
	mux := http.NewServeMux()
	rh.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/v1/kb/rules/definitions", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	data, ok := resp["data"].([]interface{})
	if !ok {
		t.Fatal("expected data to be array")
	}
	if len(data) < 1 {
		t.Error("expected at least 1 rule")
	}
}

func TestListRuleDefinitions_FilterByDomain(t *testing.T) {
	rh := newTestRulesHandler(t)
	mux := http.NewServeMux()
	rh.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/v1/kb/rules/definitions?domain=test-domain", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestGetRuleDefinition(t *testing.T) {
	rh := newTestRulesHandler(t)
	mux := http.NewServeMux()
	rh.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/v1/kb/rules/definitions/RULE-TEST-01", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetRuleDefinition_NotFound(t *testing.T) {
	rh := newTestRulesHandler(t)
	mux := http.NewServeMux()
	rh.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/v1/kb/rules/definitions/RULE-NONEXISTENT", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestGetTestReport(t *testing.T) {
	rh := newTestRulesHandler(t)
	mux := http.NewServeMux()
	rh.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/v1/kb/test-report", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestListDemoCases(t *testing.T) {
	rh := newTestRulesHandler(t)
	mux := http.NewServeMux()
	rh.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/v1/kb/demo-cases", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
```

**Step 4: Build and test**

```bash
cd platform/knowledgebase && go build ./... && go test ./... -v -count=1 -short
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add platform/knowledgebase/api/rules_handlers.go platform/knowledgebase/api/rules_handlers_test.go platform/knowledgebase/main.go
git commit -m "[platform/knowledgebase] Add API handlers for rule definitions, test report, and demo cases"
```

---

## Task 6: Test Report Generation Script + Mapping Seed

**Files:**
- Create: `scripts/generate-test-report.sh`
- Create: `test-results/.gitkeep`
- Create: `test-results/test-rule-mapping.json` (initial mapping from intelligence tests to rule IDs)

**Step 1: Create the generation script**

```bash
#!/bin/bash
# scripts/generate-test-report.sh
# Generates go test -json output for the intelligence service.
# Run from repo root: bash scripts/generate-test-report.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$REPO_ROOT/test-results"

mkdir -p "$RESULTS_DIR"

echo "Running intelligence service tests..."
cd "$REPO_ROOT/platform/intelligence"
go test -json ./... > "$RESULTS_DIR/intelligence-report.json" 2>&1 || true

echo "Test report generated: $RESULTS_DIR/intelligence-report.json"
echo "Lines: $(wc -l < "$RESULTS_DIR/intelligence-report.json")"
```

**Step 2: Create the initial mapping file**

This needs to be populated by reading the actual Go test names from the intelligence service. The implementer should:

1. Run `cd platform/intelligence && go test -json ./... 2>/dev/null | grep '"Action":"pass"' | jq -r '.Test' | sort` to get test names
2. Map each test name to its corresponding RULE-* ID
3. Save as `test-results/test-rule-mapping.json`

Start with an empty mapping that the implementer will populate:

```json
{}
```

**Step 3: Run the script to generate the initial report**

```bash
bash scripts/generate-test-report.sh
```

**Step 4: Commit**

```bash
git add scripts/generate-test-report.sh test-results/.gitkeep test-results/test-rule-mapping.json
git commit -m "[scripts] Add test report generation script and initial rule mapping"
```

---

## Task 7: Docker Compose Volume Mounts

**Files:**
- Modify: `docker-compose.yml` (add volume mounts to knowledgebase service)

**Step 1: Add volumes to the knowledgebase service**

Add these volumes and environment variables to the `knowledgebase` service in `docker-compose.yml`:

```yaml
knowledgebase:
  # ... existing config ...
  volumes:
    - ./domains/pension/rules/definitions:/data/rules:ro
    - ./domains/pension/demo-cases:/data/demo-cases:ro
    - ./test-results:/data/test-results:ro
  environment:
    # ... existing env vars ...
    RULES_DIR: /data/rules
    DEMO_CASES_DIR: /data/demo-cases
    TEST_REPORT_PATH: /data/test-results/intelligence-report.json
    TEST_MAPPING_PATH: /data/test-results/test-rule-mapping.json
    RULES_CACHE_TTL_MIN: "5"
```

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "[infrastructure] Add volume mounts for rules, demo cases, and test report"
```

---

## Task 8: Frontend TypeScript Types

**Files:**
- Create: `frontend/src/types/Rules.ts`

**Step 1: Write the types**

```typescript
// frontend/src/types/Rules.ts

export interface RuleDefinition {
  id: string;
  name: string;
  domain: string;
  description: string;
  sourceReference: {
    document: string;
    section: string;
    lastVerified: string;
  };
  appliesTo: {
    tiers: string[];
    memberTypes: string[];
  };
  inputs: RuleParam[];
  logic: RuleLogic;
  output: RuleOutput[];
  dependencies: string[];
  tags: string[];
  testCases: RuleTestCase[];
  governance: RuleGovernance;
  testStatus?: TestStatus;
}

export interface RuleParam {
  name: string;
  type: string;
  description: string;
  constraints?: string;
}

export interface RuleLogic {
  type: 'conditional' | 'formula' | 'procedural' | 'lookup_table';
  conditions?: RuleCondition[];
  formula?: string;
  steps?: string[];
  table?: RuleTableRow[];
  notes?: string[];
}

export interface RuleCondition {
  condition: string;
  result: Record<string, unknown>;
  notes?: string[];
}

export interface RuleTableRow {
  key: string;
  values: Record<string, unknown>;
}

export interface RuleOutput {
  field: string;
  type: string;
  description?: string;
}

export interface RuleTestCase {
  name: string;
  demoCaseRef?: string;
  description?: string;
  inputs: Record<string, unknown>;
  expected: Record<string, unknown>;
}

export interface RuleGovernance {
  status: string;
  lastReviewed: string;
  reviewedBy: string;
  effectiveDate: string;
}

export interface TestStatus {
  total: number;
  passing: number;
  failing: number;
  skipped: number;
  lastRun: string;
}

export interface TestReport {
  lastRun: string;
  total: number;
  passing: number;
  failing: number;
  skipped: number;
  tests: TestResult[];
  byRule: Record<string, RuleTestSummary>;
}

export interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  durationMs: number;
  ruleId?: string;
}

export interface RuleTestSummary {
  total: number;
  passing: number;
  failing: number;
  skipped: number;
  tests: TestResult[];
}

export interface DemoCase {
  caseId: string;
  description: string;
  member: {
    memberId: number | string;
    firstName: string;
    lastName: string;
    dob: string;
    hireDate: string;
    tier: number | string;
  };
  retirementDate: string;
  inputs: Record<string, unknown>;
  expected: Record<string, unknown>;
  testPoints: string[];
  full: Record<string, unknown>;
}
```

**Step 2: Commit**

```bash
cd frontend && git add src/types/Rules.ts
git commit -m "[frontend] Add TypeScript types for rule definitions, test reports, and demo cases"
```

---

## Task 9: Frontend API Client + Hooks

**Files:**
- Create: `frontend/src/lib/rulesApi.ts`
- Create: `frontend/src/hooks/useRuleDefinitions.ts`
- Create: `frontend/src/hooks/useTestReport.ts`
- Create: `frontend/src/hooks/useDemoCases.ts`
- Create: `frontend/src/lib/__tests__/rulesApi.test.ts`

**Step 1: Write the API client**

```typescript
// frontend/src/lib/rulesApi.ts
import { fetchAPI } from './apiClient';
import type { RuleDefinition, TestReport, RuleTestSummary, DemoCase } from '@/types/Rules';

const KB_URL = import.meta.env.VITE_KB_URL || '/api';

export const rulesAPI = {
  listDefinitions: (domain?: string): Promise<RuleDefinition[]> => {
    const params = domain ? `?domain=${encodeURIComponent(domain)}` : '';
    return fetchAPI<RuleDefinition[]>(`${KB_URL}/v1/kb/rules/definitions${params}`);
  },

  getDefinition: (ruleId: string): Promise<RuleDefinition> =>
    fetchAPI<RuleDefinition>(`${KB_URL}/v1/kb/rules/definitions/${encodeURIComponent(ruleId)}`),

  getTestReport: (): Promise<TestReport> =>
    fetchAPI<TestReport>(`${KB_URL}/v1/kb/test-report`),

  getTestReportForRule: (ruleId: string): Promise<RuleTestSummary> =>
    fetchAPI<RuleTestSummary>(`${KB_URL}/v1/kb/test-report/${encodeURIComponent(ruleId)}`),

  listDemoCases: (): Promise<DemoCase[]> =>
    fetchAPI<DemoCase[]>(`${KB_URL}/v1/kb/demo-cases`),

  getDemoCase: (caseId: string): Promise<DemoCase> =>
    fetchAPI<DemoCase>(`${KB_URL}/v1/kb/demo-cases/${encodeURIComponent(caseId)}`),
};
```

**Step 2: Write the hooks**

```typescript
// frontend/src/hooks/useRuleDefinitions.ts
import { useQuery } from '@tanstack/react-query';
import { rulesAPI } from '@/lib/rulesApi';
import type { RuleDefinition } from '@/types/Rules';

export function useRuleDefinitions(domain?: string) {
  return useQuery<RuleDefinition[]>({
    queryKey: ['rules', 'definitions', domain],
    queryFn: () => rulesAPI.listDefinitions(domain),
    staleTime: 5 * 60_000,
  });
}

export function useRuleDefinition(ruleId: string) {
  return useQuery<RuleDefinition>({
    queryKey: ['rules', 'definitions', ruleId],
    queryFn: () => rulesAPI.getDefinition(ruleId),
    enabled: ruleId.length > 0,
    staleTime: 5 * 60_000,
  });
}
```

```typescript
// frontend/src/hooks/useTestReport.ts
import { useQuery } from '@tanstack/react-query';
import { rulesAPI } from '@/lib/rulesApi';
import type { TestReport } from '@/types/Rules';

export function useTestReport() {
  return useQuery<TestReport>({
    queryKey: ['rules', 'test-report'],
    queryFn: () => rulesAPI.getTestReport(),
    staleTime: 5 * 60_000,
  });
}
```

```typescript
// frontend/src/hooks/useDemoCases.ts
import { useQuery } from '@tanstack/react-query';
import { rulesAPI } from '@/lib/rulesApi';
import type { DemoCase } from '@/types/Rules';

export function useDemoCases() {
  return useQuery<DemoCase[]>({
    queryKey: ['rules', 'demo-cases'],
    queryFn: () => rulesAPI.listDemoCases(),
    staleTime: 5 * 60_000,
  });
}

export function useDemoCase(caseId: string) {
  return useQuery<DemoCase>({
    queryKey: ['rules', 'demo-cases', caseId],
    queryFn: () => rulesAPI.getDemoCase(caseId),
    enabled: caseId.length > 0,
    staleTime: 5 * 60_000,
  });
}
```

**Step 3: Write API client tests**

```typescript
// frontend/src/lib/__tests__/rulesApi.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rulesAPI } from '../rulesApi';

let fetchMock: ReturnType<typeof vi.fn>;

function setupFetch(data: unknown = []) {
  fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data,
          meta: { requestId: 'test', timestamp: '2026-01-01T00:00:00Z', service: 'knowledgebase', version: 'v1' },
        }),
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => setupFetch());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('rulesAPI', () => {
  it('listDefinitions hits definitions endpoint', async () => {
    await rulesAPI.listDefinitions();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/rules/definitions');
  });

  it('listDefinitions passes domain filter', async () => {
    await rulesAPI.listDefinitions('eligibility');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('?domain=eligibility');
  });

  it('getDefinition hits definition by ID', async () => {
    setupFetch({ id: 'RULE-TEST' });
    await rulesAPI.getDefinition('RULE-TEST');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/rules/definitions/RULE-TEST');
  });

  it('getTestReport hits test-report endpoint', async () => {
    setupFetch({ total: 0, passing: 0 });
    await rulesAPI.getTestReport();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/test-report');
  });

  it('listDemoCases hits demo-cases endpoint', async () => {
    await rulesAPI.listDemoCases();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/demo-cases');
  });

  it('getDemoCase hits demo-cases by ID', async () => {
    setupFetch({ caseId: 'case1' });
    await rulesAPI.getDemoCase('case1');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/demo-cases/case1');
  });
});
```

**Step 4: Run tests**

```bash
cd frontend && npx tsc --noEmit && npm test -- --run src/lib/__tests__/rulesApi.test.ts
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/types/Rules.ts src/lib/rulesApi.ts src/hooks/useRuleDefinitions.ts src/hooks/useTestReport.ts src/hooks/useDemoCases.ts src/lib/__tests__/rulesApi.test.ts
git commit -m "[frontend] Add rules API client, hooks, and types"
```

---

## Task 10: Rules Explorer Page — List View

**Files:**
- Create: `frontend/src/pages/RulesExplorer.tsx`
- Create: `frontend/src/components/rules/RulesSummaryBar.tsx`
- Create: `frontend/src/components/rules/DomainFilter.tsx`
- Create: `frontend/src/components/rules/RulesList.tsx`
- Create: `frontend/src/components/rules/RuleCard.tsx`

This task builds the list view — the main Rules Explorer page showing all rules grouped by domain with status badges. The detail view (clicking a rule) is Task 11.

**Implementation notes:**
- Use existing Tailwind utility classes matching the app's color scheme (`iw-sage`, `iw-navy`, etc.)
- Follow the panel pattern from `IssueManagementPanel.tsx` and `ConfigRulesPanel.tsx`
- Group rules by domain, show pass/fail counts per group
- Search filters by rule name, ID, or description (client-side filter since dataset is small)
- DomainFilter uses pill/tab pattern

**The implementer should:**
1. Create each component following the layout wireframes in the design doc
2. Wire `useRuleDefinitions()` and `useTestReport()` hooks
3. Implement client-side search (simple `.filter()` on name/id/description)
4. Use `RuleCard` for each rule row: status icon (checkmark/x), rule ID, description, test count badge
5. Group by domain with domain headers showing aggregate pass/fail
6. Track `selectedRuleId` state for drill-down (used in Task 11)

**Step 1: Build components**

The implementer writes each component, starting with `RuleCard` (smallest), then `RulesList`, `DomainFilter`, `RulesSummaryBar`, and finally `RulesExplorer` page that composes them.

**Step 2: Run typecheck**

```bash
cd frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/pages/RulesExplorer.tsx src/components/rules/
git commit -m "[frontend] Add Rules Explorer list view with domain filtering and search"
```

---

## Task 11: Rule Detail View — Tabs + Logic Renderers

**Files:**
- Create: `frontend/src/components/rules/RuleDetail.tsx`
- Create: `frontend/src/components/rules/RuleLogicRenderer.tsx`
- Create: `frontend/src/components/rules/ConditionalRenderer.tsx`
- Create: `frontend/src/components/rules/FormulaRenderer.tsx`
- Create: `frontend/src/components/rules/LookupTableRenderer.tsx`
- Create: `frontend/src/components/rules/ProceduralRenderer.tsx`
- Create: `frontend/src/components/rules/RuleTestCases.tsx`
- Create: `frontend/src/components/rules/RuleInputsOutputs.tsx`
- Create: `frontend/src/components/rules/RuleGovernance.tsx`

**Implementation notes:**
- `RuleDetail` is a full detail view with 4 tabs: Logic, Inputs/Outputs, Tests, Governance
- `RuleLogicRenderer` dispatches to one of 4 type-specific renderers based on `logic.type`
- `ConditionalRenderer`: IF/THEN/ELSE blocks with condition text and result key-value pairs; highlight critical notes with warning icon
- `FormulaRenderer`: code-style block showing the formula string with variable highlighting
- `LookupTableRenderer`: HTML table with headers from the first row's keys, one row per `TableRow`
- `ProceduralRenderer`: ordered list (`<ol>`) of step strings
- `RuleTestCases`: table with test name, demo case ref (as link), inputs, expected values, and pass/fail badge from test report
- `RuleInputsOutputs`: two tables — inputs (name, type, description, constraints) and outputs (field, type, description)
- `RuleGovernance`: key-value display (status, effective date, reviewer, authority, source ref, dependencies as links, change log)

**Cross-linking:** Demo case refs in `RuleTestCases` and dependency rule IDs in `RuleGovernance` should be rendered as clickable links that navigate to the corresponding demo case or rule. Since the app uses `viewMode` state, these links should call a navigation callback prop.

**Step 1: Build each renderer component bottom-up**

Start with the 4 logic renderers, then `RuleTestCases`, `RuleInputsOutputs`, `RuleGovernance`, then `RuleLogicRenderer` dispatcher, and finally `RuleDetail` that composes them with tabs.

**Step 2: Wire into RulesExplorer**

Update `RulesExplorer.tsx` to show `RuleDetail` when `selectedRuleId` is set, with a back button to return to the list.

**Step 3: Run typecheck**

```bash
cd frontend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/rules/
git commit -m "[frontend] Add rule detail view with 4 logic renderers and tabbed layout"
```

---

## Task 12: Demo Cases Page

**Files:**
- Create: `frontend/src/pages/DemoCases.tsx`
- Create: `frontend/src/components/demo-cases/CaseCardGrid.tsx`
- Create: `frontend/src/components/demo-cases/CaseCard.tsx`
- Create: `frontend/src/components/demo-cases/CaseDetail.tsx`
- Create: `frontend/src/components/demo-cases/MemberProfile.tsx`
- Create: `frontend/src/components/demo-cases/CalculationTrace.tsx`
- Create: `frontend/src/components/demo-cases/TestPoints.tsx`

**Implementation notes:**
- `CaseCardGrid`: responsive grid of `CaseCard` components
- `CaseCard`: member name, tier badge, key themes (extracted from description), test count badge
- `CaseDetail`: 3 tabs — Member Profile, Calculation Trace, Test Points
- `MemberProfile`: member info table + service credit breakdown (earned vs purchased, which calcs use which). Extract from `full` field of demo case.
- `CalculationTrace`: step-by-step walkthrough extracted from `full` field. Each step shows rule ID as link back to Rules Explorer. Highlight critical notes (purchased service exclusion, reduction rate warnings).
- `TestPoints`: render `testPoints` array as checklist with pass/fail icons

**The Calculation Trace is the most complex component.** The demo case JSON has nested `expected_eligibility`, `expected_benefit`, `expected_ipr`, etc. The implementer should build the trace steps programmatically from these sections, in the order: Tier Determination → Vesting → Rule of 75/85 → Early Retirement → Benefit Calculation → IPR → Death Benefit.

**Step 1: Build components bottom-up**

Start with `TestPoints` (simplest), `MemberProfile`, `CalculationTrace`, `CaseCard`, `CaseCardGrid`, `CaseDetail`, then `DemoCases` page.

**Step 2: Run typecheck**

```bash
cd frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/pages/DemoCases.tsx src/components/demo-cases/
git commit -m "[frontend] Add Demo Cases page with calculation trace and test points"
```

---

## Task 13: Navigation Wiring — View Modes + Sidebar

**Files:**
- Modify: `frontend/src/types/auth.ts` (add view modes)
- Modify: `frontend/src/App.tsx` (add lazy imports and rendering for new views)
- Modify: `frontend/src/components/StaffPortal.tsx` (add sidebar nav items)

**Step 1: Add view modes**

In `frontend/src/types/auth.ts`, add `'rules-explorer'` and `'demo-cases'` to the `ViewMode` type union and to the `ROLE_ACCESS` for `admin` and `staff` roles.

**Step 2: Add lazy imports in App.tsx**

```typescript
const RulesExplorer = lazy(() => import('./pages/RulesExplorer'));
const DemoCasesPage = lazy(() => import('./pages/DemoCases'));
```

Add conditional rendering in `AppInner` for the new view modes, following the existing pattern.

**Step 3: Add sidebar nav items in StaffPortal.tsx**

Add two new nav items in the staff portal sidebar, in the secondary navigation section:

```typescript
{ key: 'rules-explorer', label: 'Rules Explorer', icon: '📋' },
{ key: 'demo-cases', label: 'Demo Cases', icon: '🧪' },
```

**Step 4: Run typecheck and tests**

```bash
cd frontend && npx tsc --noEmit && npm test -- --run
```

Expected: ALL PASS (existing tests should not break)

**Step 5: Commit**

```bash
git add src/types/auth.ts src/App.tsx src/components/StaffPortal.tsx
git commit -m "[frontend] Wire Rules Explorer and Demo Cases into navigation"
```

---

## Task 14: Cross-Linking Between Views

**Files:**
- Modify: `frontend/src/pages/RulesExplorer.tsx` (accept navigation callbacks)
- Modify: `frontend/src/pages/DemoCases.tsx` (accept navigation callbacks)
- Modify: `frontend/src/components/rules/RuleTestCases.tsx` (demo case links)
- Modify: `frontend/src/components/rules/RuleGovernance.tsx` (dependency links)
- Modify: `frontend/src/components/demo-cases/CalculationTrace.tsx` (rule links)

**Implementation notes:**
- Pass `onNavigateToRule(ruleId)` and `onNavigateToDemoCase(caseId)` callbacks from App.tsx down through the component tree
- In `RuleTestCases`, render `demoCaseRef` as a clickable link that calls `onNavigateToDemoCase`
- In `RuleGovernance`, render dependency rule IDs as clickable links that call `onNavigateToRule`
- In `CalculationTrace`, render rule IDs as clickable links that call `onNavigateToRule`
- Navigation callbacks should: set the target view mode, and pass the selected ID via state

**Step 1: Implement navigation state**

Add state to `App.tsx` for `selectedRuleId` and `selectedCaseId` that persist across view mode switches.

**Step 2: Wire callbacks through components**

**Step 3: Test cross-linking manually and run typecheck**

```bash
cd frontend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/pages/ src/components/rules/ src/components/demo-cases/ src/App.tsx
git commit -m "[frontend] Add cross-linking between Rules Explorer and Demo Cases"
```

---

## Task 15: Frontend Tests

**Files:**
- Create: `frontend/src/components/rules/__tests__/RuleCard.test.tsx`
- Create: `frontend/src/components/rules/__tests__/RuleLogicRenderer.test.tsx`
- Create: `frontend/src/components/rules/__tests__/RulesSummaryBar.test.tsx`
- Create: `frontend/src/components/rules/__tests__/RuleTestCases.test.tsx`
- Create: `frontend/src/components/demo-cases/__tests__/CaseCard.test.tsx`
- Create: `frontend/src/components/demo-cases/__tests__/TestPoints.test.tsx`
- Create: `frontend/src/pages/__tests__/RulesExplorer.test.tsx`
- Create: `frontend/src/pages/__tests__/DemoCases.test.tsx`

**Implementation notes:**
- Follow existing test patterns: mock hooks with `vi.mock()`, render with `renderWithProviders()`, assert with `screen.getByText()`
- Key tests:
  - `RuleCard`: renders rule ID, name, pass/fail badge
  - `RuleLogicRenderer`: dispatches to correct renderer based on logic.type
  - `RulesSummaryBar`: shows total/passing counts and last run time
  - `RuleTestCases`: renders test names, expected values, demo case links
  - `CaseCard`: renders member name, tier, theme tags
  - `TestPoints`: renders checklist with pass/fail icons
  - `RulesExplorer`: loading state, domain filter interaction, search
  - `DemoCases`: loading state, card grid rendering

**Step 1: Write tests**

Follow the mock-hook pattern from `ConfigRulesPanel.test.tsx`:

```typescript
const mockUseRuleDefinitions = vi.fn();
vi.mock('@/hooks/useRuleDefinitions', () => ({
  useRuleDefinitions: (...args: unknown[]) => mockUseRuleDefinitions(...args),
}));
```

**Step 2: Run all tests**

```bash
cd frontend && npm test -- --run
```

Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/components/rules/__tests__/ src/components/demo-cases/__tests__/ src/pages/__tests__/
git commit -m "[frontend] Add tests for Rules Explorer and Demo Cases components"
```

---

## Task 16: Populate Test-Rule Mapping + Generate Real Report

**Files:**
- Modify: `test-results/test-rule-mapping.json` (populate with real test → rule mappings)

**Step 1: Discover actual test names**

```bash
cd platform/intelligence && go test -json ./... 2>/dev/null | grep '"Action":"pass"' | python3 -c "import sys, json; [print(json.loads(l)['Test']) for l in sys.stdin if json.loads(l).get('Test')]" | sort -u
```

**Step 2: Map each test to its rule ID**

Review each test name and map it to the RULE-* ID it validates. Save to `test-results/test-rule-mapping.json`.

**Step 3: Generate the test report**

```bash
bash scripts/generate-test-report.sh
```

**Step 4: Verify the report is parseable**

```bash
cd platform/knowledgebase && go test ./rules/... -v -count=1 -run TestLoadTestReport
```

**Step 5: Commit**

```bash
git add test-results/
git commit -m "[test-results] Populate test-rule mapping with intelligence service test names"
```

---

## Task 17: Final Integration Test + Build Verification

**Step 1: Run all Go tests**

```bash
cd platform/knowledgebase && go build ./... && go test ./... -v -count=1 -short
```

**Step 2: Run all frontend tests**

```bash
cd frontend && npx tsc --noEmit && npm run build && npm test -- --run
```

**Step 3: Verify no regressions in other services**

```bash
cd platform/intelligence && go test ./... -short -count=1
cd platform/dataaccess && go test ./... -short -count=1
```

**Step 4: Update BUILD_HISTORY.md**

**Step 5: Final commit**

```bash
git add BUILD_HISTORY.md
git commit -m "[docs] Add Rules & Test Explorer to BUILD_HISTORY"
```

---

## Task Summary

| Task | Component | Files | Estimated Effort |
|------|-----------|-------|-----------------|
| 1 | Go types for YAML rules | 2 | Small |
| 2 | YAML rule loader | 3 + fixture | Small |
| 3 | Test report parser | 2 + fixtures | Small |
| 4 | Demo case loader | 2 | Small |
| 5 | KB API handlers | 2 + modify 2 | Medium |
| 6 | Test report script + mapping | 3 | Trivial |
| 7 | Docker volumes | 1 modify | Trivial |
| 8 | Frontend TS types | 1 | Small |
| 9 | Frontend API client + hooks | 5 + test | Small |
| 10 | Rules Explorer list view | 5 | Medium |
| 11 | Rule detail + logic renderers | 9 | Large |
| 12 | Demo Cases page | 7 | Medium-Large |
| 13 | Navigation wiring | 3 modify | Small |
| 14 | Cross-linking | 5 modify | Small |
| 15 | Frontend tests | 8 | Medium |
| 16 | Populate real mapping | 1 modify | Small |
| 17 | Integration test + docs | 1 | Small |
