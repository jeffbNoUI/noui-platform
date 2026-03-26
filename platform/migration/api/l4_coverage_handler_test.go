package api

import (
	"net/http"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/models"
)

// profilingRunCols matches the column list in profilingRunColumns (profiling.go).
var profilingRunCols = []string{
	"id", "engagement_id", "source_platform", "initiated_by", "status",
	"level_reached", "total_source_columns", "total_canonical_fields",
	"auto_mapped_count", "review_required_count", "unmapped_count",
	"overall_coverage_pct", "rule_signals_found", "readiness_assessment",
	"error_message", "initiated_at", "completed_at",
}

// coverageReportCols matches the SELECT list in GetCoverageReport.
var coverageReportCols = []string{
	"report_id", "profiling_run_id", "schema_version_id",
	"total_canonical_fields", "mapped_fields", "unmapped_fields", "coverage_pct",
	"auto_mapped_count", "review_required_count", "no_match_count",
	"field_details", "created_at",
}

func TestL4CoverageEndpoints(t *testing.T) {
	now := time.Now().UTC()

	t.Run("coverage_200_ok", func(t *testing.T) {
		h, mock := newTestHandler(t)

		// Mock GetEngagement.
		mock.ExpectQuery("SELECT .+ FROM migration.engagement WHERE engagement_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
				"eng-001", "tenant-001", "LegacyPAS", "1.0",
				string(models.StatusProfiling), nil, nil, nil, "standard", now, now,
			))

		// Mock GetProfilingRun.
		mock.ExpectQuery("SELECT .+ FROM migration.profiling_run WHERE id").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(profilingRunCols).AddRow(
				"run-001", "eng-001", "postgres", "user-1",
				string(models.ProfilingStatusCoverageReportReady),
				4, 50, 20, 10, 3, 2, 75.0, nil, nil, nil, now, nil,
			))

		// Mock GetCoverageReport.
		fieldDetailsJSON := `[{"canonical_entity":"canonical_members","field_name":"member_id","data_type":"VARCHAR(200)","is_required":true,"status":"AUTO_MAPPED","source_candidates":[{"source_table":"employees","source_column":"emp_id","confidence":0.95,"match_reason":"exact_name"}]}]`
		mock.ExpectQuery("SELECT report_id, profiling_run_id, schema_version_id").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(coverageReportCols).AddRow(
				"rpt-001", "run-001", "sv-001",
				20, 15, 5, 75.0,
				10, 3, 2,
				[]byte(fieldDetailsJSON), now,
			))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/profiling/run-001/coverage", nil)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("coverage_404_no_report", func(t *testing.T) {
		h, mock := newTestHandler(t)

		// Mock GetEngagement.
		mock.ExpectQuery("SELECT .+ FROM migration.engagement WHERE engagement_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
				"eng-001", "tenant-001", "LegacyPAS", "1.0",
				string(models.StatusProfiling), nil, nil, nil, "standard", now, now,
			))

		// Mock GetProfilingRun.
		mock.ExpectQuery("SELECT .+ FROM migration.profiling_run WHERE id").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(profilingRunCols).AddRow(
				"run-001", "eng-001", "postgres", "user-1",
				string(models.ProfilingStatusRunningL2),
				2, 50, nil, nil, nil, nil, nil, nil, nil, nil, now, nil,
			))

		// Mock GetCoverageReport — no rows.
		mock.ExpectQuery("SELECT report_id").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(coverageReportCols))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/profiling/run-001/coverage", nil)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("coverage_404_engagement_not_found", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mock.ExpectQuery("SELECT .+ FROM migration.engagement WHERE engagement_id").
			WithArgs("eng-999").
			WillReturnRows(sqlmock.NewRows(engagementCols))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-999/profiling/run-001/coverage", nil)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("coverage_404_run_wrong_engagement", func(t *testing.T) {
		h, mock := newTestHandler(t)

		// Engagement exists.
		mock.ExpectQuery("SELECT .+ FROM migration.engagement WHERE engagement_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
				"eng-001", "tenant-001", "LegacyPAS", "1.0",
				string(models.StatusProfiling), nil, nil, nil, "standard", now, now,
			))

		// Run exists but belongs to different engagement.
		mock.ExpectQuery("SELECT .+ FROM migration.profiling_run WHERE id").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(profilingRunCols).AddRow(
				"run-001", "eng-OTHER", "postgres", "user-1",
				string(models.ProfilingStatusRunningL2),
				2, 50, nil, nil, nil, nil, nil, nil, nil, nil, now, nil,
			))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/profiling/run-001/coverage", nil)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("gaps_200_ok", func(t *testing.T) {
		h, mock := newTestHandler(t)

		// Mock GetEngagement.
		mock.ExpectQuery("SELECT .+ FROM migration.engagement WHERE engagement_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
				"eng-001", "tenant-001", "LegacyPAS", "1.0",
				string(models.StatusProfiling), nil, nil, nil, "standard", now, now,
			))

		// Mock GetProfilingRun.
		mock.ExpectQuery("SELECT .+ FROM migration.profiling_run WHERE id").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(profilingRunCols).AddRow(
				"run-001", "eng-001", "postgres", "user-1",
				string(models.ProfilingStatusCoverageReportReady),
				4, 50, 20, 10, 3, 2, 75.0, nil, nil, nil, now, nil,
			))

		// Mock GetCoverageReport with mixed statuses.
		fieldDetailsJSON := `[
			{"canonical_entity":"canonical_members","field_name":"member_id","data_type":"VARCHAR(200)","is_required":true,"status":"AUTO_MAPPED","source_candidates":[]},
			{"canonical_entity":"canonical_members","field_name":"unknown_field","data_type":"TEXT","is_required":false,"status":"UNMAPPED","source_candidates":[]},
			{"canonical_entity":"canonical_salaries","field_name":"amount","data_type":"NUMERIC","is_required":true,"status":"REVIEW_REQUIRED","source_candidates":[]}
		]`
		mock.ExpectQuery("SELECT report_id, profiling_run_id, schema_version_id").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(coverageReportCols).AddRow(
				"rpt-001", "run-001", "sv-001",
				20, 15, 5, 75.0,
				10, 3, 2,
				[]byte(fieldDetailsJSON), now,
			))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/profiling/run-001/coverage/gaps", nil)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("gaps_404_no_report", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mock.ExpectQuery("SELECT .+ FROM migration.engagement WHERE engagement_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
				"eng-001", "tenant-001", "LegacyPAS", "1.0",
				string(models.StatusProfiling), nil, nil, nil, "standard", now, now,
			))

		mock.ExpectQuery("SELECT .+ FROM migration.profiling_run WHERE id").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(profilingRunCols).AddRow(
				"run-001", "eng-001", "postgres", "user-1",
				string(models.ProfilingStatusRunningL1),
				1, nil, nil, nil, nil, nil, nil, nil, nil, nil, now, nil,
			))

		mock.ExpectQuery("SELECT report_id").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(coverageReportCols))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/profiling/run-001/coverage/gaps", nil)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d: %s", w.Code, w.Body.String())
		}
	})
}
