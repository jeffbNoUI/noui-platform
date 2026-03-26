package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/report"
)

// mockRenderer implements report.Renderer for API handler tests.
type mockRenderer struct {
	returnBytes []byte
	returnErr   error
}

func (m *mockRenderer) RenderHTML(_ context.Context, _ string, _ report.PDFOptions) ([]byte, error) {
	return m.returnBytes, m.returnErr
}

// newTestHandlerWithRenderer creates a Handler with sqlmock DB and a mock renderer.
func newTestHandlerWithRenderer(t *testing.T, renderer report.Renderer) (*Handler, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	h := NewHandler(db)
	h.Renderer = renderer
	return h, mock
}

// expectEngagementQuery sets up sqlmock to return an engagement row.
// Columns must match: engagement_id, tenant_id, source_system_name, canonical_schema_version,
// status, source_platform_type, quality_baseline_approved_at, source_connection,
// contribution_model, created_at, updated_at
func expectEngagementQuery(mock sqlmock.Sqlmock, engID, sourceName, schemaVer string) {
	rows := sqlmock.NewRows([]string{
		"engagement_id", "tenant_id", "source_system_name", "canonical_schema_version",
		"status", "source_platform_type", "quality_baseline_approved_at", "source_connection",
		"contribution_model", "created_at", "updated_at",
	}).AddRow(engID, "tenant-001", sourceName, schemaVer,
		"ACTIVE", nil, nil, nil,
		"standard", time.Now(), time.Now())
	mock.ExpectQuery("SELECT .+ FROM migration\\.engagement WHERE engagement_id").
		WithArgs(engID).
		WillReturnRows(rows)
}

// expectFieldMappings sets up sqlmock to return field mapping rows.
func expectFieldMappings(mock sqlmock.Sqlmock, engID string, count int) {
	rows := sqlmock.NewRows([]string{
		"canonical_table", "source_table", "source_column", "canonical_column",
		"confidence", "agreement_status", "approval_status", "approved_by",
	})
	for i := 0; i < count; i++ {
		rows.AddRow("members", "tbl_member", fmt.Sprintf("col_%d", i),
			fmt.Sprintf("field_%d", i), 0.90, "AGREED", "APPROVED", nil)
	}
	mock.ExpectQuery("SELECT .+ FROM migration\\.field_mapping").
		WithArgs(engID).
		WillReturnRows(rows)
}

// expectCodeMappings sets up sqlmock to return empty code mappings.
func expectCodeMappings(mock sqlmock.Sqlmock, engID string) {
	rows := sqlmock.NewRows([]string{
		"source_table", "source_column", "source_value", "canonical_value", "approved_by",
	})
	mock.ExpectQuery("SELECT .+ FROM migration\\.code_mapping").
		WithArgs(engID).
		WillReturnRows(rows)
}

// expectExceptionCounts sets up sqlmock to return empty exception counts.
func expectExceptionCounts(mock sqlmock.Sqlmock, engID string) {
	rows := sqlmock.NewRows([]string{"handler_name", "count"})
	mock.ExpectQuery("SELECT .+ FROM migration\\.exception").
		WithArgs(engID).
		WillReturnRows(rows)
}

// expectDerivedCount sets up sqlmock to return derived lineage count.
func expectDerivedCount(mock sqlmock.Sqlmock, engID string, count int) {
	mock.ExpectQuery("SELECT COUNT.+ FROM migration\\.lineage").
		WithArgs(engID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(count))
}

// expectExcludedCount sets up sqlmock to return excluded exception count.
func expectExcludedCount(mock sqlmock.Sqlmock, engID string, count int) {
	mock.ExpectQuery("SELECT COUNT.+ FROM migration\\.exception").
		WithArgs(engID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(count))
}

// expectFullMappingSpecQueries sets up all queries needed for BuildMappingSpec.
func expectFullMappingSpecQueries(mock sqlmock.Sqlmock, engID string, fieldCount int) {
	expectFieldMappings(mock, engID, fieldCount)
	expectCodeMappings(mock, engID)
	expectExceptionCounts(mock, engID)
	expectDerivedCount(mock, engID, 0)
	expectExcludedCount(mock, engID, 0)
}

