package domain

import "testing"

func TestValidateEligibility_ValidCombinations(t *testing.T) {
	serviceTypes := []string{
		"REFUNDED_PRIOR_PERA",
		"MILITARY_USERRA",
		"PRIOR_PUBLIC_EMPLOYMENT",
		"LEAVE_OF_ABSENCE",
		"PERACHOICE_TRANSFER",
	}
	tiers := []string{"TIER_1", "TIER_2", "TIER_3"}

	for _, st := range serviceTypes {
		for _, tier := range tiers {
			result := ValidateEligibility(st, tier)
			if !result.Eligible {
				t.Errorf("expected eligible for %s/%s, got errors: %v", st, tier, result.Errors)
			}
			if result.Label == "" {
				t.Errorf("expected label for %s", st)
			}
			if len(result.RequiredDocs) == 0 {
				t.Errorf("expected required docs for %s", st)
			}
		}
	}
}

func TestValidateEligibility_InvalidServiceType(t *testing.T) {
	result := ValidateEligibility("INVALID_TYPE", "TIER_1")
	if result.Eligible {
		t.Error("expected not eligible for invalid service type")
	}
	if len(result.Errors) == 0 {
		t.Error("expected errors for invalid service type")
	}
}

func TestValidateEligibility_InvalidTier(t *testing.T) {
	result := ValidateEligibility("MILITARY_USERRA", "TIER_99")
	if result.Eligible {
		t.Error("expected not eligible for invalid tier")
	}
	if len(result.Errors) == 0 {
		t.Error("expected errors for invalid tier")
	}
}

func TestDocumentationRequirements_AllTypesHaveDocs(t *testing.T) {
	for st := range ValidServiceTypes {
		docs, ok := DocumentationRequirements[st]
		if !ok {
			t.Errorf("missing documentation requirements for %s", st)
		}
		if len(docs) == 0 {
			t.Errorf("empty documentation requirements for %s", st)
		}
	}
}

func TestServiceTypeLabel_AllTypesHaveLabels(t *testing.T) {
	for st := range ValidServiceTypes {
		label, ok := ServiceTypeLabel[st]
		if !ok {
			t.Errorf("missing label for %s", st)
		}
		if label == "" {
			t.Errorf("empty label for %s", st)
		}
	}
}
