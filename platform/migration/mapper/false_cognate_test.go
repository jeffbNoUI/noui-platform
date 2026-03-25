package mapper

import (
	"strings"
	"testing"
)

func TestBuildFalseCognateIndex(t *testing.T) {
	vocab, err := LoadVocabulary()
	if err != nil {
		t.Fatalf("LoadVocabulary() error: %v", err)
	}
	idx := BuildFalseCognateIndex(vocab)
	if len(idx) == 0 {
		t.Fatal("false cognate index is empty")
	}

	// membership_service is HIGH risk in service-credit/credited_years_total
	fc, ok := idx.Lookup("service-credit", "credited_years_total", "membership_service")
	if !ok {
		t.Fatal("membership_service not found in index")
	}
	if fc.Risk != "HIGH" {
		t.Errorf("membership_service risk = %q, want HIGH", fc.Risk)
	}
	if fc.Warning == "" {
		t.Error("membership_service warning is empty")
	}
}

func TestFalseCognateIndex_LookupCaseInsensitive(t *testing.T) {
	vocab, _ := LoadVocabulary()
	idx := BuildFalseCognateIndex(vocab)

	// Lookup should be case-insensitive on term
	_, ok := idx.Lookup("service-credit", "credited_years_total", "MEMBERSHIP_SERVICE")
	if !ok {
		t.Error("uppercase lookup failed — index should be case-insensitive")
	}
}

func TestFalseCognateIndex_MissReturnsNotFound(t *testing.T) {
	vocab, _ := LoadVocabulary()
	idx := BuildFalseCognateIndex(vocab)

	// A term that exists but in a different slot should not match
	_, ok := idx.Lookup("service-credit", "purchased_years", "membership_service")
	if ok {
		t.Error("membership_service should NOT be a false cognate for purchased_years slot")
	}

	// A completely unknown term
	_, ok = idx.Lookup("service-credit", "credited_years_total", "totally_unknown_column")
	if ok {
		t.Error("unknown term should not match")
	}
}

func TestAttachWarnings_MembershipService(t *testing.T) {
	// Simulate a Pass 2 pattern match where "membership_service" matched credited_years_total
	matches := []ColumnMatch{
		{
			SourceColumn:    "membership_service",
			SourceType:      "decimal(6,2)",
			CanonicalColumn: "credited_years_total",
			Confidence:      0.9,
			MatchMethod:     "pattern",
		},
	}

	vocab, _ := LoadVocabulary()
	idx := BuildFalseCognateIndex(vocab)
	AttachFalseCognateWarnings(matches, "service-credit", idx)

	if len(matches[0].Warnings) == 0 {
		t.Fatal("expected warning for membership_service, got none")
	}
	w := matches[0].Warnings[0]
	if w.Risk != "HIGH" {
		t.Errorf("warning risk = %q, want HIGH", w.Risk)
	}
	if w.Term != "membership_service" {
		t.Errorf("warning term = %q, want membership_service", w.Term)
	}
}

func TestAttachWarnings_PriorService(t *testing.T) {
	matches := []ColumnMatch{
		{
			SourceColumn:    "prior_service",
			SourceType:      "decimal(6,2)",
			CanonicalColumn: "purchased_years",
			Confidence:      0.9,
			MatchMethod:     "pattern",
		},
	}

	vocab, _ := LoadVocabulary()
	idx := BuildFalseCognateIndex(vocab)
	AttachFalseCognateWarnings(matches, "service-credit", idx)

	if len(matches[0].Warnings) == 0 {
		t.Fatal("expected warning for prior_service → purchased_years, got none")
	}
	if matches[0].Warnings[0].Risk != "MEDIUM" {
		t.Errorf("prior_service risk = %q, want MEDIUM", matches[0].Warnings[0].Risk)
	}
}

