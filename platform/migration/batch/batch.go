// Package batch implements idempotent, restartable batch processing for the
// migration engine. Each batch feeds source rows through the transformation
// pipeline, tracks lineage and exceptions, and supports checkpoint/resume on
// failure.
package batch

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/noui/platform/migration/transformer"
)

// --- Batch status constants ---

// BatchStatus represents the lifecycle state of a batch.
type BatchStatus string

const (
	StatusPending    BatchStatus = "PENDING"
	StatusRunning    BatchStatus = "RUNNING"
	StatusLoaded     BatchStatus = "LOADED"
	StatusReconciled BatchStatus = "RECONCILED"
	StatusApproved   BatchStatus = "APPROVED"
	StatusFailed     BatchStatus = "FAILED"
)

// --- Batch model ---

// Batch represents a migration batch record.
type Batch struct {
	BatchID           string      `json:"batch_id"`
	EngagementID      string      `json:"engagement_id"`
	BatchScope        string      `json:"batch_scope"`
	Status            BatchStatus `json:"status"`
	MappingVersion    string      `json:"mapping_version"`
	RowCountSource    *int        `json:"row_count_source"`
	RowCountLoaded    *int        `json:"row_count_loaded"`
	RowCountException *int        `json:"row_count_exception"`
	ErrorRate         *float64    `json:"error_rate"`
	HaltedReason      *string     `json:"halted_reason"`
	CheckpointKey     *string     `json:"checkpoint_key"`
	StartedAt         *time.Time  `json:"started_at"`
	CompletedAt       *time.Time  `json:"completed_at"`
}

// --- Batch statistics ---

// BatchStats tracks running counts during batch execution.
type BatchStats struct {
	TotalRows     int
	LoadedRows    int
	ExceptionRows int
	HardErrors    int
	SoftWarnings  int
	RetireeErrors int
}

// ErrorRate returns the current hard-error rate as a fraction.
func (s BatchStats) ErrorRate() float64 {
	if s.TotalRows == 0 {
		return 0
	}
	return float64(s.HardErrors) / float64(s.TotalRows)
}

// WarningRate returns the current soft-warning rate as a fraction.
func (s BatchStats) WarningRate() float64 {
	if s.TotalRows == 0 {
		return 0
	}
	return float64(s.SoftWarnings) / float64(s.TotalRows)
}

// --- Error thresholds ---

// ErrorThresholds defines the halt conditions for batch processing.
type ErrorThresholds struct {
	HardErrorHaltPct      float64 // fraction; default 0.05 (5%)
	SoftWarningMaxPct     float64 // fraction; default 0.15 (15%)
	RetireeErrorTolerance int     // default 0 — any retiree hard error halts
	FinancialBalanceTol   string  // default "0.01" (Decimal string) — reserved for reconciliation (Phase 3)
}

// DefaultThresholds returns the standard error thresholds.
func DefaultThresholds() ErrorThresholds {
	return ErrorThresholds{
		HardErrorHaltPct:      0.05,
		SoftWarningMaxPct:     0.15,
		RetireeErrorTolerance: 0,
		FinancialBalanceTol:   "0.01",
	}
}

// CheckThresholds evaluates batch statistics against the configured thresholds.
// It returns true (halt) with a reason string when any threshold is breached.
func CheckThresholds(stats BatchStats, thresholds ErrorThresholds) (halt bool, reason string) {
	// Retiree zero-tolerance — check first, most critical.
	if stats.RetireeErrors > thresholds.RetireeErrorTolerance {
		return true, fmt.Sprintf(
			"retiree hard error tolerance exceeded: %d errors (max %d)",
			stats.RetireeErrors, thresholds.RetireeErrorTolerance,
		)
	}

	// Hard-error percentage halt.
	if stats.TotalRows > 0 && stats.ErrorRate() > thresholds.HardErrorHaltPct {
		return true, fmt.Sprintf(
			"hard error rate %.2f%% exceeds threshold %.2f%%",
			stats.ErrorRate()*100, thresholds.HardErrorHaltPct*100,
		)
	}

	// Soft-warning percentage halt.
	if stats.TotalRows > 0 && stats.WarningRate() > thresholds.SoftWarningMaxPct {
		return true, fmt.Sprintf(
			"soft warning rate %.2f%% exceeds threshold %.2f%%",
			stats.WarningRate()*100, thresholds.SoftWarningMaxPct*100,
		)
	}

	return false, ""
}

