package batch

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/jobqueue"
)

// --- test helpers ---

// jobEventCollector collects BatchEvents emitted by the worker.
type jobEventCollector struct {
	mu     sync.Mutex
	events []BatchEvent
}

func (c *jobEventCollector) Emit(event BatchEvent) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.events = append(c.events, event)
}

func (c *jobEventCollector) eventTypes() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	types := make([]string, len(c.events))
	for i, e := range c.events {
		types[i] = e.Type
	}
	return types
}

func (c *jobEventCollector) len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.events)
}

func (c *jobEventCollector) hasEvent(eventType string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, e := range c.events {
		if e.Type == eventType {
			return true
		}
	}
	return false
}

// countingHandler tracks how many times it was called.
type countingHandler struct {
	mu        sync.Mutex
	calls     int
	returnErr error
	delay     time.Duration
}

func (h *countingHandler) Execute(ctx context.Context, job *jobqueue.Job, conn *sql.Conn) error {
	if h.delay > 0 {
		select {
		case <-time.After(h.delay):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	h.mu.Lock()
	h.calls++
	h.mu.Unlock()
	return h.returnErr
}

func (h *countingHandler) callCount() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.calls
}

// --- TestJobWorkerExecute (AC-1) ---

func TestJobWorkerExecute_HappyPath(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	q := jobqueue.New(db)
	dispatcher := NewJobDispatcher()
	handler := &countingHandler{}
	dispatcher.Register("profile_l1", handler)
	emitter := &jobEventCollector{}

	w := NewJobWorker(db, q, dispatcher, emitter, DefaultJobWorkerConfig())

	// Expect: engagement lookup for tenant_id
	mock.ExpectQuery(`SELECT tenant_id FROM migration\.engagement`).
		WithArgs("eng-1").
		WillReturnRows(sqlmock.NewRows([]string{"tenant_id"}).AddRow("tenant-abc"))

	// Expect: scoped connection set_config
	mock.ExpectExec(`SELECT set_config`).
		WillReturnResult(sqlmock.NewResult(0, 0))

	// Expect: MarkRunning
	mock.ExpectExec(`UPDATE migration\.job SET status = 'RUNNING'`).
		WithArgs("job-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Expect: Complete
	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs("job-1", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	job := &jobqueue.Job{
		JobID:        "job-1",
		EngagementID: "eng-1",
		JobType:      "profile_l1",
		Scope:        "public.members",
		Status:       jobqueue.StatusClaimed,
		Attempt:      1,
		MaxAttempts:  3,
		InputJSON:    json.RawMessage(`{}`),
	}

	w.executeJob(context.Background(), job)

	if handler.callCount() != 1 {
		t.Fatalf("expected handler called once, got %d", handler.callCount())
	}

	// Check events: job_started + job_completed
	types := emitter.eventTypes()
	if len(types) < 2 {
		t.Fatalf("expected at least 2 events, got %d: %v", len(types), types)
	}
	if types[0] != EventJobStarted {
		t.Errorf("expected first event %s, got %s", EventJobStarted, types[0])
	}
	if types[len(types)-1] != EventJobCompleted {
		t.Errorf("expected last event %s, got %s", EventJobCompleted, types[len(types)-1])
	}
}

func TestJobWorkerExecute_HandlerError(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	q := jobqueue.New(db)
	dispatcher := NewJobDispatcher()
	handler := &countingHandler{returnErr: fmt.Errorf("source DB unreachable")}
	dispatcher.Register("profile_l1", handler)
	emitter := &jobEventCollector{}

	w := NewJobWorker(db, q, dispatcher, emitter, DefaultJobWorkerConfig())

	// Expect: engagement lookup
	mock.ExpectQuery(`SELECT tenant_id FROM migration\.engagement`).
		WithArgs("eng-1").
		WillReturnRows(sqlmock.NewRows([]string{"tenant_id"}).AddRow("tenant-abc"))

	mock.ExpectExec(`SELECT set_config`).
		WillReturnResult(sqlmock.NewResult(0, 0))

	// Expect: MarkRunning
	mock.ExpectExec(`UPDATE migration\.job SET status = 'RUNNING'`).
		WithArgs("job-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Expect: Fail — reads attempt/max
	mock.ExpectQuery(`SELECT attempt, max_attempts`).
		WithArgs("job-1").
		WillReturnRows(sqlmock.NewRows([]string{"attempt", "max_attempts"}).AddRow(1, 3))
	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs("job-1", "PENDING", "source DB unreachable").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Expect: retry_after update
	mock.ExpectExec(`UPDATE migration\.job SET retry_after`).
		WithArgs("job-1", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	job := &jobqueue.Job{
		JobID:        "job-1",
		EngagementID: "eng-1",
		JobType:      "profile_l1",
		Status:       jobqueue.StatusClaimed,
		Attempt:      1,
		MaxAttempts:  3,
		InputJSON:    json.RawMessage(`{}`),
	}

	w.executeJob(context.Background(), job)

	if !emitter.hasEvent(EventJobFailed) {
		t.Errorf("expected job_failed event, got: %v", emitter.eventTypes())
	}
}

func TestJobWorkerExecute_UnknownJobType(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	q := jobqueue.New(db)
	dispatcher := NewJobDispatcher() // no handlers registered
	emitter := &jobEventCollector{}

	w := NewJobWorker(db, q, dispatcher, emitter, DefaultJobWorkerConfig())

	// Expect: engagement lookup
	mock.ExpectQuery(`SELECT tenant_id FROM migration\.engagement`).
		WithArgs("eng-1").
		WillReturnRows(sqlmock.NewRows([]string{"tenant_id"}).AddRow("tenant-abc"))

	mock.ExpectExec(`SELECT set_config`).
		WillReturnResult(sqlmock.NewResult(0, 0))

	// Expect: MarkRunning
	mock.ExpectExec(`UPDATE migration\.job SET status = 'RUNNING'`).
		WithArgs("job-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Expect: Fail — unknown type goes to permanent failure
	mock.ExpectQuery(`SELECT attempt, max_attempts`).
		WithArgs("job-1").
		WillReturnRows(sqlmock.NewRows([]string{"attempt", "max_attempts"}).AddRow(1, 3))
	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs("job-1", "FAILED", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	job := &jobqueue.Job{
		JobID:        "job-1",
		EngagementID: "eng-1",
		JobType:      "totally_unknown",
		Status:       jobqueue.StatusClaimed,
		Attempt:      1,
		MaxAttempts:  3,
		InputJSON:    json.RawMessage(`{}`),
	}

	w.executeJob(context.Background(), job)

	if !emitter.hasEvent(EventJobFailed) {
		t.Errorf("expected job_failed event for unknown type, got: %v", emitter.eventTypes())
	}
}

// --- TestJobRetry (AC-2) ---

func TestJobRetry_ExponentialBackoff(t *testing.T) {
	cfg := DefaultJobWorkerConfig()
	cfg.RetryBaseDelay = 30 * time.Second
	cfg.RetryMaxDelay = 15 * time.Minute

	tests := []struct {
		attempt  int
		minDelay time.Duration
		maxDelay time.Duration
	}{
		{1, 25 * time.Second, 37 * time.Second},     // 30s ± 20% jitter
		{2, 48 * time.Second, 73 * time.Second},     // 60s ± 20%
		{3, 96 * time.Second, 145 * time.Second},    // 120s ± 20%
		{4, 192 * time.Second, 289 * time.Second},   // 240s ± 20%
		{5, 384 * time.Second, 577 * time.Second},   // 480s ± 20%
		{10, 720 * time.Second, 1080 * time.Second}, // capped at 15min ± 20%
	}

	for _, tt := range tests {
		delay := ComputeBackoff(tt.attempt, cfg.RetryBaseDelay, cfg.RetryMaxDelay)
		if delay < tt.minDelay || delay > tt.maxDelay {
			t.Errorf("attempt %d: expected delay in [%v, %v], got %v",
				tt.attempt, tt.minDelay, tt.maxDelay, delay)
		}
	}
}

func TestJobRetry_RequeuesWhenAttemptsRemain(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	q := jobqueue.New(db)
	emitter := &jobEventCollector{}
	w := NewJobWorker(db, q, NewJobDispatcher(), emitter, DefaultJobWorkerConfig())

	job := &jobqueue.Job{
		JobID:       "job-retry",
		Attempt:     1,
		MaxAttempts: 3,
	}

	// queue.Fail reads attempt/max
	mock.ExpectQuery(`SELECT attempt, max_attempts`).
		WithArgs("job-retry").
		WillReturnRows(sqlmock.NewRows([]string{"attempt", "max_attempts"}).AddRow(1, 3))
	// queue.Fail sets PENDING
	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs("job-retry", "PENDING", "temporary error").
		WillReturnResult(sqlmock.NewResult(0, 1))
	// retry_after update
	mock.ExpectExec(`UPDATE migration\.job SET retry_after`).
		WithArgs("job-retry", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := w.failWithRetry(context.Background(), job, "temporary error")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestJobRetry_PermanentFailAfterMaxAttempts(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	q := jobqueue.New(db)
	emitter := &jobEventCollector{}
	w := NewJobWorker(db, q, NewJobDispatcher(), emitter, DefaultJobWorkerConfig())

	job := &jobqueue.Job{
		JobID:       "job-maxed",
		Attempt:     3,
		MaxAttempts: 3,
	}

	// queue.Fail reads attempt/max
	mock.ExpectQuery(`SELECT attempt, max_attempts`).
		WithArgs("job-maxed").
		WillReturnRows(sqlmock.NewRows([]string{"attempt", "max_attempts"}).AddRow(3, 3))
	// queue.Fail sets FAILED permanently
	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs("job-maxed", "FAILED", "out of retries").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// No retry_after update expected — permanent failure

	err := w.failWithRetry(context.Background(), job, "out of retries")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// --- TestStaleJobRecovery (AC-3) ---

func TestStaleJobRecovery_ResetsRunningJobs(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	q := jobqueue.New(db)
	cfg := DefaultJobWorkerConfig()
	cfg.StaleTimeout = 30 * time.Minute
	w := NewJobWorker(db, q, NewJobDispatcher(), &jobEventCollector{}, cfg)

	// Expect: RecoverStale SQL with 30 min timeout
	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs("1800 seconds").
		WillReturnResult(sqlmock.NewResult(0, 5))

	n, err := w.RecoverStaleJobs(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if n != 5 {
		t.Fatalf("expected 5 recovered, got %d", n)
	}
}

func TestStaleJobRecovery_NoStaleJobs(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	q := jobqueue.New(db)
	w := NewJobWorker(db, q, NewJobDispatcher(), &jobEventCollector{}, DefaultJobWorkerConfig())

	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 0))

	n, err := w.RecoverStaleJobs(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if n != 0 {
		t.Fatalf("expected 0, got %d", n)
	}
}

func TestStaleJobRecovery_DBError(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	q := jobqueue.New(db)
	w := NewJobWorker(db, q, NewJobDispatcher(), &jobEventCollector{}, DefaultJobWorkerConfig())

	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("connection refused"))

	_, err := w.RecoverStaleJobs(context.Background())
	if err == nil {
		t.Fatal("expected error on DB failure")
	}
}

// --- TestJobWebSocket (AC-5) ---

func TestJobWebSocket_EmitsStartedCompletedEvents(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	q := jobqueue.New(db)
	dispatcher := NewJobDispatcher()
	dispatcher.Register("test_job", &countingHandler{})
	emitter := &jobEventCollector{}

	w := NewJobWorker(db, q, dispatcher, emitter, DefaultJobWorkerConfig())

	// Setup mocks for successful execution
	mock.ExpectQuery(`SELECT tenant_id FROM migration\.engagement`).
		WithArgs("eng-1").
		WillReturnRows(sqlmock.NewRows([]string{"tenant_id"}).AddRow("t-1"))
	mock.ExpectExec(`SELECT set_config`).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(`UPDATE migration\.job SET status = 'RUNNING'`).
		WithArgs("job-ws").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs("job-ws", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	job := &jobqueue.Job{
		JobID:        "job-ws",
		EngagementID: "eng-1",
		JobType:      "test_job",
		Status:       jobqueue.StatusClaimed,
		Attempt:      1,
		MaxAttempts:  3,
		InputJSON:    json.RawMessage(`{}`),
	}

	w.executeJob(context.Background(), job)

	types := emitter.eventTypes()
	if len(types) < 2 {
		t.Fatalf("expected at least 2 events, got %d", len(types))
	}
	if types[0] != EventJobStarted {
		t.Errorf("first event: expected %s, got %s", EventJobStarted, types[0])
	}
	if types[len(types)-1] != EventJobCompleted {
		t.Errorf("last event: expected %s, got %s", EventJobCompleted, types[len(types)-1])
	}
}

func TestJobWebSocket_EmitsFailedEvent(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	q := jobqueue.New(db)
	dispatcher := NewJobDispatcher()
	dispatcher.Register("fail_job", &countingHandler{returnErr: fmt.Errorf("boom")})
	emitter := &jobEventCollector{}

	w := NewJobWorker(db, q, dispatcher, emitter, DefaultJobWorkerConfig())

	mock.ExpectQuery(`SELECT tenant_id FROM migration\.engagement`).
		WithArgs("eng-1").
		WillReturnRows(sqlmock.NewRows([]string{"tenant_id"}).AddRow("t-1"))
	mock.ExpectExec(`SELECT set_config`).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(`UPDATE migration\.job SET status = 'RUNNING'`).
		WithArgs("job-fail").
		WillReturnResult(sqlmock.NewResult(0, 1))
	// Fail path
	mock.ExpectQuery(`SELECT attempt, max_attempts`).
		WithArgs("job-fail").
		WillReturnRows(sqlmock.NewRows([]string{"attempt", "max_attempts"}).AddRow(3, 3))
	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs("job-fail", "FAILED", "boom").
		WillReturnResult(sqlmock.NewResult(0, 1))

	job := &jobqueue.Job{
		JobID:        "job-fail",
		EngagementID: "eng-1",
		JobType:      "fail_job",
		Status:       jobqueue.StatusClaimed,
		Attempt:      3,
		MaxAttempts:  3,
		InputJSON:    json.RawMessage(`{}`),
	}

	w.executeJob(context.Background(), job)

	if !emitter.hasEvent(EventJobFailed) {
		t.Errorf("expected %s event, got: %v", EventJobFailed, emitter.eventTypes())
	}

	// Verify the failed event has engagement_id
	emitter.mu.Lock()
	defer emitter.mu.Unlock()
	for _, ev := range emitter.events {
		if ev.Type == EventJobFailed {
			if ev.EngagementID != "eng-1" {
				t.Errorf("expected engagement_id eng-1, got %s", ev.EngagementID)
			}
		}
	}
}

func TestJobWebSocket_NilEmitterDoesNotPanic(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	q := jobqueue.New(db)
	dispatcher := NewJobDispatcher()
	dispatcher.Register("test_job", &countingHandler{})

	// Pass nil emitter — should use noopEmitter internally
	w := NewJobWorker(db, q, dispatcher, nil, DefaultJobWorkerConfig())

	mock.ExpectQuery(`SELECT tenant_id FROM migration\.engagement`).
		WithArgs("eng-1").
		WillReturnRows(sqlmock.NewRows([]string{"tenant_id"}).AddRow("t-1"))
	mock.ExpectExec(`SELECT set_config`).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(`UPDATE migration\.job SET status = 'RUNNING'`).
		WithArgs("job-nil-emit").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs("job-nil-emit", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	job := &jobqueue.Job{
		JobID:        "job-nil-emit",
		EngagementID: "eng-1",
		JobType:      "test_job",
		Status:       jobqueue.StatusClaimed,
		Attempt:      1,
		MaxAttempts:  3,
		InputJSON:    json.RawMessage(`{}`),
	}

	// Should not panic
	w.executeJob(context.Background(), job)
}

// --- TestGracefulShutdown (AC-6) ---

func TestGracefulShutdown_FinishesCurrentJob(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	q := jobqueue.New(db)
	dispatcher := NewJobDispatcher()

	var jobFinished atomic.Bool
	slowHandler := &countingHandler{delay: 200 * time.Millisecond}
	dispatcher.Register("slow_job", slowHandler)
	emitter := &jobEventCollector{}

	cfg := DefaultJobWorkerConfig()
	cfg.PollInterval = 50 * time.Millisecond
	w := NewJobWorker(db, q, dispatcher, emitter, cfg)

	// Stale recovery on startup
	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 0))

	// First poll: return a job
	now := time.Now()
	mock.ExpectQuery(`UPDATE migration\.job`).
		WithArgs(cfg.WorkerID).
		WillReturnRows(sqlmock.NewRows(jobWorkerCols()).AddRow(
			"job-slow", "eng-1", "slow_job", "scope", "CLAIMED", 0, 0,
			[]byte(`{}`), nil, nil, strPtr(cfg.WorkerID), 1, 3,
			now, &now, &now, nil,
		))

	// Execution mocks
	mock.ExpectQuery(`SELECT tenant_id FROM migration\.engagement`).
		WithArgs("eng-1").
		WillReturnRows(sqlmock.NewRows([]string{"tenant_id"}).AddRow("t-1"))
	mock.ExpectExec(`SELECT set_config`).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(`UPDATE migration\.job SET status = 'RUNNING'`).
		WithArgs("job-slow").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs("job-slow", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		w.Start(ctx)
		close(done)
	}()

	// Wait for the job to start executing
	time.Sleep(100 * time.Millisecond)

	// Cancel context — should wait for slow job to finish
	cancel()

	select {
	case <-done:
		jobFinished.Store(true)
	case <-time.After(2 * time.Second):
		t.Fatal("worker did not shut down within 2s")
	}

	if slowHandler.callCount() != 1 {
		t.Fatalf("expected slow handler called once, got %d", slowHandler.callCount())
	}
}

func TestGracefulShutdown_NoNewJobsDuringShutdown(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	q := jobqueue.New(db)
	dispatcher := NewJobDispatcher()
	handler := &countingHandler{}
	dispatcher.Register("test_job", handler)

	cfg := DefaultJobWorkerConfig()
	cfg.PollInterval = 50 * time.Millisecond
	w := NewJobWorker(db, q, dispatcher, &jobEventCollector{}, cfg)

	// Stale recovery
	mock.ExpectExec(`UPDATE migration\.job`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 0))

	// First poll: no jobs available
	mock.ExpectQuery(`UPDATE migration\.job`).
		WithArgs(cfg.WorkerID).
		WillReturnRows(sqlmock.NewRows(jobWorkerCols()))

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		w.Start(ctx)
		close(done)
	}()

	// Let it poll once
	time.Sleep(80 * time.Millisecond)
	cancel()

	select {
	case <-done:
		// good
	case <-time.After(2 * time.Second):
		t.Fatal("worker did not shut down")
	}

	if handler.callCount() != 0 {
		t.Fatalf("expected no handler calls after shutdown, got %d", handler.callCount())
	}
}

// --- helpers ---

func jobWorkerCols() []string {
	return []string{
		"job_id", "engagement_id", "job_type", "scope", "status", "priority", "progress",
		"input_json", "result_json", "error_message", "worker_id", "attempt", "max_attempts",
		"created_at", "claimed_at", "heartbeat_at", "completed_at",
	}
}

func strPtr(s string) *string { return &s }
