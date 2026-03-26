package batch

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"math/rand"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/noui/platform/migration/jobqueue"
)

// Job event type constants for WebSocket broadcasting.
const (
	EventJobStarted   = "job_started"
	EventJobCompleted = "job_completed"
	EventJobFailed    = "job_failed"
)

// JobWorkerConfig holds configuration for the job worker.
type JobWorkerConfig struct {
	WorkerID          string
	Concurrency       int
	PollInterval      time.Duration
	HeartbeatInterval time.Duration
	StaleTimeout      time.Duration
	RetryBaseDelay    time.Duration
	RetryMaxDelay     time.Duration
}

// DefaultJobWorkerConfig returns sensible defaults.
func DefaultJobWorkerConfig() JobWorkerConfig {
	return JobWorkerConfig{
		WorkerID:          fmt.Sprintf("jw-%d", time.Now().UnixNano()%100000),
		Concurrency:       4,
		PollInterval:      pollIntervalFromEnv(5 * time.Second),
		HeartbeatInterval: 30 * time.Second,
		StaleTimeout:      30 * time.Minute,
		RetryBaseDelay:    30 * time.Second,
		RetryMaxDelay:     15 * time.Minute,
	}
}

// pollIntervalFromEnv reads JOB_POLL_INTERVAL env var (seconds). Returns fallback if unset.
func pollIntervalFromEnv(fallback time.Duration) time.Duration {
	v := os.Getenv("JOB_POLL_INTERVAL")
	if v == "" {
		return fallback
	}
	sec, err := strconv.Atoi(v)
	if err != nil || sec <= 0 {
		return fallback
	}
	return time.Duration(sec) * time.Second
}

// JobWorker polls the job queue, dispatches to registered handlers, and manages
// retry logic with exponential backoff. It runs as a goroutine managed by the
// main migration service process.
type JobWorker struct {
	db         *sql.DB
	queue      *jobqueue.Queue
	dispatcher *JobDispatcher
	emitter    BatchEventEmitter
	cfg        JobWorkerConfig
	sem        chan struct{}
	wg         sync.WaitGroup
}

// NewJobWorker creates a JobWorker. If emitter is nil, events are silently discarded.
func NewJobWorker(db *sql.DB, q *jobqueue.Queue, d *JobDispatcher, emitter BatchEventEmitter, cfg JobWorkerConfig) *JobWorker {
	if emitter == nil {
		emitter = noopEmitter{}
	}
	defaults := DefaultJobWorkerConfig()
	applyDefault(&cfg.Concurrency, defaults.Concurrency)
	applyDefaultDuration(&cfg.PollInterval, defaults.PollInterval)
	applyDefaultDuration(&cfg.HeartbeatInterval, defaults.HeartbeatInterval)
	applyDefaultDuration(&cfg.StaleTimeout, defaults.StaleTimeout)
	applyDefaultDuration(&cfg.RetryBaseDelay, defaults.RetryBaseDelay)
	applyDefaultDuration(&cfg.RetryMaxDelay, defaults.RetryMaxDelay)
	return &JobWorker{
		db:         db,
		queue:      q,
		dispatcher: d,
		emitter:    emitter,
		cfg:        cfg,
		sem:        make(chan struct{}, cfg.Concurrency),
	}
}

// Start begins the poll loop. It recovers stale jobs on startup, then polls
// for new jobs on each tick interval. Blocks until ctx is cancelled, then
// waits for all in-flight jobs to complete before returning.
func (w *JobWorker) Start(ctx context.Context) {
	slog.Info("job worker starting",
		"worker_id", w.cfg.WorkerID,
		"concurrency", w.cfg.Concurrency,
		"poll_interval", w.cfg.PollInterval,
	)

	// Recover stale jobs on startup (AC-3).
	n, err := w.RecoverStaleJobs(ctx)
	if err != nil {
		slog.Error("stale job recovery failed on startup", "error", err)
	} else if n > 0 {
		slog.Warn("recovered stale jobs on startup", "count", n)
	}

	ticker := time.NewTicker(w.cfg.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("job worker shutting down, waiting for active jobs...",
				"worker_id", w.cfg.WorkerID)
			w.wg.Wait()
			slog.Info("job worker stopped", "worker_id", w.cfg.WorkerID)
			return
		case <-ticker.C:
			w.tryClaimAndRun(ctx)
		}
	}
}