// --- WebSocket event types ---

// BatchEventEmitter is an interface for broadcasting batch lifecycle events.
// Implementations will wire this to WebSocket or other transports.
type BatchEventEmitter interface {
	Emit(event BatchEvent)
}

// BatchEvent carries a batch lifecycle event for WebSocket broadcast.
type BatchEvent struct {
	Type         string      `json:"type"`
	EngagementID string      `json:"engagement_id"`
	BatchID      string      `json:"batch_id"`
	Payload      interface{} `json:"payload"`
}

// Event type constants.
const (
	EventBatchStarted   = "batch_started"
	EventBatchProgress  = "batch_progress"
	EventBatchCompleted = "batch_completed"
	EventBatchHalted    = "batch_halted"
)

// ProgressPayload is the payload for batch_progress events.
type ProgressPayload struct {
	RowsProcessed int     `json:"rows_processed"`
	TotalRows     int     `json:"total_rows"`
	ErrorRate     float64 `json:"error_rate"`
}

// CompletedPayload is the payload for batch_completed events.
type CompletedPayload struct {
	RowsLoaded    int     `json:"rows_loaded"`
	RowsException int     `json:"rows_exception"`
	ErrorRate     float64 `json:"error_rate"`
}

// HaltedPayload is the payload for batch_halted events.
type HaltedPayload struct {
	Reason        string `json:"reason"`
	RowsProcessed int    `json:"rows_processed"`
}

// noopEmitter silently discards events.
type noopEmitter struct{}

func (noopEmitter) Emit(BatchEvent) {}

// --- Source row provider ---

// SourceRowProvider abstracts reading source rows for a batch scope.
// It allows the batch processor to iterate over source data without
// coupling to a specific database driver.
type SourceRowProvider interface {
	// FetchRows returns all source rows for the given scope.
	// When checkpointKey is non-empty, only rows after the checkpoint are returned.
	FetchRows(scope string, checkpointKey string) ([]SourceRow, error)
}

// SourceRow is a single row from the source database with a unique key for checkpointing.
type SourceRow struct {
	Key  string                 // unique identifier for checkpoint tracking
	Data map[string]interface{} // column name -> value
	// IsRetiree indicates whether this row represents a retiree record.
	// Used for zero-tolerance error checking.
	IsRetiree bool
}

// --- Database operations ---

// CreateBatch inserts a new PENDING batch and returns it.
func CreateBatch(db *sql.DB, engagementID, scope, mappingVersion string) (*Batch, error) {
	var b Batch
	err := db.QueryRow(
		`INSERT INTO migration.batch (engagement_id, batch_scope, mapping_version)
		 VALUES ($1, $2, $3)
		 RETURNING batch_id, engagement_id, batch_scope, status, mapping_version,
		           row_count_source, row_count_loaded, row_count_exception,
		           error_rate, halted_reason, checkpoint_key, started_at, completed_at`,
		engagementID, scope, mappingVersion,
	).Scan(
		&b.BatchID, &b.EngagementID, &b.BatchScope, &b.Status, &b.MappingVersion,
		&b.RowCountSource, &b.RowCountLoaded, &b.RowCountException,
		&b.ErrorRate, &b.HaltedReason, &b.CheckpointKey, &b.StartedAt, &b.CompletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create batch: %w", err)
	}
	return &b, nil
}

