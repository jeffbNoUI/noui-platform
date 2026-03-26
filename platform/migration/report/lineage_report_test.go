package report

import (
	"strings"
	"testing"

	"github.com/noui/platform/migration/models"
)

func TestLineageReportTemplate(t *testing.T) {
	t.Run("renders_complete_report", func(t *testing.T) {
		data := struct {
			EngagementID  string
			SourceSystem  string
			BatchID       string
			BatchStatus   string
			GeneratedAt   string
			Summary       models.LineageSummary
			HandlerGroups []struct {
				HandlerName string
				Entries     []models.LineageRecord
				Truncated   bool
				TotalCount  int
			}
		}{
			EngagementID: "eng-001",
			SourceSystem: "LegacyPAS",
			BatchID:      "batch-001",
			BatchStatus:  "COMPLETED",
			GeneratedAt:  "2026-03-26T12:00:00Z",
			Summary: models.LineageSummary{
				TotalRecords:        150,
				UniqueMembers:       25,
				FieldsCovered:       8,
				TransformationTypes: []string{"date_normalize", "code_map"},
				ExceptionCount:      3,
			},
			HandlerGroups: []struct {
				HandlerName string
				Entries     []models.LineageRecord
				Truncated   bool
				TotalCount  int
			}{
				{
					HandlerName: "date_normalize",
					Entries: []models.LineageRecord{
						{LineageID: "l1", BatchID: "batch-001", RowKey: "MEM001", HandlerName: "date_normalize", ColumnName: "hire_date", SourceValue: "01/15/1990", ResultValue: "1990-01-15"},
						{LineageID: "l2", BatchID: "batch-001", RowKey: "MEM002", HandlerName: "date_normalize", ColumnName: "hire_date", SourceValue: "02/20/1985", ResultValue: "1985-02-20"},
					},
					TotalCount: 2,
				},
				{
					HandlerName: "code_map",
					Entries: []models.LineageRecord{
						{LineageID: "l3", BatchID: "batch-001", RowKey: "MEM001", HandlerName: "code_map", ColumnName: "status_code", SourceValue: "A", ResultValue: "ACTIVE"},
					},
					TotalCount: 1,
				},
			},
		}

		html, err := RenderLineageReportHTML(data)
		if err != nil {
			t.Fatalf("RenderLineageReportHTML error: %v", err)
		}

		// Verify key content is present.
		checks := []string{
			"Lineage Traceability Report",
			"eng-001",
			"LegacyPAS",
			"batch-001",
			"COMPLETED",
			"150", // total records
			"25",  // unique members
			"8",   // fields covered
			"3",   // exception count
			"date_normalize",
			"code_map",
			"MEM001",
			"hire_date",
			"01/15/1990",
			"1990-01-15",
			"status_code",
			"ACTIVE",
		}
		for _, check := range checks {
			if !strings.Contains(html, check) {
				t.Errorf("lineage report HTML missing expected content: %q", check)
			}
		}

		// Verify HTML structure.
		if !strings.Contains(html, "<!DOCTYPE html>") {
			t.Error("missing DOCTYPE")
		}
		if !strings.Contains(html, "</html>") {
			t.Error("missing closing html tag")
		}
	})

	t.Run("renders_truncation_notice", func(t *testing.T) {
		data := struct {
			EngagementID  string
			SourceSystem  string
			BatchID       string
			BatchStatus   string
			GeneratedAt   string
			Summary       models.LineageSummary
			HandlerGroups []struct {
				HandlerName string
				Entries     []models.LineageRecord
				Truncated   bool
				TotalCount  int
			}
		}{
			EngagementID: "eng-trunc",
			SourceSystem: "TestSystem",
			BatchID:      "batch-trunc",
			BatchStatus:  "COMPLETED",
			GeneratedAt:  "2026-03-26T12:00:00Z",
			Summary: models.LineageSummary{
				TotalRecords:        1000,
				UniqueMembers:       50,
				FieldsCovered:       10,
				TransformationTypes: []string{"big_handler"},
				ExceptionCount:      0,
			},
			HandlerGroups: []struct {
				HandlerName string
				Entries     []models.LineageRecord
				Truncated   bool
				TotalCount  int
			}{
				{
					HandlerName: "big_handler",
					Entries:     []models.LineageRecord{{LineageID: "l1", RowKey: "M1", ColumnName: "col", SourceValue: "a", ResultValue: "b"}},
					Truncated:   true,
					TotalCount:  750,
				},
			},
		}

		html, err := RenderLineageReportHTML(data)
		if err != nil {
			t.Fatalf("RenderLineageReportHTML error: %v", err)
		}

		if !strings.Contains(html, "750") {
			t.Error("truncation notice should show total count of 750")
		}
		if !strings.Contains(html, "JSON API") {
			t.Error("truncation notice should mention JSON API")
		}
	})

	t.Run("renders_exception_note_when_present", func(t *testing.T) {
		data := struct {
			EngagementID  string
			SourceSystem  string
			BatchID       string
			BatchStatus   string
			GeneratedAt   string
			Summary       models.LineageSummary
			HandlerGroups []struct {
				HandlerName string
				Entries     []models.LineageRecord
				Truncated   bool
				TotalCount  int
			}
		}{
			EngagementID: "eng-exc",
			SourceSystem: "Test",
			BatchID:      "batch-exc",
			BatchStatus:  "COMPLETED",
			GeneratedAt:  "2026-03-26T12:00:00Z",
			Summary: models.LineageSummary{
				TotalRecords:        10,
				UniqueMembers:       5,
				FieldsCovered:       2,
				TransformationTypes: []string{},
				ExceptionCount:      7,
			},
		}

		html, err := RenderLineageReportHTML(data)
		if err != nil {
			t.Fatalf("error: %v", err)
		}

		if !strings.Contains(html, "7 exception(s)") {
			t.Error("should show exception count of 7")
		}
	})
}
