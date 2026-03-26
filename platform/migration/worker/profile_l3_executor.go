package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
)

// L3Input is the JSON payload inside job.input_json for profile_l3 jobs.
type L3Input struct {
	ProfilingRunID string `json:"profiling_run_id"`
	EngagementID   string `json:"engagement_id"`
	SourceDriver   string `json:"source_driver"`
}

// ProfileL3Executor discovers cross-column referential integrity relationships
// and detects orphan rows in source databases (Level 3 profiling).
//
// Three phases:
//  1. Discover declared FKs from information_schema / sys.foreign_keys
//  2. Infer FK relationships by name-matching heuristics
//  3. Orphan detection for relationships with confidence >= 0.7
type ProfileL3Executor struct{}

// Execute implements the Executor interface for Level 3 profiling.
func (e *ProfileL3Executor) Execute(ctx context.Context, job *jobqueue.Job, q *jobqueue.Queue, migrationDB *sql.DB) error {
	if err := q.MarkRunning(ctx, job.JobID); err != nil {
		return fmt.Errorf("mark running: %w", err)
	}

	var input L3Input
	if err := json.Unmarshal(job.InputJSON, &input); err != nil {
		return fmt.Errorf("unmarshal L3 input: %w", err)
	}

	slog.Info("L3 executor: discovering relationships",
		"run_id", input.ProfilingRunID,
		"driver", input.SourceDriver,
	)

	// Verify L2 completion (level_reached >= 2).
	run, err := db.GetProfilingRun(migrationDB, input.ProfilingRunID)
	if err != nil || run == nil {
		return fmt.Errorf("get profiling run: %w", err)
	}
	if run.LevelReached == nil || *run.LevelReached < 2 {
		return fmt.Errorf("L3 requires L2 completion (level_reached >= 2)")
	}

	// Update run status to RUNNING_L3.
	level3 := 3
	if err := db.UpdateProfilingRunStatus(migrationDB, input.ProfilingRunID, models.ProfilingStatusRunningL3, &level3, nil); err != nil {
		slog.Warn("failed to update run status to RUNNING_L3", "error", err)
	}

	// Open source database connection.
	srcDB, err := openSourceDB(ctx, migrationDB, input.EngagementID)
	if err != nil {
		return err
	}
	defer srcDB.Close()

	// Get source tables from L1/L2 inventory for context.
	tables, err := db.ListSourceTables(migrationDB, input.ProfilingRunID)
	if err != nil {
		return fmt.Errorf("list source tables: %w", err)
	}

	// Build a set of known tables (schema.table → table info) for FK inference.
	tableSet := make(map[string]*models.SourceTableProfile, len(tables))
	for i := range tables {
		key := QualifiedTableName(tables[i].SchemaName, tables[i].TableName)
		tableSet[key] = &tables[i]
	}

	var allRels []models.SourceRelationship

	// --- Phase 1: Declared FKs ---
	_ = q.UpdateProgress(ctx, job.JobID, 10)
	declaredRels, err := e.discoverDeclaredFKs(ctx, srcDB, input.SourceDriver, input.ProfilingRunID)
	if err != nil {
		slog.Warn("declared FK discovery failed", "error", err)
	} else {
		allRels = append(allRels, declaredRels...)
	}
	_ = q.UpdateProgress(ctx, job.JobID, 33)

	slog.Info("L3 phase 1 complete: declared FKs",
		"count", len(declaredRels),
		"run_id", input.ProfilingRunID,
	)

	// --- Phase 2: Inferred FKs ---
	inferredRels, err := e.inferFKRelationships(ctx, migrationDB, input.ProfilingRunID, input.SourceDriver, tableSet)
	if err != nil {
		slog.Warn("FK inference failed", "error", err)
	} else {
		// Exclude already-declared relationships.
		declaredSet := make(map[string]bool)
		for _, r := range declaredRels {
			key := r.ChildTable + "." + r.ChildColumn + "->" + r.ParentTable + "." + r.ParentColumn
			declaredSet[key] = true
		}
		for _, r := range inferredRels {
			key := r.ChildTable + "." + r.ChildColumn + "->" + r.ParentTable + "." + r.ParentColumn
			if !declaredSet[key] {
				allRels = append(allRels, r)
			}
		}
	}
	_ = q.UpdateProgress(ctx, job.JobID, 66)

	slog.Info("L3 phase 2 complete: inferred FKs",
		"inferred_count", len(inferredRels),
		"total_count", len(allRels),
		"run_id", input.ProfilingRunID,
	)

	// --- Phase 3: Orphan detection for confidence >= 0.7 ---
	for i := range allRels {
		if allRels[i].Confidence < 0.7 {
			continue
		}
		orphanCount, orphanPct, err := e.detectOrphans(ctx, srcDB, input.SourceDriver, allRels[i])
		if err != nil {
			slog.Warn("orphan detection failed",
				"child", allRels[i].ChildTable+"."+allRels[i].ChildColumn,
				"parent", allRels[i].ParentTable+"."+allRels[i].ParentColumn,
				"error", err,
			)
			continue
		}
		allRels[i].OrphanCount = orphanCount
		allRels[i].OrphanPct = orphanPct
	}
	_ = q.UpdateProgress(ctx, job.JobID, 90)

	slog.Info("L3 phase 3 complete: orphan detection",
		"relationships_checked", len(allRels),
		"run_id", input.ProfilingRunID,
	)

	// Batch insert all relationships.
	if len(allRels) > 0 {
		if err := db.InsertSourceRelationships(migrationDB, allRels); err != nil {
			return fmt.Errorf("insert source relationships: %w", err)
		}
	}

	// Update profiling run level_reached to 3.
	if err := db.UpdateProfilingRunStatus(migrationDB, input.ProfilingRunID, models.ProfilingStatusRunningL3, &level3, nil); err != nil {
		slog.Warn("failed to update level_reached", "error", err)
	}

	_ = q.UpdateProgress(ctx, job.JobID, 100)

	result, _ := json.Marshal(map[string]interface{}{
		"relationships":    len(allRels),
		"declared_fks":     len(declaredRels),
		"inferred_fks":     len(allRels) - len(declaredRels),
		"profiling_run_id": input.ProfilingRunID,
	})

	return q.Complete(ctx, job.JobID, result)
}