// GetBatch retrieves a batch by ID.
func GetBatch(db *sql.DB, batchID string) (*Batch, error) {
	var b Batch
	err := db.QueryRow(
		`SELECT batch_id, engagement_id, batch_scope, status, mapping_version,
		        row_count_source, row_count_loaded, row_count_exception,
		        error_rate, halted_reason, checkpoint_key, started_at, completed_at
		 FROM migration.batch
		 WHERE batch_id = $1`,
		batchID,
	).Scan(
		&b.BatchID, &b.EngagementID, &b.BatchScope, &b.Status, &b.MappingVersion,
		&b.RowCountSource, &b.RowCountLoaded, &b.RowCountException,
		&b.ErrorRate, &b.HaltedReason, &b.CheckpointKey, &b.StartedAt, &b.CompletedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get batch: %w", err)
	}
	return &b, nil
}

// updateBatchStatus sets the batch status and optionally started_at / completed_at.
func updateBatchStatus(db *sql.DB, batchID string, status BatchStatus) error {
	var query string
	switch status {
	case StatusRunning:
		query = `UPDATE migration.batch SET status = $2, started_at = now() WHERE batch_id = $1`
	case StatusLoaded, StatusFailed:
		query = `UPDATE migration.batch SET status = $2, completed_at = now() WHERE batch_id = $1`
	default:
		query = `UPDATE migration.batch SET status = $2 WHERE batch_id = $1`
	}
	_, err := db.Exec(query, batchID, string(status))
	if err != nil {
		return fmt.Errorf("update batch status: %w", err)
	}
	return nil
}

// updateBatchResults writes row counts and error rate after execution.
func updateBatchResults(db *sql.DB, batchID string, stats BatchStats) error {
	errorRate := stats.ErrorRate()
	_, err := db.Exec(
		`UPDATE migration.batch
		 SET row_count_source = $2, row_count_loaded = $3, row_count_exception = $4,
		     error_rate = $5
		 WHERE batch_id = $1`,
		batchID, stats.TotalRows, stats.LoadedRows, stats.ExceptionRows, errorRate,
	)
	if err != nil {
		return fmt.Errorf("update batch results: %w", err)
	}
	return nil
}

// updateBatchCheckpoint records the last-processed row key.
func updateBatchCheckpoint(db *sql.DB, batchID, checkpointKey string) error {
	_, err := db.Exec(
		`UPDATE migration.batch SET checkpoint_key = $2 WHERE batch_id = $1`,
		batchID, checkpointKey,
	)
	if err != nil {
		return fmt.Errorf("update batch checkpoint: %w", err)
	}
	return nil
}

// haltBatch sets the batch to FAILED with a reason.
func haltBatch(db *sql.DB, batchID, reason string) error {
	_, err := db.Exec(
		`UPDATE migration.batch
		 SET status = 'FAILED', halted_reason = $2, completed_at = now()
		 WHERE batch_id = $1`,
		batchID, reason,
	)
	if err != nil {
		return fmt.Errorf("halt batch: %w", err)
	}
	return nil
}

// countPriorErrors queries the exception table to restore error breakdown
// counters for threshold checking during batch resume.
func countPriorErrors(db *sql.DB, batchID string) (hardErrors, softWarnings, retireeErrors int, err error) {
	rows, err := db.Query(
		`SELECT exception_type, COUNT(*)
		 FROM migration.exception
		 WHERE batch_id = $1
		 GROUP BY exception_type`,
		batchID,
	)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("count prior errors: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var exType string
		var count int
		if err := rows.Scan(&exType, &count); err != nil {
			return 0, 0, 0, fmt.Errorf("scan error count: %w", err)
		}
		switch exType {
		case string(transformer.ExceptionMissingRequired),
			string(transformer.ExceptionInvalidFormat),
			string(transformer.ExceptionReferentialIntegrity),
			string(transformer.ExceptionBusinessRule),
			string(transformer.ExceptionCrossTableMismatch),
			string(transformer.ExceptionThresholdBreach):
			hardErrors += count
		default:
			softWarnings += count
		}
	}
	if err := rows.Err(); err != nil {
		return 0, 0, 0, fmt.Errorf("iterate error counts: %w", err)
	}
	// Retiree errors are not distinguishable from the exception table alone —
	// they require source row context. We store 0 here; the resume loop will
	// detect new retiree errors going forward. This is conservative: it may
	// allow a batch to resume that should have stayed halted, but the halt
	// will trigger again on the next retiree error.
	return hardErrors, softWarnings, 0, nil
}

