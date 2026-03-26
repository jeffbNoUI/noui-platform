package report

import (
	"context"
	"strings"
	"testing"
)

// MockRenderer is a test double that captures the HTML and opts passed to
// RenderHTML, returning configurable PDF bytes or an error.
type MockRenderer struct {
	CapturedHTML string
	CapturedOpts PDFOptions
	ReturnBytes  []byte
	ReturnErr    error
}

func (m *MockRenderer) RenderHTML(_ context.Context, html string, opts PDFOptions) ([]byte, error) {
	m.CapturedHTML = html
	m.CapturedOpts = opts
	return m.ReturnBytes, m.ReturnErr
}

// --- Template rendering tests (no Chrome needed) ---

// sampleReport returns a MappingSpecReport-shaped struct for template tests.
// We replicate the API type here to avoid import cycles.
type testMappingSpecReport struct {
	EngagementID  string
	SourceSystem  string
	GeneratedAt   string
	SchemaVersion string
	Tables        []testTableMappingSpec
	TotalMappings int
	ApprovedCount int
	PendingCount  int
	RejectedCount int
	CodeMappings  int
	Assumptions   []string
	Exclusions    []string
}

type testTableMappingSpec struct {
	CanonicalTable string
	FieldMappings  []testFieldMappingSpec
	CodeMappings   []testCodeMappingSpec
	ExceptionCount int
}

type testFieldMappingSpec struct {
	SourceTable     string
	SourceColumn    string
	CanonicalColumn string
	Confidence      float64
	AgreementStatus string
	ApprovalStatus  string
	ApprovedBy      *string
}

type testCodeMappingSpec struct {
	SourceTable    string
	SourceColumn   string
	SourceValue    string
	CanonicalValue string
	ApprovedBy     *string
}

func newSampleReport() *testMappingSpecReport {
	approver := "admin@test.com"
	return &testMappingSpecReport{
		EngagementID:  "eng-001",
		SourceSystem:  "Legacy PAS",
		GeneratedAt:   "2026-03-26T12:00:00Z",
		SchemaVersion: "v2.1",
		TotalMappings: 3,
		ApprovedCount: 1,
		PendingCount:  1,
		RejectedCount: 1,
		CodeMappings:  1,
		Tables: []testTableMappingSpec{
			{
				CanonicalTable: "members",
				FieldMappings: []testFieldMappingSpec{
					{SourceTable: "tbl_member", SourceColumn: "mem_id", CanonicalColumn: "member_id", Confidence: 0.95, ApprovalStatus: "APPROVED", ApprovedBy: &approver},
					{SourceTable: "tbl_member", SourceColumn: "first_nm", CanonicalColumn: "first_name", Confidence: 0.72, ApprovalStatus: "PROPOSED"},
					{SourceTable: "tbl_member", SourceColumn: "status_cd", CanonicalColumn: "status", Confidence: 0.35, ApprovalStatus: "REJECTED"},
				},
				CodeMappings: []testCodeMappingSpec{
					{SourceTable: "tbl_member", SourceColumn: "status_cd", SourceValue: "A", CanonicalValue: "ACTIVE"},
				},
				ExceptionCount: 2,
			},
		},
		Assumptions: []string{"5 canonical records derived from related source data (not direct mapping)"},
		Exclusions:  []string{"3 source records excluded due to constraint violations"},
	}
}

func TestMappingSpecTemplate(t *testing.T) {
	report := newSampleReport()
	html, err := RenderMappingSpecHTML(report)
	if err != nil {
		t.Fatalf("RenderMappingSpecHTML failed: %v", err)
	}

	// Title page elements
	checks := []struct {
		name string
		want string
	}{
		{"engagement ID", "eng-001"},
		{"source system", "Legacy PAS"},
		{"schema version", "v2.1"},
		{"generated date", "2026-03-26T12:00:00Z"},
		{"table heading", "members"},
		{"source column", "mem_id"},
		{"canonical field", "member_id"},
		{"code source value", "ACTIVE"},
		{"assumption text", "derived from related source data"},
		{"exclusion text", "excluded due to constraint violations"},
		{"total mappings stat", ">3<"},
	}
	for _, c := range checks {
		if !strings.Contains(html, c.want) {
			t.Errorf("template missing %s: expected %q in output", c.name, c.want)
		}
	}
}

