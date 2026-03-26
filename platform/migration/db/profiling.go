package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/noui/platform/migration/models"
)

// CreateProfilingRun inserts a new profiling run and returns its ID.
func CreateProfilingRun(db *sql.DB, engagementID, sourcePlatform, initiatedBy string) (string, error) {
	if db == nil {
		return "", fmt.Errorf("db is nil")
	}
	var id string
	err := db.QueryRow(
		`INSERT INTO migration.profiling_run (engagement_id, source_platform, initiated_by)
		 VALUES ($1, $2, $3)
		 RETURNING id`,
		engagementID, sourcePlatform, initiatedBy,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create profiling run: %w", err)
	}
	return id, nil
}

// GetProfilingRun returns a single profiling run by ID.
func GetProfilingRun(db *sql.DB, runID string) (*models.ProfilingRun, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	r := &models.ProfilingRun{}
	err := db.QueryRow(
		`SELECT id, engagement_id, source_platform, initiated_by, status,
		        level_reached, total_source_columns, total_canonical_fields,
		        auto_mapped_count, review_required_count, unmapped_count,
		        overall_coverage_pct, rule_signals_found, readiness_assessment,
		        error_message, initiated_at, completed_at
		 FROM migration.profiling_run WHERE id = $1`, runID,
	).Scan(
		&r.ID, &r.EngagementID, &r.SourcePlatform, &r.InitiatedBy, &r.Status,
		&r.LevelReached, &r.TotalSourceColumns, &r.TotalCanonicalFields,
		&r.AutoMappedCount, &r.ReviewRequiredCount, &r.UnmappedCount,
		&r.OverallCoveragePct, &r.RuleSignalsFound, &r.ReadinessAssessment,
		&r.ErrorMessage, &r.InitiatedAt, &r.CompletedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get profiling run: %w", err)
	}
	return r, nil
}

// ListProfilingRuns returns all profiling runs for an engagement.
func ListProfilingRuns(db *sql.DB, engagementID string) ([]models.ProfilingRun, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	rows, err := db.Query(
		`SELECT id, engagement_id, source_platform, initiated_by, status,
		        level_reached, total_source_columns, total_canonical_fields,
		        auto_mapped_count, review_required_count, unmapped_count,
		        overall_coverage_pct, rule_signals_found, readiness_assessment,
		        error_message, initiated_at, completed_at
		 FROM migration.profiling_run
		 WHERE engagement_id = $1
		 ORDER BY initiated_at DESC`, engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("list profiling runs: %w", err)
	}
	defer rows.Close()

	var runs []models.ProfilingRun
	for rows.Next() {
		var r models.ProfilingRun
		if err := rows.Scan(
			&r.ID, &r.EngagementID, &r.SourcePlatform, &r.InitiatedBy, &r.Status,
			&r.LevelReached, &r.TotalSourceColumns, &r.TotalCanonicalFields,
			&r.AutoMappedCount, &r.ReviewRequiredCount, &r.UnmappedCount,
			&r.OverallCoveragePct, &r.RuleSignalsFound, &r.ReadinessAssessment,
			&r.ErrorMessage, &r.InitiatedAt, &r.CompletedAt,
		); err != nil {
			return nil, fmt.Errorf("scan profiling run: %w", err)
		}
		runs = append(runs, r)
	}
	return runs, rows.Err()
}

// UpdateProfilingRunStatus updates the status and optionally the level_reached/error.
func UpdateProfilingRunStatus(db *sql.DB, runID string, status models.ProfilingRunStatus, levelReached *int, errMsg *string) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	_, err := db.Exec(
		`UPDATE migration.profiling_run
		 SET status = $2, level_reached = COALESCE($3, level_reached),
		     error_message = COALESCE($4, error_message),
		     completed_at = CASE WHEN $2 IN ('FAILED', 'COVERAGE_REPORT_READY', 'MAPPER_PRE_POPULATED', 'RULES_ENGINEER_REVIEW') THEN now() ELSE completed_at END
		 WHERE id = $1`,
		runID, string(status), levelReached, errMsg,
	)
	if err != nil {
		return fmt.Errorf("update profiling run status: %w", err)
	}
	return nil
}

