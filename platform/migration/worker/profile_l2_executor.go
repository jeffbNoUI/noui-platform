package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
	"github.com/noui/platform/migration/profiler"
)

// L2Input is the JSON payload inside job.input_json for profile_l2 jobs.
type L2Input struct {
	ProfilingRunID string `json:"profiling_run_id"`
	EngagementID   string `json:"engagement_id"`
	SourceTableID  string `json:"source_table_id"`
	SchemaName     string `json:"schema_name"`
	TableName      string `json:"table_name"`
	SourceDriver   string `json:"source_driver"`
	EstimatedRows  int64  `json:"estimated_rows"`
}

// ProfileL2Executor computes column-level statistics, pension patterns, and
// sample values for a single source table. This is the heavy-lifting profiling
// pass that touches source data.
type ProfileL2Executor struct{}

// Execute implements the Executor interface for Level 2 profiling.
func (e *ProfileL2Executor) Execute(ctx context.Context, job *jobqueue.Job, q *jobqueue.Queue, migrationDB *sql.DB) error {
	if err := q.MarkRunning(ctx, job.JobID); err != nil {
		return fmt.Errorf("mark running: %w", err)
	}

	var input L2Input
	if err := json.Unmarshal(job.InputJSON, &input); err != nil {
		return fmt.Errorf("unmarshal L2 input: %w", err)
	}

	slog.Info("L2 executor: computing column stats",
		"table", input.TableName,
		"schema", input.SchemaName,
		"run_id", input.ProfilingRunID,
		"estimated_rows", input.EstimatedRows,
	)

	// Open source database connection.
	conn, err := db.GetEngagementSourceConnection(migrationDB, input.EngagementID)
	if err != nil {
		return fmt.Errorf("get source connection: %w", err)
	}
	srcDB, err := db.OpenSourceDB(conn)
	if err != nil {
		return fmt.Errorf("open source db: %w", err)
	}
	defer srcDB.Close()

	if err := srcDB.PingContext(ctx); err != nil {
		return fmt.Errorf("ping source db: %w", err)
	}

	// Get existing columns from L1.
	columns, err := db.ListSourceColumns(migrationDB, input.SourceTableID)
	if err != nil {
		return fmt.Errorf("list source columns: %w", err)
	}
	if len(columns) == 0 {
		return fmt.Errorf("no columns found for table %s (L1 may not have run)", input.SourceTableID)
	}

	// Determine sampling strategy.
	sampling := profiler.DetermineSampling(input.SourceDriver, input.EstimatedRows)
	sampleClause := profiler.TableSampleClause(sampling, input.SourceDriver)

	quotedTable, err := quoteIdentL1(input.SchemaName, input.TableName, input.SourceDriver)
	if err != nil {
		return fmt.Errorf("quote table: %w", err)
	}

	_ = q.UpdateProgress(ctx, job.JobID, 10)

	// Process each column.
	for i, col := range columns {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		stats, err := e.computeColumnStats(ctx, srcDB, quotedTable, sampleClause, col.ColumnName, col.DataType, input.SourceDriver, sampling.UseSampling)
		if err != nil {
			slog.Warn("column stats failed, skipping",
				"column", col.ColumnName, "table", input.TableName, "error", err)
			continue
		}

		// Update column with L2 stats.
		if err := db.UpdateSourceColumnStats(migrationDB, col.ID, stats); err != nil {
			return fmt.Errorf("update column stats %s: %w", col.ColumnName, err)
		}

		progress := 10 + (80 * (i + 1) / max(len(columns), 1))
		_ = q.UpdateProgress(ctx, job.JobID, progress)
	}

	// Mark table as L2_DONE.
	if err := db.UpdateSourceTableStatus(migrationDB, input.SourceTableID, models.TableProfileL2Done); err != nil {
		return fmt.Errorf("update table status: %w", err)
	}

	_ = q.UpdateProgress(ctx, job.JobID, 100)

	result, _ := json.Marshal(map[string]interface{}{
		"table_id": input.SourceTableID,
		"columns":  len(columns),
		"sampled":  sampling.UseSampling,
	})

	return q.Complete(ctx, job.JobID, result)
}

