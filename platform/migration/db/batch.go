package db

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// batchColumns is the standard column list for batch queries.
const batchColumns = `batch_id, engagement_id, batch_scope, status, mapping_version,
		row_count_source, row_count_loaded, row_count_exception, error_rate,
		halted_reason, checkpoint_key, started_at, completed_at`

// scanBatch scans a single batch row into a MigrationBatch struct.
func scanBatch(scanner interface{ Scan(...any) error }) (*models.MigrationBatch, error) {
	var b models.MigrationBatch
	err := scanner.Scan(
		&b.BatchID, &b.EngagementID, &b.BatchScope, &b.Status, &b.MappingVersion,
		&b.RowCountSource, &b.RowCountLoaded, &b.RowCountException, &b.ErrorRate,
		&b.HaltedReason, &b.CheckpointKey, &b.StartedAt, &b.CompletedAt,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// ListBatches returns all batches for an engagement, ordered by started_at descending.
func ListBatches(db *sql.DB, engagementID string) ([]models.MigrationBatch, error) {
	rows, err := db.Query(
		`SELECT `+batchColumns+`
		 FROM migration.batch
		 WHERE engagement_id = $1
		 ORDER BY started_at DESC NULLS LAST`,
		engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("list batches: %w", err)
	}
	defer rows.Close()

	var batches []models.MigrationBatch
	for rows.Next() {
		b, err := scanBatch(rows)
		if err != nil {
			return nil, fmt.Errorf("scan batch: %w", err)
		}
		batches = append(batches, *b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list batches rows: %w", err)
	}
	return batches, nil
}

// GetBatch retrieves a single batch by its ID. Returns nil if not found.
func GetBatch(db *sql.DB, batchID string) (*models.MigrationBatch, error) {
	row := db.QueryRow(
		`SELECT `+batchColumns+`
		 FROM migration.batch
		 WHERE batch_id = $1`,
		batchID,
	)
	b, err := scanBatch(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get batch: %w", err)
	}
	return b, nil
}

// CreateBatch inserts a new transformation batch and returns the created record.
func CreateBatch(db *sql.DB, engagementID, batchScope, mappingVersion string) (*models.MigrationBatch, error) {
	row := db.QueryRow(
		`INSERT INTO migration.batch (engagement_id, batch_scope, mapping_version)
		 VALUES ($1, $2, $3)
		 RETURNING `+batchColumns,
		engagementID, batchScope, mappingVersion,
	)
	b, err := scanBatch(row)
	if err != nil {
		return nil, fmt.Errorf("create batch: %w", err)
	}
	return b, nil
}

// exceptionColumns is the standard column list for exception queries.
const exceptionColumns = `exception_id, batch_id, source_table, source_id, canonical_table,
		field_name, exception_type, attempted_value, constraint_violated,
		disposition, resolution_note, resolved_by, resolved_at`

// ListExceptions returns all exceptions for a batch, ordered by type, field, and source ID.
func ListExceptions(db *sql.DB, batchID string) ([]models.MigrationException, error) {
	rows, err := db.Query(
		`SELECT `+exceptionColumns+`
		 FROM migration.exception
		 WHERE batch_id = $1
		 ORDER BY exception_type, field_name, source_id`,
		batchID,
	)
	if err != nil {
		return nil, fmt.Errorf("list exceptions: %w", err)
	}
	defer rows.Close()

	var exceptions []models.MigrationException
	for rows.Next() {
		var e models.MigrationException
		if err := rows.Scan(
			&e.ExceptionID, &e.BatchID, &e.SourceTable, &e.SourceID, &e.CanonicalTable,
			&e.FieldName, &e.ExceptionType, &e.AttemptedValue, &e.ConstraintViolated,
			&e.Disposition, &e.ResolutionNote, &e.ResolvedBy, &e.ResolvedAt,
		); err != nil {
			return nil, fmt.Errorf("scan exception: %w", err)
		}
		exceptions = append(exceptions, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list exceptions rows: %w", err)
	}
	return exceptions, nil
}
