package db

import (
	"testing"

	"github.com/noui/platform/migration/models"
)

func TestPersistPatterns_BuildsValidSQL(t *testing.T) {
	patterns := []models.ReconciliationPattern{
		{
			SuspectedDomain:  "salary",
			PlanCode:         "TIER_1",
			Direction:        "negative",
			MemberCount:      23,
			MeanVariance:     "-142.75",
			CoefficientOfVar: 0.18,
			AffectedMembers:  []string{"M001", "M002"},
			CorrectionType:   strPtr("MAPPING_FIX"),
			AffectedField:    strPtr("gross_amount"),
			Confidence:       float64Ptr(0.82),
			Evidence:         strPtr("23 members in TIER_1 show -142.75 salary variance"),
		},
	}

	if len(patterns) != 1 {
		t.Errorf("expected 1 pattern, got %d", len(patterns))
	}
	if patterns[0].MemberCount != 23 {
		t.Errorf("expected member_count=23, got %d", patterns[0].MemberCount)
	}
	if *patterns[0].CorrectionType != "MAPPING_FIX" {
		t.Errorf("expected MAPPING_FIX, got %s", *patterns[0].CorrectionType)
	}
}

func strPtr(s string) *string       { return &s }
func float64Ptr(f float64) *float64 { return &f }