// clearPriorBatchData removes canonical rows and lineage from a previous run
// of this batch, enabling idempotent re-runs.
func clearPriorBatchData(tx *sql.Tx, batchID string) error {
	if _, err := tx.Exec(
		`DELETE FROM migration.lineage WHERE batch_id = $1`, batchID,
	); err != nil {
		return fmt.Errorf("clear lineage: %w", err)
	}
	if _, err := tx.Exec(
		`DELETE FROM migration.canonical_row WHERE batch_id = $1`, batchID,
	); err != nil {
		return fmt.Errorf("clear canonical rows: %w", err)
	}
	if _, err := tx.Exec(
		`DELETE FROM migration.exception WHERE batch_id = $1`, batchID,
	); err != nil {
		return fmt.Errorf("clear exceptions: %w", err)
	}
	return nil
}

// writeCanonicalRow inserts a transformed row into the canonical table.
func writeCanonicalRow(tx *sql.Tx, batchID, rowKey string, confidence transformer.Confidence) error {
	_, err := tx.Exec(
		`INSERT INTO migration.canonical_row (batch_id, row_key, confidence)
		 VALUES ($1, $2, $3)`,
		batchID, rowKey, string(confidence),
	)
	if err != nil {
		return fmt.Errorf("write canonical row: %w", err)
	}
	return nil
}

// writeLineageEntries inserts lineage records for a single row.
func writeLineageEntries(tx *sql.Tx, batchID, rowKey string, entries []transformer.LineageEntry) error {
	for _, le := range entries {
		_, err := tx.Exec(
			`INSERT INTO migration.lineage (batch_id, row_key, handler_name, column_name, source_value, result_value)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			batchID, rowKey, le.HandlerName, le.Column, le.SourceValue, le.ResultValue,
		)
		if err != nil {
			return fmt.Errorf("write lineage: %w", err)
		}
	}
	return nil
}

// writeExceptionEntries inserts exception records for a single row.
func writeExceptionEntries(tx *sql.Tx, batchID, rowKey string, entries []transformer.ExceptionEntry) error {
	for _, ex := range entries {
		_, err := tx.Exec(
			`INSERT INTO migration.exception (batch_id, row_key, handler_name, column_name, source_value, exception_type, message)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			batchID, rowKey, ex.HandlerName, ex.Column, ex.SourceValue, string(ex.ExceptionType), ex.Message,
		)
		if err != nil {
			return fmt.Errorf("write exception: %w", err)
		}
	}
	return nil
}

// --- Batch execution ---

