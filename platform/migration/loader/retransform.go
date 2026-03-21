// Package loader — retransform implements surgical re-transformation of
// canonical rows affected by an approved mapping correction. Old lineage
// entries are marked superseded (never deleted) to preserve the audit trail.
package loader

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/noui/platform/migration/transformer"
)

// --- Types ---

// AffectedRow holds the lineage + source context for a row that must be
// re-transformed after a mapping correction.
type AffectedRow struct {
	LineageID      string `json:"lineage_id"`
	BatchID        string `json:"batch_id"`
	SourceTable    string `json:"source_table"`
	SourceID       string `json:"source_id"`
	CanonicalTable string `json:"canonical_table"`
	CanonicalID    string `json:"canonical_id"`
	MappingVersion string `json:"mapping_version"`
}

// RetransformResult summarises a completed re-transformation.
type RetransformResult struct {
	CorrectionID    string `json:"correction_id"`
	RowsAffected    int    `json:"rows_affected"`
	RowsTransformed int    `json:"rows_transformed"`
	RowsFailed      int    `json:"rows_failed"`
	NewVersion      string `json:"new_version"`
}

// RetransformRequest is the JSON body for the retransform API endpoint.
type RetransformRequest struct {
	CorrectionID string                     `json:"correction_id"`
	NewMappings  []transformer.FieldMapping `json:"new_mappings"`
}

// --- Core function ---

// Retransform identifies rows affected by a mapping correction and
// re-processes them through the pipeline with updated mappings.
//
// Steps:
//  1. Look up the correction to find the affected mapping and version.
//  2. Query lineage for all rows produced by that mapping version.
//  3. For each affected row: fetch source data, re-run transformation.
//  4. Update the canonical row with new values.
//  5. Mark old lineage as superseded, write new lineage.
//  6. Return summary counts.
func Retransform(
	db *sql.DB,
	sourceDB *sql.DB,
	correctionID string,
	pipeline *transformer.Pipeline,
	newMappings []transformer.FieldMapping,
) (*RetransformResult, error) {

	// 1. Look up the correction and the affected mapping's scope.
	var affectedMappingID string
	var mappingVersion string
	var status string
	var sourceTable, canonicalTable string
	err := db.QueryRow(
		`SELECT c.affected_mapping_id, fm.mapping_version, c.status,
		        fm.source_table, fm.canonical_table
		 FROM migration.correction c
		 JOIN migration.field_mapping fm ON fm.mapping_id = c.affected_mapping_id
		 WHERE c.correction_id = $1`,
		correctionID,
	).Scan(&affectedMappingID, &mappingVersion, &status, &sourceTable, &canonicalTable)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("correction %s not found", correctionID)
	}
	if err != nil {
		return nil, fmt.Errorf("lookup correction: %w", err)
	}
	if status != "APPROVED" {
		return nil, fmt.Errorf("correction %s has status %s, expected APPROVED", correctionID, status)
	}

	// 2. Find affected rows via lineage, scoped to the specific table mapping.
	affected, err := findAffectedRows(db, mappingVersion, sourceTable, canonicalTable)
	if err != nil {
		return nil, fmt.Errorf("find affected rows: %w", err)
	}

	newVersion := bumpVersion(mappingVersion)
	result := &RetransformResult{
		CorrectionID: correctionID,
		RowsAffected: len(affected),
		NewVersion:   newVersion,
	}

	if len(affected) == 0 {
		return result, nil
	}

	// 3-5. Re-transform each affected row inside a transaction.
	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}

	sharedCtx := &transformer.TransformContext{
		MappingVersion: newVersion,
	}

	for _, row := range affected {
		// Fetch source data from the source database.
		sourceData, err := fetchSourceRow(sourceDB, row.SourceTable, row.SourceID)
		if err != nil {
			result.RowsFailed++
			continue
		}

		// Re-run transformation pipeline with new mappings.
		results := pipeline.TransformWithContext(
			[]map[string]interface{}{sourceData},
			newMappings,
			sharedCtx,
		)
		if len(results) == 0 {
			result.RowsFailed++
			continue
		}
		transformResult := results[0]

		// Update the canonical row with new values.
		if err := updateCanonicalRow(tx, row.CanonicalTable, row.CanonicalID, transformResult.CanonicalRow); err != nil {
			_ = tx.Rollback()
			return nil, fmt.Errorf("update canonical row %s: %w", row.CanonicalID, err)
		}

		// Write new lineage entry.
		actions := make([]TransformAction, len(transformResult.Lineage))
		for j, le := range transformResult.Lineage {
			actions[j] = TransformAction{
				Handler: le.HandlerName,
				Input:   le.SourceValue,
				Output:  le.ResultValue,
			}
		}

		newLineageID, err := writeLineageReturningID(tx, LineageEntry{
			BatchID:         row.BatchID,
			SourceTable:     row.SourceTable,
			SourceID:        row.SourceID,
			CanonicalTable:  row.CanonicalTable,
			CanonicalID:     row.CanonicalID,
			MappingVersion:  newVersion,
			ConfidenceLevel: string(transformResult.Confidence),
			Transformations: actions,
		})
		if err != nil {
			_ = tx.Rollback()
			return nil, fmt.Errorf("write new lineage for %s: %w", row.CanonicalID, err)
		}

		// Mark old lineage as superseded.
		if err := markSuperseded(tx, row.LineageID, newLineageID); err != nil {
			_ = tx.Rollback()
			return nil, fmt.Errorf("mark superseded %s: %w", row.LineageID, err)
		}

		result.RowsTransformed++
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	return result, nil
}

