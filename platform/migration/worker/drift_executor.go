package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
)

// JobTypeDriftDetection is the canonical job type string for drift detection jobs.
const JobTypeDriftDetection = "drift_detection"

// DriftDetectionInput is the JSON payload inside job.input_json for drift_detection jobs.
type DriftDetectionInput struct {
	RunID        string `json:"run_id"`
	EngagementID string `json:"engagement_id"`
	DriftType    string `json:"drift_type"`
	BaselineID   string `json:"baseline_id"`
}

// DriftDetectionExecutor implements the worker.Executor interface for drift detection jobs.
type DriftDetectionExecutor struct {
	// Broadcast is set by the Worker after construction to enable WebSocket events.
	Broadcast BroadcastFunc
}

// Execute implements the Executor interface for drift detection.
func (e *DriftDetectionExecutor) Execute(ctx context.Context, job *jobqueue.Job, q *jobqueue.Queue, migrationDB *sql.DB) (execErr error) {
	if err := q.MarkRunning(ctx, job.JobID); err != nil {
		return fmt.Errorf("mark running: %w", err)
	}

	var input DriftDetectionInput
	if err := json.Unmarshal(job.InputJSON, &input); err != nil {
		return fmt.Errorf("unmarshal drift detection input: %w", err)
	}

	slog.Info("drift detection executor: starting",
		"run_id", input.RunID,
		"engagement_id", input.EngagementID,
		"drift_type", input.DriftType,
	)

	// Deferred failure broadcast.
	defer func() {
		if execErr != nil {
			e.broadcastEvent(input.EngagementID, "drift_detection_failed", map[string]interface{}{
				"run_id":        input.RunID,
				"engagement_id": input.EngagementID,
				"error":         execErr.Error(),
			})
		}
	}()

	// Transition run to RUNNING.
	if _, err := db.UpdateDriftRunStatus(migrationDB, input.RunID, models.DriftRunRunning, nil); err != nil {
		return fmt.Errorf("update run status to RUNNING: %w", err)
	}

	driftType := models.DriftType(input.DriftType)
	var allRecords []models.DriftRecord
	var detectionErr error

	// Schema drift detection.
	if driftType == models.DriftTypeSchema || driftType == models.DriftTypeBoth {
		schemaRecords, err := e.detectSchemaDrift(ctx, migrationDB, input.EngagementID, input.BaselineID)
		if err != nil {
			detectionErr = fmt.Errorf("schema drift: %w", err)
		} else {
			allRecords = append(allRecords, schemaRecords...)
		}
	}

	// Row count drift detection.
	if detectionErr == nil && (driftType == models.DriftTypeData || driftType == models.DriftTypeBoth) {
		rowRecords, err := e.detectRowCountDrift(ctx, migrationDB, input.EngagementID)
		if err != nil {
			detectionErr = fmt.Errorf("row count drift: %w", err)
		} else {
			allRecords = append(allRecords, rowRecords...)
		}
	}

	if detectionErr != nil {
		errMsg := detectionErr.Error()
		if _, err := db.UpdateDriftRunStatus(migrationDB, input.RunID, models.DriftRunFailed, &errMsg); err != nil {
			slog.Warn("failed to mark drift run as FAILED", "error", err)
		}
		return detectionErr
	}

	// Set run_id on all records.
	for i := range allRecords {
		allRecords[i].RunID = input.RunID
	}

	// Insert drift records.
	if len(allRecords) > 0 {
		if err := db.InsertDriftRecords(migrationDB, allRecords); err != nil {
			errMsg := err.Error()
			db.UpdateDriftRunStatus(migrationDB, input.RunID, models.DriftRunFailed, &errMsg)
			return fmt.Errorf("insert drift records: %w", err)
		}
	}

	// Count critical changes.
	detected := len(allRecords)
	critical := 0
	for _, r := range allRecords {
		if r.Severity == models.DriftSeverityCritical {
			critical++
		}
	}

	// Update counts.
	if err := db.UpdateDriftRunCounts(migrationDB, input.RunID, detected, critical); err != nil {
		slog.Warn("failed to update drift run counts", "error", err)
	}

	// Mark completed.
	if _, err := db.UpdateDriftRunStatus(migrationDB, input.RunID, models.DriftRunCompleted, nil); err != nil {
		return fmt.Errorf("update run status to COMPLETED: %w", err)
	}

	// Auto-create attention item for critical drift.
	if critical > 0 {
		summary := fmt.Sprintf("Drift detection found %d critical schema changes", critical)
		detail := fmt.Sprintf("Run %s detected %d total changes, %d critical. Review source system changes before proceeding.", input.RunID, detected, critical)
		if err := db.InsertDriftAttentionItem(migrationDB, input.EngagementID, summary, detail); err != nil {
			slog.Warn("failed to create attention item for critical drift", "error", err)
		}
	}

	// Broadcast completion.
	e.broadcastEvent(input.EngagementID, "drift_detection_completed", map[string]interface{}{
		"run_id":           input.RunID,
		"engagement_id":    input.EngagementID,
		"detected_changes": detected,
		"critical_changes": critical,
	})

	result, _ := json.Marshal(map[string]interface{}{
		"run_id":           input.RunID,
		"detected_changes": detected,
		"critical_changes": critical,
	})

	return q.Complete(ctx, job.JobID, result)
}

