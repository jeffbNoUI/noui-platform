package mapper

import (
	"strings"
	"testing"
)

func TestMatchColumns_PRISM_Member(t *testing.T) {
	// PRISM uses abbreviated names
	source := []SourceColumn{
		{Name: "MBR_NBR", DataType: "integer", IsKey: true},
		{Name: "NATL_ID", DataType: "varchar(11)"},
		{Name: "BIRTH_DT", DataType: "varchar(10)"},
		{Name: "FIRST_NM", DataType: "varchar(50)"},
		{Name: "LAST_NM", DataType: "varchar(50)"},
		{Name: "HIRE_DT", DataType: "varchar(10)"},
		{Name: "PLAN_CD", DataType: "varchar(10)"},
		{Name: "STATUS_CD", DataType: "varchar(5)"},
	}
	reg := NewRegistry()
	tmpl, _ := reg.Get("employee-master")
	matches := MatchColumns(source, tmpl)

	// Verify key mappings
	assertMatch(t, matches, "MBR_NBR", "member_id")
	assertMatch(t, matches, "NATL_ID", "national_id")
	assertMatch(t, matches, "BIRTH_DT", "birth_date")
	assertMatch(t, matches, "FIRST_NM", "first_name")
	assertMatch(t, matches, "LAST_NM", "last_name")
	assertMatch(t, matches, "PLAN_CD", "plan_code")
	assertMatch(t, matches, "STATUS_CD", "member_status")
}

func TestMatchColumns_PAS_Member(t *testing.T) {
	// PAS uses full descriptive names
	source := []SourceColumn{
		{Name: "member_id", DataType: "uuid", IsKey: true},
		{Name: "ssn", DataType: "varchar(11)"},
		{Name: "birth_date", DataType: "date"},
		{Name: "first_name", DataType: "varchar(100)"},
		{Name: "last_name", DataType: "varchar(100)"},
		{Name: "original_hire_date", DataType: "date"},
		{Name: "member_tier", DataType: "varchar(10)"},
		{Name: "status_code", DataType: "varchar(20)"},
	}
	reg := NewRegistry()
	tmpl, _ := reg.Get("employee-master")
	matches := MatchColumns(source, tmpl)

	assertMatch(t, matches, "member_id", "member_id")
	assertMatch(t, matches, "ssn", "national_id")
	assertMatch(t, matches, "birth_date", "birth_date")
	assertMatch(t, matches, "first_name", "first_name")
	assertMatch(t, matches, "last_name", "last_name")
	assertMatch(t, matches, "status_code", "member_status")
}

func TestMatchColumns_SalaryHistory(t *testing.T) {
	source := []SourceColumn{
		{Name: "salary_amount", DataType: "decimal(10,2)"},
		{Name: "earned_start", DataType: "date"},
		{Name: "earned_end", DataType: "date"},
		{Name: "member_id", DataType: "integer"},
	}
	reg := NewRegistry()
	tmpl, _ := reg.Get("salary-history")
	matches := MatchColumns(source, tmpl)

	assertMatch(t, matches, "earned_start", "period_start")
	assertMatch(t, matches, "earned_end", "period_end")
	assertMatch(t, matches, "salary_amount", "gross_amount")
}

func TestUnmatchedSlots(t *testing.T) {
	// Source has only 2 columns, template expects 12
	source := []SourceColumn{
		{Name: "member_id", DataType: "integer"},
		{Name: "birth_date", DataType: "date"},
	}
	reg := NewRegistry()
	tmpl, _ := reg.Get("employee-master")
	matches := MatchColumns(source, tmpl)
	unmatched := UnmatchedSlots(matches, tmpl)
	// Should have several unmatched required slots
	if len(unmatched) < 3 {
		t.Errorf("expected at least 3 unmatched slots, got %d", len(unmatched))
	}
}

func TestTypeCompatible(t *testing.T) {
	tests := []struct {
		source, target string
		want           bool
	}{
		{"integer", "INTEGER", true},
		{"decimal(10,2)", "DECIMAL", true},
		{"varchar(50)", "VARCHAR", true},
		{"date", "DATE", true},
		{"uuid", "UUID", true},
		{"text", "VARCHAR", true},      // text is compatible with varchar family
		{"varchar(50)", "DATE", false}, // varchar not compatible with date
		{"integer", "DATE", false},
	}
	for _, tt := range tests {
		got := TypeCompatible(tt.source, tt.target)
		if got != tt.want {
			t.Errorf("TypeCompatible(%q, %q) = %v, want %v", tt.source, tt.target, got, tt.want)
		}
	}
}

func TestMatchMethod_Exact(t *testing.T) {
	source := []SourceColumn{
		{Name: "member_id", DataType: "integer"},
	}
	reg := NewRegistry()
	tmpl, _ := reg.Get("employee-master")
	matches := MatchColumns(source, tmpl)

	for _, m := range matches {
		if strings.EqualFold(m.SourceColumn, "member_id") {
			if m.MatchMethod != "exact" {
				t.Errorf("expected exact match method for member_id, got %q", m.MatchMethod)
			}
			if m.Confidence != 1.0 {
				t.Errorf("expected confidence 1.0 for exact match, got %.2f", m.Confidence)
			}
			return
		}
	}
	t.Error("member_id not matched")
}

func TestMatchMethod_Pattern(t *testing.T) {
	source := []SourceColumn{
		{Name: "ssn", DataType: "varchar(11)"},
	}
	reg := NewRegistry()
	tmpl, _ := reg.Get("employee-master")
	matches := MatchColumns(source, tmpl)

	for _, m := range matches {
		if strings.EqualFold(m.SourceColumn, "ssn") {
			if m.MatchMethod != "pattern" {
				t.Errorf("expected pattern match method for ssn, got %q", m.MatchMethod)
			}
			if m.Confidence != 0.9 {
				t.Errorf("expected confidence 0.9 for pattern match, got %.2f", m.Confidence)
			}
			return
		}
	}
	t.Error("ssn not matched")
}

// Helper
func assertMatch(t *testing.T, matches []ColumnMatch, sourceCol, canonicalCol string) {
	t.Helper()
	for _, m := range matches {
		if strings.EqualFold(m.SourceColumn, sourceCol) {
			if m.CanonicalColumn != canonicalCol {
				t.Errorf("source %q matched to %q, expected %q", sourceCol, m.CanonicalColumn, canonicalCol)
			}
			return
		}
	}
	t.Errorf("source column %q not matched at all", sourceCol)
}
