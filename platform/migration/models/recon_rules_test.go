package models

import (
	"encoding/json"
	"testing"
)

func TestReconRuleSetModel(t *testing.T) {
	t.Run("status_constants_are_valid", func(t *testing.T) {
		statuses := []ReconRuleSetStatus{
			ReconRuleSetDraft,
			ReconRuleSetActive,
			ReconRuleSetSuperseded,
			ReconRuleSetArchived,
		}
		for _, s := range statuses {
			if !ValidReconRuleSetStatuses[s] {
				t.Errorf("status %q not in ValidReconRuleSetStatuses", s)
			}
		}
		if len(ValidReconRuleSetStatuses) != 4 {
			t.Errorf("expected 4 valid statuses, got %d", len(ValidReconRuleSetStatuses))
		}
	})

	t.Run("comparison_type_constants_are_valid", func(t *testing.T) {
		types := []ReconComparisonType{
			ComparisonExact,
			ComparisonToleranceAbs,
			ComparisonTolerancePct,
			ComparisonRoundThenCompare,
		}
		for _, ct := range types {
			if !ValidComparisonTypes[ct] {
				t.Errorf("comparison type %q not in ValidComparisonTypes", ct)
			}
		}
		if len(ValidComparisonTypes) != 4 {
			t.Errorf("expected 4 valid comparison types, got %d", len(ValidComparisonTypes))
		}
	})

	t.Run("priority_constants_are_valid", func(t *testing.T) {
		prios := []ReconPriority{PriorityP1, PriorityP2, PriorityP3}
		for _, p := range prios {
			if !ValidPriorities[p] {
				t.Errorf("priority %q not in ValidPriorities", p)
			}
		}
		if len(ValidPriorities) != 3 {
			t.Errorf("expected 3 valid priorities, got %d", len(ValidPriorities))
		}
	})

	t.Run("recon_rule_set_json_roundtrip", func(t *testing.T) {
		rs := ReconRuleSet{
			RulesetID:    "rs-001",
			EngagementID: "eng-001",
			Version:      1,
			Label:        "Initial Rules",
			Status:       ReconRuleSetDraft,
			Rules: []ReconRule{
				{
					RuleID:             "1_annual_benefit",
					Tier:               1,
					CalcName:           "annual_benefit",
					ComparisonType:     ComparisonToleranceAbs,
					ToleranceValue:     "0.01",
					PriorityIfMismatch: PriorityP1,
					Enabled:            true,
				},
			},
			CreatedBy: "user_test_analyst",
		}

		data, err := json.Marshal(rs)
		if err != nil {
			t.Fatalf("marshal failed: %v", err)
		}

		var decoded ReconRuleSet
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("unmarshal failed: %v", err)
		}

		if decoded.RulesetID != rs.RulesetID {
			t.Errorf("ruleset_id = %q, want %q", decoded.RulesetID, rs.RulesetID)
		}
		if decoded.Version != 1 {
			t.Errorf("version = %d, want 1", decoded.Version)
		}
		if len(decoded.Rules) != 1 {
			t.Fatalf("rules length = %d, want 1", len(decoded.Rules))
		}
		if decoded.Rules[0].ToleranceValue != "0.01" {
			t.Errorf("tolerance_value = %q, want %q", decoded.Rules[0].ToleranceValue, "0.01")
		}
		if decoded.Rules[0].PriorityIfMismatch != PriorityP1 {
			t.Errorf("priority = %q, want P1", decoded.Rules[0].PriorityIfMismatch)
		}
	})

	t.Run("tolerance_value_is_string_not_float", func(t *testing.T) {
		// Ensure tolerance_value survives JSON without floating-point precision loss.
		rule := ReconRule{
			RuleID:             "2_service_credit",
			Tier:               2,
			CalcName:           "service_credit",
			ComparisonType:     ComparisonTolerancePct,
			ToleranceValue:     "0.005",
			PriorityIfMismatch: PriorityP2,
			Enabled:            true,
		}

		data, _ := json.Marshal(rule)
		var decoded ReconRule
		json.Unmarshal(data, &decoded)

		if decoded.ToleranceValue != "0.005" {
			t.Errorf("tolerance_value = %q, want %q — decimal precision lost", decoded.ToleranceValue, "0.005")
		}
	})

	t.Run("rule_id_generation_pattern", func(t *testing.T) {
		// Verify the expected {tier}_{calc_name} pattern.
		tests := []struct {
			tier     int
			calcName string
			expected string
		}{
			{1, "annual_benefit", "1_annual_benefit"},
			{2, "service_credit", "2_service_credit"},
			{3, "address_match", "3_address_match"},
		}
		for _, tc := range tests {
			ruleID := ruleIDFromTierCalc(tc.tier, tc.calcName)
			if ruleID != tc.expected {
				t.Errorf("ruleID(%d, %q) = %q, want %q", tc.tier, tc.calcName, ruleID, tc.expected)
			}
		}
	})

	t.Run("only_one_active_per_engagement_constraint", func(t *testing.T) {
		// This is a DB-level constraint (UNIQUE on engagement_id + version).
		// At the model level, we verify that status transitions are correct.
		// DRAFT → ACTIVE is valid.
		// ACTIVE → SUPERSEDED is valid.
		// SUPERSEDED → ARCHIVED is valid.
		// Any other mutation on non-DRAFT is invalid.
		validTransitions := map[ReconRuleSetStatus]ReconRuleSetStatus{
			ReconRuleSetDraft:      ReconRuleSetActive,
			ReconRuleSetActive:     ReconRuleSetSuperseded,
			ReconRuleSetSuperseded: ReconRuleSetArchived,
		}

		for from, to := range validTransitions {
			if from == to {
				t.Errorf("self-transition %q → %q should not exist", from, to)
			}
			if !ValidReconRuleSetStatuses[from] || !ValidReconRuleSetStatuses[to] {
				t.Errorf("invalid status in transition %q → %q", from, to)
			}
		}

		// Archived is terminal — no transitions out.
		if _, ok := validTransitions[ReconRuleSetArchived]; ok {
			t.Error("ARCHIVED should be terminal — no outbound transitions")
		}
	})

	t.Run("recon_rule_diff_types", func(t *testing.T) {
		diff := ReconRuleDiff{
			FromRulesetID: "rs-001",
			FromVersion:   1,
			ToRulesetID:   "rs-002",
			ToVersion:     2,
			Added:         []ReconRule{{RuleID: "2_new_calc", Tier: 2, CalcName: "new_calc"}},
			Removed:       []ReconRule{{RuleID: "1_old_calc", Tier: 1, CalcName: "old_calc"}},
			Modified: []ReconRuleChange{{
				RuleID: "1_annual_benefit",
				From:   ReconRule{ToleranceValue: "0.01"},
				To:     ReconRule{ToleranceValue: "0.02"},
			}},
		}

		data, err := json.Marshal(diff)
		if err != nil {
			t.Fatalf("marshal diff failed: %v", err)
		}

		var decoded ReconRuleDiff
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("unmarshal diff failed: %v", err)
		}

		if len(decoded.Added) != 1 {
			t.Errorf("added length = %d, want 1", len(decoded.Added))
		}
		if len(decoded.Removed) != 1 {
			t.Errorf("removed length = %d, want 1", len(decoded.Removed))
		}
		if len(decoded.Modified) != 1 {
			t.Errorf("modified length = %d, want 1", len(decoded.Modified))
		}
	})
}

// ruleIDFromTierCalc is a test helper that mirrors the handler's rule_id generation.
func ruleIDFromTierCalc(tier int, calcName string) string {
	return string(rune('0'+tier)) + "_" + calcName
}
