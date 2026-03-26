package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"regexp"

	"github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
	"github.com/noui/platform/migration/profiler"
)

// L1Input is the JSON payload inside job.input_json for profile_l1 jobs.
type L1Input struct {
	ProfilingRunID string `json:"profiling_run_id"`
	EngagementID   string `json:"engagement_id"`
	SchemaName     string `json:"schema_name"`
	TableName      string `json:"table_name"`
	SourceDriver   string `json:"source_driver"`
}

// ProfileL1Executor discovers columns and row counts for a single source table.
// It reads table metadata from the source database and persists it to the
// migration database as source_table + source_column rows.
type ProfileL1Executor struct{}

// Execute implements the Executor interface for Level 1 profiling.
func (e *ProfileL1Executor) Execute(ctx context.Context, job *jobqueue.Job, q *jobqueue.Queue, migrationDB *sql.DB) error {
	if err := q.MarkRunning(ctx, job.JobID); err != nil {
		return fmt.Errorf("mark running: %w", err)
	}

	var input L1Input
	if err := json.Unmarshal(job.InputJSON, &input); err != nil {
		return fmt.Errorf("unmarshal L1 input: %w", err)
	}

	slog.Info("L1 executor: discovering columns",
		"table", input.TableName,
		"schema", input.SchemaName,
		"run_id", input.ProfilingRunID,
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

	// Get row count estimate (and optionally exact count for small tables).
	estimatedRows, isExact, err := e.getRowCount(ctx, srcDB, input)
	if err != nil {
		slog.Warn("row count failed, defaulting to 0", "error", err, "table", input.TableName)
		estimatedRows = 0
	}

	_ = q.UpdateProgress(ctx, job.JobID, 30)

	// Insert/update source_table record.
	tbl := &models.SourceTableProfile{
		ProfilingRunID: input.ProfilingRunID,
		SchemaName:     strPtr(input.SchemaName),
		TableName:      input.TableName,
		RowCount:       &estimatedRows,
		RowCountExact:  isExact,
		ProfileStatus:  models.TableProfilePending,
	}
	tableID, err := db.InsertSourceTable(migrationDB, tbl)
	if err != nil {
		return fmt.Errorf("insert source table: %w", err)
	}

	_ = q.UpdateProgress(ctx, job.JobID, 50)

	// Discover columns from information_schema.
	columns, err := e.discoverColumns(ctx, srcDB, input)
	if err != nil {
		return fmt.Errorf("discover columns: %w", err)
	}

	// Insert column records.
	for i, col := range columns {
		col.SourceTableID = tableID
		if _, err := db.InsertSourceColumn(migrationDB, &col); err != nil {
			return fmt.Errorf("insert column %s: %w", col.ColumnName, err)
		}
		progress := 50 + (50 * (i + 1) / max(len(columns), 1))
		_ = q.UpdateProgress(ctx, job.JobID, progress)
	}

	// Mark table as L1_DONE.
	if err := db.UpdateSourceTableStatus(migrationDB, tableID, models.TableProfileL1Done); err != nil {
		return fmt.Errorf("update table status: %w", err)
	}

	result, _ := json.Marshal(map[string]interface{}{
		"table_id":     tableID,
		"column_count": len(columns),
		"row_count":    estimatedRows,
		"exact":        isExact,
	})

	return q.Complete(ctx, job.JobID, result)
}

// getRowCount retrieves the row count for a table. Uses catalog estimate for
// large tables, exact COUNT(*) for small tables.
func (e *ProfileL1Executor) getRowCount(ctx context.Context, srcDB *sql.DB, input L1Input) (int64, bool, error) {
	// First get catalog estimate.
	var estimated int64
	estimateQuery, estimateArgs := profiler.RowCountEstimateQuery(input.SourceDriver, input.SchemaName, input.TableName)
	if estimateQuery != "" {
		if err := srcDB.QueryRowContext(ctx, estimateQuery, estimateArgs...).Scan(&estimated); err != nil {
			slog.Warn("catalog estimate failed", "error", err)
			estimated = 0
		}
	}

	// For small tables, do exact count.
	if profiler.ExactRowCountNeeded(estimated) {
		quotedTable, err := quoteIdentL1(input.SchemaName, input.TableName, input.SourceDriver)
		if err != nil {
			return estimated, false, nil
		}
		var exact int64
		q := fmt.Sprintf("SELECT COUNT(*) FROM %s", quotedTable)
		if err := srcDB.QueryRowContext(ctx, q).Scan(&exact); err != nil {
			return estimated, false, nil
		}
		return exact, true, nil
	}

	return estimated, false, nil
}

// discoverColumns reads column metadata from information_schema.
func (e *ProfileL1Executor) discoverColumns(ctx context.Context, srcDB *sql.DB, input L1Input) ([]models.SourceColumnProfile, error) {
	query := `SELECT
		c.column_name,
		c.ordinal_position,
		c.data_type,
		c.character_maximum_length,
		CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END AS is_nullable
	FROM information_schema.columns c
	WHERE c.table_name = $1`

	args := []interface{}{input.TableName}
	if input.SchemaName != "" {
		query += ` AND c.table_schema = $2`
		args = append(args, input.SchemaName)
	}
	query += ` ORDER BY c.ordinal_position`

	rows, err := srcDB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query columns: %w", err)
	}
	defer rows.Close()

	var columns []models.SourceColumnProfile
	for rows.Next() {
		var col models.SourceColumnProfile
		if err := rows.Scan(
			&col.ColumnName,
			&col.OrdinalPosition,
			&col.DataType,
			&col.MaxLength,
			&col.IsNullable,
		); err != nil {
			return nil, fmt.Errorf("scan column: %w", err)
		}
		columns = append(columns, col)
	}

	// Detect primary keys.
	pkCols, err := e.detectPrimaryKeys(ctx, srcDB, input)
	if err == nil {
		for i := range columns {
			if pkCols[columns[i].ColumnName] {
				columns[i].IsPrimaryKey = true
			}
		}
	}

	return columns, rows.Err()
}