// discoverDeclaredFKs reads declared foreign keys from the source database catalog.
func (e *ProfileL3Executor) discoverDeclaredFKs(ctx context.Context, srcDB *sql.DB, driver, profilingRunID string) ([]models.SourceRelationship, error) {
	query := DeclaredFKQuery(driver)
	if query == "" {
		return nil, fmt.Errorf("unsupported driver for FK discovery: %s", driver)
	}

	rows, err := srcDB.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query declared FKs: %w", err)
	}
	defer rows.Close()

	var rels []models.SourceRelationship
	for rows.Next() {
		var parentSchema, parentTable, parentColumn string
		var childSchema, childTable, childColumn string
		if err := rows.Scan(&childSchema, &childTable, &childColumn, &parentSchema, &parentTable, &parentColumn); err != nil {
			return nil, fmt.Errorf("scan FK row: %w", err)
		}
		rels = append(rels, models.SourceRelationship{
			ProfilingRunID:   profilingRunID,
			ParentTable:      QualifiedName(parentSchema, parentTable),
			ParentColumn:     parentColumn,
			ChildTable:       QualifiedName(childSchema, childTable),
			ChildColumn:      childColumn,
			RelationshipType: models.RelationshipFKDeclared,
			Confidence:       1.0,
		})
	}
	return rels, rows.Err()
}

// inferFKRelationships finds potential FK relationships by column name heuristics.
// Columns ending in '_id' are matched against PK columns of other tables.
func (e *ProfileL3Executor) inferFKRelationships(ctx context.Context, migrationDB *sql.DB, profilingRunID, driver string, tableSet map[string]*models.SourceTableProfile) ([]models.SourceRelationship, error) {
	// Load all columns across all tables in this run.
	columns, err := db.ListSourceColumnsByRun(migrationDB, profilingRunID)
	if err != nil {
		return nil, fmt.Errorf("list columns for inference: %w", err)
	}

	// Build PK lookup: table_id → {column_name → SourceColumnProfile}
	pkByTable := make(map[string][]models.SourceColumnProfile)
	colsByTable := make(map[string][]models.SourceColumnProfile)
	for _, c := range columns {
		colsByTable[c.SourceTableID] = append(colsByTable[c.SourceTableID], c)
		if c.IsPrimaryKey {
			pkByTable[c.SourceTableID] = append(pkByTable[c.SourceTableID], c)
		}
	}

	// Build table_id → qualified table name mapping.
	tableIDToName := make(map[string]string)
	tableNameToID := make(map[string]string)
	for name, tbl := range tableSet {
		tableIDToName[tbl.ID] = name
		tableNameToID[name] = tbl.ID
	}

	var rels []models.SourceRelationship
	for tableID, cols := range colsByTable {
		childTable, ok := tableIDToName[tableID]
		if !ok {
			continue
		}
		for _, col := range cols {
			if col.IsPrimaryKey {
				continue // Skip PKs — they're not FK candidates
			}
			if !strings.HasSuffix(strings.ToLower(col.ColumnName), "_id") {
				continue
			}

			// Try to match against PKs in other tables.
			confidence, parentTable, parentCol := MatchFKCandidate(col, pkByTable, tableIDToName, childTable)
			if confidence > 0 {
				rels = append(rels, models.SourceRelationship{
					ProfilingRunID:   profilingRunID,
					ParentTable:      parentTable,
					ParentColumn:     parentCol,
					ChildTable:       childTable,
					ChildColumn:      col.ColumnName,
					RelationshipType: models.RelationshipFKInferred,
					Confidence:       confidence,
				})
			}
		}
	}

	return rels, nil
}