func TestMappingSpecPDF(t *testing.T) {
	renderer := &mockRenderer{returnBytes: []byte("%PDF-1.4 mock")}
	h, mock := newTestHandlerWithRenderer(t, renderer)
	defer h.DB.Close()

	engID := "eng-test-001"
	expectEngagementQuery(mock, engID, "Legacy PAS", "v2.1")
	expectFullMappingSpecQueries(mock, engID, 3)

	req := httptest.NewRequest("GET", "/api/v1/migration/engagements/"+engID+"/reports/mapping-spec/pdf", nil)
	req.SetPathValue("id", engID)
	w := httptest.NewRecorder()

	h.MappingSpecPDF(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/pdf" {
		t.Errorf("expected Content-Type application/pdf, got %q", ct)
	}
	cd := w.Header().Get("Content-Disposition")
	if !strings.Contains(cd, "mapping-spec-") {
		t.Errorf("expected Content-Disposition with mapping-spec filename, got %q", cd)
	}
	if !strings.Contains(cd, "attachment") {
		t.Errorf("expected attachment disposition, got %q", cd)
	}
	body := w.Body.String()
	if !strings.HasPrefix(body, "%PDF") {
		t.Error("response body should start with PDF magic bytes")
	}
}

func TestMappingSpecPDF_NoMappings(t *testing.T) {
	renderer := &mockRenderer{returnBytes: []byte("%PDF-mock")}
	h, mock := newTestHandlerWithRenderer(t, renderer)
	defer h.DB.Close()

	engID := "eng-empty"
	expectEngagementQuery(mock, engID, "Empty System", "v1")
	expectFullMappingSpecQueries(mock, engID, 0) // no field mappings

	req := httptest.NewRequest("GET", "/api/v1/migration/engagements/"+engID+"/reports/mapping-spec/pdf", nil)
	req.SetPathValue("id", engID)
	w := httptest.NewRecorder()

	h.MappingSpecPDF(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for no mappings, got %d: %s", w.Code, w.Body.String())
	}
}

