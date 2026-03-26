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