// detectOrphans counts orphan rows using LEFT JOIN pattern.
// Returns orphan count and orphan percentage.
func (e *ProfileL3Executor) detectOrphans(ctx context.Context, srcDB *sql.DB, driver string, rel models.SourceRelationship) (int, float64, error) {
	parentRef, err := quoteTableRef(rel.ParentTable, driver)
	if err != nil {
		return 0, 0, fmt.Errorf("quote parent table: %w", err)
	}
	childRef, err := quoteTableRef(rel.ChildTable, driver)
	if err != nil {
		return 0, 0, fmt.Errorf("quote child table: %w", err)
	}
	parentCol, err := quoteColName(rel.ParentColumn, driver)
	if err != nil {
		return 0, 0, fmt.Errorf("quote parent column: %w", err)
	}
	childCol, err := quoteColName(rel.ChildColumn, driver)
	if err != nil {
		return 0, 0, fmt.Errorf("quote child column: %w", err)
	}

	// LEFT JOIN pattern — handles NULLs correctly (unlike NOT IN).
	query := fmt.Sprintf(
		`SELECT COUNT(*) FROM %s c
		 LEFT JOIN %s p ON c.%s = p.%s
		 WHERE c.%s IS NOT NULL AND p.%s IS NULL`,
		childRef, parentRef, childCol, parentCol, childCol, parentCol,
	)

	var orphanCount int
	if err := srcDB.QueryRowContext(ctx, query).Scan(&orphanCount); err != nil {
		return 0, 0, fmt.Errorf("orphan count query: %w", err)
	}

	// Get total non-null count in child column for percentage.
	totalQuery := fmt.Sprintf(
		`SELECT COUNT(*) FROM %s WHERE %s IS NOT NULL`,
		childRef, childCol,
	)
	var total int
	if err := srcDB.QueryRowContext(ctx, totalQuery).Scan(&total); err != nil {
		return orphanCount, 0, nil // Return count even if pct fails
	}

	var pct float64
	if total > 0 {
		pct = float64(orphanCount) / float64(total) * 100
	}

	return orphanCount, pct, nil
}

// --- Exported helper functions for testing ---

// DeclaredFKQuery returns the SQL query for discovering declared foreign keys
// from the source database catalog, based on the driver type.
func DeclaredFKQuery(driver string) string {
	switch driver {
	case "postgres":
		return `SELECT
			tc.table_schema AS child_schema,
			tc.table_name AS child_table,
			kcu.column_name AS child_column,
			ccu.table_schema AS parent_schema,
			ccu.table_name AS parent_table,
			ccu.column_name AS parent_column
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
			ON tc.constraint_name = kcu.constraint_name
			AND tc.table_schema = kcu.table_schema
		JOIN information_schema.constraint_column_usage ccu
			ON ccu.constraint_name = tc.constraint_name
			AND ccu.table_schema = tc.table_schema
		WHERE tc.constraint_type = 'FOREIGN KEY'
		ORDER BY tc.table_schema, tc.table_name, kcu.column_name`
	case "mysql":
		return `SELECT
			kcu.TABLE_SCHEMA AS child_schema,
			kcu.TABLE_NAME AS child_table,
			kcu.COLUMN_NAME AS child_column,
			kcu.REFERENCED_TABLE_SCHEMA AS parent_schema,
			kcu.REFERENCED_TABLE_NAME AS parent_table,
			kcu.REFERENCED_COLUMN_NAME AS parent_column
		FROM information_schema.KEY_COLUMN_USAGE kcu
		WHERE kcu.REFERENCED_TABLE_NAME IS NOT NULL
		ORDER BY kcu.TABLE_SCHEMA, kcu.TABLE_NAME, kcu.COLUMN_NAME`
	case "mssql":
		return `SELECT
			SCHEMA_NAME(fk.schema_id) AS child_schema,
			OBJECT_NAME(fk.parent_object_id) AS child_table,
			COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS child_column,
			SCHEMA_NAME(pk.schema_id) AS parent_schema,
			OBJECT_NAME(fk.referenced_object_id) AS parent_table,
			COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS parent_column
		FROM sys.foreign_keys fk
		JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
		JOIN sys.tables pk ON fk.referenced_object_id = pk.object_id
		ORDER BY SCHEMA_NAME(fk.schema_id), OBJECT_NAME(fk.parent_object_id)`
	default:
		return ""
	}
}

