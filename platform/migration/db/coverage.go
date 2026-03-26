package db

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// InsertCoverageReport inserts or replaces a coverage report for a profiling run + schema version.
// The UNIQUE(profiling_run_id, schema_version_id) constraint means re-running L4
// against the same version overwrites the previous report.
func InsertCoverageReport(db *sql.DB, report *models.CoverageReport) (string, error) {
	if db == nil {
		return "", fmt.Errorf("db is nil")
	}

	detailsJSON, err := json.Marshal(report.FieldDetails)
	if err != nil {
		return "", fmt.Errorf("marshal field_details: %w", err)
	}

	var id string
	err = db.QueryRow(
		`INSERT INTO migration.coverage_report
		 (profiling_run_id, schema_version_id, total_canonical_fields, mapped_fields,
		  unmapped_fields, coverage_pct, auto_mapped_count, review_required_count,
		  no_match_count, field_details)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 ON CONFLICT (profiling_run_id, schema_version_id) DO UPDATE
		 SET total_canonical_fields = EXCLUDED.total_canonical_fields,
		     mapped_fields = EXCLUDED.mapped_fields,
		     unmapped_fields = EXCLUDED.unmapped_fields,
		     coverage_pct = EXCLUDED.coverage_pct,
		     auto_mapped_count = EXCLUDED.auto_mapped_count,
		     review_required_count = EXCLUDED.review_required_count,
		     no_match_count = EXCLUDED.no_match_count,
		     field_details = EXCLUDED.field_details,
		     created_at = now()
		 RETURNING report_id`,
		report.ProfilingRunID, report.SchemaVersionID,
		report.TotalCanonicalFields, report.MappedFields,
		report.UnmappedFields, report.CoveragePct,
		report.AutoMappedCount, report.ReviewRequiredCount,
		report.NoMatchCount, detailsJSON,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("insert coverage report: %w", err)
	}
	return id, nil
}

// GetCoverageReport returns the coverage report for a profiling run.
// Returns nil, nil if no report exists.
func GetCoverageReport(db *sql.DB, runID string) (*models.CoverageReport, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}

	var r models.CoverageReport
	var detailsJSON []byte
	err := db.QueryRow(
		`SELECT report_id, profiling_run_id, schema_version_id,
		        total_canonical_fields, mapped_fields, unmapped_fields, coverage_pct,
		        auto_mapped_count, review_required_count, no_match_count,
		        field_details, created_at
		 FROM migration.coverage_report
		 WHERE profiling_run_id = $1
		 ORDER BY created_at DESC
		 LIMIT 1`, runID,
	).Scan(
		&r.ReportID, &r.ProfilingRunID, &r.SchemaVersionID,
		&r.TotalCanonicalFields, &r.MappedFields, &r.UnmappedFields, &r.CoveragePct,
		&r.AutoMappedCount, &r.ReviewRequiredCount, &r.NoMatchCount,
		&detailsJSON, &r.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get coverage report: %w", err)
	}

	if detailsJSON != nil {
		if err := json.Unmarshal(detailsJSON, &r.FieldDetails); err != nil {
			return nil, fmt.Errorf("unmarshal field_details: %w", err)
		}
	}
	if r.FieldDetails == nil {
		r.FieldDetails = []models.CoverageFieldDetail{}
	}

	return &r, nil
}

// UpdateProfilingRunCoverageAggregates updates the aggregate coverage columns on profiling_run.
func UpdateProfilingRunCoverageAggregates(db *sql.DB, runID string, totalCanonical, autoMapped, reviewRequired, unmapped int, coveragePct float64) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	_, err := db.Exec(
		`UPDATE migration.profiling_run
		 SET total_canonical_fields = $2,
		     auto_mapped_count = $3,
		     review_required_count = $4,
		     unmapped_count = $5,
		     overall_coverage_pct = $6
		 WHERE id = $1`,
		runID, totalCanonical, autoMapped, reviewRequired, unmapped, coveragePct,
	)
	if err != nil {
		return fmt.Errorf("update profiling run coverage aggregates: %w", err)
	}
	return nil
}

