// Package worker implements the job execution loop for migration profiling,
// mapping, and reconciliation jobs. Runs as a standalone binary on conversion
// servers or embedded in the API process for development.
package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/ws"
)

// Executor processes a single job. Implementations are per-job-type.
type Executor interface {
	// Execute runs the job. It should call q.MarkRunning, q.UpdateProgress,
	// and q.Complete/q.Fail during execution. The context is cancelled when
	// the worker shuts down or the job is cancelled.
	Execute(ctx context.Context, job *jobqueue.Job, q *jobqueue.Queue, db *sql.DB) error
}

// Config holds worker configuration.
type Config struct {
	WorkerID          string        // unique identifier for this worker instance
	Concurrency       int           // max parallel jobs (default 4)
	PollInterval      time.Duration // how often to check for jobs (default 2s)
	HeartbeatInterval time.Duration // how often to heartbeat (default 30s)
}

// DefaultConfig returns sensible defaults.
func DefaultConfig() Config {
	return Config{
		WorkerID:          fmt.Sprintf("worker-%d", time.Now().UnixNano()%100000),
		Concurrency:       4,
		PollInterval:      2 * time.Second,
		HeartbeatInterval: 30 * time.Second,
	}
}

// Worker polls the job queue and dispatches jobs to executors.
type Worker struct {
	cfg       Config
	queue     *jobqueue.Queue
	db        *sql.DB
	executors map[string]Executor
	sem       chan struct{}
	wg        sync.WaitGroup

	// Hub is the WebSocket hub for broadcasting events to engagement members.
	// Assigned post-construction via w.Hub = hub in main.go (not a constructor parameter).
	// Nil-safe: broadcasts are no-ops when Hub is nil.
	Hub *ws.Hub
}

// New creates a Worker. Register executors via RegisterExecutor before calling Run.
func New(db *sql.DB, queue *jobqueue.Queue, cfg Config) *Worker {
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = 4
	}
	if cfg.PollInterval <= 0 {
		cfg.PollInterval = 2 * time.Second
	}
	if cfg.HeartbeatInterval <= 0 {
		cfg.HeartbeatInterval = 30 * time.Second
	}
	return &Worker{
		cfg:       cfg,
		queue:     queue,
		db:        db,
		executors: make(map[string]Executor),
		sem:       make(chan struct{}, cfg.Concurrency),
	}
}

// RegisterExecutor maps a job_type to its executor.
func (w *Worker) RegisterExecutor(jobType string, exec Executor) {
	w.executors[jobType] = exec
}

// Run starts the poll loop. Blocks until ctx is cancelled.
func (w *Worker) Run(ctx context.Context) {
	slog.Info("worker starting", "worker_id", w.cfg.WorkerID, "concurrency", w.cfg.Concurrency)

	ticker := time.NewTicker(w.cfg.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("worker shutting down, waiting for active jobs...", "worker_id", w.cfg.WorkerID)
			w.wg.Wait()
			slog.Info("worker stopped", "worker_id", w.cfg.WorkerID)
			return
		case <-ticker.C:
			w.tryClaimAndRun(ctx)
		}
	}
}

// tryClaimAndRun attempts to claim a job and run it if the semaphore allows.
func (w *Worker) tryClaimAndRun(ctx context.Context) {
	// Non-blocking semaphore check — if all slots are busy, skip this poll.
	select {
	case w.sem <- struct{}{}:
		// Got a slot
	default:
		return // all workers busy
	}

	job, err := w.queue.Claim(ctx, w.cfg.WorkerID)
	if err != nil {
		<-w.sem
		slog.Error("failed to claim job", "error", err, "worker_id", w.cfg.WorkerID)
		return
	}
	if job == nil {
		<-w.sem // no job available
		return
	}

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		defer func() { <-w.sem }()
		w.executeJob(ctx, job)
	}()
}

// executeJob runs a single job with heartbeat monitoring.
func (w *Worker) executeJob(parentCtx context.Context, job *jobqueue.Job) {
	executor, ok := w.executors[job.JobType]
	if !ok {
		errMsg := fmt.Sprintf("no executor registered for job type: %s", job.JobType)
		slog.Error(errMsg, "job_id", job.JobID)
		_ = w.queue.Fail(parentCtx, job.JobID, errMsg)
		return
	}

	slog.Info("executing job",
		"job_id", job.JobID,
		"job_type", job.JobType,
		"scope", job.Scope,
		"attempt", job.Attempt,
		"worker_id", w.cfg.WorkerID,
	)

	// Create a cancellable context for this job.
	jobCtx, cancel := context.WithCancel(parentCtx)
	defer cancel()

	// Start heartbeat goroutine — also detects external cancellation.
	heartbeatDone := make(chan struct{})
	go func() {
		defer close(heartbeatDone)
		w.heartbeatLoop(jobCtx, cancel, job.JobID)
	}()

	// Execute the job.
	err := executor.Execute(jobCtx, job, w.queue, w.db)

	// Stop heartbeat.
	cancel()
	<-heartbeatDone

	if err != nil {
		slog.Error("job failed", "job_id", job.JobID, "error", err)
		_ = w.queue.Fail(context.Background(), job.JobID, err.Error())
		return
	}

	slog.Info("job completed", "job_id", job.JobID, "job_type", job.JobType)
}

// heartbeatLoop sends heartbeats and checks for cancellation.
func (w *Worker) heartbeatLoop(ctx context.Context, cancelJob context.CancelFunc, jobID string) {
	ticker := time.NewTicker(w.cfg.HeartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			active, err := w.queue.Heartbeat(ctx, jobID)
			if err != nil {
				slog.Warn("heartbeat failed", "job_id", jobID, "error", err)
				continue
			}
			if !active {
				slog.Info("job cancelled externally, aborting", "job_id", jobID)
				cancelJob()
				return
			}
		}
	}
}

// BroadcastEvent sends a WebSocket event to all clients in an engagement room.
// Nil-safe: no-op if Hub is nil.
func (w *Worker) BroadcastEvent(engagementID, eventType string, payload interface{}) {
	if w.Hub == nil {
		return
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	w.Hub.Broadcast(engagementID, ws.Event{
		Type:    eventType,
		Payload: json.RawMessage(data),
	})
}

// StaleRecoveryLoop periodically resets stale jobs back to PENDING.
// Run this as a background goroutine in the API process (or one worker).
func StaleRecoveryLoop(ctx context.Context, q *jobqueue.Queue, interval, timeout time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := q.RecoverStale(ctx, timeout)
			if err != nil {
				slog.Error("stale recovery failed", "error", err)
				continue
			}
			if n > 0 {
				slog.Warn("recovered stale jobs", "count", n)
			}
		}
	}
}

// PurgeLoop periodically deletes old completed jobs.
func PurgeLoop(ctx context.Context, q *jobqueue.Queue, interval, retention time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := q.PurgeCompleted(ctx, retention)
			if err != nil {
				slog.Error("purge failed", "error", err)
				continue
			}
			if n > 0 {
				slog.Info("purged old completed jobs", "count", n)
			}
		}
	}
}

// NoopExecutor is a placeholder executor for testing that immediately completes.
type NoopExecutor struct{}

func (e *NoopExecutor) Execute(ctx context.Context, job *jobqueue.Job, q *jobqueue.Queue, db *sql.DB) error {
	if err := q.MarkRunning(ctx, job.JobID); err != nil {
		return err
	}
	return q.Complete(ctx, job.JobID, json.RawMessage(`{"noop":true}`))
}
