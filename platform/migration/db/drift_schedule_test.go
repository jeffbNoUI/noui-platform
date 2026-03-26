package db

import (
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

// driftScheduleTestCols matches the 8-column RETURNING clause for drift_schedule.
var driftScheduleTestCols = []string{
	"schedule_id", "engagement_id", "interval_hours", "enabled",
	"last_triggered_at", "next_trigger_at", "created_at", "updated_at",
}

func TestUpsertDriftSchedule(t *testing.T) {
	t.Run("creates_new_schedule", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()
		now := time.Now().UTC()

		mock.ExpectQuery("INSERT INTO migration.drift_schedule").
			WillReturnRows(sqlmock.NewRows(driftScheduleTestCols).AddRow(
				"sched-001", "eng-001", 24, true, nil, now.Add(24*time.Hour), now, now,
			))

		s, err := UpsertDriftSchedule(db, "eng-001", 24, true)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if s.ScheduleID != "sched-001" {
			t.Errorf("expected schedule_id=sched-001, got %s", s.ScheduleID)
		}
		if s.IntervalHours != 24 {
			t.Errorf("expected interval_hours=24, got %d", s.IntervalHours)
		}
		if !s.Enabled {
			t.Error("expected enabled=true")
		}
	})

	t.Run("clamps_interval_min", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()
		now := time.Now().UTC()

		mock.ExpectQuery("INSERT INTO migration.drift_schedule").
			WillReturnRows(sqlmock.NewRows(driftScheduleTestCols).AddRow(
				"sched-001", "eng-001", 1, false, nil, nil, now, now,
			))

		s, err := UpsertDriftSchedule(db, "eng-001", -5, false)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if s.IntervalHours != 1 {
			t.Errorf("expected clamped interval_hours=1, got %d", s.IntervalHours)
		}
	})

	t.Run("clamps_interval_max", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()
		now := time.Now().UTC()

		mock.ExpectQuery("INSERT INTO migration.drift_schedule").
			WillReturnRows(sqlmock.NewRows(driftScheduleTestCols).AddRow(
				"sched-001", "eng-001", 168, false, nil, nil, now, now,
			))

		s, err := UpsertDriftSchedule(db, "eng-001", 999, false)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if s.IntervalHours != 168 {
			t.Errorf("expected clamped interval_hours=168, got %d", s.IntervalHours)
		}
	})

	t.Run("nil_db_returns_error", func(t *testing.T) {
		_, err := UpsertDriftSchedule(nil, "eng-001", 24, true)
		if err == nil {
			t.Fatal("expected error for nil db")
		}
	})
}

func TestGetDriftSchedule(t *testing.T) {
	t.Run("returns_schedule", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()
		now := time.Now().UTC()

		mock.ExpectQuery("SELECT .+ FROM migration.drift_schedule WHERE engagement_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(driftScheduleTestCols).AddRow(
				"sched-001", "eng-001", 12, true, now, now.Add(12*time.Hour), now, now,
			))

		s, err := GetDriftSchedule(db, "eng-001")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if s == nil {
			t.Fatal("expected non-nil schedule")
		}
		if s.IntervalHours != 12 {
			t.Errorf("expected interval_hours=12, got %d", s.IntervalHours)
		}
	})

	t.Run("returns_nil_for_no_rows", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()

		mock.ExpectQuery("SELECT .+ FROM migration.drift_schedule WHERE engagement_id").
			WithArgs("eng-999").
			WillReturnRows(sqlmock.NewRows(driftScheduleTestCols))

		s, err := GetDriftSchedule(db, "eng-999")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if s != nil {
			t.Error("expected nil schedule for non-existent engagement")
		}
	})

	t.Run("nil_db_returns_error", func(t *testing.T) {
		_, err := GetDriftSchedule(nil, "eng-001")
		if err == nil {
			t.Fatal("expected error for nil db")
		}
	})
}

