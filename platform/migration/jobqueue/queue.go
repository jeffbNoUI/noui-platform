// Package jobqueue implements a PostgreSQL-backed job queue using SKIP LOCKED.
// Workers on conversion servers (or embedded in the API process) poll this queue
// for profiling, mapping, and reconciliation jobs.
package jobqueue

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"
)

// JobStatus represents the lifecycle state of a job.
type JobStatus string

const (
	StatusPending   JobStatus = "PENDING"
	StatusClaimed   JobStatus = "CLAIMED"
	StatusRunning   JobStatus = "RUNNING"
	StatusComplete  JobStatus = "COMPLETE"
	StatusFailed    JobStatus = "FAILED"
	StatusCancelled JobStatus = "CANCELLED"
)

// JobTypeParallelRun is the canonical job type string for parallel run jobs.
const JobTypeParallelRun = "parallel_run"

// Job represents a row in migration.job.
type Job struct {
	JobID        string          `json:"job_id"`
	EngagementID string          `json:"engagement_id"`
	JobType      string          `json:"job_type"`
	Scope        string          `json:"scope"`
	Status       JobStatus       `json:"status"`
	Priority     int             `json:"priority"`
	Progress     int             `json:"progress"`
	InputJSON    json.RawMessage `json:"input_json"`
	ResultJSON   json.RawMessage `json:"result_json,omitempty"`
	ErrorMessage *string         `json:"error_message,omitempty"`
	WorkerID     *string         `json:"worker_id,omitempty"`
	Attempt      int             `json:"attempt"`
	MaxAttempts  int             `json:"max_attempts"`
	CreatedAt    time.Time       `json:"created_at"`
	ClaimedAt    *time.Time      `json:"claimed_at,omitempty"`
	HeartbeatAt  *time.Time      `json:"heartbeat_at,omitempty"`
	CompletedAt  *time.Time      `json:"completed_at,omitempty"`
}

// EnqueueParams are the required fields to create a new job.
type EnqueueParams struct {
	EngagementID string
	JobType      string
	Scope        string
	Priority     int
	InputJSON    json.RawMessage
	MaxAttempts  int // 0 defaults to 3
}

// Queue provides operations on the migration.job table.
type Queue struct {
	db *sql.DB
}

// New creates a Queue backed by the given database connection.
func New(db *sql.DB) *Queue {
	return &Queue{db: db}
}

// Enqueue inserts a new PENDING job and returns its ID.
func (q *Queue) Enqueue(ctx context.Context, p EnqueueParams) (string, error) {
	maxAttempts := p.MaxAttempts
	if maxAttempts <= 0 {
		maxAttempts = 3
	}
	if p.InputJSON == nil {
		p.InputJSON = json.RawMessage(`{}`)
	}

	var jobID string
	err := q.db.QueryRowContext(ctx,
		`INSERT INTO migration.job (engagement_id, job_type, scope, priority, input_json, max_attempts)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING job_id`,
		p.EngagementID, p.JobType, p.Scope, p.Priority, p.InputJSON, maxAttempts,
	).Scan(&jobID)
	if err != nil {
		return "", fmt.Errorf("enqueue job: %w", err)
	}
	return jobID, nil
}

// EnqueueBatch inserts multiple PENDING jobs in a single transaction.
// Returns the list of created job IDs in the same order as params.
func (q *Queue) EnqueueBatch(ctx context.Context, params []EnqueueParams) ([]string, error) {
	tx, err := q.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin batch enqueue tx: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx,
		`INSERT INTO migration.job (engagement_id, job_type, scope, priority, input_json, max_attempts)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING job_id`)
	if err != nil {
		return nil, fmt.Errorf("prepare batch enqueue: %w", err)
	}
	defer stmt.Close()

	ids := make([]string, 0, len(params))
	for _, p := range params {
		maxAttempts := p.MaxAttempts
		if maxAttempts <= 0 {
			maxAttempts = 3
		}
		inputJSON := p.InputJSON
		if inputJSON == nil {
			inputJSON = json.RawMessage(`{}`)
		}
		var jobID string
		if err := stmt.QueryRowContext(ctx,
			p.EngagementID, p.JobType, p.Scope, p.Priority, inputJSON, maxAttempts,
		).Scan(&jobID); err != nil {
			return nil, fmt.Errorf("enqueue batch item %s/%s: %w", p.JobType, p.Scope, err)
		}
		ids = append(ids, jobID)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit batch enqueue: %w", err)
	}
	return ids, nil
}

