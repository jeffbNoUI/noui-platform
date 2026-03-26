package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/noui/platform/migration/models"
)

// driftRunColumns is the standard column list for drift_detection_run queries.
const driftRunColumns = `run_id, engagement_id, status, drift_type, baseline_snapshot_id,
	detected_changes, critical_changes, started_at, completed_at, error_message, created_at`

// scanDriftRun scans a drift_detection_run row.
func scanDriftRun(scanner interface{ Scan(...any) error }) (*models.DriftDetectionRun, error) {
	var r models.DriftDetectionRun
	var baselineID sql.NullString
	err := scanner.Scan(
		&r.RunID, &r.EngagementID, &r.Status, &r.DriftType, &baselineID,
		&r.DetectedChanges, &r.CriticalChanges, &r.StartedAt, &r.CompletedAt,
		&r.ErrorMessage, &r.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if baselineID.Valid {
		r.BaselineSnapshotID = baselineID.String
	}
	return &r, nil
}

// driftRecordColumns is the standard column list for drift_record queries.
const driftRecordColumns = `record_id, run_id, change_type, entity, detail, severity, affects_mapping, created_at`

// scanDriftRecord scans a drift_record row.
func scanDriftRecord(scanner interface{ Scan(...any) error }) (*models.DriftRecord, error) {
	var r models.DriftRecord
	var detailRaw []byte
	err := scanner.Scan(
		&r.RecordID, &r.RunID, &r.ChangeType, &r.Entity,
		&detailRaw, &r.Severity, &r.AffectsMapping, &r.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	r.Detail = json.RawMessage(detailRaw)
	return &r, nil
}

// CreateDriftDetectionRun inserts a new drift detection run in PENDING status.
func CreateDriftDetectionRun(db *sql.DB, engagementID string, driftType models.DriftType, baselineSnapshotID string) (*models.DriftDetectionRun, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	var baselineArg interface{}
	if baselineSnapshotID != "" {
		baselineArg = baselineSnapshotID
	}
	row := db.QueryRow(
		`INSERT INTO migration.drift_detection_run (engagement_id, drift_type, baseline_snapshot_id)
		 VALUES ($1, $2, $3)
		 RETURNING `+driftRunColumns,
		engagementID, string(driftType), baselineArg,
	)
	return scanDriftRun(row)
}

// GetDriftDetectionRun returns a single drift detection run by ID, or nil if not found.
func GetDriftDetectionRun(db *sql.DB, runID string) (*models.DriftDetectionRun, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	row := db.QueryRow(
		`SELECT `+driftRunColumns+`
		 FROM migration.drift_detection_run
		 WHERE run_id = $1`,
		runID,
	)
	r, err := scanDriftRun(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get drift run: %w", err)
	}
	return r, nil
}

// ListDriftDetectionRuns returns paginated drift detection runs for an engagement, newest first.
func ListDriftDetectionRuns(db *sql.DB, engagementID string, page, perPage int) ([]models.DriftDetectionRun, int, error) {
	if db == nil {
		return nil, 0, fmt.Errorf("db is nil")
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	var total int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM migration.drift_detection_run WHERE engagement_id = $1`,
		engagementID,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count drift runs: %w", err)
	}

	offset := (page - 1) * perPage
	rows, err := db.Query(
		`SELECT `+driftRunColumns+`
		 FROM migration.drift_detection_run
		 WHERE engagement_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2 OFFSET $3`,
		engagementID, perPage, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("list drift runs: %w", err)
	}
	defer rows.Close()

	var runs []models.DriftDetectionRun
	for rows.Next() {
		r, err := scanDriftRun(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan drift run: %w", err)
		}
		runs = append(runs, *r)
	}
	if runs == nil {
		runs = []models.DriftDetectionRun{}
	}
	return runs, total, rows.Err()
}

// UpdateDriftRunStatus updates a drift detection run's status and optional timestamps/error.
func UpdateDriftRunStatus(db *sql.DB, runID string, status models.DriftDetectionRunStatus, errorMsg *string) (*models.DriftDetectionRun, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	var startedAt, completedAt *time.Time
	now := time.Now()
	switch status {
	case models.DriftRunRunning:
		startedAt = &now
	case models.DriftRunCompleted, models.DriftRunFailed:
		completedAt = &now
	}

	row := db.QueryRow(
		`UPDATE migration.drift_detection_run
		 SET status = $2,
		     started_at = COALESCE($3, started_at),
		     completed_at = COALESCE($4, completed_at),
		     error_message = COALESCE($5, error_message)
		 WHERE run_id = $1
		 RETURNING `+driftRunColumns,
		runID, string(status), startedAt, completedAt, errorMsg,
	)
	r, err := scanDriftRun(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("update drift run status: %w", err)
	}
	return r, nil
}

// UpdateDriftRunCounts updates the detected_changes and critical_changes on a run.
func UpdateDriftRunCounts(db *sql.DB, runID string, detected, critical int) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	_, err := db.Exec(
		`UPDATE migration.drift_detection_run
		 SET detected_changes = $2, critical_changes = $3
		 WHERE run_id = $1`,
		runID, detected, critical,
	)
	if err != nil {
		return fmt.Errorf("update drift run counts: %w", err)
	}
	return nil
}

// InsertDriftRecords batch-inserts drift records for a run.
func InsertDriftRecords(db *sql.DB, records []models.DriftRecord) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	if len(records) == 0 {
		return nil
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(
		`INSERT INTO migration.drift_record (run_id, change_type, entity, detail, severity, affects_mapping)
		 VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
	)
	if err != nil {
		return fmt.Errorf("prepare insert: %w", err)
	}
	defer stmt.Close()

	for _, r := range records {
		detail := string(r.Detail)
		if detail == "" {
			detail = "{}"
		}
		_, err := stmt.Exec(r.RunID, string(r.ChangeType), r.Entity, detail, string(r.Severity), r.AffectsMapping)
		if err != nil {
			return fmt.Errorf("insert drift record: %w", err)
		}
	}

	return tx.Commit()
}

// GetDriftRecordsForRun returns all drift records for a run, optionally filtered by severity.
func GetDriftRecordsForRun(db *sql.DB, runID string, severity *string, page, perPage int) ([]models.DriftRecord, int, error) {
	if db == nil {
		return nil, 0, fmt.Errorf("db is nil")
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	// Count query.
	countQuery := `SELECT COUNT(*) FROM migration.drift_record WHERE run_id = $1`
	args := []interface{}{runID}
	if severity != nil && *severity != "" {
		countQuery += ` AND severity = $2`
		args = append(args, *severity)
	}

	var total int
	if err := db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count drift records: %w", err)
	}

	// Data query.
	offset := (page - 1) * perPage
	dataQuery := `SELECT ` + driftRecordColumns + `
		FROM migration.drift_record WHERE run_id = $1`
	dataArgs := []interface{}{runID}
	nextParam := 2
	if severity != nil && *severity != "" {
		dataQuery += fmt.Sprintf(` AND severity = $%d`, nextParam)
		dataArgs = append(dataArgs, *severity)
		nextParam++
	}
	dataQuery += fmt.Sprintf(` ORDER BY CASE severity
		WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 END,
		created_at DESC LIMIT $%d OFFSET $%d`, nextParam, nextParam+1)
	dataArgs = append(dataArgs, perPage, offset)

	rows, err := db.Query(dataQuery, dataArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list drift records: %w", err)
	}
	defer rows.Close()

	var records []models.DriftRecord
	for rows.Next() {
		r, err := scanDriftRecord(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan drift record: %w", err)
		}
		records = append(records, *r)
	}
	if records == nil {
		records = []models.DriftRecord{}
	}
	return records, total, rows.Err()
}

// GetActiveSchemaVersionID returns the version_id of the active schema_version for a tenant.
func GetActiveSchemaVersionID(db *sql.DB, tenantID string) (string, error) {
	if db == nil {
		return "", fmt.Errorf("db is nil")
	}
	var versionID string
	err := db.QueryRow(
		`SELECT version_id FROM migration.schema_version
		 WHERE tenant_id = $1 AND is_active = true`,
		tenantID,
	).Scan(&versionID)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("no active schema version for tenant %s", tenantID)
	}
	if err != nil {
		return "", fmt.Errorf("get active schema version: %w", err)
	}
	return versionID, nil
}

// GetBaselineFields returns all fields for a schema version as a map keyed by entity.column_name.
func GetBaselineFields(db *sql.DB, versionID string) ([]models.SchemaVersionField, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	return listFieldsForVersion(db, versionID)
}

// GetMappedColumns returns a set of source columns (as "table.column") that are
// referenced in field_mapping for the given engagement, along with their approval status.
type MappedColumn struct {
	SourceTable    string
	SourceColumn   string
	ApprovalStatus string
}

// GetMappedColumnsForEngagement returns all mapped source columns for an engagement.
func GetMappedColumnsForEngagement(db *sql.DB, engagementID string) ([]MappedColumn, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	rows, err := db.Query(
		`SELECT source_table, source_column, approval_status
		 FROM migration.field_mapping
		 WHERE engagement_id = $1`,
		engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("get mapped columns: %w", err)
	}
	defer rows.Close()

	var mappings []MappedColumn
	for rows.Next() {
		var m MappedColumn
		if err := rows.Scan(&m.SourceTable, &m.SourceColumn, &m.ApprovalStatus); err != nil {
			return nil, fmt.Errorf("scan mapped column: %w", err)
		}
		mappings = append(mappings, m)
	}
	return mappings, rows.Err()
}

// GetSourceTablesForEngagement returns all source tables from the latest profiling run.
func GetSourceTablesForEngagement(db *sql.DB, engagementID string) ([]models.SourceTableProfile, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	rows, err := db.Query(
		`SELECT st.id, st.profiling_run_id, st.schema_name, st.table_name,
		        st.row_count, st.row_count_exact, st.entity_class, st.class_confidence,
		        st.is_likely_lookup, st.is_likely_archive, st.profile_status, st.notes
		 FROM migration.source_table st
		 JOIN migration.profiling_run pr ON st.profiling_run_id = pr.id
		 WHERE pr.engagement_id = $1
		 ORDER BY pr.initiated_at DESC, st.table_name`,
		engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("get source tables: %w", err)
	}
	defer rows.Close()

	var tables []models.SourceTableProfile
	for rows.Next() {
		var t models.SourceTableProfile
		if err := rows.Scan(
			&t.ID, &t.ProfilingRunID, &t.SchemaName, &t.TableName,
			&t.RowCount, &t.RowCountExact, &t.EntityClass, &t.ClassConfidence,
			&t.IsLikelyLookup, &t.IsLikelyArchive, &t.ProfileStatus, &t.Notes,
		); err != nil {
			return nil, fmt.Errorf("scan source table: %w", err)
		}
		tables = append(tables, t)
	}
	return tables, rows.Err()
}

// InsertDriftAttentionItem creates an attention item for critical drift detection.
// Attention items are synthesized from UNION queries in attention.go, but drift
// items are inserted as risk records with a specific source marker.
func InsertDriftAttentionItem(db *sql.DB, engagementID, summary, detail string) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	_, err := db.Exec(
		`INSERT INTO migration.risk (engagement_id, tenant_id, source, severity, description, evidence, status)
		 SELECT $1, e.tenant_id, 'DRIFT', 'P1', $2, $3, 'OPEN'
		 FROM migration.engagement e
		 WHERE e.engagement_id = $1`,
		engagementID, summary, detail,
	)
	if err != nil {
		return fmt.Errorf("insert drift attention item: %w", err)
	}
	return nil
}
