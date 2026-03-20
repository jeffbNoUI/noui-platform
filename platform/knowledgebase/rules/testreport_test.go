package rules

import (
	"path/filepath"
	"testing"
)

func testdataPath(name string) string {
	return filepath.Join("..", "testdata", name)
}

func TestLoadTestReport_WithMapping(t *testing.T) {
	report, err := LoadTestReport(
		testdataPath("test-report.json"),
		testdataPath("test-rule-mapping.json"),
	)
	if err != nil {
		t.Fatalf("LoadTestReport returned error: %v", err)
	}

	if report.Total != 4 {
		t.Errorf("Total: got %d, want 4", report.Total)
	}
	if report.Passing != 2 {
		t.Errorf("Passing: got %d, want 2", report.Passing)
	}
	if report.Failing != 1 {
		t.Errorf("Failing: got %d, want 1", report.Failing)
	}
	if report.Skipped != 1 {
		t.Errorf("Skipped: got %d, want 1", report.Skipped)
	}
	if report.LastRun.IsZero() {
		t.Error("LastRun should not be zero")
	}
	if len(report.Tests) != 4 {
		t.Fatalf("Tests length: got %d, want 4", len(report.Tests))
	}

	// Verify ByRule aggregation.
	if len(report.ByRule) != 4 {
		t.Errorf("ByRule length: got %d, want 4", len(report.ByRule))
	}

	rule75 := report.ByRule["RULE-RULE-OF-75"]
	if rule75.Total != 1 || rule75.Passing != 1 {
		t.Errorf("RULE-RULE-OF-75: got total=%d passing=%d, want 1/1", rule75.Total, rule75.Passing)
	}

	deathBenefit := report.ByRule["RULE-DEATH-BENEFIT"]
	if deathBenefit.Total != 1 || deathBenefit.Failing != 1 {
		t.Errorf("RULE-DEATH-BENEFIT: got total=%d failing=%d, want 1/1", deathBenefit.Total, deathBenefit.Failing)
	}

	ipr := report.ByRule["RULE-IPR-CALC"]
	if ipr.Total != 1 || ipr.Skipped != 1 {
		t.Errorf("RULE-IPR-CALC: got total=%d skipped=%d, want 1/1", ipr.Total, ipr.Skipped)
	}

	// Verify RuleID populated on individual test results.
	for _, tr := range report.Tests {
		if tr.RuleID == "" {
			t.Errorf("Test %q should have a RuleID", tr.Name)
		}
	}
}

func TestLoadTestReport_WithoutMapping(t *testing.T) {
	report, err := LoadTestReport(
		testdataPath("test-report.json"),
		"",
	)
	if err != nil {
		t.Fatalf("LoadTestReport returned error: %v", err)
	}

	if report.Total != 4 {
		t.Errorf("Total: got %d, want 4", report.Total)
	}
	if len(report.ByRule) != 0 {
		t.Errorf("ByRule should be empty without mapping, got %d entries", len(report.ByRule))
	}
	for _, tr := range report.Tests {
		if tr.RuleID != "" {
			t.Errorf("Test %q should not have a RuleID without mapping", tr.Name)
		}
	}
}

func TestLoadTestReport_NonexistentReport(t *testing.T) {
	report, err := LoadTestReport(
		"/nonexistent/path/report.json",
		testdataPath("test-rule-mapping.json"),
	)
	if err != nil {
		t.Fatalf("Expected no error for missing report, got: %v", err)
	}
	if report.Total != 0 {
		t.Errorf("Total: got %d, want 0", report.Total)
	}
	if len(report.Tests) != 0 {
		t.Errorf("Tests should be empty, got %d", len(report.Tests))
	}
	if len(report.ByRule) != 0 {
		t.Errorf("ByRule should be empty, got %d", len(report.ByRule))
	}
}