// Claim atomically claims the next available PENDING job using SKIP LOCKED.
// Returns nil, nil if no job is available (not an error — worker should back off).
func (q *Queue) Claim(ctx context.Context, workerID string) (*Job, error) {
	var j Job
	var inputJSON, resultJSON []byte
	err := q.db.QueryRowContext(ctx,
		`UPDATE migration.job
		 SET status = 'CLAIMED', worker_id = $1, claimed_at = now(), heartbeat_at = now(), attempt = attempt + 1
		 WHERE job_id = (
		     SELECT job_id FROM migration.job
		     WHERE status = 'PENDING' AND attempt < max_attempts
		     ORDER BY priority DESC, created_at
		     FOR UPDATE SKIP LOCKED
		     LIMIT 1
		 )
		 RETURNING job_id, engagement_id, job_type, scope, status, priority, progress,
		           input_json, result_json, error_message, worker_id, attempt, max_attempts,
		           created_at, claimed_at, heartbeat_at, completed_at`,
		workerID).Scan(
		&j.JobID, &j.EngagementID, &j.JobType, &j.Scope, &j.Status, &j.Priority, &j.Progress,
		&inputJSON, &resultJSON, &j.ErrorMessage, &j.WorkerID, &j.Attempt, &j.MaxAttempts,
		&j.CreatedAt, &j.ClaimedAt, &j.HeartbeatAt, &j.CompletedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("claim job: %w", err)
	}
	j.InputJSON = json.RawMessage(inputJSON)
	if resultJSON != nil {
		j.ResultJSON = json.RawMessage(resultJSON)
	}
	return &j, nil
}