// InsertSourceTable inserts a source_table row (Level 1) and returns the ID.
func InsertSourceTable(db *sql.DB, t *models.SourceTableProfile) (string, error) {
	if db == nil {
		return "", fmt.Errorf("db is nil")
	}
	var id string
	err := db.QueryRow(
		`INSERT INTO migration.source_table
		 (profiling_run_id, schema_name, table_name, row_count, row_count_exact,
		  entity_class, class_confidence, is_likely_lookup, is_likely_archive, profile_status, notes)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		 ON CONFLICT (profiling_run_id, schema_name, table_name) DO UPDATE
		 SET row_count = EXCLUDED.row_count, row_count_exact = EXCLUDED.row_count_exact,
		     entity_class = EXCLUDED.entity_class, class_confidence = EXCLUDED.class_confidence,
		     is_likely_lookup = EXCLUDED.is_likely_lookup, is_likely_archive = EXCLUDED.is_likely_archive,
		     profile_status = EXCLUDED.profile_status, notes = EXCLUDED.notes
		 RETURNING id`,
		t.ProfilingRunID, t.SchemaName, t.TableName, t.RowCount, t.RowCountExact,
		t.EntityClass, t.ClassConfidence, t.IsLikelyLookup, t.IsLikelyArchive,
		string(t.ProfileStatus), t.Notes,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("insert source table: %w", err)
	}
	return id, nil
}

// UpdateSourceTableStatus updates the profile_status of a source table.
func UpdateSourceTableStatus(db *sql.DB, tableID string, status models.TableProfileStatus) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	_, err := db.Exec(
		`UPDATE migration.source_table SET profile_status = $2 WHERE id = $1`,
		tableID, string(status),
	)
	if err != nil {
		return fmt.Errorf("update source table status: %w", err)
	}
	return nil
}

// ListSourceTables returns all source tables for a profiling run.
func ListSourceTables(db *sql.DB, runID string) ([]models.SourceTableProfile, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	rows, err := db.Query(
		`SELECT id, profiling_run_id, schema_name, table_name, row_count, row_count_exact,
		        entity_class, class_confidence, is_likely_lookup, is_likely_archive,
		        profile_status, notes
		 FROM migration.source_table
		 WHERE profiling_run_id = $1
		 ORDER BY table_name`, runID,
	)
	if err != nil {
		return nil, fmt.Errorf("list source tables: %w", err)
	}
	defer rows.Close()

	var tables []models.SourceTableProfile
	for rows.Next() {
		var t models.SourceTableProfile
		if err := rows.Scan(
			&t.ID, &t.ProfilingRunID, &t.SchemaName, &t.TableName, &t.RowCount, &t.RowCountExact,
			&t.EntityClass, &t.ClassConfidence, &t.IsLikelyLookup, &t.IsLikelyArchive,
			&t.ProfileStatus, &t.Notes,
		); err != nil {
			return nil, fmt.Errorf("scan source table: %w", err)
		}
		tables = append(tables, t)
	}
	return tables, rows.Err()
}

// InsertSourceColumn inserts a source_column row (Level 1 metadata) and returns the ID.
func InsertSourceColumn(db *sql.DB, c *models.SourceColumnProfile) (string, error) {
	if db == nil {
		return "", fmt.Errorf("db is nil")
	}
	topValJSON := nullableJSON(c.TopValues)
	patternJSON := nullableJSON(c.PatternFreqs)
	sampleJSON := nullableJSON(c.SampleValues)

	var id string
	err := db.QueryRow(
		`INSERT INTO migration.source_column
		 (source_table_id, column_name, ordinal_position, data_type, max_length,
		  is_nullable, is_primary_key, is_unique,
		  row_count, null_count, null_pct, distinct_count, distinct_pct,
		  min_value, max_value, mean_value, stddev_value,
		  top_values, pattern_frequencies, sample_values, sample_size, is_sampled)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
		 ON CONFLICT (source_table_id, column_name) DO UPDATE
		 SET ordinal_position = EXCLUDED.ordinal_position, data_type = EXCLUDED.data_type,
		     max_length = EXCLUDED.max_length, is_nullable = EXCLUDED.is_nullable,
		     is_primary_key = EXCLUDED.is_primary_key, is_unique = EXCLUDED.is_unique,
		     row_count = EXCLUDED.row_count, null_count = EXCLUDED.null_count,
		     null_pct = EXCLUDED.null_pct, distinct_count = EXCLUDED.distinct_count,
		     distinct_pct = EXCLUDED.distinct_pct, min_value = EXCLUDED.min_value,
		     max_value = EXCLUDED.max_value, mean_value = EXCLUDED.mean_value,
		     stddev_value = EXCLUDED.stddev_value, top_values = EXCLUDED.top_values,
		     pattern_frequencies = EXCLUDED.pattern_frequencies,
		     sample_values = EXCLUDED.sample_values, sample_size = EXCLUDED.sample_size,
		     is_sampled = EXCLUDED.is_sampled
		 RETURNING id`,
		c.SourceTableID, c.ColumnName, c.OrdinalPosition, c.DataType, c.MaxLength,
		c.IsNullable, c.IsPrimaryKey, c.IsUnique,
		c.RowCount, c.NullCount, c.NullPct, c.DistinctCount, c.DistinctPct,
		c.MinValue, c.MaxValue, c.MeanValue, c.StddevValue,
		topValJSON, patternJSON, sampleJSON, c.SampleSize, c.IsSampled,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("insert source column: %w", err)
	}
	return id, nil
}

