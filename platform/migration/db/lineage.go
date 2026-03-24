package db

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// GetLineage returns lineage records for a batch with optional filters.
// memberID and columnName are optional — pass "" to skip filtering.
func GetLineage(db *sql.DB, batchID, memberID, columnName string, limit, offset int) ([]models.LineageRecord, error) {
	query := `SELECT lineage_id, batch_id, row_key, handler_name, column_name,
	                  COALESCE(source_value, ''), COALESCE(result_value, ''),
	                  created_at::TEXT
	           FROM migration.lineage
	           WHERE batch_id = $1`
	args := []any{batchID}
	argN := 2

	if memberID != "" {
		query += fmt.Sprintf(" AND row_key = $%d", argN)
		args = append(args, memberID)
		argN++
	}
	if columnName != "" {
		query += fmt.Sprintf(" AND column_name = $%d", argN)
		args = append(args, columnName)
		argN++
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argN, argN+1)
	args = append(args, limit, offset)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("get lineage: %w", err)
	}
	defer rows.Close()

	var records []models.LineageRecord
	for rows.Next() {
		var rec models.LineageRecord
		if err := rows.Scan(
			&rec.LineageID, &rec.BatchID, &rec.RowKey, &rec.HandlerName,
			&rec.ColumnName, &rec.SourceValue, &rec.ResultValue, &rec.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan lineage record: %w", err)
		}
		records = append(records, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lineage rows: %w", err)
	}

	// Return empty slice instead of nil for clean JSON serialization.
	if records == nil {
		records = []models.LineageRecord{}
	}
	return records, nil
}

// GetLineageSummary returns aggregate statistics for lineage records in a batch.
func GetLineageSummary(db *sql.DB, batchID string) (*models.LineageSummary, error) {
	var s models.LineageSummary

	err := db.QueryRow(
		`SELECT
			COUNT(*) AS total_records,
			COUNT(DISTINCT row_key) AS unique_members,
			COUNT(DISTINCT column_name) AS fields_covered
		 FROM migration.lineage
		 WHERE batch_id = $1`,
		batchID,
	).Scan(&s.TotalRecords, &s.UniqueMembers, &s.FieldsCovered)
	if err != nil {
		return nil, fmt.Errorf("lineage summary counts: %w", err)
	}

	// Distinct handler names (transformation types).
	rows, err := db.Query(
		`SELECT DISTINCT handler_name
		 FROM migration.lineage
		 WHERE batch_id = $1
		 ORDER BY handler_name`,
		batchID,
	)
	if err != nil {
		return nil, fmt.Errorf("lineage summary handlers: %w", err)
	}
	defer rows.Close()

	s.TransformationTypes = []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scan handler name: %w", err)
		}
		s.TransformationTypes = append(s.TransformationTypes, name)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lineage summary handler rows: %w", err)
	}

	// Exception count for this batch.
	err = db.QueryRow(
		`SELECT COUNT(*)
		 FROM migration.exception
		 WHERE batch_id = $1`,
		batchID,
	).Scan(&s.ExceptionCount)
	if err != nil {
		return nil, fmt.Errorf("lineage summary exception count: %w", err)
	}

	return &s, nil
}