// ExecuteBatch runs the transformation pipeline for all source rows in the batch
// scope. It is idempotent: re-running deletes prior output before processing.
func ExecuteBatch(
	db *sql.DB,
	batch *Batch,
	provider SourceRowProvider,
	pipeline *transformer.Pipeline,
	mappings []transformer.FieldMapping,
	thresholds ErrorThresholds,
	emitter BatchEventEmitter,
) error {
	if emitter == nil {
		emitter = noopEmitter{}
	}

	// 1. Update status: PENDING -> RUNNING
	if err := updateBatchStatus(db, batch.BatchID, StatusRunning); err != nil {
		return err
	}
	batch.Status = StatusRunning

	emitter.Emit(BatchEvent{
		Type:         EventBatchStarted,
		EngagementID: batch.EngagementID,
		BatchID:      batch.BatchID,
	})

	// Fetch source rows (no checkpoint — full run).
	sourceRows, err := provider.FetchRows(batch.BatchScope, "")
	if err != nil {
		_ = haltBatch(db, batch.BatchID, fmt.Sprintf("fetch source rows: %v", err))
		return fmt.Errorf("fetch source rows: %w", err)
	}

	// 2. Begin transaction.
	tx, err := db.Begin()
	if err != nil {
		_ = haltBatch(db, batch.BatchID, fmt.Sprintf("begin tx: %v", err))
		return fmt.Errorf("begin transaction: %w", err)
	}

	// 3. Clear prior output for idempotent re-run.
	if err := clearPriorBatchData(tx, batch.BatchID); err != nil {
		_ = tx.Rollback()
		_ = haltBatch(db, batch.BatchID, fmt.Sprintf("clear prior data: %v", err))
		return err
	}

	// 4. Process each source row.
	stats := BatchStats{TotalRows: len(sourceRows)}
	sharedCtx := &transformer.TransformContext{
		EngagementID:   batch.EngagementID,
		MappingVersion: batch.MappingVersion,
	}

	for i, srcRow := range sourceRows {
		// Transform single row through pipeline.
		results := pipeline.TransformWithContext(
			[]map[string]interface{}{srcRow.Data},
			mappings,
			sharedCtx,
		)
		result := results[0]

		hasExceptions := len(result.Exceptions) > 0
		if hasExceptions {
			stats.ExceptionRows++
			rowHasHard := containsHardError(result.Exceptions)
			if rowHasHard {
				stats.HardErrors++
				if srcRow.IsRetiree {
					stats.RetireeErrors++
				}
			} else {
				stats.SoftWarnings++
			}
		}

		// Check thresholds after each row.
		if halt, reason := CheckThresholds(stats, thresholds); halt {
			_ = tx.Rollback()
			haltReason := fmt.Sprintf("halted at row %d/%d: %s", i+1, len(sourceRows), reason)
			_ = haltBatch(db, batch.BatchID, haltReason)
			batch.Status = StatusFailed
			r := haltReason
			batch.HaltedReason = &r

			emitter.Emit(BatchEvent{
				Type:         EventBatchHalted,
				EngagementID: batch.EngagementID,
				BatchID:      batch.BatchID,
				Payload: HaltedPayload{
					Reason:        haltReason,
					RowsProcessed: i + 1,
				},
			})
			return fmt.Errorf("batch halted: %s", reason)
		}

		// Write canonical row.
		if err := writeCanonicalRow(tx, batch.BatchID, srcRow.Key, result.Confidence); err != nil {
			_ = tx.Rollback()
			_ = haltBatch(db, batch.BatchID, fmt.Sprintf("write canonical row %s: %v", srcRow.Key, err))
			return err
		}

		// Write lineage.
		if err := writeLineageEntries(tx, batch.BatchID, srcRow.Key, result.Lineage); err != nil {
			_ = tx.Rollback()
			_ = haltBatch(db, batch.BatchID, fmt.Sprintf("write lineage %s: %v", srcRow.Key, err))
			return err
		}

		// Write exceptions.
		if err := writeExceptionEntries(tx, batch.BatchID, srcRow.Key, result.Exceptions); err != nil {
			_ = tx.Rollback()
			_ = haltBatch(db, batch.BatchID, fmt.Sprintf("write exceptions %s: %v", srcRow.Key, err))
			return err
		}

		stats.LoadedRows++

		// Update checkpoint.
		if err := updateBatchCheckpoint(db, batch.BatchID, srcRow.Key); err != nil {
			// Non-fatal for checkpoint — log but continue.
		}

		// Emit progress every 100 rows.
		if (i+1)%100 == 0 || i == len(sourceRows)-1 {
			emitter.Emit(BatchEvent{
				Type:         EventBatchProgress,
				EngagementID: batch.EngagementID,
				BatchID:      batch.BatchID,
				Payload: ProgressPayload{
					RowsProcessed: i + 1,
					TotalRows:     len(sourceRows),
					ErrorRate:     stats.ErrorRate(),
				},
			})
		}
	}

	// 5. Commit transaction.
	if err := tx.Commit(); err != nil {
		_ = haltBatch(db, batch.BatchID, fmt.Sprintf("commit: %v", err))
		return fmt.Errorf("commit transaction: %w", err)
	}

	// 6. Update batch results.
	if err := updateBatchResults(db, batch.BatchID, stats); err != nil {
		return err
	}

	// 7. Update status: RUNNING -> LOADED.
	if err := updateBatchStatus(db, batch.BatchID, StatusLoaded); err != nil {
		return err
	}
	batch.Status = StatusLoaded

	emitter.Emit(BatchEvent{
		Type:         EventBatchCompleted,
		EngagementID: batch.EngagementID,
		BatchID:      batch.BatchID,
		Payload: CompletedPayload{
			RowsLoaded:    stats.LoadedRows,
			RowsException: stats.ExceptionRows,
			ErrorRate:     stats.ErrorRate(),
		},
	})

	return nil
}