// UpdateSourceColumnStats updates the Level 2 statistics for a source column.
func UpdateSourceColumnStats(db *sql.DB, colID string, c *models.SourceColumnProfile) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	topValJSON := nullableJSON(c.TopValues)
	patternJSON := nullableJSON(c.PatternFreqs)
	sampleJSON := nullableJSON(c.SampleValues)

	_, err := db.Exec(
		`UPDATE migration.source_column SET
		  row_count=$2, null_count=$3, null_pct=$4, distinct_count=$5, distinct_pct=$6,
		  min_value=$7, max_value=$8, mean_value=$9, stddev_value=$10,
		  top_values=$11, pattern_frequencies=$12, sample_values=$13, sample_size=$14, is_sampled=$15
		 WHERE id=$1`,
		colID,
		c.RowCount, c.NullCount, c.NullPct, c.DistinctCount, c.DistinctPct,
		c.MinValue, c.MaxValue, c.MeanValue, c.StddevValue,
		topValJSON, patternJSON, sampleJSON, c.SampleSize, c.IsSampled,
	)
	if err != nil {
		return fmt.Errorf("update source column stats: %w", err)
	}
	return nil
}

// ListSourceColumns returns all source columns for a given source table.
func ListSourceColumns(db *sql.DB, tableID string) ([]models.SourceColumnProfile, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	rows, err := db.Query(
		`SELECT id, source_table_id, column_name, ordinal_position, data_type, max_length,
		        is_nullable, is_primary_key, is_unique,
		        row_count, null_count, null_pct, distinct_count, distinct_pct,
		        min_value, max_value, mean_value, stddev_value,
		        top_values, pattern_frequencies, sample_values, sample_size, is_sampled
		 FROM migration.source_column
		 WHERE source_table_id = $1
		 ORDER BY ordinal_position`, tableID,
	)
	if err != nil {
		return nil, fmt.Errorf("list source columns: %w", err)
	}
	defer rows.Close()

	var cols []models.SourceColumnProfile
	for rows.Next() {
		var c models.SourceColumnProfile
		var topVal, patternFreq, sampleVal []byte
		if err := rows.Scan(
			&c.ID, &c.SourceTableID, &c.ColumnName, &c.OrdinalPosition, &c.DataType, &c.MaxLength,
			&c.IsNullable, &c.IsPrimaryKey, &c.IsUnique,
			&c.RowCount, &c.NullCount, &c.NullPct, &c.DistinctCount, &c.DistinctPct,
			&c.MinValue, &c.MaxValue, &c.MeanValue, &c.StddevValue,
			&topVal, &patternFreq, &sampleVal, &c.SampleSize, &c.IsSampled,
		); err != nil {
			return nil, fmt.Errorf("scan source column: %w", err)
		}
		c.TopValues = json.RawMessage(topVal)
		c.PatternFreqs = json.RawMessage(patternFreq)
		c.SampleValues = json.RawMessage(sampleVal)
		cols = append(cols, c)
	}
	return cols, rows.Err()
}

