package reconciler

import (
	"math/big"
	"testing"

	"github.com/noui/platform/migration/models"
)

func strPtr(s string) *string { return &s }

func TestExecuteRules_ExactMatch(t *testing.T) {
	ruleset := &models.ReconRuleSet{
		RulesetID: "rs-001",
		Rules: []models.ReconRule{
			{RuleID: "r1", CalcName: "monthly_benefit", ComparisonType: models.ComparisonExact, PriorityIfMismatch: models.PriorityP1, Enabled: true},
		},
	}
	results := []models.ParallelRunResult{
		{MemberID: "m1", CanonicalEntity: "benefit", FieldName: "monthly_benefit", LegacyValue: strPtr("1000.00"), NewValue: strPtr("1000.00")},
	}

	mismatches, err := ExecuteRules("exec-001", ruleset, results)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(mismatches) != 0 {
		t.Errorf("expected 0 mismatches, got %d", len(mismatches))
	}
}

func TestExecuteRules_ExactMismatch(t *testing.T) {
	ruleset := &models.ReconRuleSet{
		RulesetID: "rs-001",
		Rules: []models.ReconRule{
			{RuleID: "r1", CalcName: "monthly_benefit", ComparisonType: models.ComparisonExact, PriorityIfMismatch: models.PriorityP1, Enabled: true},
		},
	}
	results := []models.ParallelRunResult{
		{MemberID: "m1", CanonicalEntity: "benefit", FieldName: "monthly_benefit", LegacyValue: strPtr("1000.00"), NewValue: strPtr("999.99")},
	}

	mismatches, err := ExecuteRules("exec-001", ruleset, results)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(mismatches) != 1 {
		t.Fatalf("expected 1 mismatch, got %d", len(mismatches))
	}
	if mismatches[0].Priority != models.PriorityP1 {
		t.Errorf("expected P1, got %s", mismatches[0].Priority)
	}
	if mismatches[0].RuleID != "r1" {
		t.Errorf("expected rule_id r1, got %s", mismatches[0].RuleID)
	}
}

func TestExecuteRules_ToleranceAbs_WithinTolerance(t *testing.T) {
	ruleset := &models.ReconRuleSet{
		Rules: []models.ReconRule{
			{RuleID: "r1", CalcName: "salary", ComparisonType: models.ComparisonToleranceAbs, ToleranceValue: "0.50", PriorityIfMismatch: models.PriorityP2, Enabled: true},
		},
	}
	results := []models.ParallelRunResult{
		{MemberID: "m1", CanonicalEntity: "member", FieldName: "salary", LegacyValue: strPtr("50000.00"), NewValue: strPtr("50000.49")},
	}

	mismatches, err := ExecuteRules("exec-001", ruleset, results)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(mismatches) != 0 {
		t.Errorf("expected 0 mismatches (within tolerance), got %d", len(mismatches))
	}
}

func TestExecuteRules_ToleranceAbs_Exceeds(t *testing.T) {
	ruleset := &models.ReconRuleSet{
		Rules: []models.ReconRule{
			{RuleID: "r1", CalcName: "salary", ComparisonType: models.ComparisonToleranceAbs, ToleranceValue: "0.50", PriorityIfMismatch: models.PriorityP2, Enabled: true},
		},
	}
	results := []models.ParallelRunResult{
		{MemberID: "m1", CanonicalEntity: "member", FieldName: "salary", LegacyValue: strPtr("50000.00"), NewValue: strPtr("50000.51")},
	}

	mismatches, err := ExecuteRules("exec-001", ruleset, results)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(mismatches) != 1 {
		t.Fatalf("expected 1 mismatch (exceeds tolerance), got %d", len(mismatches))
	}
	if mismatches[0].VarianceAmount == nil {
		t.Fatal("expected variance_amount to be set")
	}
}