// computeColumnStats gathers statistics for a single column.
func (e *ProfileL2Executor) computeColumnStats(
	ctx context.Context,
	srcDB *sql.DB,
	quotedTable, sampleClause, columnName, dataType, driver string,
	isSampled bool,
) (*models.SourceColumnProfile, error) {
	quotedCol, err := quoteColName(columnName, driver)
	if err != nil {
		return nil, fmt.Errorf("unsafe column name %q: %w", columnName, err)
	}

	stats := &models.SourceColumnProfile{
		ColumnName: columnName,
		DataType:   dataType,
		IsSampled:  isSampled,
	}

	// Basic aggregate stats: count, null_count, distinct_count.
	aggQuery := fmt.Sprintf(
		`SELECT COUNT(*), COUNT(*) - COUNT(%s), COUNT(DISTINCT %s)
		 FROM %s%s`,
		quotedCol, quotedCol, quotedTable, sampleClause,
	)

	var rowCount, nullCount, distinctCount int64
	if err := srcDB.QueryRowContext(ctx, aggQuery).Scan(&rowCount, &nullCount, &distinctCount); err != nil {
		return nil, fmt.Errorf("aggregate stats for %s: %w", columnName, err)
	}
	stats.RowCount = &rowCount
	stats.NullCount = &nullCount
	stats.DistinctCount = &distinctCount

	if rowCount > 0 {
		nullPct := float64(nullCount) / float64(rowCount) * 100
		stats.NullPct = &nullPct
		distinctPct := float64(distinctCount) / float64(rowCount) * 100
		stats.DistinctPct = &distinctPct
	}

	if isSampled {
		sampleSize := rowCount
		stats.SampleSize = &sampleSize
	}

	// Min/max for all types.
	minMaxQuery := fmt.Sprintf(
		`SELECT MIN(%s)::TEXT, MAX(%s)::TEXT FROM %s%s WHERE %s IS NOT NULL`,
		quotedCol, quotedCol, quotedTable, sampleClause, quotedCol,
	)
	var minVal, maxVal sql.NullString
	if err := srcDB.QueryRowContext(ctx, minMaxQuery).Scan(&minVal, &maxVal); err == nil {
		if minVal.Valid {
			stats.MinValue = &minVal.String
		}
		if maxVal.Valid {
			stats.MaxValue = &maxVal.String
		}
	}

	// Mean/stddev for numeric types.
	if isNumericType(dataType) {
		numQuery := fmt.Sprintf(
			`SELECT AVG(%s::numeric), STDDEV(%s::numeric) FROM %s%s WHERE %s IS NOT NULL`,
			quotedCol, quotedCol, quotedTable, sampleClause, quotedCol,
		)
		var mean, stddev sql.NullFloat64
		if err := srcDB.QueryRowContext(ctx, numQuery).Scan(&mean, &stddev); err == nil {
			if mean.Valid {
				stats.MeanValue = &mean.Float64
			}
			if stddev.Valid {
				stats.StddevValue = &stddev.Float64
			}
		}
	}

	// Top values (top 20 by frequency).
	topQuery := fmt.Sprintf(
		`SELECT %s::TEXT AS val, COUNT(*) AS cnt
		 FROM %s%s
		 WHERE %s IS NOT NULL
		 GROUP BY %s
		 ORDER BY cnt DESC
		 LIMIT 20`,
		quotedCol, quotedTable, sampleClause, quotedCol, quotedCol,
	)
	topRows, err := srcDB.QueryContext(ctx, topQuery)
	if err == nil {
		defer topRows.Close()
		var topValues []models.TopValueEntry
		for topRows.Next() {
			var tv models.TopValueEntry
			if err := topRows.Scan(&tv.Value, &tv.Count); err == nil {
				if rowCount > 0 {
					tv.Pct = float64(tv.Count) / float64(rowCount)
				}
				topValues = append(topValues, tv)
			}
		}
		if err := topRows.Err(); err != nil {
			slog.Warn("top values iteration error", "column", columnName, "error", err)
		}
		if len(topValues) > 0 {
			if b, err := json.Marshal(topValues); err == nil {
				stats.TopValues = b
			}
		}
	}

	// Sample values (10 random non-null).
	sampleQuery := fmt.Sprintf(
		`SELECT %s::TEXT FROM %s%s WHERE %s IS NOT NULL LIMIT 10`,
		quotedCol, quotedTable, sampleClause, quotedCol,
	)
	sampleRows, err := srcDB.QueryContext(ctx, sampleQuery)
	if err == nil {
		defer sampleRows.Close()
		var sampleValues []string
		for sampleRows.Next() {
			var v string
			if err := sampleRows.Scan(&v); err == nil {
				sampleValues = append(sampleValues, v)
			}
		}

		if err := sampleRows.Err(); err != nil {
			slog.Warn("sample values iteration error", "column", columnName, "error", err)
		}

		// Run pension pattern detection on sample values.
		if len(sampleValues) > 0 {
			if b, err := json.Marshal(sampleValues); err == nil {
				stats.SampleValues = b
			}

			// Pension pattern matching.
			patterns := profiler.MatchPensionPatterns(sampleValues)
			if len(patterns) > 0 {
				if b, err := json.Marshal(patterns); err == nil {
					stats.PatternFreqs = b
				}
			}
		}
	}

	return stats, nil
}

// quoteColName returns a safely quoted column name for the given driver.
// Uses the validated quoteIdentL1 from the L1 executor (same package).
func quoteColName(col, driver string) (string, error) {
	return quoteIdentL1("", col, driver)
}

// isNumericType returns true for SQL types that support AVG/STDDEV.
func isNumericType(dataType string) bool {
	switch dataType {
	case "integer", "int", "bigint", "smallint", "tinyint",
		"numeric", "decimal", "real", "float", "double precision",
		"money", "smallmoney",
		"int2", "int4", "int8", "float4", "float8":
		return true
	}
	return false
}