// ListSourceColumnsByRun returns all columns across all tables in a profiling run.
func ListSourceColumnsByRun(db *sql.DB, runID string) ([]models.SourceColumnProfile, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	rows, err := db.Query(
		`SELECT sc.id, sc.source_table_id, sc.column_name, sc.ordinal_position, sc.data_type, sc.max_length,
		        sc.is_nullable, sc.is_primary_key, sc.is_unique,
		        sc.row_count, sc.null_count, sc.null_pct, sc.distinct_count, sc.distinct_pct,
		        sc.min_value, sc.max_value, sc.mean_value, sc.stddev_value,
		        sc.top_values, sc.pattern_frequencies, sc.sample_values, sc.sample_size, sc.is_sampled
		 FROM migration.source_column sc
		 JOIN migration.source_table st ON st.id = sc.source_table_id
		 WHERE st.profiling_run_id = $1
		 ORDER BY st.table_name, sc.ordinal_position`, runID,
	)
	if err != nil {
		return nil, fmt.Errorf("list source columns by run: %w", err)
	}
	defer rows.Close()

	var cols []models.SourceColumnProfile
	for rows.Next() {
		var c models.SourceColumnProfile
		var topVal, patternFreq, sampleVal []byte
		if err := rows.Scan(
			&c.ID, &c.SourceTableID, &c.ColumnName, &c.OrdinalPosition, &c.DataType, &c.MaxLength,
			&c.IsNullable, &c.IsPrimaryKey, &c.IsUnique,
			&c.RowCount, &c.NullCount, &c.NullPct, &c.DistinctCount, &c.DistinctPct,
			&c.MinValue, &c.MaxValue, &c.MeanValue, &c.StddevValue,
			&topVal, &patternFreq, &sampleVal, &c.SampleSize, &c.IsSampled,
		); err != nil {
			return nil, fmt.Errorf("scan source column: %w", err)
		}
		c.TopValues = json.RawMessage(topVal)
		c.PatternFreqs = json.RawMessage(patternFreq)
		c.SampleValues = json.RawMessage(sampleVal)
		cols = append(cols, c)
	}
	return cols, rows.Err()
}

// nullableJSON returns nil if the raw message is nil/empty, otherwise returns the bytes.
func nullableJSON(raw json.RawMessage) []byte {
	if len(raw) == 0 {
		return nil
	}
	return []byte(raw)
}

// --- Helper: get engagement source connection for executor use ---

// GetEngagementSourceConnection returns the source_connection for an engagement.
func GetEngagementSourceConnection(database *sql.DB, engagementID string) (*models.SourceConnection, error) {
	if database == nil {
		return nil, fmt.Errorf("db is nil")
	}
	var connJSON []byte
	err := database.QueryRow(
		`SELECT source_connection FROM migration.engagement WHERE engagement_id = $1`,
		engagementID,
	).Scan(&connJSON)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("engagement not found: %s", engagementID)
	}
	if err != nil {
		return nil, fmt.Errorf("get source connection: %w", err)
	}
	if connJSON == nil {
		return nil, fmt.Errorf("no source connection configured for engagement %s", engagementID)
	}
	var conn models.SourceConnection
	if err := json.Unmarshal(connJSON, &conn); err != nil {
		return nil, fmt.Errorf("unmarshal source connection: %w", err)
	}
	return &conn, nil
}

// CountSourceTablesByStatus counts source tables with a given status in a run.
func CountSourceTablesByStatus(database *sql.DB, runID string, status models.TableProfileStatus) (int, error) {
	if database == nil {
		return 0, fmt.Errorf("db is nil")
	}
	var count int
	err := database.QueryRow(
		`SELECT COUNT(*) FROM migration.source_table WHERE profiling_run_id = $1 AND profile_status = $2`,
		runID, string(status),
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count source tables by status: %w", err)
	}
	return count, nil
}

// CountSourceTables counts total source tables in a run.
func CountSourceTables(database *sql.DB, runID string) (int, error) {
	if database == nil {
		return 0, fmt.Errorf("db is nil")
	}
	var count int
	err := database.QueryRow(
		`SELECT COUNT(*) FROM migration.source_table WHERE profiling_run_id = $1`,
		runID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count source tables: %w", err)
	}
	return count, nil
}

// GetSourceTable returns a source table by ID.
func GetSourceTable(database *sql.DB, tableID string) (*models.SourceTableProfile, error) {
	if database == nil {
		return nil, fmt.Errorf("db is nil")
	}
	t := &models.SourceTableProfile{}
	err := database.QueryRow(
		`SELECT id, profiling_run_id, schema_name, table_name, row_count, row_count_exact,
		        entity_class, class_confidence, is_likely_lookup, is_likely_archive,
		        profile_status, notes
		 FROM migration.source_table WHERE id = $1`, tableID,
	).Scan(
		&t.ID, &t.ProfilingRunID, &t.SchemaName, &t.TableName, &t.RowCount, &t.RowCountExact,
		&t.EntityClass, &t.ClassConfidence, &t.IsLikelyLookup, &t.IsLikelyArchive,
		&t.ProfileStatus, &t.Notes,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get source table: %w", err)
	}
	return t, nil
}

// Ensure unused import warning doesn't trigger.
var _ = time.Now
