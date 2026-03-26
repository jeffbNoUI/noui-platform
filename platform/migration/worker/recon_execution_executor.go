package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"

	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
	"github.com/noui/platform/migration/reconciler"
)

// ReconExecutionInput is the JSON payload for recon_execution jobs.
type ReconExecutionInput struct {
	EngagementID  string  `json:"engagement_id"`
	ParallelRunID string  `json:"parallel_run_id"`
	RulesetID     *string `json:"ruleset_id,omitempty"`
	ExecutionID   string  `json:"execution_id"`
}

// ReconExecutionExecutor implements the worker.Executor interface for recon execution jobs.
type ReconExecutionExecutor struct {
	Broadcast BroadcastFunc
}

// Execute runs the recon execution job: loads ruleset + parallel run results,
// evaluates rules, inserts mismatches, updates counts, and broadcasts completion.
func (e *ReconExecutionExecutor) Execute(ctx context.Context, job *jobqueue.Job, q *jobqueue.Queue, db *sql.DB) error {
	if err := q.MarkRunning(ctx, job.JobID); err != nil {
		return fmt.Errorf("mark running: %w", err)
	}

	var input ReconExecutionInput
	if err := json.Unmarshal(job.InputJSON, &input); err != nil {
		return e.failJob(ctx, q, job.JobID, input.ExecutionID, db, fmt.Sprintf("invalid input: %v", err))
	}

	// Mark execution as RUNNING.
	if _, err := migrationdb.UpdateReconExecutionRunStatus(db, input.ExecutionID, models.ReconExecRunning, nil); err != nil {
		slog.Error("failed to mark execution running", "error", err, "execution_id", input.ExecutionID)
	}

	// Load ruleset.
	var ruleset *models.ReconRuleSet
	var err error
	if input.RulesetID != nil && *input.RulesetID != "" {
		ruleset, err = migrationdb.GetReconRuleSet(db, *input.RulesetID)
		if err != nil {
			return e.failJob(ctx, q, job.JobID, input.ExecutionID, db, fmt.Sprintf("load ruleset: %v", err))
		}
		if ruleset == nil {
			return e.failJob(ctx, q, job.JobID, input.ExecutionID, db, fmt.Sprintf("ruleset %s not found", *input.RulesetID))
		}
	} else {
		ruleset, err = migrationdb.GetActiveReconRuleSet(db, input.EngagementID)
		if err != nil {
			return e.failJob(ctx, q, job.JobID, input.ExecutionID, db, fmt.Sprintf("load active ruleset: %v", err))
		}
		if ruleset == nil {
			return e.failJob(ctx, q, job.JobID, input.ExecutionID, db, "no ACTIVE ruleset found for engagement")
		}
	}

	// Load all parallel run results (full dataset — no pagination gaps).
	results, err := migrationdb.GetAllParallelRunResults(db, input.ParallelRunID)
	if err != nil {
		return e.failJob(ctx, q, job.JobID, input.ExecutionID, db, fmt.Sprintf("load parallel run results: %v", err))
	}

	slog.Info("executing recon rules",
		"execution_id", input.ExecutionID,
		"ruleset_id", ruleset.RulesetID,
		"ruleset_version", ruleset.Version,
		"result_count", len(results),
		"rule_count", len(ruleset.Rules),
	)

	// Execute rules.
	mismatches, err := reconciler.ExecuteRules(input.ExecutionID, ruleset, results)
	if err != nil {
		return e.failJob(ctx, q, job.JobID, input.ExecutionID, db, fmt.Sprintf("execute rules: %v", err))
	}

	// Batch-insert mismatches.
	if err := migrationdb.InsertReconExecutionMismatches(db, mismatches); err != nil {
		return e.failJob(ctx, q, job.JobID, input.ExecutionID, db, fmt.Sprintf("insert mismatches: %v", err))
	}

	// Compute counts.
	totalEvaluated := len(results)
	mismatchCount := len(mismatches)
	matchCount := totalEvaluated - mismatchCount
	p1, p2, p3 := countByPriority(mismatches)

	// Update execution run counts atomically.
	if err := migrationdb.UpdateReconExecutionRunCounts(db, input.ExecutionID,
		totalEvaluated, matchCount, mismatchCount, p1, p2, p3); err != nil {
		return e.failJob(ctx, q, job.JobID, input.ExecutionID, db, fmt.Sprintf("update counts: %v", err))
	}

	// Mark COMPLETED.
	if _, err := migrationdb.UpdateReconExecutionRunStatus(db, input.ExecutionID, models.ReconExecCompleted, nil); err != nil {
		slog.Error("failed to mark execution completed", "error", err, "execution_id", input.ExecutionID)
	}

	// Audit log (non-blocking — failure does not fail the execution).
	metadata, _ := json.Marshal(map[string]any{
		"ruleset_id":      ruleset.RulesetID,
		"ruleset_version": ruleset.Version,
		"total_evaluated": totalEvaluated,
		"match_count":     matchCount,
		"mismatch_count":  mismatchCount,
		"p1_count":        p1,
	})
	auditLogger := migrationdb.NewAuditLogger(db)
	auditLogger.Log(ctx, models.AuditEntry{
		EngagementID: input.EngagementID,
		EntityType:   "recon_execution",
		EntityID:     input.ExecutionID,
		Action:       "execute",
		Metadata:     metadata,
	})

	// WebSocket broadcast.
	if e.Broadcast != nil {
		e.Broadcast(input.EngagementID, "recon_execution_completed", map[string]any{
			"engagement_id":  input.EngagementID,
			"execution_id":   input.ExecutionID,
			"match_count":    matchCount,
			"mismatch_count": mismatchCount,
			"p1_count":       p1,
		})
	}

	slog.Info("recon execution completed",
		"execution_id", input.ExecutionID,
		"total_evaluated", totalEvaluated,
		"match_count", matchCount,
		"mismatch_count", mismatchCount,
		"p1_count", p1,
	)

	resultJSON, _ := json.Marshal(map[string]any{
		"execution_id":    input.ExecutionID,
		"total_evaluated": totalEvaluated,
		"match_count":     matchCount,
		"mismatch_count":  mismatchCount,
	})
	return q.Complete(ctx, job.JobID, resultJSON)
}

// failJob marks both the execution run and the job as failed.
func (e *ReconExecutionExecutor) failJob(ctx context.Context, q *jobqueue.Queue, jobID, executionID string, db *sql.DB, errMsg string) error {
	if executionID != "" {
		migrationdb.UpdateReconExecutionRunStatus(db, executionID, models.ReconExecFailed, &errMsg)
	}
	return q.Fail(ctx, jobID, errMsg)
}

// countByPriority tallies mismatches by P1/P2/P3.
func countByPriority(mismatches []models.ReconExecutionMismatch) (p1, p2, p3 int) {
	for _, m := range mismatches {
		switch m.Priority {
		case models.PriorityP1:
			p1++
		case models.PriorityP2:
			p2++
		case models.PriorityP3:
			p3++
		}
	}
	return
}
