package rules

import (
	"testing"
	"time"
)

func TestRuleTypeInstantiation(t *testing.T) {
	// Verify that a Rule with conditional logic can be instantiated and fields
	// are accessible. This is a compilation + basic sanity test.
	r := Rule{
		ID:          "RULE-VESTING",
		Name:        "Vesting Requirement",
		Description: "All DERP members vest after 5 years of EARNED service credit.",
		SourceReference: SourceRef{
			Document:     "RMC",
			Section:      "Section 5.01 - Vesting",
			LastVerified: "2026-03-01",
		},
		AppliesTo: AppliesTo{
			Tiers:       []string{"tier_1", "tier_2", "tier_3"},
			MemberTypes: []string{"active", "terminated"},
		},
		Inputs: []RuleParam{
			{
				Name:     "earned_service_years",
				Type:     "decimal",
				Required: true,
			},
		},
		Logic: RuleLogic{
			Type: "conditional",
			Conditions: []Condition{
				{
					Condition: "earned_service_years >= 5.0",
					Result:    map[string]interface{}{"is_vested": true},
				},
				{
					Condition: "earned_service_years < 5.0",
					Result:    map[string]interface{}{"is_vested": false},
				},
			},
			CriticalNote: "Use earned_service_years ONLY. Purchased service excluded.",
		},
		Output: RuleOutput{
			Name: "vesting_status",
			Type: "object",
			Fields: []RuleOutputField{
				{Name: "is_vested", Type: "boolean"},
				{Name: "years_to_vest", Type: "decimal"},
			},
		},
		Dependencies: []string{"RULE-SVC-EARNED"},
		Tags:         []string{"eligibility", "vesting", "prerequisite"},
		TestCases: []RuleTestCase{
			{
				Name:     "Happy path - well over vesting",
				Type:     "happy_path",
				Inputs:   map[string]interface{}{"earned_service_years": 27.5},
				Expected: map[string]interface{}{"is_vested": true},
			},
		},
		Governance: RuleGovernance{
			Status:       "approved",
			LastReviewed: "2026-03-02",
			ReviewedBy:   "Plan Administrator",
		},
	}

	if r.ID != "RULE-VESTING" {
		t.Errorf("expected ID RULE-VESTING, got %s", r.ID)
	}
	if r.Logic.Type != "conditional" {
		t.Errorf("expected logic type conditional, got %s", r.Logic.Type)
	}
	if len(r.Logic.Conditions) != 2 {
		t.Errorf("expected 2 conditions, got %d", len(r.Logic.Conditions))
	}
	if len(r.AppliesTo.Tiers) != 3 {
		t.Errorf("expected 3 tiers, got %d", len(r.AppliesTo.Tiers))
	}
	if len(r.TestCases) != 1 {
		t.Errorf("expected 1 test case, got %d", len(r.TestCases))
	}
	if r.Governance.Status != "approved" {
		t.Errorf("expected governance status approved, got %s", r.Governance.Status)
	}
}

func TestTestStatusNotFromYAML(t *testing.T) {
	// TestStatus should only be populated at runtime, not parsed from YAML.
	// Verify the struct can hold runtime data.
	now := time.Now()
	ts := &TestStatus{
		Total:   10,
		Passing: 8,
		Failing: 1,
		Skipped: 1,
		LastRun: &now,
	}

	r := Rule{
		ID:         "RULE-TEST",
		Name:       "Test Rule",
		TestStatus: ts,
	}

	if r.TestStatus.Total != 10 {
		t.Errorf("expected total 10, got %d", r.TestStatus.Total)
	}
	if r.TestStatus.Passing != 8 {
		t.Errorf("expected passing 8, got %d", r.TestStatus.Passing)
	}
}

func TestRuleLogicFormula(t *testing.T) {
	// Verify formula-type logic fields.
	r := Rule{
		ID:   "RULE-BENEFIT-T1",
		Name: "Tier 1 Benefit Formula",
		Logic: RuleLogic{
			Type:       "formula",
			Expression: "monthly_benefit = ams * 0.020 * total_service_for_benefit",
			Variables:  map[string]interface{}{"multiplier": 0.020},
		},
	}

	if r.Logic.Expression == "" {
		t.Error("expected expression to be set")
	}
	if r.Logic.Variables["multiplier"] != 0.020 {
		t.Errorf("expected multiplier 0.020, got %v", r.Logic.Variables["multiplier"])
	}
}

func TestRuleLogicLookupTable(t *testing.T) {
	// Verify lookup_table-type logic fields.
	r := Rule{
		ID:   "RULE-EARLY-REDUCE-T12",
		Name: "Early Retirement Reduction - Tiers 1 and 2",
		Logic: RuleLogic{
			Type:       "lookup_table",
			KeyField:   "age",
			ValueField: "factor",
			Table: []TableRow{
				{"age": 55, "factor": 0.70},
				{"age": 65, "factor": 1.00},
			},
		},
	}

	if len(r.Logic.Table) != 2 {
		t.Errorf("expected 2 table rows, got %d", len(r.Logic.Table))
	}
	if r.Logic.KeyField != "age" {
		t.Errorf("expected key_field age, got %s", r.Logic.KeyField)
	}
}

func TestRuleLogicProcedural(t *testing.T) {
	// Verify procedural-type logic fields.
	r := Rule{
		ID:   "RULE-ELIG-HIERARCHY",
		Name: "Eligibility Determination Hierarchy",
		Logic: RuleLogic{
			Type: "procedural",
			Steps: []Step{
				{Step: 1, Action: "Check RULE-NORMAL-RET", IfTrue: "retirement_type = 'normal'"},
				{Step: 2, Action: "Check RULE-RULE-OF-75", IfTrue: "retirement_type = 'rule_of_n'"},
			},
		},
	}

	if len(r.Logic.Steps) != 2 {
		t.Errorf("expected 2 steps, got %d", len(r.Logic.Steps))
	}
	if r.Logic.Steps[0].Step != 1 {
		t.Errorf("expected step 1, got %d", r.Logic.Steps[0].Step)
	}
}