func TestUpdateDriftSchedule(t *testing.T) {
	t.Run("updates_interval", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()
		now := time.Now().UTC()
		newInterval := 48

		// GetDriftSchedule (reads current state).
		mock.ExpectQuery("SELECT .+ FROM migration.drift_schedule WHERE engagement_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(driftScheduleTestCols).AddRow(
				"sched-001", "eng-001", 24, true, nil, now.Add(24*time.Hour), now, now,
			))

		// UPDATE RETURNING.
		mock.ExpectQuery("UPDATE migration.drift_schedule").
			WillReturnRows(sqlmock.NewRows(driftScheduleTestCols).AddRow(
				"sched-001", "eng-001", 48, true, nil, now.Add(48*time.Hour), now, now,
			))

		s, err := UpdateDriftSchedule(db, "eng-001", &newInterval, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if s.IntervalHours != 48 {
			t.Errorf("expected interval_hours=48, got %d", s.IntervalHours)
		}
	})

	t.Run("returns_nil_for_no_schedule", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()

		mock.ExpectQuery("SELECT .+ FROM migration.drift_schedule WHERE engagement_id").
			WithArgs("eng-999").
			WillReturnRows(sqlmock.NewRows(driftScheduleTestCols))

		newInterval := 48
		s, err := UpdateDriftSchedule(db, "eng-999", &newInterval, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if s != nil {
			t.Error("expected nil for non-existent schedule")
		}
	})

	t.Run("nil_db_returns_error", func(t *testing.T) {
		newInterval := 24
		_, err := UpdateDriftSchedule(nil, "eng-001", &newInterval, nil)
		if err == nil {
			t.Fatal("expected error for nil db")
		}
	})
}

func TestGetDriftSummary(t *testing.T) {
	t.Run("with_completed_critical_run", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()
		now := time.Now().UTC()

		// Total runs.
		mock.ExpectQuery("SELECT COUNT").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))

		// Most recent completed.
		mock.ExpectQuery("SELECT run_id, completed_at, detected_changes, critical_changes").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows([]string{"run_id", "completed_at", "detected_changes", "critical_changes"}).
				AddRow("run-003", now, 5, 2))

		// Severity breakdown.
		mock.ExpectQuery("SELECT severity, COUNT").
			WithArgs("run-003").
			WillReturnRows(sqlmock.NewRows([]string{"severity", "count"}).
				AddRow("CRITICAL", 2).
				AddRow("HIGH", 1).
				AddRow("MEDIUM", 2))

		// Schedule.
		mock.ExpectQuery("SELECT .+ FROM migration.drift_schedule WHERE engagement_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(driftScheduleTestCols).AddRow(
				"sched-001", "eng-001", 24, true, now, now.Add(24*time.Hour), now, now,
			))

		summary, err := GetDriftSummary(db, "eng-001")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if summary.TotalRuns != 3 {
			t.Errorf("expected total_runs=3, got %d", summary.TotalRuns)
		}
		if summary.DriftStatus != "CRITICAL" {
			t.Errorf("expected drift_status=CRITICAL, got %s", summary.DriftStatus)
		}
		if summary.BySeverity["CRITICAL"] != 2 {
			t.Errorf("expected CRITICAL count=2, got %d", summary.BySeverity["CRITICAL"])
		}
		if !summary.ScheduleEnabled {
			t.Error("expected schedule_enabled=true")
		}
	})

	t.Run("no_runs_returns_clean", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()

		mock.ExpectQuery("SELECT COUNT").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

		mock.ExpectQuery("SELECT run_id, completed_at, detected_changes, critical_changes").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows([]string{"run_id", "completed_at", "detected_changes", "critical_changes"}))

		mock.ExpectQuery("SELECT .+ FROM migration.drift_schedule WHERE engagement_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(driftScheduleTestCols))

		summary, err := GetDriftSummary(db, "eng-001")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if summary.DriftStatus != "CLEAN" {
			t.Errorf("expected CLEAN, got %s", summary.DriftStatus)
		}
		if summary.TotalRuns != 0 {
			t.Errorf("expected 0 runs, got %d", summary.TotalRuns)
		}
	})

	t.Run("nil_db_returns_error", func(t *testing.T) {
		_, err := GetDriftSummary(nil, "eng-001")
		if err == nil {
			t.Fatal("expected error for nil db")
		}
	})
}

func TestClaimDueSchedules(t *testing.T) {
	t.Run("nil_db_returns_error", func(t *testing.T) {
		_, err := ClaimDueSchedules(nil)
		if err == nil {
			t.Fatal("expected error for nil db")
		}
	})
}
