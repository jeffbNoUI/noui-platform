package jobqueue

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

// --- Enqueue ---

func TestEnqueue_Success(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	mock.ExpectQuery(`INSERT INTO migration\.job`).
		WithArgs("eng-1", "profile_l1", "public.members", 10, sqlmock.AnyArg(), 3).
		WillReturnRows(sqlmock.NewRows([]string{"job_id"}).AddRow("job-abc"))

	id, err := q.Enqueue(context.Background(), EnqueueParams{
		EngagementID: "eng-1",
		JobType:      "profile_l1",
		Scope:        "public.members",
		Priority:     10,
		InputJSON:    json.RawMessage(`{"table":"public.members"}`),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if id != "job-abc" {
		t.Fatalf("expected job-abc, got %s", id)
	}
}

func TestEnqueue_DefaultMaxAttempts(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	mock.ExpectQuery(`INSERT INTO migration\.job`).
		WithArgs("eng-1", "profile_l2", "t", 0, sqlmock.AnyArg(), 3).
		WillReturnRows(sqlmock.NewRows([]string{"job_id"}).AddRow("job-1"))

	_, err := q.Enqueue(context.Background(), EnqueueParams{
		EngagementID: "eng-1",
		JobType:      "profile_l2",
		Scope:        "t",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestEnqueue_NilInputJSONDefaults(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	mock.ExpectQuery(`INSERT INTO migration\.job`).
		WithArgs("eng-1", "profile_l1", "t", 0, json.RawMessage(`{}`), 3).
		WillReturnRows(sqlmock.NewRows([]string{"job_id"}).AddRow("job-1"))

	_, err := q.Enqueue(context.Background(), EnqueueParams{
		EngagementID: "eng-1",
		JobType:      "profile_l1",
		Scope:        "t",
		InputJSON:    nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// --- EnqueueBatch ---

func TestEnqueueBatch_MultipleJobs(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	mock.ExpectBegin()
	mock.ExpectPrepare(`INSERT INTO migration\.job`)
	mock.ExpectQuery(`INSERT INTO migration\.job`).
		WillReturnRows(sqlmock.NewRows([]string{"job_id"}).AddRow("j1"))
	mock.ExpectQuery(`INSERT INTO migration\.job`).
		WillReturnRows(sqlmock.NewRows([]string{"job_id"}).AddRow("j2"))
	mock.ExpectQuery(`INSERT INTO migration\.job`).
		WillReturnRows(sqlmock.NewRows([]string{"job_id"}).AddRow("j3"))
	mock.ExpectCommit()

	ids, err := q.EnqueueBatch(context.Background(), []EnqueueParams{
		{EngagementID: "eng-1", JobType: "profile_l1", Scope: "t1"},
		{EngagementID: "eng-1", JobType: "profile_l1", Scope: "t2"},
		{EngagementID: "eng-1", JobType: "profile_l1", Scope: "t3"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(ids) != 3 {
		t.Fatalf("expected 3 IDs, got %d", len(ids))
	}
	if ids[0] != "j1" || ids[1] != "j2" || ids[2] != "j3" {
		t.Fatalf("unexpected IDs: %v", ids)
	}
}

// --- Claim ---

func TestClaim_ReturnsJob(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	now := time.Now()
	cols := jobColumns()
	mock.ExpectQuery(`UPDATE migration\.job`).
		WithArgs("worker-1").
		WillReturnRows(sqlmock.NewRows(cols).AddRow(
			"job-1", "eng-1", "profile_l1", "public.members", "CLAIMED", 10, 0,
			[]byte(`{"table":"members"}`), nil, nil, strPtr("worker-1"), 1, 3,
			now, &now, &now, nil,
		))

	j, err := q.Claim(context.Background(), "worker-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if j == nil {
		t.Fatal("expected a job, got nil")
	}
	if j.JobID != "job-1" {
		t.Fatalf("expected job-1, got %s", j.JobID)
	}
	if j.Status != StatusClaimed {
		t.Fatalf("expected CLAIMED, got %s", j.Status)
	}
}

func TestClaim_NoJobAvailable(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	mock.ExpectQuery(`UPDATE migration\.job`).
		WithArgs("worker-1").
		WillReturnRows(sqlmock.NewRows(jobColumns()))

	j, err := q.Claim(context.Background(), "worker-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if j != nil {
		t.Fatalf("expected nil job, got %+v", j)
	}
}

// --- MarkRunning ---

func TestMarkRunning_Success(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	mock.ExpectExec(`UPDATE migration\.job SET status = 'RUNNING'`).
		WithArgs("job-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := q.MarkRunning(context.Background(), "job-1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestMarkRunning_NotClaimed(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	mock.ExpectExec(`UPDATE migration\.job SET status = 'RUNNING'`).
		WithArgs("job-1").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := q.MarkRunning(context.Background(), "job-1")
	if err == nil {
		t.Fatal("expected error for non-CLAIMED job")
	}
}

// --- Heartbeat ---

func TestHeartbeat_Active(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	mock.ExpectQuery(`UPDATE migration\.job SET heartbeat_at`).
		WithArgs("job-1").
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow("RUNNING"))

	active, err := q.Heartbeat(context.Background(), "job-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !active {
		t.Fatal("expected active=true")
	}
}

func TestHeartbeat_Cancelled(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	// First query: heartbeat fails (job no longer active)
	mock.ExpectQuery(`UPDATE migration\.job SET heartbeat_at`).
		WithArgs("job-1").
		WillReturnRows(sqlmock.NewRows([]string{"status"}))
	// Second query: check actual status
	mock.ExpectQuery(`SELECT status FROM migration\.job`).
		WithArgs("job-1").
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow("CANCELLED"))

	active, err := q.Heartbeat(context.Background(), "job-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if active {
		t.Fatal("expected active=false for cancelled job")
	}
}

// --- Complete ---

func TestComplete_Success(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	result := json.RawMessage(`{"score":0.95}`)
	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs("job-1", result).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := q.Complete(context.Background(), "job-1", result); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// --- Fail ---

func TestFail_RequeuesWhenAttemptsRemain(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	mock.ExpectQuery(`SELECT attempt, max_attempts`).
		WithArgs("job-1").
		WillReturnRows(sqlmock.NewRows([]string{"attempt", "max_attempts"}).AddRow(1, 3))
	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs("job-1", "PENDING", "timeout exceeded").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := q.Fail(context.Background(), "job-1", "timeout exceeded"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestFail_PermanentWhenMaxAttempts(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	mock.ExpectQuery(`SELECT attempt, max_attempts`).
		WithArgs("job-1").
		WillReturnRows(sqlmock.NewRows([]string{"attempt", "max_attempts"}).AddRow(3, 3))
	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs("job-1", "FAILED", "out of retries").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := q.Fail(context.Background(), "job-1", "out of retries"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// --- Cancel ---

func TestCancel_Success(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	mock.ExpectExec(`UPDATE migration\.job SET status = 'CANCELLED'`).
		WithArgs("job-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := q.Cancel(context.Background(), "job-1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestCancel_AlreadyComplete(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	mock.ExpectExec(`UPDATE migration\.job SET status = 'CANCELLED'`).
		WithArgs("job-1").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := q.Cancel(context.Background(), "job-1")
	if err == nil {
		t.Fatal("expected error for already-complete job")
	}
}

// --- RecoverStale ---

func TestRecoverStale_ResetsStalledJobs(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs("300 seconds").
		WillReturnResult(sqlmock.NewResult(0, 3))

	n, err := q.RecoverStale(context.Background(), 5*time.Minute)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if n != 3 {
		t.Fatalf("expected 3 recovered, got %d", n)
	}
}

// --- ActiveWorkers ---

func TestActiveWorkers_ReturnsConnected(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	now := time.Now()
	mock.ExpectQuery(`SELECT worker_id, COUNT`).
		WithArgs("120 seconds").
		WillReturnRows(sqlmock.NewRows([]string{"worker_id", "active_jobs", "last_heartbeat"}).
			AddRow("worker-1", 2, now).
			AddRow("worker-2", 1, now.Add(-30*time.Second)))

	workers, err := q.ActiveWorkers(context.Background(), 2*time.Minute)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(workers) != 2 {
		t.Fatalf("expected 2 workers, got %d", len(workers))
	}
	if workers[0].WorkerID != "worker-1" || workers[0].ActiveJobs != 2 {
		t.Fatalf("unexpected first worker: %+v", workers[0])
	}
}

// --- UpdateProgress ---

func TestUpdateProgress_Clamps(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	// progress > 100 should be clamped
	mock.ExpectExec(`UPDATE migration\.job SET progress`).
		WithArgs("job-1", 100).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := q.UpdateProgress(context.Background(), "job-1", 150); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// --- ListByEngagement ---

func TestListByEngagement_WithFilters(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	jt := "profile_l1"
	st := StatusComplete
	now := time.Now()

	mock.ExpectQuery(`SELECT .+ FROM migration\.job WHERE engagement_id`).
		WithArgs("eng-1", jt, string(st), 50).
		WillReturnRows(sqlmock.NewRows(jobColumns()).AddRow(
			"j1", "eng-1", "profile_l1", "t1", "COMPLETE", 0, 100,
			[]byte(`{}`), []byte(`{"done":true}`), nil, nil, 1, 3,
			now, nil, nil, &now,
		))

	jobs, err := q.ListByEngagement(context.Background(), "eng-1", ListParams{
		JobType: &jt,
		Status:  &st,
		Limit:   50,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}
	if jobs[0].Status != StatusComplete {
		t.Fatalf("expected COMPLETE, got %s", jobs[0].Status)
	}
}

// --- PurgeCompleted ---

func TestPurgeCompleted_DeletesOld(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	q := New(db)

	mock.ExpectExec(`DELETE FROM migration\.job`).
		WithArgs(fmt.Sprintf("%d seconds", int((30 * 24 * time.Hour).Seconds()))).
		WillReturnResult(sqlmock.NewResult(0, 42))

	n, err := q.PurgeCompleted(context.Background(), 30*24*time.Hour)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if n != 42 {
		t.Fatalf("expected 42 purged, got %d", n)
	}
}

// --- helpers ---

func jobColumns() []string {
	return []string{
		"job_id", "engagement_id", "job_type", "scope", "status", "priority", "progress",
		"input_json", "result_json", "error_message", "worker_id", "attempt", "max_attempts",
		"created_at", "claimed_at", "heartbeat_at", "completed_at",
	}
}

func strPtr(s string) *string { return &s }