func TestAttachWarnings_ServiceCredit_TMRS(t *testing.T) {
	// service_credit matched to credited_years_total — HIGH risk because TMRS uses it as monetary
	matches := []ColumnMatch{
		{
			SourceColumn:    "service_credit",
			SourceType:      "decimal(10,2)",
			CanonicalColumn: "credited_years_total",
			Confidence:      0.9,
			MatchMethod:     "pattern",
		},
	}

	vocab, _ := LoadVocabulary()
	idx := BuildFalseCognateIndex(vocab)
	AttachFalseCognateWarnings(matches, "service-credit", idx)

	if len(matches[0].Warnings) == 0 {
		t.Fatal("expected warning for service_credit (TMRS monetary ambiguity), got none")
	}
	if matches[0].Warnings[0].Risk != "HIGH" {
		t.Errorf("service_credit risk = %q, want HIGH", matches[0].Warnings[0].Risk)
	}
	if !strings.Contains(matches[0].Warnings[0].Warning, "TMRS") {
		t.Error("service_credit warning should mention TMRS")
	}
}

func TestAttachWarnings_AFC(t *testing.T) {
	// afc in fac-abbreviations/salary_average — HIGH risk
	matches := []ColumnMatch{
		{
			SourceColumn:    "afc",
			SourceType:      "decimal(10,2)",
			CanonicalColumn: "salary_average",
			Confidence:      0.9,
			MatchMethod:     "pattern",
		},
	}

	vocab, _ := LoadVocabulary()
	idx := BuildFalseCognateIndex(vocab)
	AttachFalseCognateWarnings(matches, "fac-abbreviations", idx)

	if len(matches[0].Warnings) == 0 {
		t.Fatal("expected warning for afc, got none")
	}
	if matches[0].Warnings[0].Risk != "HIGH" {
		t.Errorf("afc risk = %q, want HIGH", matches[0].Warnings[0].Risk)
	}
}

func TestAttachWarnings_NilIndex(t *testing.T) {
	// nil index = no-op, should not panic
	matches := []ColumnMatch{
		{
			SourceColumn:    "membership_service",
			CanonicalColumn: "credited_years_total",
		},
	}
	AttachFalseCognateWarnings(matches, "service-credit", nil)
	if len(matches[0].Warnings) != 0 {
		t.Error("nil index should produce no warnings")
	}
}

func TestAttachWarnings_NoFalseCognate(t *testing.T) {
	// A normal term with no false cognate entry should get no warnings
	matches := []ColumnMatch{
		{
			SourceColumn:    "birth_date",
			SourceType:      "date",
			CanonicalColumn: "birth_date",
			Confidence:      1.0,
			MatchMethod:     "exact",
		},
	}

	vocab, _ := LoadVocabulary()
	idx := BuildFalseCognateIndex(vocab)
	AttachFalseCognateWarnings(matches, "employee-master", idx)

	if len(matches[0].Warnings) != 0 {
		t.Errorf("birth_date should have no warnings, got %d", len(matches[0].Warnings))
	}
}

func TestAttachWarnings_QualifyingService(t *testing.T) {
	// qualifying_service matched to eligibility_service_years — HIGH risk (STRS Ohio narrower scope)
	matches := []ColumnMatch{
		{
			SourceColumn:    "qualifying_service",
			SourceType:      "decimal(6,2)",
			CanonicalColumn: "eligibility_service_years",
			Confidence:      0.9,
			MatchMethod:     "pattern",
		},
	}

	vocab, _ := LoadVocabulary()
	idx := BuildFalseCognateIndex(vocab)
	AttachFalseCognateWarnings(matches, "service-credit", idx)

	if len(matches[0].Warnings) == 0 {
		t.Fatal("expected warning for qualifying_service → eligibility_service_years, got none")
	}
	if matches[0].Warnings[0].Risk != "HIGH" {
		t.Errorf("qualifying_service risk = %q, want HIGH", matches[0].Warnings[0].Risk)
	}
	if !strings.Contains(matches[0].Warnings[0].Warning, "STRS Ohio") {
		t.Error("qualifying_service warning should mention STRS Ohio")
	}
}

func TestAttachWarnings_CompensationCap(t *testing.T) {
	// compensation_cap matched to anti_spiking_cap_pct — MEDIUM risk (IRC §401(a)(17) ambiguity)
	matches := []ColumnMatch{
		{
			SourceColumn:    "compensation_cap",
			SourceType:      "decimal(5,2)",
			CanonicalColumn: "anti_spiking_cap_pct",
			Confidence:      0.9,
			MatchMethod:     "pattern",
		},
	}

	vocab, _ := LoadVocabulary()
	idx := BuildFalseCognateIndex(vocab)
	AttachFalseCognateWarnings(matches, "salary-history", idx)

	if len(matches[0].Warnings) == 0 {
		t.Fatal("expected warning for compensation_cap → anti_spiking_cap_pct, got none")
	}
	if matches[0].Warnings[0].Risk != "MEDIUM" {
		t.Errorf("compensation_cap risk = %q, want MEDIUM", matches[0].Warnings[0].Risk)
	}
	if !strings.Contains(matches[0].Warnings[0].Warning, "401(a)(17)") {
		t.Error("compensation_cap warning should mention IRC 401(a)(17)")
	}
}

