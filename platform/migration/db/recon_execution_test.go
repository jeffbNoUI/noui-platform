package db

import (
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/models"
)

var reconExecRunCols = []string{
	"execution_id", "engagement_id", "ruleset_id", "parallel_run_id",
	"status", "total_evaluated", "match_count", "mismatch_count",
	"p1_count", "p2_count", "p3_count",
	"started_at", "completed_at", "error_message", "created_at",
}

var reconExecMismatchCols = []string{
	"mismatch_id", "execution_id", "rule_id", "member_id",
	"canonical_entity", "field_name", "legacy_value", "new_value",
	"variance_amount", "comparison_type", "tolerance_value", "priority",
	"created_at",
}

func TestReconExecutionModels(t *testing.T) {
	// Verify the model types exist and have expected fields.
	run := models.ReconExecutionRun{
		ExecutionID:   "exec-001",
		EngagementID:  "eng-001",
		RulesetID:     "rs-001",
		ParallelRunID: "pr-001",
		Status:        models.ReconExecPending,
	}
	if run.Status != "PENDING" {
		t.Errorf("Status = %q, want PENDING", run.Status)
	}

	m := models.ReconExecutionMismatch{
		MismatchID:     "mm-001",
		ExecutionID:    "exec-001",
		RuleID:         "r1",
		ComparisonType: models.ComparisonExact,
		Priority:       models.PriorityP1,
	}
	if m.Priority != "P1" {
		t.Errorf("Priority = %q, want P1", m.Priority)
	}
}