// MarkRunning transitions a CLAIMED job to RUNNING. Call this when the worker
// starts actual execution (after any setup).
func (q *Queue) MarkRunning(ctx context.Context, jobID string) error {
	res, err := q.db.ExecContext(ctx,
		`UPDATE migration.job SET status = 'RUNNING', heartbeat_at = now()
		 WHERE job_id = $1 AND status = 'CLAIMED'`, jobID)
	if err != nil {
		return fmt.Errorf("mark running: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("mark running: job %s not in CLAIMED state", jobID)
	}
	return nil
}

// Heartbeat updates the heartbeat timestamp. Workers call this every 30s
// to prove they're alive. Also checks if the job was cancelled externally.
// Returns true if the job is still active, false if it was cancelled.
func (q *Queue) Heartbeat(ctx context.Context, jobID string) (bool, error) {
	var status JobStatus
	err := q.db.QueryRowContext(ctx,
		`UPDATE migration.job SET heartbeat_at = now()
		 WHERE job_id = $1 AND status IN ('CLAIMED', 'RUNNING')
		 RETURNING status`, jobID).Scan(&status)
	if err == sql.ErrNoRows {
		// Job was cancelled or completed externally — check status.
		err2 := q.db.QueryRowContext(ctx,
			`SELECT status FROM migration.job WHERE job_id = $1`, jobID).Scan(&status)
		if err2 != nil {
			return false, fmt.Errorf("heartbeat check status: %w", err2)
		}
		return status != StatusCancelled, nil
	}
	if err != nil {
		return false, fmt.Errorf("heartbeat: %w", err)
	}
	return true, nil
}

// UpdateProgress sets the progress percentage (0-100) on a running job.
func (q *Queue) UpdateProgress(ctx context.Context, jobID string, progress int) error {
	if progress < 0 {
		progress = 0
	}
	if progress > 100 {
		progress = 100
	}
	_, err := q.db.ExecContext(ctx,
		`UPDATE migration.job SET progress = $2, heartbeat_at = now()
		 WHERE job_id = $1 AND status IN ('CLAIMED', 'RUNNING')`,
		jobID, progress)
	if err != nil {
		return fmt.Errorf("update progress: %w", err)
	}
	return nil
}

// Complete marks a job as successfully completed with an optional result payload.
func (q *Queue) Complete(ctx context.Context, jobID string, result json.RawMessage) error {
	_, err := q.db.ExecContext(ctx,
		`UPDATE migration.job
		 SET status = 'COMPLETE', progress = 100, result_json = $2, completed_at = now()
		 WHERE job_id = $1 AND status IN ('CLAIMED', 'RUNNING')`,
		jobID, result)
	if err != nil {
		return fmt.Errorf("complete job: %w", err)
	}
	return nil
}

// Fail marks a job as failed with an error message.
// If attempts remain, the job returns to PENDING for retry.
func (q *Queue) Fail(ctx context.Context, jobID string, errMsg string) error {
	var attempt, maxAttempts int
	err := q.db.QueryRowContext(ctx,
		`SELECT attempt, max_attempts FROM migration.job WHERE job_id = $1`, jobID,
	).Scan(&attempt, &maxAttempts)
	if err != nil {
		return fmt.Errorf("fail job (read attempts): %w", err)
	}

	newStatus := StatusFailed
	if attempt < maxAttempts {
		newStatus = StatusPending // re-queue for retry
	}

	_, err = q.db.ExecContext(ctx,
		`UPDATE migration.job
		 SET status = $2, error_message = $3, worker_id = NULL, completed_at = CASE WHEN $2 = 'FAILED' THEN now() ELSE NULL END
		 WHERE job_id = $1 AND status IN ('CLAIMED', 'RUNNING')`,
		jobID, string(newStatus), errMsg)
	if err != nil {
		return fmt.Errorf("fail job: %w", err)
	}

	if newStatus == StatusPending {
		slog.Info("job re-queued for retry", "job_id", jobID, "attempt", attempt, "max", maxAttempts)
	}
	return nil
}

// Cancel marks a PENDING or CLAIMED job as CANCELLED.
// RUNNING jobs cannot be cancelled via the API — only the worker can stop a running job.
func (q *Queue) Cancel(ctx context.Context, jobID string) error {
	res, err := q.db.ExecContext(ctx,
		`UPDATE migration.job SET status = 'CANCELLED', completed_at = now()
		 WHERE job_id = $1 AND status IN ('PENDING', 'CLAIMED')`, jobID)
	if err != nil {
		return fmt.Errorf("cancel job: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("cancel: job %s not in cancellable state", jobID)
	}
	return nil
}

// CancelScoped cancels a job within a specific engagement.
// Returns an error if the job is not PENDING or CLAIMED within that engagement.
func (q *Queue) CancelScoped(ctx context.Context, jobID, engagementID string) error {
	res, err := q.db.ExecContext(ctx,
		`UPDATE migration.job SET status = 'CANCELLED', completed_at = now()
		 WHERE job_id = $1 AND engagement_id = $2 AND status IN ('PENDING', 'CLAIMED')`,
		jobID, engagementID)
	if err != nil {
		return fmt.Errorf("cancel job: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("cancel: job %s not in cancellable state", jobID)
	}
	return nil
}

// Retry resets a FAILED job to PENDING, clearing error state and resetting attempt count.
// Manual retry grants a fresh quota of max_attempts automatic retries.
func (q *Queue) Retry(ctx context.Context, jobID, engagementID string) error {
	res, err := q.db.ExecContext(ctx,
		`UPDATE migration.job SET status = 'PENDING', attempt = 0, error_message = NULL,
		 worker_id = NULL, completed_at = NULL
		 WHERE job_id = $1 AND engagement_id = $2 AND status = 'FAILED'`,
		jobID, engagementID)
	if err != nil {
		return fmt.Errorf("retry job: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("retry: job %s not in FAILED state", jobID)
	}
	return nil
}

// JobSummary contains aggregated job status counts and performance metrics.
type JobSummary struct {
	Counts         map[string]int `json:"counts"`
	Total          int            `json:"total"`
	AvgExecSeconds float64        `json:"avg_exec_seconds"`
}

// Summary returns aggregated job counts by status and average execution time
// for all jobs in an engagement. Uses a single GROUP BY query.
func (q *Queue) Summary(ctx context.Context, engagementID string) (*JobSummary, error) {
	rows, err := q.db.QueryContext(ctx,
		`SELECT status, COUNT(*) AS cnt,
		        COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - claimed_at))), 0) AS avg_seconds
		 FROM migration.job WHERE engagement_id = $1
		 GROUP BY status`, engagementID)
	if err != nil {
		return nil, fmt.Errorf("job summary: %w", err)
	}
	defer rows.Close()

	s := &JobSummary{Counts: make(map[string]int)}
	var totalAvg float64
	var completedCount int
	for rows.Next() {
		var status string
		var count int
		var avgSec *float64
		if err := rows.Scan(&status, &count, &avgSec); err != nil {
			return nil, fmt.Errorf("scan job summary: %w", err)
		}
		s.Counts[status] = count
		s.Total += count
		if avgSec != nil && (status == string(StatusComplete) || status == string(StatusFailed)) {
			totalAvg += *avgSec * float64(count)
			completedCount += count
		}
	}
	if completedCount > 0 {
		s.AvgExecSeconds = totalAvg / float64(completedCount)
	}
	return s, rows.Err()
}

// GetByEngagement retrieves a single job scoped to a specific engagement.
// Returns nil, nil if the job does not exist or does not belong to the engagement.
func (q *Queue) GetByEngagement(ctx context.Context, jobID, engagementID string) (*Job, error) {
	return q.scanJob(q.db.QueryRowContext(ctx,
		`SELECT job_id, engagement_id, job_type, scope, status, priority, progress,
		        input_json, result_json, error_message, worker_id, attempt, max_attempts,
		        created_at, claimed_at, heartbeat_at, completed_at
		 FROM migration.job WHERE job_id = $1 AND engagement_id = $2`, jobID, engagementID))
}

// Get retrieves a single job by ID.
func (q *Queue) Get(ctx context.Context, jobID string) (*Job, error) {
	return q.scanJob(q.db.QueryRowContext(ctx,
		`SELECT job_id, engagement_id, job_type, scope, status, priority, progress,
		        input_json, result_json, error_message, worker_id, attempt, max_attempts,
		        created_at, claimed_at, heartbeat_at, completed_at
		 FROM migration.job WHERE job_id = $1`, jobID))
}

// ListParams controls filtering for ListByEngagement.
type ListParams struct {
	JobType  *string
	Status   *JobStatus
	Limit    int        // 0 defaults to 100
	Sort     string     // "created_at" (default) or "priority"
	CursorAt *time.Time // cursor: jobs before this timestamp
	CursorID *string    // cursor: tiebreaker job ID
}

// ListByEngagement returns jobs for an engagement with cursor-based pagination.
// Default sort is created_at DESC. Cursor uses composite (created_at, job_id) for
// consistent pagination during concurrent inserts.
func (q *Queue) ListByEngagement(ctx context.Context, engagementID string, p ListParams) ([]Job, error) {
	query := `SELECT job_id, engagement_id, job_type, scope, status, priority, progress,
	                 input_json, result_json, error_message, worker_id, attempt, max_attempts,
	                 created_at, claimed_at, heartbeat_at, completed_at
	          FROM migration.job WHERE engagement_id = $1`
	args := []any{engagementID}
	argIdx := 2

	if p.JobType != nil {
		query += fmt.Sprintf(" AND job_type = $%d", argIdx)
		args = append(args, *p.JobType)
		argIdx++
	}
	if p.Status != nil {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, string(*p.Status))
		argIdx++
	}

	// Cursor-based pagination: composite (created_at, job_id) comparison
	if p.CursorAt != nil && p.CursorID != nil {
		query += fmt.Sprintf(" AND (created_at, job_id) < ($%d, $%d)", argIdx, argIdx+1)
		args = append(args, *p.CursorAt, *p.CursorID)
		argIdx += 2
	}

	// Sort order
	switch p.Sort {
	case "priority":
		query += " ORDER BY priority DESC, created_at DESC, job_id DESC"
	default:
		query += " ORDER BY created_at DESC, job_id DESC"
	}

	limit := p.Limit
	if limit <= 0 {
		limit = 100
	}
	query += fmt.Sprintf(" LIMIT $%d", argIdx)
	args = append(args, limit)

	rows, err := q.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list jobs: %w", err)
	}
	defer rows.Close()

	var jobs []Job
	for rows.Next() {
		j, err := q.scanJobRow(rows)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, *j)
	}
	return jobs, rows.Err()
}

// RecoverStale resets jobs whose heartbeat has expired back to PENDING.
// Returns the number of recovered jobs.
func (q *Queue) RecoverStale(ctx context.Context, timeout time.Duration) (int, error) {
	res, err := q.db.ExecContext(ctx,
		`UPDATE migration.job
		 SET status = 'PENDING', worker_id = NULL
		 WHERE status IN ('CLAIMED', 'RUNNING')
		   AND heartbeat_at < now() - $1::interval`,
		fmt.Sprintf("%d seconds", int(timeout.Seconds())))
	if err != nil {
		return 0, fmt.Errorf("recover stale jobs: %w", err)
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

// PurgeCompleted deletes COMPLETE jobs older than the given retention period.
// Returns the number of purged jobs.
func (q *Queue) PurgeCompleted(ctx context.Context, retention time.Duration) (int, error) {
	res, err := q.db.ExecContext(ctx,
		`DELETE FROM migration.job
		 WHERE status = 'COMPLETE'
		   AND completed_at < now() - $1::interval`,
		fmt.Sprintf("%d seconds", int(retention.Seconds())))
	if err != nil {
		return 0, fmt.Errorf("purge completed jobs: %w", err)
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

// ActiveWorkers returns distinct worker IDs with recent heartbeats.
func (q *Queue) ActiveWorkers(ctx context.Context, within time.Duration) ([]WorkerInfo, error) {
	rows, err := q.db.QueryContext(ctx,
		`SELECT worker_id, COUNT(*) AS active_jobs, MAX(heartbeat_at) AS last_heartbeat
		 FROM migration.job
		 WHERE worker_id IS NOT NULL
		   AND status IN ('CLAIMED', 'RUNNING')
		   AND heartbeat_at > now() - $1::interval
		 GROUP BY worker_id
		 ORDER BY last_heartbeat DESC`,
		fmt.Sprintf("%d seconds", int(within.Seconds())))
	if err != nil {
		return nil, fmt.Errorf("active workers: %w", err)
	}
	defer rows.Close()

	var workers []WorkerInfo
	for rows.Next() {
		var w WorkerInfo
		if err := rows.Scan(&w.WorkerID, &w.ActiveJobs, &w.LastHeartbeat); err != nil {
			return nil, fmt.Errorf("scan worker: %w", err)
		}
		workers = append(workers, w)
	}
	return workers, rows.Err()
}

// WorkerInfo describes an active worker.
type WorkerInfo struct {
	WorkerID      string    `json:"worker_id"`
	ActiveJobs    int       `json:"active_jobs"`
	LastHeartbeat time.Time `json:"last_heartbeat"`
}

// --- internal scan helpers ---

func (q *Queue) scanJob(row *sql.Row) (*Job, error) {
	var j Job
	var inputJSON, resultJSON []byte
	err := row.Scan(
		&j.JobID, &j.EngagementID, &j.JobType, &j.Scope, &j.Status, &j.Priority, &j.Progress,
		&inputJSON, &resultJSON, &j.ErrorMessage, &j.WorkerID, &j.Attempt, &j.MaxAttempts,
		&j.CreatedAt, &j.ClaimedAt, &j.HeartbeatAt, &j.CompletedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("scan job: %w", err)
	}
	j.InputJSON = json.RawMessage(inputJSON)
	if resultJSON != nil {
		j.ResultJSON = json.RawMessage(resultJSON)
	}
	return &j, nil
}

type scannable interface {
	Scan(dest ...any) error
}

func (q *Queue) scanJobRow(row scannable) (*Job, error) {
	var j Job
	var inputJSON, resultJSON []byte
	err := row.Scan(
		&j.JobID, &j.EngagementID, &j.JobType, &j.Scope, &j.Status, &j.Priority, &j.Progress,
		&inputJSON, &resultJSON, &j.ErrorMessage, &j.WorkerID, &j.Attempt, &j.MaxAttempts,
		&j.CreatedAt, &j.ClaimedAt, &j.HeartbeatAt, &j.CompletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scan job row: %w", err)
	}
	j.InputJSON = json.RawMessage(inputJSON)
	if resultJSON != nil {
		j.ResultJSON = json.RawMessage(resultJSON)
	}
	return &j, nil
}