func TestMappingSpecFormatting(t *testing.T) {
	report := newSampleReport()
	html, err := RenderMappingSpecHTML(report)
	if err != nil {
		t.Fatalf("RenderMappingSpecHTML failed: %v", err)
	}

	// Confidence color coding
	if !strings.Contains(html, `class="conf-high"`) {
		t.Error("high confidence (>=0.85) should use conf-high class")
	}
	if !strings.Contains(html, `class="conf-med"`) {
		t.Error("medium confidence (0.50-0.84) should use conf-med class")
	}
	if !strings.Contains(html, `class="conf-low"`) {
		t.Error("low confidence (<0.50) should use conf-low class")
	}

	// Approval badges
	if !strings.Contains(html, `badge-approved`) {
		t.Error("approved status should have badge-approved class")
	}
	if !strings.Contains(html, `badge-proposed`) {
		t.Error("proposed status should have badge-proposed class")
	}
	if !strings.Contains(html, `badge-rejected`) {
		t.Error("rejected status should have badge-rejected class")
	}

	// Page counter CSS
	if !strings.Contains(html, "counter(page)") {
		t.Error("template should include CSS page counter for page numbers")
	}

	// Alternating row colors
	if !strings.Contains(html, "nth-child(even)") {
		t.Error("template should include alternating row styling")
	}

	// Exception summary
	if !strings.Contains(html, "2 exception(s) recorded") {
		t.Error("exception count should appear in template output")
	}
}

func TestRenderHTMLToPDF(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping Chrome-dependent test in -short mode")
	}

	// This test would require a real Chrome binary. In -short mode it is
	// skipped. When Chrome is available, it tests the full pipeline.
	report := newSampleReport()
	html, err := RenderMappingSpecHTML(report)
	if err != nil {
		t.Fatalf("RenderMappingSpecHTML failed: %v", err)
	}

	pool := NewBrowserPool(1)
	defer pool.Close()

	opts := DefaultPDFOptions()
	pdf, err := pool.RenderHTML(context.Background(), html, opts)
	if err != nil {
		t.Fatalf("RenderHTML failed: %v", err)
	}

	// PDF magic bytes: %PDF
	if len(pdf) < 4 || string(pdf[:4]) != "%PDF" {
		t.Error("output does not start with PDF magic bytes")
	}
	t.Logf("PDF generated: %d bytes", len(pdf))
}

func TestMockRendererSatisfiesInterface(t *testing.T) {
	var r Renderer = &MockRenderer{
		ReturnBytes: []byte("%PDF-mock"),
	}
	pdf, err := r.RenderHTML(context.Background(), "<html></html>", DefaultPDFOptions())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(pdf) != "%PDF-mock" {
		t.Errorf("expected mock PDF bytes, got %q", string(pdf))
	}
}

func TestTemplateEscaping(t *testing.T) {
	// Ensure user-supplied values are HTML-escaped to prevent XSS.
	report := &testMappingSpecReport{
		EngagementID:  `<script>alert("xss")</script>`,
		SourceSystem:  `"malicious" & <evil>`,
		GeneratedAt:   "2026-03-26T12:00:00Z",
		SchemaVersion: "v1",
		Tables:        []testTableMappingSpec{},
		Assumptions:   []string{},
		Exclusions:    []string{},
	}
	html, err := RenderMappingSpecHTML(report)
	if err != nil {
		t.Fatalf("RenderMappingSpecHTML failed: %v", err)
	}

	if strings.Contains(html, "<script>") {
		t.Error("html/template should escape <script> tags")
	}
	if strings.Contains(html, `"malicious"`) && !strings.Contains(html, "&amp;") {
		t.Error("html/template should escape & characters")
	}
}