// GetExistingFieldMappingsForEngagement returns mapped source column keys ("table.column")
// for an engagement that have been approved. Used by L4 to detect MAPPED status.
func GetExistingFieldMappingsForEngagement(db *sql.DB, engagementID string) (map[string]string, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	rows, err := db.Query(
		`SELECT canonical_table, canonical_column, source_table, source_column
		 FROM migration.field_mapping
		 WHERE engagement_id = $1 AND approval_status = 'APPROVED'`,
		engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("get field mappings: %w", err)
	}
	defer rows.Close()

	// Key: "entity.field_name" → "source_table.source_column"
	result := make(map[string]string)
	for rows.Next() {
		var canonTable, canonCol, srcTable, srcCol string
		if err := rows.Scan(&canonTable, &canonCol, &srcTable, &srcCol); err != nil {
			return nil, fmt.Errorf("scan field mapping: %w", err)
		}
		key := canonTable + "." + canonCol
		result[key] = srcTable + "." + srcCol
	}
	return result, rows.Err()
}

// GetEngagementIDForProfilingRun returns the engagement_id for a profiling run.
func GetEngagementIDForProfilingRun(db *sql.DB, runID string) (string, error) {
	if db == nil {
		return "", fmt.Errorf("db is nil")
	}
	var engID string
	err := db.QueryRow(
		`SELECT engagement_id FROM migration.profiling_run WHERE id = $1`, runID,
	).Scan(&engID)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("profiling run not found: %s", runID)
	}
	if err != nil {
		return "", fmt.Errorf("get engagement for run: %w", err)
	}
	return engID, nil
}

// GetTenantIDForEngagement returns the tenant_id for an engagement.
func GetTenantIDForEngagement(db *sql.DB, engagementID string) (string, error) {
	if db == nil {
		return "", fmt.Errorf("db is nil")
	}
	var tenantID string
	err := db.QueryRow(
		`SELECT tenant_id FROM migration.engagement WHERE engagement_id = $1`, engagementID,
	).Scan(&tenantID)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("engagement not found: %s", engagementID)
	}
	if err != nil {
		return "", fmt.Errorf("get tenant for engagement: %w", err)
	}
	return tenantID, nil
}

// ListSourceColumnsByRunWithTable returns all columns across all tables in a profiling run,
// including the parent table_name for coverage matching.
type SourceColumnWithTable struct {
	models.SourceColumnProfile
	TableName string `json:"table_name"`
}

// ListSourceColumnsWithTableByRun returns source columns with their parent table names.
func ListSourceColumnsWithTableByRun(db *sql.DB, runID string) ([]SourceColumnWithTable, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	rows, err := db.Query(
		`SELECT sc.id, sc.source_table_id, sc.column_name, sc.ordinal_position, sc.data_type, sc.max_length,
		        sc.is_nullable, sc.is_primary_key, sc.is_unique,
		        sc.row_count, sc.null_count, sc.null_pct, sc.distinct_count, sc.distinct_pct,
		        sc.min_value, sc.max_value, sc.mean_value, sc.stddev_value,
		        sc.top_values, sc.pattern_frequencies, sc.sample_values, sc.sample_size, sc.is_sampled,
		        st.table_name
		 FROM migration.source_column sc
		 JOIN migration.source_table st ON st.id = sc.source_table_id
		 WHERE st.profiling_run_id = $1
		 ORDER BY st.table_name, sc.ordinal_position`, runID,
	)
	if err != nil {
		return nil, fmt.Errorf("list source columns with table by run: %w", err)
	}
	defer rows.Close()

	var cols []SourceColumnWithTable
	for rows.Next() {
		var c SourceColumnWithTable
		var topVal, patternFreq, sampleVal []byte
		err := rows.Scan(
			&c.ID, &c.SourceTableID, &c.ColumnName, &c.OrdinalPosition, &c.DataType, &c.MaxLength,
			&c.IsNullable, &c.IsPrimaryKey, &c.IsUnique,
			&c.RowCount, &c.NullCount, &c.NullPct, &c.DistinctCount, &c.DistinctPct,
			&c.MinValue, &c.MaxValue, &c.MeanValue, &c.StddevValue,
			&topVal, &patternFreq, &sampleVal, &c.SampleSize, &c.IsSampled,
			&c.TableName,
		)
		if err != nil {
			return nil, fmt.Errorf("scan source column with table: %w", err)
		}
		c.TopValues = topVal
		c.PatternFreqs = patternFreq
		c.SampleValues = sampleVal
		cols = append(cols, c)
	}
	return cols, rows.Err()
}