func (w *JobWorker) tryClaimAndRun(ctx context.Context) {
	select {
	case w.sem <- struct{}{}:
	default:
		return
	}

	job, err := w.DequeueNext(ctx)
	if err != nil {
		<-w.sem
		if ctx.Err() != nil {
			return // shutting down
		}
		slog.Error("failed to dequeue job", "error", err, "worker_id", w.cfg.WorkerID)
		return
	}
	if job == nil {
		<-w.sem
		return
	}

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		defer func() { <-w.sem }()
		// Use background context for job execution — the job must finish
		// even during worker shutdown (AC-6: graceful shutdown).
		w.executeJob(context.Background(), job)
	}()
}

// DequeueNext claims the next available job from the queue.
// Returns nil, nil if no job is available.
func (w *JobWorker) DequeueNext(ctx context.Context) (*jobqueue.Job, error) {
	return w.queue.Claim(ctx, w.cfg.WorkerID)
}

// RecoverStaleJobs resets RUNNING jobs whose heartbeat has expired.
// Called on worker startup to handle jobs left behind by crashed workers.
func (w *JobWorker) RecoverStaleJobs(ctx context.Context) (int, error) {
	return w.queue.RecoverStale(ctx, w.cfg.StaleTimeout)
}

// executeJob runs a single job: sets RLS scope, dispatches to handler,
// broadcasts lifecycle events, and handles completion or failure.
func (w *JobWorker) executeJob(parentCtx context.Context, job *jobqueue.Job) {
	w.emitter.Emit(BatchEvent{
		Type:         EventJobStarted,
		EngagementID: job.EngagementID,
		BatchID:      job.JobID,
		Payload: map[string]interface{}{
			"job_id":        job.JobID,
			"engagement_id": job.EngagementID,
			"job_type":      job.JobType,
			"attempt":       job.Attempt,
		},
	})

	slog.Info("executing job",
		"job_id", job.JobID,
		"job_type", job.JobType,
		"scope", job.Scope,
		"attempt", job.Attempt,
		"worker_id", w.cfg.WorkerID,
	)

	tenantID, err := w.lookupTenantID(parentCtx, job.EngagementID)
	if err != nil {
		slog.Error("failed to look up tenant_id", "job_id", job.JobID, "error", err)
		w.handleJobFailure(parentCtx, job, fmt.Sprintf("tenant lookup failed: %v", err))
		return
	}

	conn, err := w.acquireScopedConn(parentCtx, tenantID)
	if err != nil {
		slog.Error("failed to acquire scoped connection", "job_id", job.JobID, "error", err)
		w.handleJobFailure(parentCtx, job, fmt.Sprintf("scoped connection failed: %v", err))
		return
	}
	defer conn.Close()

	if err := w.queue.MarkRunning(parentCtx, job.JobID); err != nil {
		slog.Error("failed to mark job running", "job_id", job.JobID, "error", err)
		w.handleJobFailure(parentCtx, job, fmt.Sprintf("mark running failed: %v", err))
		return
	}

	jobCtx, cancel := context.WithCancel(parentCtx)
	defer cancel()

	heartbeatDone := make(chan struct{})
	go func() {
		defer close(heartbeatDone)
		w.heartbeatLoop(jobCtx, cancel, job.JobID)
	}()

	execErr := w.dispatcher.Dispatch(jobCtx, job, conn)

	cancel()
	<-heartbeatDone

	if execErr != nil {
		slog.Error("job failed",
			"job_id", job.JobID,
			"job_type", job.JobType,
			"error", execErr,
		)
		w.handleJobFailure(parentCtx, job, execErr.Error())
		return
	}

	result, _ := json.Marshal(map[string]string{"status": "completed"})
	if err := w.queue.Complete(parentCtx, job.JobID, result); err != nil {
		slog.Error("failed to mark job complete", "job_id", job.JobID, "error", err)
	}

	slog.Info("job completed", "job_id", job.JobID, "job_type", job.JobType)

	w.emitter.Emit(BatchEvent{
		Type:         EventJobCompleted,
		EngagementID: job.EngagementID,
		BatchID:      job.JobID,
		Payload: map[string]interface{}{
			"job_id":        job.JobID,
			"engagement_id": job.EngagementID,
			"job_type":      job.JobType,
		},
	})
}

