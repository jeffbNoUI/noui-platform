package report

import (
	"strings"
	"testing"

	"github.com/noui/platform/migration/models"
)

// reconRecord is a test helper mimicking migrationdb.ReconciliationRecord
// (same field names used in the template via derefString).
type reconRecord struct {
	ReconID         string  `json:"recon_id"`
	BatchID         string  `json:"batch_id"`
	MemberID        string  `json:"member_id"`
	CalcName        string  `json:"calc_name"`
	LegacyValue     *string `json:"legacy_value"`
	RecomputedValue *string `json:"recomputed_value"`
	Category        string  `json:"category"`
	Priority        string  `json:"priority"`
	Tier            int     `json:"tier"`
}

func strPtr(s string) *string { return &s }

func TestReconciliationReportTemplate(t *testing.T) {
	t.Run("renders_complete_report", func(t *testing.T) {
		data := struct {
			EngagementID   string
			SourceSystem   string
			SchemaVersion  string
			GeneratedAt    string
			Summary        models.ReconciliationSummaryResult
			TierBreakdowns []struct {
				Tier       int
				Records    []reconRecord
				Truncated  bool
				TotalCount int
			}
			Patterns []models.ReconciliationPattern
		}{
			EngagementID:  "eng-recon",
			SourceSystem:  "LegacyPAS",
			SchemaVersion: "v1",
			GeneratedAt:   "2026-03-26T12:00:00Z",
			Summary: models.ReconciliationSummaryResult{
				TotalRecords: 500,
				MatchCount:   450,
				MinorCount:   30,
				MajorCount:   15,
				ErrorCount:   5,
				GateScore:    0.90,
				P1Count:      3,
				Tier1Score:   0.95,
				Tier2Score:   0.88,
				Tier3Score:   0.85,
			},
			TierBreakdowns: []struct {
				Tier       int
				Records    []reconRecord
				Truncated  bool
				TotalCount int
			}{
				{
					Tier: 1,
					Records: []reconRecord{
						{MemberID: "MEM001", CalcName: "monthly_benefit", LegacyValue: strPtr("2500.00"), RecomputedValue: strPtr("2500.00"), Category: "MATCH", Priority: "P3"},
						{MemberID: "MEM002", CalcName: "monthly_benefit", LegacyValue: strPtr("3100.00"), RecomputedValue: strPtr("3050.00"), Category: "MINOR", Priority: "P2"},
					},
					TotalCount: 2,
				},
				{
					Tier: 2,
					Records: []reconRecord{
						{MemberID: "MEM003", CalcName: "service_years", LegacyValue: strPtr("25"), RecomputedValue: strPtr("24"), Category: "MAJOR", Priority: "P1"},
					},
					TotalCount: 1,
				},
				{
					Tier:       3,
					Records:    []reconRecord{},
					TotalCount: 0,
				},
			},
			Patterns: []models.ReconciliationPattern{
				{
					PatternID:       "pat-001",
					SuspectedDomain: "benefit_calculation",
					Direction:       "OVER",
					MemberCount:     12,
					MeanVariance:    "50.25",
					Resolved:        false,
				},
			},
		}

		html, err := RenderReconciliationReportHTML(data)
		if err != nil {
			t.Fatalf("RenderReconciliationReportHTML error: %v", err)
		}

		checks := []string{
			"Reconciliation Summary",
			"eng-recon",
			"LegacyPAS",
			"500", // total records
			"450", // match count
			"30",  // minor count
			"15",  // major count
			"5",   // error count
			"3",   // P1 count
			"MEM001",
			"MEM002",
			"MEM003",
			"monthly_benefit",
			"service_years",
			"2500.00",
			"3050.00",
			"benefit_calculation",
			"OVER",
			"50.25",
			"Tier 1",
			"Tier 2",
			"Tier 3",
		}
		for _, check := range checks {
			if !strings.Contains(html, check) {
				t.Errorf("reconciliation report HTML missing expected content: %q", check)
			}
		}

		// Gate score color classes.
		if !strings.Contains(html, "score-yellow") {
			t.Error("gate score 0.90 should render as yellow (0.80-0.94)")
		}
		if !strings.Contains(html, "score-green") {
			t.Error("tier1 score 0.95 should render as green (>= 0.95)")
		}
	})

	t.Run("renders_gate_score_colors", func(t *testing.T) {
		tests := []struct {
			name      string
			score     float64
			wantClass string
		}{
			{"green", 0.97, "score-green"},
			{"yellow", 0.85, "score-yellow"},
			{"red", 0.50, "score-red"},
		}

		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				data := struct {
					EngagementID   string
					SourceSystem   string
					SchemaVersion  string
					GeneratedAt    string
					Summary        models.ReconciliationSummaryResult
					TierBreakdowns []struct {
						Tier       int
						Records    []reconRecord
						Truncated  bool
						TotalCount int
					}
					Patterns []models.ReconciliationPattern
				}{
					EngagementID:  "eng-color",
					SourceSystem:  "Test",
					SchemaVersion: "v1",
					GeneratedAt:   "2026-03-26T12:00:00Z",
					Summary: models.ReconciliationSummaryResult{
						GateScore:  tc.score,
						Tier1Score: tc.score,
						Tier2Score: tc.score,
						Tier3Score: tc.score,
					},
					TierBreakdowns: []struct {
						Tier       int
						Records    []reconRecord
						Truncated  bool
						TotalCount int
					}{
						{Tier: 1, Records: []reconRecord{}},
						{Tier: 2, Records: []reconRecord{}},
						{Tier: 3, Records: []reconRecord{}},
					},
					Patterns: []models.ReconciliationPattern{},
				}

				html, err := RenderReconciliationReportHTML(data)
				if err != nil {
					t.Fatalf("error: %v", err)
				}

				if !strings.Contains(html, tc.wantClass) {
					t.Errorf("score %.2f should contain class %q", tc.score, tc.wantClass)
				}
			})
		}
	})

	t.Run("renders_truncation_notice", func(t *testing.T) {
		data := struct {
			EngagementID   string
			SourceSystem   string
			SchemaVersion  string
			GeneratedAt    string
			Summary        models.ReconciliationSummaryResult
			TierBreakdowns []struct {
				Tier       int
				Records    []reconRecord
				Truncated  bool
				TotalCount int
			}
			Patterns []models.ReconciliationPattern
		}{
			EngagementID:  "eng-trunc",
			SourceSystem:  "Test",
			SchemaVersion: "v1",
			GeneratedAt:   "2026-03-26T12:00:00Z",
			Summary:       models.ReconciliationSummaryResult{TotalRecords: 300},
			TierBreakdowns: []struct {
				Tier       int
				Records    []reconRecord
				Truncated  bool
				TotalCount int
			}{
				{
					Tier:       1,
					Records:    []reconRecord{{MemberID: "M1", CalcName: "c", Category: "MATCH", Priority: "P3"}},
					Truncated:  true,
					TotalCount: 500,
				},
				{Tier: 2, Records: []reconRecord{}},
				{Tier: 3, Records: []reconRecord{}},
			},
			Patterns: []models.ReconciliationPattern{},
		}

		html, err := RenderReconciliationReportHTML(data)
		if err != nil {
			t.Fatalf("error: %v", err)
		}

		if !strings.Contains(html, "500") {
			t.Error("should show total count 500 in truncation notice")
		}
		if !strings.Contains(html, "JSON export") {
			t.Error("truncation notice should mention JSON export")
		}
	})

	t.Run("no_patterns_hides_section", func(t *testing.T) {
		data := struct {
			EngagementID   string
			SourceSystem   string
			SchemaVersion  string
			GeneratedAt    string
			Summary        models.ReconciliationSummaryResult
			TierBreakdowns []struct {
				Tier       int
				Records    []reconRecord
				Truncated  bool
				TotalCount int
			}
			Patterns []models.ReconciliationPattern
		}{
			EngagementID:  "eng-nopat",
			SourceSystem:  "Test",
			SchemaVersion: "v1",
			GeneratedAt:   "2026-03-26T12:00:00Z",
			Summary:       models.ReconciliationSummaryResult{},
			TierBreakdowns: []struct {
				Tier       int
				Records    []reconRecord
				Truncated  bool
				TotalCount int
			}{
				{Tier: 1, Records: []reconRecord{}},
				{Tier: 2, Records: []reconRecord{}},
				{Tier: 3, Records: []reconRecord{}},
			},
			Patterns: []models.ReconciliationPattern{},
		}

		html, err := RenderReconciliationReportHTML(data)
		if err != nil {
			t.Fatalf("error: %v", err)
		}

		if strings.Contains(html, "Pattern Analysis") {
			t.Error("Pattern Analysis section should be hidden when no patterns")
		}
	})
}
