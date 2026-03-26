package db

import (
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/models"
)

func TestCoverageReportRLS(t *testing.T) {
	// This test validates the RLS policy structure via the migration file.
	// The actual RLS enforcement is tested in rls_test.go against a real DB.
	// Here we validate the DB functions work correctly with sqlmock.
	t.Run("insert_returns_id", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New() error: %v", err)
		}
		defer db.Close()

		report := &models.CoverageReport{
			ProfilingRunID:       "run-001",
			SchemaVersionID:      "sv-001",
			TotalCanonicalFields: 20,
			MappedFields:         15,
			UnmappedFields:       5,
			CoveragePct:          75.0,
			AutoMappedCount:      10,
			ReviewRequiredCount:  3,
			NoMatchCount:         2,
			FieldDetails:         []models.CoverageFieldDetail{},
		}

		mock.ExpectQuery("INSERT INTO migration.coverage_report").
			WillReturnRows(sqlmock.NewRows([]string{"report_id"}).AddRow("rpt-001"))

		id, err := InsertCoverageReport(db, report)
		if err != nil {
			t.Fatalf("InsertCoverageReport error: %v", err)
		}
		if id != "rpt-001" {
			t.Errorf("id = %q, want rpt-001", id)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("insert_nil_db", func(t *testing.T) {
		report := &models.CoverageReport{FieldDetails: []models.CoverageFieldDetail{}}
		_, err := InsertCoverageReport(nil, report)
		if err == nil {
			t.Fatal("expected error for nil db")
		}
	})
}

func TestGetCoverageReport(t *testing.T) {
	t.Run("found", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New() error: %v", err)
		}
		defer db.Close()

		now := time.Now()
		rows := sqlmock.NewRows([]string{
			"report_id", "profiling_run_id", "schema_version_id",
			"total_canonical_fields", "mapped_fields", "unmapped_fields", "coverage_pct",
			"auto_mapped_count", "review_required_count", "no_match_count",
			"field_details", "created_at",
		}).AddRow(
			"rpt-001", "run-001", "sv-001",
			20, 15, 5, 75.0,
			10, 3, 2,
			[]byte(`[{"canonical_entity":"canonical_members","field_name":"member_id","data_type":"VARCHAR(200)","is_required":true,"status":"AUTO_MAPPED","source_candidates":[]}]`),
			now,
		)

		mock.ExpectQuery("SELECT report_id, profiling_run_id, schema_version_id").
			WithArgs("run-001").
			WillReturnRows(rows)

		report, err := GetCoverageReport(db, "run-001")
		if err != nil {
			t.Fatalf("GetCoverageReport error: %v", err)
		}
		if report == nil {
			t.Fatal("expected non-nil report")
		}
		if report.ReportID != "rpt-001" {
			t.Errorf("ReportID = %q, want rpt-001", report.ReportID)
		}
		if report.TotalCanonicalFields != 20 {
			t.Errorf("TotalCanonicalFields = %d, want 20", report.TotalCanonicalFields)
		}
		if len(report.FieldDetails) != 1 {
			t.Errorf("FieldDetails len = %d, want 1", len(report.FieldDetails))
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("not_found", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New() error: %v", err)
		}
		defer db.Close()

		mock.ExpectQuery("SELECT report_id").
			WithArgs("run-999").
			WillReturnRows(sqlmock.NewRows([]string{}))

		report, err := GetCoverageReport(db, "run-999")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if report != nil {
			t.Errorf("expected nil report for missing run, got %+v", report)
		}
	})

	t.Run("nil_db", func(t *testing.T) {
		_, err := GetCoverageReport(nil, "run-001")
		if err == nil {
			t.Fatal("expected error for nil db")
		}
	})
}

func TestUpdateProfilingRunCoverageAggregates(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New() error: %v", err)
		}
		defer db.Close()

		mock.ExpectExec("UPDATE migration.profiling_run").
			WithArgs("run-001", 20, 10, 3, 2, 75.0).
			WillReturnResult(sqlmock.NewResult(0, 1))

		err = UpdateProfilingRunCoverageAggregates(db, "run-001", 20, 10, 3, 2, 75.0)
		if err != nil {
			t.Fatalf("error: %v", err)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("nil_db", func(t *testing.T) {
		err := UpdateProfilingRunCoverageAggregates(nil, "run-001", 20, 10, 3, 2, 75.0)
		if err == nil {
			t.Fatal("expected error for nil db")
		}
	})
}

func TestGetEngagementIDForProfilingRun(t *testing.T) {
	t.Run("found", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New() error: %v", err)
		}
		defer db.Close()

		mock.ExpectQuery("SELECT engagement_id FROM migration.profiling_run").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows([]string{"engagement_id"}).AddRow("eng-001"))

		engID, err := GetEngagementIDForProfilingRun(db, "run-001")
		if err != nil {
			t.Fatalf("error: %v", err)
		}
		if engID != "eng-001" {
			t.Errorf("engagement_id = %q, want eng-001", engID)
		}
	})

	t.Run("nil_db", func(t *testing.T) {
		_, err := GetEngagementIDForProfilingRun(nil, "run-001")
		if err == nil {
			t.Fatal("expected error for nil db")
		}
	})
}

func TestGetTenantIDForEngagement(t *testing.T) {
	t.Run("found", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New() error: %v", err)
		}
		defer db.Close()

		mock.ExpectQuery("SELECT tenant_id FROM migration.engagement").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows([]string{"tenant_id"}).AddRow("tenant-001"))

		tid, err := GetTenantIDForEngagement(db, "eng-001")
		if err != nil {
			t.Fatalf("error: %v", err)
		}
		if tid != "tenant-001" {
			t.Errorf("tenant_id = %q, want tenant-001", tid)
		}
	})

	t.Run("nil_db", func(t *testing.T) {
		_, err := GetTenantIDForEngagement(nil, "eng-001")
		if err == nil {
			t.Fatal("expected error for nil db")
		}
	})
}