// --- Helper functions ---

// findAffectedRows queries lineage for all rows produced by a specific
// mapping version and table pair that are not yet superseded.
func findAffectedRows(db *sql.DB, mappingVersion, sourceTable, canonicalTable string) ([]AffectedRow, error) {
	rows, err := db.Query(
		`SELECT lineage_id, batch_id, source_table, source_id,
		        canonical_table, canonical_id, mapping_version
		 FROM migration.lineage
		 WHERE mapping_version = $1
		   AND source_table = $2
		   AND canonical_table = $3
		   AND superseded_by IS NULL
		 ORDER BY created_at`,
		mappingVersion, sourceTable, canonicalTable,
	)
	if err != nil {
		return nil, fmt.Errorf("query affected lineage: %w", err)
	}
	defer rows.Close()

	var affected []AffectedRow
	for rows.Next() {
		var ar AffectedRow
		if err := rows.Scan(
			&ar.LineageID, &ar.BatchID, &ar.SourceTable, &ar.SourceID,
			&ar.CanonicalTable, &ar.CanonicalID, &ar.MappingVersion,
		); err != nil {
			return nil, fmt.Errorf("scan affected row: %w", err)
		}
		affected = append(affected, ar)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate affected rows: %w", err)
	}
	return affected, nil
}

// fetchSourceRow retrieves a single source row by table and ID.
// TODO: The PK column is hardcoded to "id". When integrating with real source
// databases (PRISM uses MEMBER_ID, etc.), this should accept the PK column
// name from the profiler's quality_profile or field_mapping metadata.
func fetchSourceRow(sourceDB *sql.DB, sourceTable, sourceID string) (map[string]interface{}, error) {
	query := fmt.Sprintf(
		"SELECT * FROM %s WHERE %s = $1",
		quoteIdent(sourceTable),
		quoteIdent("id"),
	)
	rows, err := sourceDB.Query(query, sourceID)
	if err != nil {
		return nil, fmt.Errorf("fetch source row: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("get source columns: %w", err)
	}

	if !rows.Next() {
		return nil, fmt.Errorf("source row %s not found in %s", sourceID, sourceTable)
	}

	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	if err := rows.Scan(valuePtrs...); err != nil {
		return nil, fmt.Errorf("scan source row: %w", err)
	}

	result := make(map[string]interface{}, len(columns))
	for i, col := range columns {
		result[col] = values[i]
	}
	return result, nil
}

// updateCanonicalRow updates an existing canonical row with new transformed values.
func updateCanonicalRow(tx *sql.Tx, table, canonicalID string, row map[string]interface{}) error {
	if len(row) == 0 {
		return fmt.Errorf("update canonical row: empty row data")
	}

	// Sort column names for deterministic SQL.
	columns := make([]string, 0, len(row))
	for col := range row {
		columns = append(columns, col)
	}
	sort.Strings(columns)

	// Build SET clause.
	setClauses := make([]string, len(columns))
	values := make([]interface{}, len(columns)+1)
	for i, col := range columns {
		setClauses[i] = fmt.Sprintf("%s = $%d", quoteIdent(col), i+1)
		values[i] = row[col]
	}
	values[len(columns)] = canonicalID

	query := fmt.Sprintf(
		"UPDATE %s SET %s WHERE canonical_id = $%d",
		quoteIdent(table),
		strings.Join(setClauses, ", "),
		len(columns)+1,
	)

	_, err := tx.Exec(query, values...)
	if err != nil {
		return fmt.Errorf("update canonical row in %s: %w", table, err)
	}
	return nil
}

// writeLineageReturningID inserts a lineage record and returns the generated lineage_id.
func writeLineageReturningID(tx *sql.Tx, entry LineageEntry) (string, error) {
	transformJSON, err := json.Marshal(entry.Transformations)
	if err != nil {
		return "", fmt.Errorf("marshal transformations: %w", err)
	}

	var lineageID string
	err = tx.QueryRow(
		`INSERT INTO migration.lineage
		 (batch_id, source_table, source_id, canonical_table, canonical_id,
		  mapping_version, confidence_level, transformations)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING lineage_id`,
		entry.BatchID, entry.SourceTable, entry.SourceID,
		entry.CanonicalTable, entry.CanonicalID,
		entry.MappingVersion, entry.ConfidenceLevel,
		string(transformJSON),
	).Scan(&lineageID)
	if err != nil {
		return "", fmt.Errorf("write lineage returning id: %w", err)
	}
	return lineageID, nil
}

// markSuperseded sets superseded_by on an old lineage entry.
func markSuperseded(tx *sql.Tx, oldLineageID, newLineageID string) error {
	_, err := tx.Exec(
		`UPDATE migration.lineage SET superseded_by = $2 WHERE lineage_id = $1`,
		oldLineageID, newLineageID,
	)
	if err != nil {
		return fmt.Errorf("mark superseded: %w", err)
	}
	return nil
}

// bumpVersion increments a version string like "v1.0" to "v1.1".
// Falls back to appending ".1" if the format is unrecognised.
func bumpVersion(version string) string {
	// Try to parse "vX.Y" format.
	var major, minor int
	if n, _ := fmt.Sscanf(version, "v%d.%d", &major, &minor); n == 2 {
		return fmt.Sprintf("v%d.%d", major, minor+1)
	}
	return version + ".1"
}