// detectSchemaDrift connects to the source database and compares against baseline.
func (e *DriftDetectionExecutor) detectSchemaDrift(ctx context.Context, migrationDB *sql.DB, engagementID, baselineID string) ([]models.DriftRecord, error) {
	// Get baseline fields.
	baselineFields, err := db.GetBaselineFields(migrationDB, baselineID)
	if err != nil {
		return nil, fmt.Errorf("get baseline fields: %w", err)
	}

	// Get mapped columns.
	mappedCols, err := db.GetMappedColumnsForEngagement(migrationDB, engagementID)
	if err != nil {
		return nil, fmt.Errorf("get mapped columns: %w", err)
	}
	mappedMap := make(map[string]string, len(mappedCols))
	for _, m := range mappedCols {
		mappedMap[fmt.Sprintf("%s.%s", m.SourceTable, m.SourceColumn)] = m.ApprovalStatus
	}

	// Connect to source database.
	srcDB, err := openSourceDB(ctx, migrationDB, engagementID)
	if err != nil {
		return nil, fmt.Errorf("open source db: %w", err)
	}
	defer srcDB.Close()

	// Discover current source schema via information_schema.
	sourceColumns, err := discoverSourceColumns(ctx, srcDB)
	if err != nil {
		return nil, fmt.Errorf("discover source columns: %w", err)
	}

	return db.ComputeSchemaDrift(baselineFields, sourceColumns, mappedMap), nil
}

// detectRowCountDrift connects to the source database and compares row counts.
func (e *DriftDetectionExecutor) detectRowCountDrift(ctx context.Context, migrationDB *sql.DB, engagementID string) ([]models.DriftRecord, error) {
	// Get source tables from latest profiling run.
	tables, err := db.GetSourceTablesForEngagement(migrationDB, engagementID)
	if err != nil {
		return nil, fmt.Errorf("get source tables: %w", err)
	}

	if len(tables) == 0 {
		return nil, nil
	}

	// Connect to source database.
	srcDB, err := openSourceDB(ctx, migrationDB, engagementID)
	if err != nil {
		return nil, fmt.Errorf("open source db: %w", err)
	}
	defer srcDB.Close()

	// Build baseline info and query current counts.
	var baselineTables []db.TableRowInfo
	currentCounts := make(map[string]int64)

	for _, t := range tables {
		if t.RowCount == nil {
			continue
		}
		baselineTables = append(baselineTables, db.TableRowInfo{
			TableName:     t.TableName,
			BaselineCount: *t.RowCount,
		})

		// Query current count — use catalog estimate for large tables.
		current, err := getCurrentRowCount(ctx, srcDB, t.TableName, *t.RowCount)
		if err != nil {
			slog.Warn("failed to get current row count",
				"table", t.TableName, "error", err)
			continue
		}
		currentCounts[t.TableName] = current
	}

	return db.ComputeRowCountDrift(baselineTables, currentCounts, models.DriftRowCountThresholdPct), nil
}

// discoverSourceColumns reads all columns from information_schema.
func discoverSourceColumns(ctx context.Context, srcDB *sql.DB) ([]db.SourceColumnInfo, error) {
	rows, err := srcDB.QueryContext(ctx,
		`SELECT table_name, column_name, data_type
		 FROM information_schema.columns
		 WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
		 ORDER BY table_name, ordinal_position`)
	if err != nil {
		return nil, fmt.Errorf("query information_schema: %w", err)
	}
	defer rows.Close()

	var columns []db.SourceColumnInfo
	for rows.Next() {
		var c db.SourceColumnInfo
		if err := rows.Scan(&c.TableName, &c.ColumnName, &c.DataType); err != nil {
			return nil, fmt.Errorf("scan column: %w", err)
		}
		columns = append(columns, c)
	}
	return columns, rows.Err()
}

// getCurrentRowCount returns the current row count for a table.
// Uses catalog estimate for tables > 100K rows to avoid expensive COUNT(*).
func getCurrentRowCount(ctx context.Context, srcDB *sql.DB, tableName string, baselineCount int64) (int64, error) {
	if baselineCount > 100000 {
		// Use PostgreSQL catalog estimate.
		var estimate int64
		err := srcDB.QueryRowContext(ctx,
			`SELECT COALESCE(reltuples::bigint, 0)
			 FROM pg_class WHERE relname = $1`,
			tableName,
		).Scan(&estimate)
		if err == nil && estimate > 0 {
			return estimate, nil
		}
		// Fall through to COUNT(*) if catalog estimate fails.
	}

	var count int64
	err := srcDB.QueryRowContext(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM %q`, tableName),
	).Scan(&count)
	return count, err
}

// broadcastEvent sends a WebSocket event via the executor's Broadcast callback.
func (e *DriftDetectionExecutor) broadcastEvent(engagementID, eventType string, payload interface{}) {
	if e.Broadcast == nil {
		return
	}
	e.Broadcast(engagementID, eventType, payload)
}

// Ensure DriftDetectionExecutor satisfies the Executor interface at compile time.
var _ Executor = (*DriftDetectionExecutor)(nil)

// Placeholder for time tracking — used in deferred functions.
var _ = time.Now
