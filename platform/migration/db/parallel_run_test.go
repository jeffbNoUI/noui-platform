package db

import (
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/models"
)

// parallelRunCols matches the 13-column RETURNING clause for parallel_run queries.
var parallelRunCols = []string{
	"run_id", "engagement_id", "name", "description", "status",
	"legacy_source", "canonical_source", "comparison_mode", "sample_rate",
	"started_by", "started_at", "completed_at", "created_at",
}

// parallelRunResultCols matches the 11-column list for parallel_run_result queries.
var parallelRunResultCols = []string{
	"result_id", "run_id", "member_id", "canonical_entity", "field_name",
	"legacy_value", "new_value", "match", "variance_amount", "variance_pct",
	"checked_at",
}

func TestCreateParallelRun(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	sampleRate := 0.1
	mock.ExpectQuery("INSERT INTO migration.parallel_run").
		WithArgs("eng-001", "First Run", nil, "PENDING",
			"legacy-db", "canonical-api", "SAMPLE", &sampleRate, "analyst@co.com").
		WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
			"run-001", "eng-001", "First Run", nil, "PENDING",
			"legacy-db", "canonical-api", "SAMPLE", 0.1,
			"analyst@co.com", nil, nil, now,
		))

	input := &models.ParallelRun{
		EngagementID:    "eng-001",
		Name:            "First Run",
		Status:          models.ParallelRunPending,
		LegacySource:    "legacy-db",
		CanonicalSource: "canonical-api",
		ComparisonMode:  models.ComparisonModeSample,
		SampleRate:      &sampleRate,
		StartedBy:       "analyst@co.com",
	}

	r, err := CreateParallelRun(db, input)
	if err != nil {
		t.Fatalf("CreateParallelRun error: %v", err)
	}
	if r.RunID != "run-001" {
		t.Errorf("RunID = %q, want %q", r.RunID, "run-001")
	}
	if r.Status != models.ParallelRunPending {
		t.Errorf("Status = %q, want %q", r.Status, models.ParallelRunPending)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetParallelRun(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT .+ FROM migration.parallel_run").
		WithArgs("run-001").
		WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
			"run-001", "eng-001", "Test Run", nil, "RUNNING",
			"legacy-db", "canonical-api", "FULL", 1.0,
			"analyst@co.com", now, nil, now,
		))

	r, err := GetParallelRun(db, "run-001")
	if err != nil {
		t.Fatalf("GetParallelRun error: %v", err)
	}
	if r == nil {
		t.Fatal("GetParallelRun returned nil")
	}
	if r.RunID != "run-001" {
		t.Errorf("RunID = %q, want %q", r.RunID, "run-001")
	}
	if r.Status != models.ParallelRunRunning {
		t.Errorf("Status = %q, want %q", r.Status, models.ParallelRunRunning)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetParallelRun_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT .+ FROM migration.parallel_run").
		WithArgs("run-999").
		WillReturnRows(sqlmock.NewRows(parallelRunCols))

	r, err := GetParallelRun(db, "run-999")
	if err != nil {
		t.Fatalf("GetParallelRun error: %v", err)
	}
	if r != nil {
		t.Errorf("expected nil for not-found, got %+v", r)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListParallelRuns(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	rows := sqlmock.NewRows(parallelRunCols).
		AddRow("run-002", "eng-001", "Run B", nil, "RUNNING",
			"legacy-db", "canonical-api", "SAMPLE", 0.1,
			"analyst@co.com", now, nil, now).
		AddRow("run-001", "eng-001", "Run A", nil, "COMPLETED",
			"legacy-db", "canonical-api", "FULL", 1.0,
			"analyst@co.com", now, now, now.Add(-time.Hour))

	mock.ExpectQuery("SELECT .+ FROM migration.parallel_run").
		WithArgs("eng-001").
		WillReturnRows(rows)

	runs, err := ListParallelRuns(db, "eng-001", nil)
	if err != nil {
		t.Fatalf("ListParallelRuns error: %v", err)
	}
	if len(runs) != 2 {
		t.Fatalf("len(runs) = %d, want 2", len(runs))
	}
	if runs[0].RunID != "run-002" {
		t.Errorf("first run = %q, want run-002", runs[0].RunID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListParallelRuns_WithStatusFilter(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	status := "RUNNING"
	mock.ExpectQuery("SELECT .+ FROM migration.parallel_run").
		WithArgs("eng-001", "RUNNING").
		WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
			"run-002", "eng-001", "Run B", nil, "RUNNING",
			"legacy-db", "canonical-api", "SAMPLE", 0.1,
			"analyst@co.com", now, nil, now,
		))

	runs, err := ListParallelRuns(db, "eng-001", &status)
	if err != nil {
		t.Fatalf("ListParallelRuns with filter error: %v", err)
	}
	if len(runs) != 1 {
		t.Fatalf("len(runs) = %d, want 1", len(runs))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateParallelRunStatus(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()

	// First: GetParallelRun reads the current status
	mock.ExpectQuery("SELECT .+ FROM migration.parallel_run").
		WithArgs("run-001").
		WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
			"run-001", "eng-001", "Test Run", nil, "PENDING",
			"legacy-db", "canonical-api", "SAMPLE", 0.1,
			"analyst@co.com", nil, nil, now,
		))

	// Then: UPDATE with new status
	mock.ExpectQuery("UPDATE migration.parallel_run").
		WithArgs("run-001", "RUNNING").
		WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
			"run-001", "eng-001", "Test Run", nil, "RUNNING",
			"legacy-db", "canonical-api", "SAMPLE", 0.1,
			"analyst@co.com", now, nil, now,
		))

	r, err := UpdateParallelRunStatus(db, "run-001", models.ParallelRunRunning)
	if err != nil {
		t.Fatalf("UpdateParallelRunStatus error: %v", err)
	}
	if r.Status != models.ParallelRunRunning {
		t.Errorf("Status = %q, want %q", r.Status, models.ParallelRunRunning)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateParallelRunStatus_InvalidTransition(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()

	// GetParallelRun reads current status as COMPLETED
	mock.ExpectQuery("SELECT .+ FROM migration.parallel_run").
		WithArgs("run-001").
		WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
			"run-001", "eng-001", "Test Run", nil, "COMPLETED",
			"legacy-db", "canonical-api", "SAMPLE", 0.1,
			"analyst@co.com", now, now, now,
		))

	_, err = UpdateParallelRunStatus(db, "run-001", models.ParallelRunRunning)
	if err == nil {
		t.Error("expected error for invalid transition COMPLETED→RUNNING, got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestInsertParallelRunResults(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	legVal := "1000.00"
	newVal := "1000.00"
	results := []models.ParallelRunResult{
		{
			RunID:           "run-001",
			MemberID:        "M001",
			CanonicalEntity: "salary",
			FieldName:       "amount",
			LegacyValue:     &legVal,
			NewValue:        &newVal,
			Match:           true,
		},
		{
			RunID:           "run-001",
			MemberID:        "M002",
			CanonicalEntity: "salary",
			FieldName:       "amount",
			LegacyValue:     &legVal,
			NewValue:        nil,
			Match:           false,
		},
	}

	mock.ExpectBegin()
	mock.ExpectPrepare("INSERT INTO migration.parallel_run_result")
	mock.ExpectExec("INSERT INTO migration.parallel_run_result").
		WithArgs("run-001", "M001", "salary", "amount", &legVal, &newVal, true, nil, nil).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO migration.parallel_run_result").
		WithArgs("run-001", "M002", "salary", "amount", &legVal, nil, false, nil, nil).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	n, err := InsertParallelRunResults(db, results)
	if err != nil {
		t.Fatalf("InsertParallelRunResults error: %v", err)
	}
	if n != 2 {
		t.Errorf("inserted = %d, want 2", n)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestInsertParallelRunResults_Empty(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	n, err := InsertParallelRunResults(db, nil)
	if err != nil {
		t.Fatalf("InsertParallelRunResults(nil) error: %v", err)
	}
	if n != 0 {
		t.Errorf("inserted = %d, want 0", n)
	}
}

func TestGetParallelRunResults(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	legVal := "1000.00"
	newVal := "1050.00"
	mock.ExpectQuery("SELECT .+ FROM migration.parallel_run_result").
		WithArgs("run-001", 50, 0).
		WillReturnRows(sqlmock.NewRows(parallelRunResultCols).AddRow(
			"res-001", "run-001", "M001", "salary", "amount",
			&legVal, &newVal, false, 50.0, 5.0, "2026-03-25T12:00:00Z",
		))

	results, err := GetParallelRunResults(db, "run-001", nil, 50, 0)
	if err != nil {
		t.Fatalf("GetParallelRunResults error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("len(results) = %d, want 1", len(results))
	}
	if results[0].ResultID != "res-001" {
		t.Errorf("ResultID = %q, want %q", results[0].ResultID, "res-001")
	}
	if results[0].Match {
		t.Error("expected match = false")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetParallelRunResults_WithMatchFilter(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	matchOnly := false
	mock.ExpectQuery("SELECT .+ FROM migration.parallel_run_result").
		WithArgs("run-001", false, 200, 0).
		WillReturnRows(sqlmock.NewRows(parallelRunResultCols))

	results, err := GetParallelRunResults(db, "run-001", &matchOnly, 0, 0)
	if err != nil {
		t.Fatalf("GetParallelRunResults error: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected empty results, got %d", len(results))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetParallelRunSummary(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT canonical_entity").
		WithArgs("run-001").
		WillReturnRows(sqlmock.NewRows([]string{"canonical_entity", "match_count", "mismatch_count"}).
			AddRow("salary", 80, 10).
			AddRow("contribution", 45, 5))

	s, err := GetParallelRunSummary(db, "run-001")
	if err != nil {
		t.Fatalf("GetParallelRunSummary error: %v", err)
	}
	if s.TotalCompared != 140 {
		t.Errorf("TotalCompared = %d, want 140", s.TotalCompared)
	}
	if s.MatchCount != 125 {
		t.Errorf("MatchCount = %d, want 125", s.MatchCount)
	}
	if s.MismatchCount != 15 {
		t.Errorf("MismatchCount = %d, want 15", s.MismatchCount)
	}
	// 125/140 * 100 = ~89.28...
	if s.MatchRatePct < 89.0 || s.MatchRatePct > 90.0 {
		t.Errorf("MatchRatePct = %f, want ~89.28", s.MatchRatePct)
	}
	if len(s.ByEntity) != 2 {
		t.Errorf("ByEntity has %d entries, want 2", len(s.ByEntity))
	}
	if s.ByEntity["salary"].MatchCount != 80 {
		t.Errorf("salary.MatchCount = %d, want 80", s.ByEntity["salary"].MatchCount)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetParallelRunSummary_Empty(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT canonical_entity").
		WithArgs("run-999").
		WillReturnRows(sqlmock.NewRows([]string{"canonical_entity", "match_count", "mismatch_count"}))

	s, err := GetParallelRunSummary(db, "run-999")
	if err != nil {
		t.Fatalf("GetParallelRunSummary error: %v", err)
	}
	if s.TotalCompared != 0 {
		t.Errorf("TotalCompared = %d, want 0", s.TotalCompared)
	}
	if s.MatchRatePct != 0 {
		t.Errorf("MatchRatePct = %f, want 0", s.MatchRatePct)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}