func TestExecuteRules_TolerancePct(t *testing.T) {
	ruleset := &models.ReconRuleSet{
		Rules: []models.ReconRule{
			{RuleID: "r1", CalcName: "contribution", ComparisonType: models.ComparisonTolerancePct, ToleranceValue: "0.01", PriorityIfMismatch: models.PriorityP3, Enabled: true},
		},
	}

	// 1% of 10000 = 100; difference 101 > 100 → mismatch
	results := []models.ParallelRunResult{
		{MemberID: "m1", CanonicalEntity: "contribution", FieldName: "contribution", LegacyValue: strPtr("10000"), NewValue: strPtr("9899")},
	}

	mismatches, err := ExecuteRules("exec-001", ruleset, results)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(mismatches) != 1 {
		t.Fatalf("expected 1 mismatch (exceeds 1%%), got %d", len(mismatches))
	}
}

func TestExecuteRules_RoundThenCompare_Match(t *testing.T) {
	ruleset := &models.ReconRuleSet{
		Rules: []models.ReconRule{
			{RuleID: "r1", CalcName: "benefit", ComparisonType: models.ComparisonRoundThenCompare, PriorityIfMismatch: models.PriorityP1, Enabled: true},
		},
	}
	// 100.004 rounds to 100.00, 100.003 rounds to 100.00 → match
	results := []models.ParallelRunResult{
		{MemberID: "m1", CanonicalEntity: "benefit", FieldName: "benefit", LegacyValue: strPtr("100.004"), NewValue: strPtr("100.003")},
	}

	mismatches, err := ExecuteRules("exec-001", ruleset, results)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(mismatches) != 0 {
		t.Errorf("expected 0 mismatches (both round to 100.00), got %d", len(mismatches))
	}
}

func TestExecuteRules_RoundThenCompare_Mismatch(t *testing.T) {
	ruleset := &models.ReconRuleSet{
		Rules: []models.ReconRule{
			{RuleID: "r1", CalcName: "benefit", ComparisonType: models.ComparisonRoundThenCompare, PriorityIfMismatch: models.PriorityP1, Enabled: true},
		},
	}
	// 100.005 rounds to 100.01, 100.004 rounds to 100.00 → mismatch
	results := []models.ParallelRunResult{
		{MemberID: "m1", CanonicalEntity: "benefit", FieldName: "benefit", LegacyValue: strPtr("100.005"), NewValue: strPtr("100.004")},
	}

	mismatches, err := ExecuteRules("exec-001", ruleset, results)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(mismatches) != 1 {
		t.Errorf("expected 1 mismatch (100.01 vs 100.00), got %d", len(mismatches))
	}
}

func TestExecuteRules_DisabledRuleSkipped(t *testing.T) {
	ruleset := &models.ReconRuleSet{
		Rules: []models.ReconRule{
			{RuleID: "r1", CalcName: "salary", ComparisonType: models.ComparisonExact, PriorityIfMismatch: models.PriorityP1, Enabled: false},
		},
	}
	results := []models.ParallelRunResult{
		{MemberID: "m1", CanonicalEntity: "member", FieldName: "salary", LegacyValue: strPtr("1000"), NewValue: strPtr("2000")},
	}

	mismatches, err := ExecuteRules("exec-001", ruleset, results)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(mismatches) != 0 {
		t.Errorf("expected disabled rule to be skipped, got %d mismatches", len(mismatches))
	}
}