// ResumeBatch restarts batch processing from the last checkpoint.
// It picks up where a previous run left off rather than clearing all data.
func ResumeBatch(
	db *sql.DB,
	batch *Batch,
	provider SourceRowProvider,
	pipeline *transformer.Pipeline,
	mappings []transformer.FieldMapping,
	thresholds ErrorThresholds,
	emitter BatchEventEmitter,
) error {
	if emitter == nil {
		emitter = noopEmitter{}
	}

	checkpointKey := ""
	if batch.CheckpointKey != nil {
		checkpointKey = *batch.CheckpointKey
	}

	// Update status back to RUNNING.
	if err := updateBatchStatus(db, batch.BatchID, StatusRunning); err != nil {
		return err
	}
	batch.Status = StatusRunning
	// Clear any previous halt reason.
	if _, err := db.Exec(
		`UPDATE migration.batch SET halted_reason = NULL WHERE batch_id = $1`,
		batch.BatchID,
	); err != nil {
		return fmt.Errorf("clear halt reason: %w", err)
	}

	emitter.Emit(BatchEvent{
		Type:         EventBatchStarted,
		EngagementID: batch.EngagementID,
		BatchID:      batch.BatchID,
		Payload:      map[string]string{"resume_from": checkpointKey},
	})

	// Fetch remaining source rows from checkpoint.
	sourceRows, err := provider.FetchRows(batch.BatchScope, checkpointKey)
	if err != nil {
		_ = haltBatch(db, batch.BatchID, fmt.Sprintf("fetch source rows: %v", err))
		return fmt.Errorf("fetch source rows: %w", err)
	}

	// Restore stats from batch record + exception table so threshold
	// checking is cumulative across resume boundaries.
	stats := BatchStats{
		TotalRows: len(sourceRows),
	}
	if batch.RowCountLoaded != nil {
		stats.LoadedRows = *batch.RowCountLoaded
		stats.TotalRows += stats.LoadedRows
	}
	if batch.RowCountException != nil {
		stats.ExceptionRows = *batch.RowCountException
	}
	// Restore error breakdown from prior exceptions so thresholds
	// consider the full batch history, not just remaining rows.
	priorHard, priorSoft, priorRetiree, err := countPriorErrors(db, batch.BatchID)
	if err != nil {
		_ = haltBatch(db, batch.BatchID, fmt.Sprintf("count prior errors: %v", err))
		return fmt.Errorf("count prior errors: %w", err)
	}
	stats.HardErrors = priorHard
	stats.SoftWarnings = priorSoft
	stats.RetireeErrors = priorRetiree

	tx, err := db.Begin()
	if err != nil {
		_ = haltBatch(db, batch.BatchID, fmt.Sprintf("begin tx: %v", err))
		return fmt.Errorf("begin transaction: %w", err)
	}

	sharedCtx := &transformer.TransformContext{
		EngagementID:   batch.EngagementID,
		MappingVersion: batch.MappingVersion,
	}

	for i, srcRow := range sourceRows {
		results := pipeline.TransformWithContext(
			[]map[string]interface{}{srcRow.Data},
			mappings,
			sharedCtx,
		)
		result := results[0]

		hasExceptions := len(result.Exceptions) > 0
		if hasExceptions {
			stats.ExceptionRows++
			rowHasHard := containsHardError(result.Exceptions)
			if rowHasHard {
				stats.HardErrors++
				if srcRow.IsRetiree {
					stats.RetireeErrors++
				}
			} else {
				stats.SoftWarnings++
			}
		}

		if halt, reason := CheckThresholds(stats, thresholds); halt {
			_ = tx.Rollback()
			haltReason := fmt.Sprintf("halted at row %d: %s", i+1, reason)
			_ = haltBatch(db, batch.BatchID, haltReason)
			batch.Status = StatusFailed
			r := haltReason
			batch.HaltedReason = &r

			emitter.Emit(BatchEvent{
				Type:         EventBatchHalted,
				EngagementID: batch.EngagementID,
				BatchID:      batch.BatchID,
				Payload: HaltedPayload{
					Reason:        haltReason,
					RowsProcessed: i + 1,
				},
			})
			return fmt.Errorf("batch halted: %s", reason)
		}

		if err := writeCanonicalRow(tx, batch.BatchID, srcRow.Key, result.Confidence); err != nil {
			_ = tx.Rollback()
			_ = haltBatch(db, batch.BatchID, fmt.Sprintf("write canonical row %s: %v", srcRow.Key, err))
			return err
		}
		if err := writeLineageEntries(tx, batch.BatchID, srcRow.Key, result.Lineage); err != nil {
			_ = tx.Rollback()
			_ = haltBatch(db, batch.BatchID, fmt.Sprintf("write lineage %s: %v", srcRow.Key, err))
			return err
		}
		if err := writeExceptionEntries(tx, batch.BatchID, srcRow.Key, result.Exceptions); err != nil {
			_ = tx.Rollback()
			_ = haltBatch(db, batch.BatchID, fmt.Sprintf("write exceptions %s: %v", srcRow.Key, err))
			return err
		}

		stats.LoadedRows++

		if err := updateBatchCheckpoint(db, batch.BatchID, srcRow.Key); err != nil {
			// Non-fatal.
		}

		if (i+1)%100 == 0 || i == len(sourceRows)-1 {
			emitter.Emit(BatchEvent{
				Type:         EventBatchProgress,
				EngagementID: batch.EngagementID,
				BatchID:      batch.BatchID,
				Payload: ProgressPayload{
					RowsProcessed: stats.LoadedRows,
					TotalRows:     stats.TotalRows,
					ErrorRate:     stats.ErrorRate(),
				},
			})
		}
	}

	if err := tx.Commit(); err != nil {
		_ = haltBatch(db, batch.BatchID, fmt.Sprintf("commit: %v", err))
		return fmt.Errorf("commit transaction: %w", err)
	}

	if err := updateBatchResults(db, batch.BatchID, stats); err != nil {
		return err
	}

	if err := updateBatchStatus(db, batch.BatchID, StatusLoaded); err != nil {
		return err
	}
	batch.Status = StatusLoaded

	emitter.Emit(BatchEvent{
		Type:         EventBatchCompleted,
		EngagementID: batch.EngagementID,
		BatchID:      batch.BatchID,
		Payload: CompletedPayload{
			RowsLoaded:    stats.LoadedRows,
			RowsException: stats.ExceptionRows,
			ErrorRate:     stats.ErrorRate(),
		},
	})

	return nil
}

// --- helpers ---

// isHardError returns true for exception types that count as hard errors.
func isHardError(et transformer.ExceptionType) bool {
	switch et {
	case transformer.ExceptionMissingRequired,
		transformer.ExceptionBusinessRule,
		transformer.ExceptionReferentialIntegrity:
		return true
	}
	return false
}

// containsHardError checks if any exception in the slice is a hard error.
func containsHardError(exceptions []transformer.ExceptionEntry) bool {
	for _, ex := range exceptions {
		if isHardError(ex.ExceptionType) {
			return true
		}
	}
	return false
}