// handleJobFailure records the failure and emits a job_failed event.
// Unknown job types fail permanently (no retry).
func (w *JobWorker) handleJobFailure(ctx context.Context, job *jobqueue.Job, errMsg string) {
	_, knownType := w.dispatcher.handlers[job.JobType]
	if !knownType {
		_ = w.failPermanently(ctx, job.JobID, errMsg)
	} else if err := w.failWithRetry(ctx, job, errMsg); err != nil {
		slog.Error("failed to record job failure", "job_id", job.JobID, "error", err)
	}

	willRetry := knownType && job.Attempt < job.MaxAttempts

	w.emitter.Emit(BatchEvent{
		Type:         EventJobFailed,
		EngagementID: job.EngagementID,
		BatchID:      job.JobID,
		Payload: map[string]interface{}{
			"job_id":        job.JobID,
			"engagement_id": job.EngagementID,
			"job_type":      job.JobType,
			"error":         errMsg,
			"will_retry":    willRetry,
			"next_attempt":  job.Attempt + 1,
		},
	})
}

// failPermanently marks a job as FAILED with no retry.
func (w *JobWorker) failPermanently(ctx context.Context, jobID string, errMsg string) error {
	_, err := w.db.ExecContext(ctx,
		`UPDATE migration.job
		 SET status = 'FAILED', error_message = $2, completed_at = now(), worker_id = NULL
		 WHERE job_id = $1 AND status IN ('CLAIMED', 'RUNNING')`,
		jobID, errMsg)
	if err != nil {
		return fmt.Errorf("fail permanently: %w", err)
	}
	return nil
}

// failWithRetry delegates to queue.Fail and sets retry_after for backoff
// if the job was re-queued.
func (w *JobWorker) failWithRetry(ctx context.Context, job *jobqueue.Job, errMsg string) error {
	if err := w.queue.Fail(ctx, job.JobID, errMsg); err != nil {
		return err
	}

	if job.Attempt < job.MaxAttempts {
		delay := ComputeBackoff(job.Attempt, w.cfg.RetryBaseDelay, w.cfg.RetryMaxDelay)
		retryAfter := time.Now().Add(delay)
		_, err := w.db.ExecContext(ctx,
			`UPDATE migration.job SET retry_after = $2 WHERE job_id = $1`,
			job.JobID, retryAfter)
		if err != nil {
			return fmt.Errorf("set retry_after: %w", err)
		}
		slog.Info("job scheduled for retry",
			"job_id", job.JobID,
			"attempt", job.Attempt,
			"retry_after", retryAfter,
			"delay", delay,
		)
	}
	return nil
}

// lookupTenantID reads tenant_id from the engagement table. This is an unscoped
// query (no RLS) because we need tenant_id to SET the RLS context.
func (w *JobWorker) lookupTenantID(ctx context.Context, engagementID string) (string, error) {
	var tenantID string
	err := w.db.QueryRowContext(ctx,
		`SELECT tenant_id FROM migration.engagement WHERE engagement_id = $1`,
		engagementID,
	).Scan(&tenantID)
	if err != nil {
		return "", fmt.Errorf("lookup tenant_id for engagement %s: %w", engagementID, err)
	}
	return tenantID, nil
}

// acquireScopedConn gets a dedicated DB connection with app.tenant_id set for RLS.
func (w *JobWorker) acquireScopedConn(ctx context.Context, tenantID string) (*sql.Conn, error) {
	conn, err := w.db.Conn(ctx)
	if err != nil {
		return nil, err
	}
	_, err = conn.ExecContext(ctx,
		`SELECT set_config('app.tenant_id', $1, false)`,
		tenantID)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("set_config tenant_id: %w", err)
	}
	return conn, nil
}

// heartbeatLoop sends periodic heartbeats and cancels the job context if the
// job is cancelled externally. Uses the same cancel/wait pattern as worker.Worker.
func (w *JobWorker) heartbeatLoop(ctx context.Context, cancelJob context.CancelFunc, jobID string) {
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

func applyDefault(field *int, fallback int) {
	if *field <= 0 {
		*field = fallback
	}
}

func applyDefaultDuration(field *time.Duration, fallback time.Duration) {
	if *field <= 0 {
		*field = fallback
	}
}

// ComputeBackoff returns the delay for the given attempt number with jitter.
// Formula: min(base * 2^(attempt-1), maxDelay) + jitter(0-20%).
func ComputeBackoff(attempt int, base, maxDelay time.Duration) time.Duration {
	if attempt <= 0 {
		attempt = 1
	}
	exp := math.Pow(2, float64(attempt-1))
	delay := time.Duration(float64(base) * exp)
	if delay > maxDelay {
		delay = maxDelay
	}
	// Add jitter: 0-20% of the computed delay.
	jitter := time.Duration(rand.Float64() * 0.2 * float64(delay))
	return delay + jitter
}