func TestExecuteRules_MultipleRulesMultipleResults(t *testing.T) {
	ruleset := &models.ReconRuleSet{
		Rules: []models.ReconRule{
			{RuleID: "r1", CalcName: "benefit", ComparisonType: models.ComparisonExact, PriorityIfMismatch: models.PriorityP1, Enabled: true},
			{RuleID: "r2", CalcName: "salary", ComparisonType: models.ComparisonToleranceAbs, ToleranceValue: "1.00", PriorityIfMismatch: models.PriorityP2, Enabled: true},
		},
	}
	results := []models.ParallelRunResult{
		{MemberID: "m1", CanonicalEntity: "benefit", FieldName: "benefit", LegacyValue: strPtr("500"), NewValue: strPtr("501")},
		{MemberID: "m1", CanonicalEntity: "member", FieldName: "salary", LegacyValue: strPtr("5000"), NewValue: strPtr("5000.50")},
		{MemberID: "m2", CanonicalEntity: "benefit", FieldName: "benefit", LegacyValue: strPtr("600"), NewValue: strPtr("600")},
		{MemberID: "m2", CanonicalEntity: "member", FieldName: "salary", LegacyValue: strPtr("6000"), NewValue: strPtr("6002")},
	}

	mismatches, err := ExecuteRules("exec-001", ruleset, results)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// m1 benefit: 500 != 501 → P1 mismatch
	// m1 salary: |5000 - 5000.50| = 0.50 ≤ 1.00 → match
	// m2 benefit: 600 == 600 → match
	// m2 salary: |6000 - 6002| = 2 > 1 → P2 mismatch
	if len(mismatches) != 2 {
		t.Fatalf("expected 2 mismatches, got %d", len(mismatches))
	}

	p1Count, p2Count := 0, 0
	for _, m := range mismatches {
		switch m.Priority {
		case models.PriorityP1:
			p1Count++
		case models.PriorityP2:
			p2Count++
		}
	}
	if p1Count != 1 || p2Count != 1 {
		t.Errorf("expected 1 P1 + 1 P2, got P1=%d P2=%d", p1Count, p2Count)
	}
}

func TestExecuteRules_NilRuleset(t *testing.T) {
	_, err := ExecuteRules("exec-001", nil, nil)
	if err == nil {
		t.Error("expected error for nil ruleset")
	}
}

func TestRoundRatTo2(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"100.004", "100.00"},
		{"100.005", "100.01"},
		{"100.015", "100.02"},
		{"-99.995", "-100.00"},
		{"0.001", "0.00"},
		{"0.005", "0.01"},
		{"123.456", "123.46"},
	}

	for _, tt := range tests {
		r, _ := new(big.Rat).SetString(tt.input)
		result := roundRatTo2(r)
		got := result.FloatString(2)
		if got != tt.expected {
			t.Errorf("roundRatTo2(%s) = %s, want %s", tt.input, got, tt.expected)
		}
	}
}

func TestExecuteRules_TolerancePct_ZeroLegacy(t *testing.T) {
	ruleset := &models.ReconRuleSet{
		Rules: []models.ReconRule{
			{RuleID: "r1", CalcName: "balance", ComparisonType: models.ComparisonTolerancePct, ToleranceValue: "0.05", PriorityIfMismatch: models.PriorityP2, Enabled: true},
		},
	}
	results := []models.ParallelRunResult{
		{MemberID: "m1", CanonicalEntity: "account", FieldName: "balance", LegacyValue: strPtr("0"), NewValue: strPtr("100")},
	}

	mismatches, err := ExecuteRules("exec-001", ruleset, results)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(mismatches) != 1 {
		t.Errorf("expected 1 mismatch (zero legacy, non-zero new), got %d", len(mismatches))
	}
}

func TestExecuteRules_NonNumericExactFallback(t *testing.T) {
	ruleset := &models.ReconRuleSet{
		Rules: []models.ReconRule{
			{RuleID: "r1", CalcName: "status", ComparisonType: models.ComparisonToleranceAbs, ToleranceValue: "0.01", PriorityIfMismatch: models.PriorityP3, Enabled: true},
		},
	}
	results := []models.ParallelRunResult{
		{MemberID: "m1", CanonicalEntity: "member", FieldName: "status", LegacyValue: strPtr("ACTIVE"), NewValue: strPtr("INACTIVE")},
	}

	mismatches, err := ExecuteRules("exec-001", ruleset, results)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(mismatches) != 1 {
		t.Errorf("expected 1 mismatch (non-numeric falls back to exact), got %d", len(mismatches))
	}
}
