package mapper

import "testing"

func TestAnalyzeAgreement_BothAgree(t *testing.T) {
	tmpl := &ColumnMatch{SourceColumn: "BIRTH_DT", CanonicalColumn: "birth_date", Confidence: 0.85}
	signal := &ScoredMapping{SourceColumn: "BIRTH_DT", CanonicalColumn: "birth_date", Confidence: 0.78}
	result := AnalyzeAgreement(tmpl, signal)
	if result.AgreementStatus != Agreed {
		t.Errorf("expected AGREED, got %s", result.AgreementStatus)
	}
	if !result.AutoApproved {
		t.Error("expected auto-approved when both agree with >0.5 confidence")
	}
}

func TestAnalyzeAgreement_Disagree(t *testing.T) {
	tmpl := &ColumnMatch{SourceColumn: "AMT_01", CanonicalColumn: "gross_amount", Confidence: 0.6}
	signal := &ScoredMapping{SourceColumn: "AMT_01", CanonicalColumn: "net_amount", Confidence: 0.7}
	result := AnalyzeAgreement(tmpl, signal)
	if result.AgreementStatus != Disagreed {
		t.Errorf("expected DISAGREED, got %s", result.AgreementStatus)
	}
	if result.AutoApproved {
		t.Error("DISAGREED should never be auto-approved")
	}
	// Should use higher confidence mapping as proposed
	if result.CanonicalColumn != "net_amount" {
		t.Errorf("expected net_amount (higher confidence), got %s", result.CanonicalColumn)
	}
}

func TestAnalyzeAgreement_TemplateOnly(t *testing.T) {
	tmpl := &ColumnMatch{SourceColumn: "PLAN_CD", CanonicalColumn: "plan_code", Confidence: 0.9}
	result := AnalyzeAgreement(tmpl, nil)
	if result.AgreementStatus != TemplateOnly {
		t.Errorf("expected TEMPLATE_ONLY, got %s", result.AgreementStatus)
	}
	if !result.AutoApproved {
		t.Error("template-only with >0.7 confidence should be auto-approved")
	}
}

func TestAnalyzeAgreement_TemplateOnlyLowConf(t *testing.T) {
	tmpl := &ColumnMatch{SourceColumn: "X_COL", CanonicalColumn: "plan_code", Confidence: 0.4}
	result := AnalyzeAgreement(tmpl, nil)
	if result.AutoApproved {
		t.Error("template-only with <0.7 confidence should NOT be auto-approved")
	}
}

func TestAnalyzeAgreement_SignalOnly(t *testing.T) {
	signal := &ScoredMapping{SourceColumn: "EXTRA_COL", CanonicalColumn: "email", Confidence: 0.8}
	result := AnalyzeAgreement(nil, signal)
	if result.AgreementStatus != SignalOnly {
		t.Errorf("expected SIGNAL_ONLY, got %s", result.AgreementStatus)
	}
	if result.AutoApproved {
		t.Error("signal-only should NEVER be auto-approved")
	}
}

func TestAnalyzeTableMappings(t *testing.T) {
	templateMatches := []ColumnMatch{
		{SourceColumn: "MBR_NBR", CanonicalColumn: "member_id", Confidence: 0.9},
		{SourceColumn: "BIRTH_DT", CanonicalColumn: "birth_date", Confidence: 0.85},
		{SourceColumn: "PLAN_CD", CanonicalColumn: "plan_code", Confidence: 0.9},
	}
	signalMatches := []ScoredMapping{
		{SourceColumn: "MBR_NBR", CanonicalColumn: "member_id", Confidence: 0.82},
		{SourceColumn: "BIRTH_DT", CanonicalColumn: "birth_date", Confidence: 0.75},
		{SourceColumn: "EMAIL_ADDR", CanonicalColumn: "email", Confidence: 0.7},
	}
	results := AnalyzeTableMappings(templateMatches, signalMatches)

	// Should have 4 results: MBR_NBR (agreed), BIRTH_DT (agreed), PLAN_CD (template_only), EMAIL_ADDR (signal_only)
	if len(results) != 4 {
		t.Fatalf("expected 4 results, got %d", len(results))
	}

	summary := Summarize(results)
	if summary.Agreed != 2 {
		t.Errorf("expected 2 agreed, got %d", summary.Agreed)
	}
	if summary.TemplateOnly != 1 {
		t.Errorf("expected 1 template_only, got %d", summary.TemplateOnly)
	}
	if summary.SignalOnly != 1 {
		t.Errorf("expected 1 signal_only, got %d", summary.SignalOnly)
	}
}

func TestAnalyzeAgreement_BothAgree_LowConfidence(t *testing.T) {
	// Both agree on mapping but both have low confidence
	tmpl := &ColumnMatch{SourceColumn: "X", CanonicalColumn: "birth_date", Confidence: 0.35}
	signal := &ScoredMapping{SourceColumn: "X", CanonicalColumn: "birth_date", Confidence: 0.40}
	result := AnalyzeAgreement(tmpl, signal)
	if result.AgreementStatus != Agreed {
		t.Errorf("expected AGREED, got %s", result.AgreementStatus)
	}
	if result.AutoApproved {
		t.Error("low confidence agreement should NOT be auto-approved")
	}
}

func TestSummarize(t *testing.T) {
	results := []AgreementResult{
		{AgreementStatus: Agreed, AutoApproved: true},
		{AgreementStatus: Agreed, AutoApproved: true},
		{AgreementStatus: Disagreed, AutoApproved: false},
		{AgreementStatus: TemplateOnly, AutoApproved: true},
		{AgreementStatus: SignalOnly, AutoApproved: false},
	}
	s := Summarize(results)
	if s.TotalColumns != 5 {
		t.Errorf("total: %d", s.TotalColumns)
	}
	if s.AutoApproved != 3 {
		t.Errorf("auto: %d", s.AutoApproved)
	}
	if s.NeedsReview != 2 {
		t.Errorf("review: %d", s.NeedsReview)
	}
}
