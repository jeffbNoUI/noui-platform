// Package loader writes transformed rows to the canonical schema with full
// lineage tracking. It generates dynamic INSERT statements from mapping
// metadata, stores transformation lineage as JSONB for auditor queries, and
// records data quality exceptions.
package loader

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/noui/platform/migration/transformer"
)

// --- Lineage types ---

// LineageEntry describes the full provenance of a single canonical row.
type LineageEntry struct {
	BatchID         string            `json:"batch_id"`
	SourceTable     string            `json:"source_table"`
	SourceID        string            `json:"source_id"`
	CanonicalTable  string            `json:"canonical_table"`
	CanonicalID     string            `json:"canonical_id"`
	MappingVersion  string            `json:"mapping_version"`
	ConfidenceLevel string            `json:"confidence_level"` // ACTUAL, DERIVED, ESTIMATED, ROLLED_UP
	Transformations []TransformAction `json:"transformations"`
}

// TransformAction records a single transformation step within a lineage entry.
type TransformAction struct {
	Handler string `json:"handler"`
	Input   string `json:"input"`
	Output  string `json:"output"`
}

// --- Exception types ---

// ExceptionEntry describes a data quality issue for persistence.
type ExceptionEntry struct {
	BatchID            string `json:"batch_id"`
	SourceTable        string `json:"source_table"`
	SourceID           string `json:"source_id"`
	CanonicalTable     string `json:"canonical_table,omitempty"`
	FieldName          string `json:"field_name"`
	ExceptionType      string `json:"exception_type"`
	AttemptedValue     string `json:"attempted_value,omitempty"`
	ConstraintViolated string `json:"constraint_violated"`
}

// --- Canonical row writer ---

// WriteCanonicalRow inserts a single row into the specified canonical table
// using dynamically generated SQL. Column names come from the row keys.
// Returns the generated canonical_id (UUID) via RETURNING.
func WriteCanonicalRow(tx *sql.Tx, table string, row map[string]interface{}) (string, error) {
	if len(row) == 0 {
		return "", fmt.Errorf("write canonical row: empty row data")
	}

	// Sort column names for deterministic SQL generation.
	columns := make([]string, 0, len(row))
	for col := range row {
		columns = append(columns, col)
	}
	sort.Strings(columns)

	// Build parameterized INSERT.
	placeholders := make([]string, len(columns))
	values := make([]interface{}, len(columns))
	for i, col := range columns {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		values[i] = row[col]
	}

	query := fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES (%s) RETURNING canonical_id",
		quoteIdent(table),
		strings.Join(quoteIdents(columns), ", "),
		strings.Join(placeholders, ", "),
	)

	var canonicalID string
	if err := tx.QueryRow(query, values...).Scan(&canonicalID); err != nil {
		return "", fmt.Errorf("write canonical row to %s: %w", table, err)
	}
	return canonicalID, nil
}

// --- Lineage writer ---

// validConfidenceLevels matches the CHECK constraint on migration.lineage.confidence_level.
var validConfidenceLevels = map[string]bool{
	"ACTUAL": true, "DERIVED": true, "ESTIMATED": true, "ROLLED_UP": true,
}

// WriteLineage inserts a lineage record with transformations stored as JSONB.
func WriteLineage(tx *sql.Tx, entry LineageEntry) error {
	if !validConfidenceLevels[entry.ConfidenceLevel] {
		return fmt.Errorf("invalid confidence level %q: must be ACTUAL, DERIVED, ESTIMATED, or ROLLED_UP", entry.ConfidenceLevel)
	}
	transformJSON, err := json.Marshal(entry.Transformations)
	if err != nil {
		return fmt.Errorf("marshal transformations: %w", err)
	}

	_, err = tx.Exec(
		`INSERT INTO migration.lineage
		 (batch_id, source_table, source_id, canonical_table, canonical_id,
		  mapping_version, confidence_level, transformations)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		entry.BatchID, entry.SourceTable, entry.SourceID,
		entry.CanonicalTable, entry.CanonicalID,
		entry.MappingVersion, entry.ConfidenceLevel,
		string(transformJSON),
	)
	if err != nil {
		return fmt.Errorf("write lineage: %w", err)
	}
	return nil
}

// --- Exception writer ---

// WriteException inserts an exception record.
func WriteException(tx *sql.Tx, entry ExceptionEntry) error {
	_, err := tx.Exec(
		`INSERT INTO migration.exception
		 (batch_id, source_table, source_id, canonical_table, field_name,
		  exception_type, attempted_value, constraint_violated)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		entry.BatchID, entry.SourceTable, entry.SourceID,
		entry.CanonicalTable, entry.FieldName,
		entry.ExceptionType, entry.AttemptedValue, entry.ConstraintViolated,
	)
	if err != nil {
		return fmt.Errorf("write exception: %w", err)
	}
	return nil
}