func TestAttachWarnings_TotalServiceCredit(t *testing.T) {
	// total_service_credit matched to benefit_service_years — MEDIUM risk
	matches := []ColumnMatch{
		{
			SourceColumn:    "total_service_credit",
			SourceType:      "decimal(6,2)",
			CanonicalColumn: "benefit_service_years",
			Confidence:      0.9,
			MatchMethod:     "pattern",
		},
	}

	vocab, _ := LoadVocabulary()
	idx := BuildFalseCognateIndex(vocab)
	AttachFalseCognateWarnings(matches, "service-credit", idx)

	if len(matches[0].Warnings) == 0 {
		t.Fatal("expected warning for total_service_credit → benefit_service_years, got none")
	}
	if matches[0].Warnings[0].Risk != "MEDIUM" {
		t.Errorf("total_service_credit risk = %q, want MEDIUM", matches[0].Warnings[0].Risk)
	}
}

func TestAttachWarnings_EndToEnd_MatchColumns(t *testing.T) {
	// Full pipeline: MatchColumns → AttachFalseCognateWarnings
	// membership_service should match credited_years_total via pattern, then get a warning
	source := []SourceColumn{
		{Name: "MBR_NBR", DataType: "integer", IsKey: true},
		{Name: "EFFECTIVE_DATE", DataType: "date"},
		{Name: "membership_service", DataType: "decimal(6,2)"},
	}
	reg := NewRegistry()
	tmpl, _ := reg.Get("service-credit")
	matches := MatchColumns(source, tmpl)

	vocab, _ := LoadVocabulary()
	idx := BuildFalseCognateIndex(vocab)
	AttachFalseCognateWarnings(matches, "service-credit", idx)

	// Find the membership_service match
	for _, m := range matches {
		if strings.ToLower(m.SourceColumn) == "membership_service" {
			if m.CanonicalColumn != "credited_years_total" {
				t.Errorf("membership_service mapped to %q, want credited_years_total", m.CanonicalColumn)
			}
			if m.MatchMethod != "pattern" {
				t.Errorf("match method = %q, want pattern", m.MatchMethod)
			}
			if len(m.Warnings) == 0 {
				t.Fatal("membership_service should have a false cognate warning")
			}
			if m.Warnings[0].Risk != "HIGH" {
				t.Errorf("warning risk = %q, want HIGH", m.Warnings[0].Risk)
			}
			return
		}
	}
	t.Error("membership_service not matched at all")
}

func TestAttachWarnings_AccumulatedContributions_ZeroBalance(t *testing.T) {
	// accumulated_contributions matched to accumulated_balance — MEDIUM risk
	// Employer-paid systems (Nevada PERS EPC, Utah RS Tier 1) have zero accumulated contributions by design
	matches := []ColumnMatch{
		{
			SourceColumn:    "accumulated_contributions",
			SourceType:      "decimal(12,2)",
			CanonicalColumn: "accumulated_balance",
			Confidence:      0.9,
			MatchMethod:     "pattern",
		},
	}

	vocab, _ := LoadVocabulary()
	idx := BuildFalseCognateIndex(vocab)
	AttachFalseCognateWarnings(matches, "contribution-accounts", idx)

	if len(matches[0].Warnings) == 0 {
		t.Fatal("expected warning for accumulated_contributions (zero-balance employer-paid ambiguity), got none")
	}
	if matches[0].Warnings[0].Risk != "MEDIUM" {
		t.Errorf("accumulated_contributions risk = %q, want MEDIUM", matches[0].Warnings[0].Risk)
	}
	if !strings.Contains(matches[0].Warnings[0].Warning, "employer-paid") {
		t.Error("warning should mention employer-paid systems")
	}
}