func TestCreateReconExecutionRun(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO migration.recon_execution_run").
		WithArgs("eng-001", "rs-001", "pr-001").
		WillReturnRows(sqlmock.NewRows(reconExecRunCols).AddRow(
			"exec-001", "eng-001", "rs-001", "pr-001",
			"PENDING", 0, 0, 0, 0, 0, 0,
			nil, nil, nil, now,
		))

	run, err := CreateReconExecutionRun(db, "eng-001", "rs-001", "pr-001")
	if err != nil {
		t.Fatalf("CreateReconExecutionRun error: %v", err)
	}
	if run.ExecutionID != "exec-001" {
		t.Errorf("ExecutionID = %q, want exec-001", run.ExecutionID)
	}
	if run.Status != models.ReconExecPending {
		t.Errorf("Status = %q, want PENDING", run.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetReconExecutionRun(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT .+ FROM migration.recon_execution_run").
		WithArgs("exec-001").
		WillReturnRows(sqlmock.NewRows(reconExecRunCols).AddRow(
			"exec-001", "eng-001", "rs-001", "pr-001",
			"COMPLETED", 100, 95, 5, 2, 2, 1,
			&now, &now, nil, now,
		))

	run, err := GetReconExecutionRun(db, "exec-001")
	if err != nil {
		t.Fatalf("GetReconExecutionRun error: %v", err)
	}
	if run.MismatchCount != 5 {
		t.Errorf("MismatchCount = %d, want 5", run.MismatchCount)
	}
	if run.P1Count != 2 {
		t.Errorf("P1Count = %d, want 2", run.P1Count)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListReconExecutionRuns(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT .+ FROM migration.recon_execution_run").
		WithArgs("eng-001", 20, 0).
		WillReturnRows(sqlmock.NewRows(reconExecRunCols).
			AddRow("exec-001", "eng-001", "rs-001", "pr-001", "COMPLETED", 100, 95, 5, 2, 2, 1, &now, &now, nil, now).
			AddRow("exec-002", "eng-001", "rs-002", "pr-001", "PENDING", 0, 0, 0, 0, 0, 0, nil, nil, nil, now),
		)

	runs, err := ListReconExecutionRuns(db, "eng-001", 0, 0)
	if err != nil {
		t.Fatalf("ListReconExecutionRuns error: %v", err)
	}
	if len(runs) != 2 {
		t.Fatalf("expected 2 runs, got %d", len(runs))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestReconExecutionDB(t *testing.T) {
	// Umbrella test — covers UpdateReconExecutionRunStatus.
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	mock.ExpectQuery("UPDATE migration.recon_execution_run").
		WithArgs("exec-001", "RUNNING").
		WillReturnRows(sqlmock.NewRows(reconExecRunCols).AddRow(
			"exec-001", "eng-001", "rs-001", "pr-001",
			"RUNNING", 0, 0, 0, 0, 0, 0,
			&now, nil, nil, now,
		))

	run, err := UpdateReconExecutionRunStatus(db, "exec-001", models.ReconExecRunning, nil)
	if err != nil {
		t.Fatalf("UpdateReconExecutionRunStatus error: %v", err)
	}
	if run.Status != models.ReconExecRunning {
		t.Errorf("Status = %q, want RUNNING", run.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateReconExecutionRunCounts(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("UPDATE migration.recon_execution_run").
		WithArgs("exec-001", 100, 95, 5, 2, 2, 1).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = UpdateReconExecutionRunCounts(db, "exec-001", 100, 95, 5, 2, 2, 1)
	if err != nil {
		t.Fatalf("UpdateReconExecutionRunCounts error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestInsertReconExecutionMismatches(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectPrepare("INSERT INTO migration.recon_execution_mismatch")
	lv := "1000.00"
	nv := "999.99"
	va := "1.0000000000"
	tv := "0.50"
	mock.ExpectExec("INSERT INTO migration.recon_execution_mismatch").
		WithArgs("exec-001", "r1", "m1", "benefit", "monthly_benefit",
			&lv, &nv, &va,
			"TOLERANCE_ABS", &tv, "P1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	mismatches := []models.ReconExecutionMismatch{
		{
			ExecutionID:     "exec-001",
			RuleID:          "r1",
			MemberID:        "m1",
			CanonicalEntity: "benefit",
			FieldName:       "monthly_benefit",
			LegacyValue:     &lv,
			NewValue:        &nv,
			VarianceAmount:  &va,
			ComparisonType:  models.ComparisonToleranceAbs,
			ToleranceValue:  &tv,
			Priority:        models.PriorityP1,
		},
	}

	err = InsertReconExecutionMismatches(db, mismatches)
	if err != nil {
		t.Fatalf("InsertReconExecutionMismatches error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestInsertReconExecutionMismatches_Empty(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()

	err = InsertReconExecutionMismatches(db, nil)
	if err != nil {
		t.Fatalf("expected nil error for empty slice, got: %v", err)
	}
}

func TestListReconExecutionMismatches(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	lv := "1000.00"
	nv := "999.00"
	tv := "0.50"
	mock.ExpectQuery("SELECT .+ FROM migration.recon_execution_mismatch").
		WithArgs("exec-001", 50, 0).
		WillReturnRows(sqlmock.NewRows(reconExecMismatchCols).AddRow(
			"mm-001", "exec-001", "r1", "m1", "benefit", "monthly_benefit",
			&lv, &nv, nil, "EXACT", &tv, "P1", now,
		))

	mismatches, err := ListReconExecutionMismatches(db, "exec-001", nil, nil, 0, 0)
	if err != nil {
		t.Fatalf("ListReconExecutionMismatches error: %v", err)
	}
	if len(mismatches) != 1 {
		t.Fatalf("expected 1 mismatch, got %d", len(mismatches))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListReconExecutionMismatches_WithFilters(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()

	priority := "P1"
	entity := "benefit"
	mock.ExpectQuery("SELECT .+ FROM migration.recon_execution_mismatch").
		WithArgs("exec-001", "P1", "benefit", 50, 0).
		WillReturnRows(sqlmock.NewRows(reconExecMismatchCols))

	mismatches, err := ListReconExecutionMismatches(db, "exec-001", &priority, &entity, 0, 0)
	if err != nil {
		t.Fatalf("ListReconExecutionMismatches error: %v", err)
	}
	if len(mismatches) != 0 {
		t.Errorf("expected 0 mismatches with filters, got %d", len(mismatches))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCountReconExecutionMismatches(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("exec-001").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(42))

	count, err := CountReconExecutionMismatches(db, "exec-001")
	if err != nil {
		t.Fatalf("CountReconExecutionMismatches error: %v", err)
	}
	if count != 42 {
		t.Errorf("count = %d, want 42", count)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetReconExecutionSummary(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT .+ FROM migration.recon_execution_run").
		WithArgs("eng-001").
		WillReturnRows(sqlmock.NewRows([]string{
			"total_evaluated", "match_count", "mismatch_count", "p1_count", "p2_count", "p3_count",
		}).AddRow(100, 95, 5, 2, 2, 1))

	summary, err := GetReconExecutionSummary(db, "eng-001")
	if err != nil {
		t.Fatalf("GetReconExecutionSummary error: %v", err)
	}
	if summary == nil {
		t.Fatal("expected non-nil summary")
	}
	if summary.MatchRatio != 0.95 {
		t.Errorf("MatchRatio = %f, want 0.95", summary.MatchRatio)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetAllParallelRunResults(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT .+ FROM migration.parallel_run_result").
		WithArgs("run-001").
		WillReturnRows(sqlmock.NewRows(parallelRunResultCols).
			AddRow("r1", "run-001", "m1", "benefit", "monthly_benefit", "1000", "1000", true, nil, nil, "2026-03-01").
			AddRow("r2", "run-001", "m2", "benefit", "monthly_benefit", "2000", "2001", false, 1.0, 0.05, "2026-03-01"),
		)

	results, err := GetAllParallelRunResults(db, "run-001")
	if err != nil {
		t.Fatalf("GetAllParallelRunResults error: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}