// --- Batch writer ---

// BatchWriteConfig carries the context needed to write a full batch of
// transform results to the canonical schema.
type BatchWriteConfig struct {
	BatchID        string
	SourceTable    string
	CanonicalTable string
	MappingVersion string
}

// WriteBatchToCanonical writes all transformed rows for a batch, creating
// canonical rows, lineage entries, and exception entries within the provided
// transaction. It returns the number of canonical rows successfully written.
func WriteBatchToCanonical(tx *sql.Tx, cfg BatchWriteConfig, results []transformer.TransformResult, sourceIDs []string) (int, error) {
	if len(results) != len(sourceIDs) {
		return 0, fmt.Errorf("results length %d does not match sourceIDs length %d", len(results), len(sourceIDs))
	}

	loaded := 0
	for i, result := range results {
		sourceID := sourceIDs[i]

		// Write canonical row.
		canonicalID, err := WriteCanonicalRow(tx, cfg.CanonicalTable, result.CanonicalRow)
		if err != nil {
			return loaded, fmt.Errorf("row %d (%s): %w", i, sourceID, err)
		}

		// Convert transformer lineage entries to loader lineage format.
		actions := make([]TransformAction, len(result.Lineage))
		for j, le := range result.Lineage {
			actions[j] = TransformAction{
				Handler: le.HandlerName,
				Input:   le.SourceValue,
				Output:  le.ResultValue,
			}
		}

		// Write lineage.
		lineageEntry := LineageEntry{
			BatchID:         cfg.BatchID,
			SourceTable:     cfg.SourceTable,
			SourceID:        sourceID,
			CanonicalTable:  cfg.CanonicalTable,
			CanonicalID:     canonicalID,
			MappingVersion:  cfg.MappingVersion,
			ConfidenceLevel: string(result.Confidence),
			Transformations: actions,
		}
		if err := WriteLineage(tx, lineageEntry); err != nil {
			return loaded, fmt.Errorf("row %d (%s) lineage: %w", i, sourceID, err)
		}

		// Write exceptions.
		for _, ex := range result.Exceptions {
			exEntry := ExceptionEntry{
				BatchID:            cfg.BatchID,
				SourceTable:        cfg.SourceTable,
				SourceID:           sourceID,
				CanonicalTable:     cfg.CanonicalTable,
				FieldName:          ex.Column,
				ExceptionType:      string(ex.ExceptionType),
				AttemptedValue:     ex.SourceValue,
				ConstraintViolated: ex.Message,
			}
			if err := WriteException(tx, exEntry); err != nil {
				return loaded, fmt.Errorf("row %d (%s) exception: %w", i, sourceID, err)
			}
		}

		loaded++
	}

	return loaded, nil
}

// --- identifier sanitization ---

// quoteIdent wraps a SQL identifier in double quotes with proper escaping.
// For schema-qualified names (e.g. "migration.member"), each part is quoted
// separately: "migration"."member".
func quoteIdent(name string) string {
	parts := strings.Split(name, ".")
	for i, p := range parts {
		parts[i] = `"` + strings.ReplaceAll(p, `"`, `""`) + `"`
	}
	return strings.Join(parts, ".")
}

// quoteIdents applies quoteIdent to each element.
func quoteIdents(ids []string) []string {
	out := make([]string, len(ids))
	for i, id := range ids {
		out[i] = quoteIdent(id)
	}
	return out
}
