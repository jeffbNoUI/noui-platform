package rules

import (
	"os"
	"path/filepath"
	"testing"
)

// testdataDir returns the absolute path to the testdata directory.
// It walks up from the test file's location to platform/knowledgebase/testdata.
func testdataDir(t *testing.T) string {
	t.Helper()
	// The test runs from platform/knowledgebase/rules/, so testdata is ../testdata
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getting working directory: %v", err)
	}
	return filepath.Join(wd, "..", "testdata")
}

func TestLoadRuleFile(t *testing.T) {
	dir := testdataDir(t)
	path := filepath.Join(dir, "test-rule.yaml")

	rf, err := LoadRuleFile(path)
	if err != nil {
		t.Fatalf("LoadRuleFile: %v", err)
	}

	// Check metadata
	if rf.Metadata.Domain != "test-domain" {
		t.Errorf("expected domain test-domain, got %s", rf.Metadata.Domain)
	}
	if rf.Metadata.Version != "1.0.0" {
		t.Errorf("expected version 1.0.0, got %s", rf.Metadata.Version)
	}
	if rf.Metadata.Authority != "Test Authority" {
		t.Errorf("expected authority Test Authority, got %s", rf.Metadata.Authority)
	}

	// Check rules count
	if len(rf.Rules) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(rf.Rules))
	}

	// Verify first rule (conditional)
	r0 := rf.Rules[0]
	if r0.ID != "TEST-CONDITIONAL" {
		t.Errorf("expected first rule ID TEST-CONDITIONAL, got %s", r0.ID)
	}
	if r0.Logic.Type != "conditional" {
		t.Errorf("expected logic type conditional, got %s", r0.Logic.Type)
	}
	if len(r0.Logic.Conditions) != 2 {
		t.Errorf("expected 2 conditions, got %d", len(r0.Logic.Conditions))
	}
	if r0.Logic.CriticalNote == "" {
		t.Error("expected critical_note to be populated")
	}
	if len(r0.TestCases) != 2 {
		t.Errorf("expected 2 test cases on rule 0, got %d", len(r0.TestCases))
	}
	if len(r0.AppliesTo.Tiers) != 2 {
		t.Errorf("expected 2 tiers, got %d", len(r0.AppliesTo.Tiers))
	}

	// Verify second rule (formula)
	r1 := rf.Rules[1]
	if r1.ID != "TEST-FORMULA" {
		t.Errorf("expected second rule ID TEST-FORMULA, got %s", r1.ID)
	}
	if r1.Logic.Type != "formula" {
		t.Errorf("expected logic type formula, got %s", r1.Logic.Type)
	}
	if r1.Logic.Expression == "" {
		t.Error("expected expression to be populated")
	}
	if len(r1.Dependencies) != 1 || r1.Dependencies[0] != "TEST-CONDITIONAL" {
		t.Errorf("expected dependency [TEST-CONDITIONAL], got %v", r1.Dependencies)
	}
	if r1.Output.Precision != 2 {
		t.Errorf("expected output precision 2, got %d", r1.Output.Precision)
	}
}

func TestLoadRulesFromDir(t *testing.T) {
	dir := testdataDir(t)

	rules, err := LoadRulesFromDir(dir)
	if err != nil {
		t.Fatalf("LoadRulesFromDir: %v", err)
	}

	if len(rules) != 2 {
		t.Errorf("expected 2 rules from testdata dir, got %d", len(rules))
	}

	// Verify rule IDs are present
	ids := make(map[string]bool)
	for _, r := range rules {
		ids[r.ID] = true
	}
	if !ids["TEST-CONDITIONAL"] {
		t.Error("expected TEST-CONDITIONAL in loaded rules")
	}
	if !ids["TEST-FORMULA"] {
		t.Error("expected TEST-FORMULA in loaded rules")
	}
}

func TestLoadRulesByDomain(t *testing.T) {
	dir := testdataDir(t)

	byDomain, err := LoadRulesByDomain(dir)
	if err != nil {
		t.Fatalf("LoadRulesByDomain: %v", err)
	}

	rules, ok := byDomain["test-domain"]
	if !ok {
		t.Fatal("expected test-domain key in result")
	}
	if len(rules) != 2 {
		t.Errorf("expected 2 rules in test-domain, got %d", len(rules))
	}
}

func TestLoadRulesFromEmptyDir(t *testing.T) {
	// Create a temporary empty directory
	dir := t.TempDir()

	rules, err := LoadRulesFromDir(dir)
	if err != nil {
		t.Fatalf("LoadRulesFromDir on empty dir: %v", err)
	}
	if len(rules) != 0 {
		t.Errorf("expected 0 rules from empty dir, got %d", len(rules))
	}
}

func TestLoadRulesFromNonexistentDir(t *testing.T) {
	_, err := LoadRulesFromDir("/nonexistent/path/that/does/not/exist")
	if err == nil {
		t.Error("expected error for nonexistent directory, got nil")
	}
}

func TestLoadRuleFileNonexistent(t *testing.T) {
	_, err := LoadRuleFile("/nonexistent/file.yaml")
	if err == nil {
		t.Error("expected error for nonexistent file, got nil")
	}
}

func TestLoadRulesFromDirSkipsNonYAML(t *testing.T) {
	dir := t.TempDir()

	// Write a non-YAML file that should be skipped
	if err := os.WriteFile(filepath.Join(dir, "readme.txt"), []byte("not yaml"), 0644); err != nil {
		t.Fatal(err)
	}

	rules, err := LoadRulesFromDir(dir)
	if err != nil {
		t.Fatalf("LoadRulesFromDir: %v", err)
	}
	if len(rules) != 0 {
		t.Errorf("expected 0 rules (non-YAML skipped), got %d", len(rules))
	}
}