func TestMappingSpecPDF_EngagementNotFound(t *testing.T) {
	renderer := &mockRenderer{returnBytes: []byte("%PDF-mock")}
	h, mock := newTestHandlerWithRenderer(t, renderer)
	defer h.DB.Close()

	engID := "eng-missing"
	rows := sqlmock.NewRows([]string{
		"engagement_id", "name", "source_system_name", "canonical_schema_version",
		"current_phase", "status", "created_at", "updated_at",
		"source_db_driver", "source_db_dsn",
	})
	mock.ExpectQuery("SELECT .+ FROM migration\\.engagement WHERE engagement_id").
		WithArgs(engID).
		WillReturnRows(rows) // empty result set

	req := httptest.NewRequest("GET", "/api/v1/migration/engagements/"+engID+"/reports/mapping-spec/pdf", nil)
	req.SetPathValue("id", engID)
	w := httptest.NewRecorder()

	h.MappingSpecPDF(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestMappingSpecPDF_RenderError(t *testing.T) {
	renderer := &mockRenderer{returnErr: errors.New("chrome crashed")}
	h, mock := newTestHandlerWithRenderer(t, renderer)
	defer h.DB.Close()

	engID := "eng-render-fail"
	expectEngagementQuery(mock, engID, "Test System", "v1")
	expectFullMappingSpecQueries(mock, engID, 5)

	req := httptest.NewRequest("GET", "/api/v1/migration/engagements/"+engID+"/reports/mapping-spec/pdf", nil)
	req.SetPathValue("id", engID)
	w := httptest.NewRecorder()

	h.MappingSpecPDF(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

func TestMappingSpecPDF_RendererNil(t *testing.T) {
	h, _ := newTestHandlerWithRenderer(t, nil) // no renderer
	defer h.DB.Close()

	req := httptest.NewRequest("GET", "/api/v1/migration/engagements/eng-001/reports/mapping-spec/pdf", nil)
	req.SetPathValue("id", "eng-001")
	w := httptest.NewRecorder()

	h.MappingSpecPDF(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", w.Code, w.Body.String())
	}
}

func TestMappingSpecPDF_TooLarge(t *testing.T) {
	renderer := &mockRenderer{returnBytes: []byte("%PDF-mock")}
	h, mock := newTestHandlerWithRenderer(t, renderer)
	defer h.DB.Close()

	engID := "eng-huge"
	expectEngagementQuery(mock, engID, "Huge System", "v1")
	expectFullMappingSpecQueries(mock, engID, 5001) // exceeds maxPDFFieldCount

	req := httptest.NewRequest("GET", "/api/v1/migration/engagements/"+engID+"/reports/mapping-spec/pdf", nil)
	req.SetPathValue("id", engID)
	w := httptest.NewRecorder()

	h.MappingSpecPDF(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 for too many mappings, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSanitizeFilename(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"Legacy PAS", "legacy-pas"},
		{"../../../etc/passwd", "etc-passwd"},
		{"Normal_Name-123", "normal-name-123"},
		{"  spaces  ", "spaces"},
		{"<script>alert('xss')</script>", "script-alert-xss-script"},
		{"", "unnamed"},
		{"---", "unnamed"},
	}
	for _, tt := range tests {
		got := sanitizeFilename(tt.input)
		if got != tt.want {
			t.Errorf("sanitizeFilename(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

// --- M07b: Lineage Report PDF Handler Tests ---

// expectBatchQuery sets up sqlmock to return a batch row.
func expectBatchQuery(mock sqlmock.Sqlmock, batchID, engID, scope, status string) {
	mock.ExpectQuery("SELECT").
		WithArgs(batchID).
		WillReturnRows(sqlmock.NewRows([]string{
			"batch_id", "engagement_id", "batch_scope", "status", "mapping_version",
			"row_count_source", "row_count_loaded", "row_count_exception",
			"error_rate", "halted_reason", "checkpoint_key", "started_at", "completed_at",
		}).AddRow(
			batchID, engID, scope, status, "v1",
			100, 95, 5,
			0.05, nil, nil, time.Now(), nil,
		))
}

// expectBatchNotFound sets up sqlmock to return no batch rows.
func expectBatchNotFound(mock sqlmock.Sqlmock, batchID string) {
	mock.ExpectQuery("SELECT").
		WithArgs(batchID).
		WillReturnRows(sqlmock.NewRows([]string{
			"batch_id", "engagement_id", "batch_scope", "status", "mapping_version",
			"row_count_source", "row_count_loaded", "row_count_exception",
			"error_rate", "halted_reason", "checkpoint_key", "started_at", "completed_at",
		}))
}

// expectLineageSummary sets up the 3 queries for GetLineageSummary.
func expectLineageSummary(mock sqlmock.Sqlmock, batchID string, total, members, fields, exceptions int, handlers []string) {
	// Count query
	mock.ExpectQuery("SELECT").
		WithArgs(batchID).
		WillReturnRows(sqlmock.NewRows([]string{"total_records", "unique_members", "fields_covered"}).
			AddRow(total, members, fields))

	// Distinct handler names query
	handlerRows := sqlmock.NewRows([]string{"handler_name"})
	for _, h := range handlers {
		handlerRows.AddRow(h)
	}
	mock.ExpectQuery("SELECT DISTINCT").
		WithArgs(batchID).
		WillReturnRows(handlerRows)

	// Exception count query
	mock.ExpectQuery("SELECT COUNT").
		WithArgs(batchID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(exceptions))
}

// expectLineageByHandler sets up the per-handler lineage query.
func expectLineageByHandler(mock sqlmock.Sqlmock, batchID, handler string, entries int) {
	rows := sqlmock.NewRows([]string{
		"lineage_id", "batch_id", "row_key", "handler_name",
		"column_name", "source_value", "result_value", "created_at",
	})
	for i := 0; i < entries; i++ {
		rows.AddRow(fmt.Sprintf("l-%d", i), batchID, fmt.Sprintf("MEM%03d", i),
			handler, "col_a", "old_val", "new_val", "2026-03-26T12:00:00Z")
	}
	mock.ExpectQuery("SELECT .+ FROM migration\\.lineage").
		WithArgs(batchID, handler, sqlmock.AnyArg()).
		WillReturnRows(rows)
}

func TestBuildLineageReport(t *testing.T) {
	t.Run("assembles_handler_groups", func(t *testing.T) {
		h, mock := newTestHandlerWithRenderer(t, &mockRenderer{returnBytes: []byte("%PDF")})
		defer h.DB.Close()

		batchID := "batch-lr-001"
		expectLineageSummary(mock, batchID, 50, 10, 3, 2, []string{"date_normalize", "code_map"})
		expectLineageByHandler(mock, batchID, "date_normalize", 5)
		expectLineageByHandler(mock, batchID, "code_map", 3)

		rpt, err := BuildLineageReport(h.DB, "eng-001", batchID, "members")
		if err != nil {
			t.Fatalf("BuildLineageReport error: %v", err)
		}

		if rpt.Summary.TotalRecords != 50 {
			t.Errorf("TotalRecords = %d, want 50", rpt.Summary.TotalRecords)
		}
		if len(rpt.HandlerGroups) != 2 {
			t.Fatalf("HandlerGroups = %d, want 2", len(rpt.HandlerGroups))
		}
		if rpt.HandlerGroups[0].HandlerName != "date_normalize" {
			t.Errorf("first group = %q, want date_normalize", rpt.HandlerGroups[0].HandlerName)
		}
		if len(rpt.HandlerGroups[0].Entries) != 5 {
			t.Errorf("date_normalize entries = %d, want 5", len(rpt.HandlerGroups[0].Entries))
		}
		if rpt.HandlerGroups[0].Truncated {
			t.Error("5 entries should not be truncated (limit 500)")
		}
	})
}

func TestLineageReportPDF(t *testing.T) {
	t.Run("returns_pdf_for_valid_batch", func(t *testing.T) {
		renderer := &mockRenderer{returnBytes: []byte("%PDF-lineage")}
		h, mock := newTestHandlerWithRenderer(t, renderer)
		defer h.DB.Close()

		engID := "eng-lr-001"
		batchID := "batch-lr-001"
		expectEngagementQuery(mock, engID, "LegacyPAS", "v1")
		expectBatchQuery(mock, batchID, engID, "members", "COMPLETED")
		expectLineageSummary(mock, batchID, 25, 5, 3, 0, []string{"date_normalize"})
		expectLineageByHandler(mock, batchID, "date_normalize", 3)

		req := httptest.NewRequest("GET", "/api/v1/migration/engagements/"+engID+"/reports/lineage/"+batchID+"/pdf", nil)
		req.SetPathValue("id", engID)
		req.SetPathValue("batch_id", batchID)
		w := httptest.NewRecorder()

		h.LineageReportPDF(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		if ct := w.Header().Get("Content-Type"); ct != "application/pdf" {
			t.Errorf("Content-Type = %q, want application/pdf", ct)
		}
		if cd := w.Header().Get("Content-Disposition"); !strings.Contains(cd, "lineage-") {
			t.Errorf("Content-Disposition = %q, want lineage- prefix", cd)
		}
	})

	t.Run("returns_404_for_missing_engagement", func(t *testing.T) {
		renderer := &mockRenderer{returnBytes: []byte("%PDF")}
		h, mock := newTestHandlerWithRenderer(t, renderer)
		defer h.DB.Close()

		mock.ExpectQuery("SELECT").
			WithArgs("eng-missing").
			WillReturnRows(sqlmock.NewRows([]string{
				"engagement_id", "tenant_id", "source_system_name", "canonical_schema_version",
				"status", "source_platform_type", "quality_baseline_approved_at", "source_connection",
				"contribution_model", "created_at", "updated_at",
			}))

		req := httptest.NewRequest("GET", "/api/v1/migration/engagements/eng-missing/reports/lineage/batch-001/pdf", nil)
		req.SetPathValue("id", "eng-missing")
		req.SetPathValue("batch_id", "batch-001")
		w := httptest.NewRecorder()

		h.LineageReportPDF(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d", w.Code)
		}
	})

	t.Run("returns_404_for_missing_batch", func(t *testing.T) {
		renderer := &mockRenderer{returnBytes: []byte("%PDF")}
		h, mock := newTestHandlerWithRenderer(t, renderer)
		defer h.DB.Close()

		engID := "eng-lr-002"
		expectEngagementQuery(mock, engID, "Test", "v1")
		expectBatchNotFound(mock, "batch-gone")

		req := httptest.NewRequest("GET", "/api/v1/migration/engagements/"+engID+"/reports/lineage/batch-gone/pdf", nil)
		req.SetPathValue("id", engID)
		req.SetPathValue("batch_id", "batch-gone")
		w := httptest.NewRecorder()

		h.LineageReportPDF(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d", w.Code)
		}
	})

	t.Run("returns_404_for_empty_lineage", func(t *testing.T) {
		renderer := &mockRenderer{returnBytes: []byte("%PDF")}
		h, mock := newTestHandlerWithRenderer(t, renderer)
		defer h.DB.Close()

		engID := "eng-lr-003"
		batchID := "batch-empty"
		expectEngagementQuery(mock, engID, "Test", "v1")
		expectBatchQuery(mock, batchID, engID, "members", "COMPLETED")
		expectLineageSummary(mock, batchID, 0, 0, 0, 0, []string{})

		req := httptest.NewRequest("GET", "/api/v1/migration/engagements/"+engID+"/reports/lineage/"+batchID+"/pdf", nil)
		req.SetPathValue("id", engID)
		req.SetPathValue("batch_id", batchID)
		w := httptest.NewRecorder()

		h.LineageReportPDF(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 for empty lineage, got %d", w.Code)
		}
	})

	t.Run("returns_503_when_renderer_nil", func(t *testing.T) {
		h, _ := newTestHandlerWithRenderer(t, nil)
		defer h.DB.Close()
		h.Renderer = nil

		req := httptest.NewRequest("GET", "/api/v1/migration/engagements/eng-001/reports/lineage/batch-001/pdf", nil)
		req.SetPathValue("id", "eng-001")
		req.SetPathValue("batch_id", "batch-001")
		w := httptest.NewRecorder()

		h.LineageReportPDF(w, req)

		if w.Code != http.StatusServiceUnavailable {
			t.Errorf("expected 503, got %d", w.Code)
		}
	})
}

// --- M07b: Reconciliation Report PDF Handler Tests ---

// expectReconSummary sets up sqlmock for GetReconciliationSummary.
func expectReconSummary(mock sqlmock.Sqlmock, engID string, total, match, minor, major, errCount, p1 int, gateScore, t1, t2, t3 float64) {
	mock.ExpectQuery("SELECT").
		WithArgs(engID).
		WillReturnRows(sqlmock.NewRows([]string{
			"total_records", "match_count", "minor_count", "major_count", "error_count",
			"gate_score", "p1_count", "tier1_score", "tier2_score", "tier3_score",
		}).AddRow(total, match, minor, major, errCount, gateScore, p1, t1, t2, t3))
}

// expectReconByTier sets up sqlmock for GetReconciliationByTier.
func expectReconByTier(mock sqlmock.Sqlmock, engID string, tier, count int) {
	rows := sqlmock.NewRows([]string{
		"recon_id", "batch_id", "member_id", "calc_name",
		"legacy_value", "recomputed_value", "category", "priority", "tier",
	})
	for i := 0; i < count; i++ {
		rows.AddRow(fmt.Sprintf("r-%d", i), "batch-001", fmt.Sprintf("MEM%03d", i),
			"monthly_benefit", "2500.00", "2500.00", "MATCH", "P3", tier)
	}
	mock.ExpectQuery("SELECT .+ FROM migration\\.reconciliation").
		WithArgs(engID, tier).
		WillReturnRows(rows)
}

// expectPatterns sets up sqlmock for GetPatternsByEngagement.
func expectPatterns(mock sqlmock.Sqlmock, engID string, count int) {
	rows := sqlmock.NewRows([]string{
		"pattern_id", "batch_id", "suspected_domain", "plan_code", "direction",
		"member_count", "mean_variance", "coefficient_of_var", "affected_members",
		"correction_type", "affected_field", "confidence", "evidence",
		"resolved", "resolved_at", "created_at",
	})
	for i := 0; i < count; i++ {
		rows.AddRow(fmt.Sprintf("pat-%d", i), "batch-001", "benefit_calculation", "DB", "OVER",
			5, "25.50", 0.15, "{MEM001,MEM002}",
			nil, nil, nil, nil,
			false, nil, "2026-03-26T12:00:00Z")
	}
	mock.ExpectQuery("SELECT").
		WithArgs(engID).
		WillReturnRows(rows)
}

func TestReconciliationReportPDF(t *testing.T) {
	t.Run("returns_pdf_for_valid_engagement", func(t *testing.T) {
		renderer := &mockRenderer{returnBytes: []byte("%PDF-recon")}
		h, mock := newTestHandlerWithRenderer(t, renderer)
		defer h.DB.Close()

		engID := "eng-recon-001"
		expectEngagementQuery(mock, engID, "LegacyPAS", "v1")

		// Guard summary check.
		expectReconSummary(mock, engID, 100, 90, 5, 3, 2, 1, 0.90, 0.95, 0.88, 0.85)

		// BuildReconciliationReport calls GetReconciliationSummary again.
		expectReconSummary(mock, engID, 100, 90, 5, 3, 2, 1, 0.90, 0.95, 0.88, 0.85)

		// Per-tier queries.
		expectReconByTier(mock, engID, 1, 5)
		expectReconByTier(mock, engID, 2, 3)
		expectReconByTier(mock, engID, 3, 2)

		// Patterns.
		expectPatterns(mock, engID, 1)

		req := httptest.NewRequest("GET", "/api/v1/migration/engagements/"+engID+"/reports/reconciliation/pdf", nil)
		req.SetPathValue("id", engID)
		w := httptest.NewRecorder()

		h.ReconciliationReportPDF(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		if ct := w.Header().Get("Content-Type"); ct != "application/pdf" {
			t.Errorf("Content-Type = %q, want application/pdf", ct)
		}
		if cd := w.Header().Get("Content-Disposition"); !strings.Contains(cd, "reconciliation-") {
			t.Errorf("Content-Disposition = %q, want reconciliation- prefix", cd)
		}
	})

	t.Run("returns_404_for_missing_engagement", func(t *testing.T) {
		renderer := &mockRenderer{returnBytes: []byte("%PDF")}
		h, mock := newTestHandlerWithRenderer(t, renderer)
		defer h.DB.Close()

		mock.ExpectQuery("SELECT").
			WithArgs("eng-missing").
			WillReturnRows(sqlmock.NewRows([]string{
				"engagement_id", "tenant_id", "source_system_name", "canonical_schema_version",
				"status", "source_platform_type", "quality_baseline_approved_at", "source_connection",
				"contribution_model", "created_at", "updated_at",
			}))

		req := httptest.NewRequest("GET", "/api/v1/migration/engagements/eng-missing/reports/reconciliation/pdf", nil)
		req.SetPathValue("id", "eng-missing")
		w := httptest.NewRecorder()

		h.ReconciliationReportPDF(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d", w.Code)
		}
	})

	t.Run("returns_404_for_no_reconciliation_data", func(t *testing.T) {
		renderer := &mockRenderer{returnBytes: []byte("%PDF")}
		h, mock := newTestHandlerWithRenderer(t, renderer)
		defer h.DB.Close()

		engID := "eng-no-recon"
		expectEngagementQuery(mock, engID, "Test", "v1")
		expectReconSummary(mock, engID, 0, 0, 0, 0, 0, 0, 0.0, 0.0, 0.0, 0.0)

		req := httptest.NewRequest("GET", "/api/v1/migration/engagements/"+engID+"/reports/reconciliation/pdf", nil)
		req.SetPathValue("id", engID)
		w := httptest.NewRecorder()

		h.ReconciliationReportPDF(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 for no recon data, got %d", w.Code)
		}
	})

	t.Run("returns_422_for_too_large", func(t *testing.T) {
		renderer := &mockRenderer{returnBytes: []byte("%PDF")}
		h, mock := newTestHandlerWithRenderer(t, renderer)
		defer h.DB.Close()

		engID := "eng-huge-recon"
		expectEngagementQuery(mock, engID, "Test", "v1")
		expectReconSummary(mock, engID, 15000, 10000, 3000, 1500, 500, 50, 0.67, 0.5, 0.5, 0.5)

		req := httptest.NewRequest("GET", "/api/v1/migration/engagements/"+engID+"/reports/reconciliation/pdf", nil)
		req.SetPathValue("id", engID)
		w := httptest.NewRecorder()

		h.ReconciliationReportPDF(w, req)

		if w.Code != http.StatusUnprocessableEntity {
			t.Errorf("expected 422 for too many records, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("returns_503_when_renderer_nil", func(t *testing.T) {
		h, _ := newTestHandlerWithRenderer(t, nil)
		defer h.DB.Close()
		h.Renderer = nil

		req := httptest.NewRequest("GET", "/api/v1/migration/engagements/eng-001/reports/reconciliation/pdf", nil)
		req.SetPathValue("id", "eng-001")
		w := httptest.NewRecorder()

		h.ReconciliationReportPDF(w, req)

		if w.Code != http.StatusServiceUnavailable {
			t.Errorf("expected 503, got %d", w.Code)
		}
	})

	t.Run("render_error_returns_500", func(t *testing.T) {
		renderer := &mockRenderer{returnErr: errors.New("chrome crashed")}
		h, mock := newTestHandlerWithRenderer(t, renderer)
		defer h.DB.Close()

		engID := "eng-render-fail"
		expectEngagementQuery(mock, engID, "Test", "v1")
		expectReconSummary(mock, engID, 10, 8, 1, 1, 0, 0, 0.80, 0.9, 0.8, 0.7)
		expectReconSummary(mock, engID, 10, 8, 1, 1, 0, 0, 0.80, 0.9, 0.8, 0.7)
		expectReconByTier(mock, engID, 1, 3)
		expectReconByTier(mock, engID, 2, 2)
		expectReconByTier(mock, engID, 3, 1)
		expectPatterns(mock, engID, 0)

		req := httptest.NewRequest("GET", "/api/v1/migration/engagements/"+engID+"/reports/reconciliation/pdf", nil)
		req.SetPathValue("id", engID)
		w := httptest.NewRecorder()

		h.ReconciliationReportPDF(w, req)

		if w.Code != http.StatusInternalServerError {
			t.Errorf("expected 500, got %d: %s", w.Code, w.Body.String())
		}
	})
}

func TestBuildReconciliationReport(t *testing.T) {
	t.Run("assembles_tiers_and_patterns", func(t *testing.T) {
		h, mock := newTestHandlerWithRenderer(t, &mockRenderer{returnBytes: []byte("%PDF")})
		defer h.DB.Close()

		engID := "eng-br-001"
		expectReconSummary(mock, engID, 50, 40, 5, 3, 2, 1, 0.80, 0.90, 0.85, 0.75)
		expectReconByTier(mock, engID, 1, 10)
		expectReconByTier(mock, engID, 2, 5)
		expectReconByTier(mock, engID, 3, 3)
		expectPatterns(mock, engID, 2)

		rpt, err := BuildReconciliationReport(h.DB, engID, "TestSystem", "v1")
		if err != nil {
			t.Fatalf("BuildReconciliationReport error: %v", err)
		}

		if rpt.Summary.TotalRecords != 50 {
			t.Errorf("TotalRecords = %d, want 50", rpt.Summary.TotalRecords)
		}
		if len(rpt.TierBreakdowns) != 3 {
			t.Fatalf("TierBreakdowns = %d, want 3", len(rpt.TierBreakdowns))
		}
		if len(rpt.TierBreakdowns[0].Records) != 10 {
			t.Errorf("Tier 1 records = %d, want 10", len(rpt.TierBreakdowns[0].Records))
		}
		if len(rpt.Patterns) != 2 {
			t.Errorf("Patterns = %d, want 2", len(rpt.Patterns))
		}
	})
}
