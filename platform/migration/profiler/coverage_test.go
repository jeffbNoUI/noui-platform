package profiler

import (
	"testing"

	"github.com/noui/platform/migration/mapper"
)

func TestComputeCoverage_FullCoverageFromMappings(t *testing.T) {
	registry := mapper.NewRegistry()

	// Simulate existing mappings that cover all required member fields.
	tmplConf := 0.9
	sigConf := 0.85
	mappings := []FieldMappingRow{
		{SourceTable: "SRC", SourceColumn: "MBR_NBR", CanonicalTable: "member", CanonicalColumn: "member_id", TemplateConfidence: &tmplConf, SignalConfidence: &sigConf, AgreementStatus: "AGREED"},
		{SourceTable: "SRC", SourceColumn: "NATL_ID", CanonicalTable: "member", CanonicalColumn: "national_id", TemplateConfidence: &tmplConf, SignalConfidence: &sigConf, AgreementStatus: "AGREED"},
		{SourceTable: "SRC", SourceColumn: "BIRTH_DT", CanonicalTable: "member", CanonicalColumn: "birth_date", TemplateConfidence: &tmplConf, SignalConfidence: &sigConf, AgreementStatus: "AGREED"},
		{SourceTable: "SRC", SourceColumn: "FIRST_NM", CanonicalTable: "member", CanonicalColumn: "first_name", TemplateConfidence: &tmplConf, SignalConfidence: &sigConf, AgreementStatus: "AGREED"},
		{SourceTable: "SRC", SourceColumn: "LAST_NM", CanonicalTable: "member", CanonicalColumn: "last_name", TemplateConfidence: &tmplConf, SignalConfidence: &sigConf, AgreementStatus: "AGREED"},
		{SourceTable: "SRC", SourceColumn: "HIRE_DT", CanonicalTable: "member", CanonicalColumn: "original_hire_date", TemplateConfidence: &tmplConf, SignalConfidence: &sigConf, AgreementStatus: "AGREED"},
		{SourceTable: "SRC", SourceColumn: "PLAN_CD", CanonicalTable: "member", CanonicalColumn: "plan_code", TemplateConfidence: &tmplConf, SignalConfidence: &sigConf, AgreementStatus: "AGREED"},
		{SourceTable: "SRC", SourceColumn: "STATUS", CanonicalTable: "member", CanonicalColumn: "member_status", TemplateConfidence: &tmplConf, SignalConfidence: &sigConf, AgreementStatus: "AGREED"},
	}

	report := ComputeCoverage("eng-001", registry, mappings, nil)

	if report.EngagementID != "eng-001" {
		t.Errorf("EngagementID = %q, want eng-001", report.EngagementID)
	}
	if report.TotalCanonical == 0 {
		t.Fatal("TotalCanonical = 0, want >0")
	}
	if report.Covered < 8 {
		t.Errorf("Covered = %d, want >= 8 (the 8 mapped fields)", report.Covered)
	}
	if report.RequiredGaps > 0 && report.Covered >= 8 {
		// Some required gaps from other tables (earnings, employment, etc.) are expected
		// since we only mapped member fields. This is fine.
	}

	// Verify member_id is COVERED.
	var memberIDField *CanonicalFieldCoverage
	for i := range report.Fields {
		if report.Fields[i].CanonicalTable == "member" && report.Fields[i].CanonicalColumn == "member_id" {
			memberIDField = &report.Fields[i]
			break
		}
	}
	if memberIDField == nil {
		t.Fatal("member.member_id not found in report")
	}
	if memberIDField.Status != "COVERED" {
		t.Errorf("member.member_id status = %q, want COVERED", memberIDField.Status)
	}
	if memberIDField.BestConfidence < 0.85 {
		t.Errorf("member.member_id best_confidence = %.2f, want >= 0.85", memberIDField.BestConfidence)
	}
	if len(memberIDField.Candidates) != 1 {
		t.Errorf("member.member_id candidates = %d, want 1", len(memberIDField.Candidates))
	}
}

func TestComputeCoverage_SimilarityFallback(t *testing.T) {
	registry := mapper.NewRegistry()

	// No mappings, but source columns exist.
	sourceColumns := []SourceColumnInfo{
		{Table: "LEGACY", Column: "member_id", DataType: "INTEGER"},
		{Table: "LEGACY", Column: "birth_date", DataType: "DATE"},
		{Table: "LEGACY", Column: "random_col", DataType: "VARCHAR"},
	}

	report := ComputeCoverage("eng-002", registry, nil, sourceColumns)

	if report.TotalCanonical == 0 {
		t.Fatal("TotalCanonical = 0, want >0")
	}

	// member_id should be found via exact name similarity.
	var memberIDField *CanonicalFieldCoverage
	for i := range report.Fields {
		if report.Fields[i].CanonicalTable == "member" && report.Fields[i].CanonicalColumn == "member_id" {
			memberIDField = &report.Fields[i]
			break
		}
	}
	if memberIDField == nil {
		t.Fatal("member.member_id not found in report")
	}
	if memberIDField.BestConfidence < 0.5 {
		t.Errorf("member.member_id best_confidence = %.2f, want >= 0.5 (similarity match)", memberIDField.BestConfidence)
	}
	if len(memberIDField.Candidates) == 0 {
		t.Error("member.member_id should have at least one candidate")
	}
}

func TestComputeCoverage_NoCandidates(t *testing.T) {
	registry := mapper.NewRegistry()

	// No mappings, no source columns.
	report := ComputeCoverage("eng-003", registry, nil, nil)

	if report.TotalCanonical == 0 {
		t.Fatal("TotalCanonical = 0, want >0")
	}
	if report.Uncovered != report.TotalCanonical {
		t.Errorf("Uncovered = %d, want %d (all uncovered)", report.Uncovered, report.TotalCanonical)
	}
	if report.CoverageRate != 0.0 {
		t.Errorf("CoverageRate = %.2f, want 0.0", report.CoverageRate)
	}
	if report.RequiredGaps == 0 {
		t.Error("RequiredGaps = 0, but there are required canonical fields")
	}
}

func TestComputeCoverage_CandidatesSorted(t *testing.T) {
	registry := mapper.NewRegistry()

	low := 0.4
	high := 0.9
	mappings := []FieldMappingRow{
		{SourceTable: "SRC", SourceColumn: "MBR_LOW", CanonicalTable: "member", CanonicalColumn: "member_id", TemplateConfidence: &low, AgreementStatus: "TEMPLATE_ONLY"},
		{SourceTable: "SRC", SourceColumn: "MBR_HIGH", CanonicalTable: "member", CanonicalColumn: "member_id", TemplateConfidence: &high, AgreementStatus: "TEMPLATE_ONLY"},
	}

	report := ComputeCoverage("eng-004", registry, mappings, nil)

	for _, f := range report.Fields {
		if f.CanonicalTable == "member" && f.CanonicalColumn == "member_id" {
			if len(f.Candidates) != 2 {
				t.Fatalf("member.member_id candidates = %d, want 2", len(f.Candidates))
			}
			if f.Candidates[0].Confidence < f.Candidates[1].Confidence {
				t.Error("candidates not sorted by confidence descending")
			}
			if f.Candidates[0].SourceColumn != "MBR_HIGH" {
				t.Errorf("first candidate = %q, want MBR_HIGH", f.Candidates[0].SourceColumn)
			}
			return
		}
	}
	t.Fatal("member.member_id not found")
}