// detectPrimaryKeys returns a set of column names that are part of the primary key.
func (e *ProfileL1Executor) detectPrimaryKeys(ctx context.Context, srcDB *sql.DB, input L1Input) (map[string]bool, error) {
	query := `SELECT kcu.column_name
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
			ON tc.constraint_name = kcu.constraint_name
			AND tc.table_schema = kcu.table_schema
		WHERE tc.constraint_type = 'PRIMARY KEY'
			AND tc.table_name = $1`

	args := []interface{}{input.TableName}
	if input.SchemaName != "" {
		query += ` AND tc.table_schema = $2`
		args = append(args, input.SchemaName)
	}

	rows, err := srcDB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]bool)
	for rows.Next() {
		var col string
		if err := rows.Scan(&col); err != nil {
			return nil, err
		}
		result[col] = true
	}
	return result, rows.Err()
}

// validSQLIdent matches safe SQL identifiers: letters, digits, underscores, dots.
var validSQLIdent = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// quoteIdentL1 constructs a quoted schema.table reference for a source query.
// Validates identifiers to prevent SQL injection.
func quoteIdentL1(schema, table, driver string) (string, error) {
	if table == "" {
		return "", fmt.Errorf("empty table name")
	}
	if !validSQLIdent.MatchString(table) {
		return "", fmt.Errorf("unsafe table name: %q", table)
	}
	if schema != "" && !validSQLIdent.MatchString(schema) {
		return "", fmt.Errorf("unsafe schema name: %q", schema)
	}
	switch driver {
	case "mssql":
		if schema != "" {
			return fmt.Sprintf("[%s].[%s]", schema, table), nil
		}
		return fmt.Sprintf("[%s]", table), nil
	default: // postgres
		if schema != "" {
			return fmt.Sprintf(`"%s"."%s"`, schema, table), nil
		}
		return fmt.Sprintf(`"%s"`, table), nil
	}
}

// strPtr returns a pointer to a string, or nil for empty strings.
func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