// QualifiedName constructs a schema.table name; returns just table if schema is empty.
func QualifiedName(schema, table string) string {
	if schema == "" {
		return table
	}
	return schema + "." + table
}

// QualifiedTableName constructs a schema.table name from a pointer schema.
func QualifiedTableName(schema *string, table string) string {
	if schema == nil || *schema == "" {
		return table
	}
	return *schema + "." + table
}

// MatchFKCandidate attempts to match a column (ending in _id) against PKs
// in other tables. Returns confidence, parent table name, and parent column name.
//
// Confidence levels:
//   - 0.9: exact name match (e.g., employee_id → employees.employee_id or employees.id)
//   - 0.7: partial match (e.g., emp_id → employees.id)
//   - 0.5: type-only match (same data type as a single-column PK)
func MatchFKCandidate(col models.SourceColumnProfile, pkByTable map[string][]models.SourceColumnProfile, tableIDToName map[string]string, childTable string) (float64, string, string) {
	colLower := strings.ToLower(col.ColumnName)
	// Strip trailing _id to get the entity hint.
	entityHint := strings.TrimSuffix(colLower, "_id")

	var bestConf float64
	var bestParent, bestCol string

	for tableID, pks := range pkByTable {
		parentTable, ok := tableIDToName[tableID]
		if !ok || parentTable == childTable {
			continue // Skip self-references for inference
		}

		// Single-column PK only for inference.
		if len(pks) != 1 {
			continue
		}
		pk := pks[0]

		parentLower := strings.ToLower(extractTableName(parentTable))
		pkLower := strings.ToLower(pk.ColumnName)

		// Exact match: column name matches table_name + _id or PK is "id".
		// Also handles plural table names (employees → employee_id).
		parentSingular := strings.TrimSuffix(parentLower, "s")
		if colLower == parentLower+"_id" || colLower == parentSingular+"_id" ||
			(entityHint == parentLower && pkLower == "id") ||
			(entityHint == parentSingular && pkLower == "id") {
			if bestConf < 0.9 {
				bestConf = 0.9
				bestParent = parentTable
				bestCol = pk.ColumnName
			}
			continue
		}

		// Exact match: column name matches PK name exactly.
		if colLower == pkLower {
			if bestConf < 0.9 {
				bestConf = 0.9
				bestParent = parentTable
				bestCol = pk.ColumnName
			}
			continue
		}

		// Partial match: entity hint is a prefix/suffix of the table name.
		if len(entityHint) >= 3 && (strings.Contains(parentLower, entityHint) || strings.Contains(entityHint, parentLower)) {
			if bestConf < 0.7 {
				bestConf = 0.7
				bestParent = parentTable
				bestCol = pk.ColumnName
			}
			continue
		}

		// Type-only match: same data type.
		if col.DataType == pk.DataType {
			if bestConf < 0.5 {
				bestConf = 0.5
				bestParent = parentTable
				bestCol = pk.ColumnName
			}
		}
	}

	return bestConf, bestParent, bestCol
}

// extractTableName returns just the table part from a possibly qualified "schema.table" name.
func extractTableName(qualifiedName string) string {
	parts := strings.SplitN(qualifiedName, ".", 2)
	if len(parts) == 2 {
		return parts[1]
	}
	return parts[0]
}

// quoteTableRef parses a "schema.table" string and returns a safely quoted reference.
func quoteTableRef(qualifiedName, driver string) (string, error) {
	parts := strings.SplitN(qualifiedName, ".", 2)
	var schema, table string
	if len(parts) == 2 {
		schema = parts[0]
		table = parts[1]
	} else {
		table = parts[0]
	}
	return quoteIdentL1(schema, table, driver)
}
