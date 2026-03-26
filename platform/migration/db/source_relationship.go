package db

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/noui/platform/migration/models"
)

// sourceRelationshipColumns is the shared column list for source_relationship queries.
const sourceRelationshipColumns = `relationship_id, profiling_run_id, parent_table, parent_column,
	child_table, child_column, relationship_type, confidence, orphan_count, orphan_pct, created_at`

// scanSourceRelationship scans a row into a SourceRelationship struct.
func scanSourceRelationship(s scanner) (models.SourceRelationship, error) {
	var r models.SourceRelationship
	err := s.Scan(
		&r.RelationshipID, &r.ProfilingRunID, &r.ParentTable, &r.ParentColumn,
		&r.ChildTable, &r.ChildColumn, &r.RelationshipType, &r.Confidence,
		&r.OrphanCount, &r.OrphanPct, &r.CreatedAt,
	)
	return r, err
}

// InsertSourceRelationships batch-inserts source relationship records.
func InsertSourceRelationships(database *sql.DB, rels []models.SourceRelationship) error {
	if database == nil {
		return fmt.Errorf("db is nil")
	}
	if len(rels) == 0 {
		return nil
	}

	// Build batch INSERT with VALUES clause.
	var b strings.Builder
	b.WriteString(`INSERT INTO migration.source_relationship
		(profiling_run_id, parent_table, parent_column, child_table, child_column,
		 relationship_type, confidence, orphan_count, orphan_pct)
		VALUES `)

	args := make([]interface{}, 0, len(rels)*9)
	for i, r := range rels {
		if i > 0 {
			b.WriteString(", ")
		}
		base := i * 9
		fmt.Fprintf(&b, "($%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)",
			base+1, base+2, base+3, base+4, base+5, base+6, base+7, base+8, base+9)
		args = append(args,
			r.ProfilingRunID, r.ParentTable, r.ParentColumn,
			r.ChildTable, r.ChildColumn,
			string(r.RelationshipType), r.Confidence, r.OrphanCount, r.OrphanPct,
		)
	}

	b.WriteString(` ON CONFLICT (profiling_run_id, parent_table, parent_column, child_table, child_column)
		DO UPDATE SET relationship_type = EXCLUDED.relationship_type,
		confidence = EXCLUDED.confidence, orphan_count = EXCLUDED.orphan_count,
		orphan_pct = EXCLUDED.orphan_pct`)

	_, err := database.Exec(b.String(), args...)
	if err != nil {
		return fmt.Errorf("insert source relationships: %w", err)
	}
	return nil
}

// ListSourceRelationships returns paginated source relationships for a profiling run.
// When orphansOnly is true, only relationships with orphan_count > 0 are returned.
func ListSourceRelationships(database *sql.DB, profilingRunID string, orphansOnly bool, page, perPage int) ([]models.SourceRelationship, int, error) {
	if database == nil {
		return nil, 0, fmt.Errorf("db is nil")
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}

	whereClause := "WHERE profiling_run_id = $1"
	args := []interface{}{profilingRunID}
	if orphansOnly {
		whereClause += " AND orphan_count > 0"
	}

	// Count total.
	var total int
	countQ := fmt.Sprintf("SELECT COUNT(*) FROM migration.source_relationship %s", whereClause)
	if err := database.QueryRow(countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count source relationships: %w", err)
	}

	// Query page.
	offset := (page - 1) * perPage
	q := fmt.Sprintf("SELECT %s FROM migration.source_relationship %s ORDER BY confidence DESC, parent_table, child_table LIMIT $%d OFFSET $%d",
		sourceRelationshipColumns, whereClause, len(args)+1, len(args)+2)
	args = append(args, perPage, offset)

	rows, err := database.Query(q, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list source relationships: %w", err)
	}
	defer rows.Close()

	var rels []models.SourceRelationship
	for rows.Next() {
		r, err := scanSourceRelationship(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan source relationship: %w", err)
		}
		rels = append(rels, r)
	}
	return rels, total, rows.Err()
}

// GetOrphanSummary returns aggregate orphan metrics for a profiling run.
func GetOrphanSummary(database *sql.DB, profilingRunID string) (*models.OrphanSummary, error) {
	if database == nil {
		return nil, fmt.Errorf("db is nil")
	}
	var s models.OrphanSummary
	err := database.QueryRow(
		`SELECT
			COUNT(*)::INT,
			COUNT(*) FILTER (WHERE orphan_count > 0)::INT,
			COALESCE(SUM(orphan_count), 0)::INT,
			COALESCE(MAX(orphan_pct), 0)::FLOAT8
		 FROM migration.source_relationship
		 WHERE profiling_run_id = $1`,
		profilingRunID,
	).Scan(&s.TotalRelationships, &s.OrphanRelationships, &s.TotalOrphanRows, &s.HighestOrphanPct)
	if err != nil {
		return nil, fmt.Errorf("get orphan summary: %w", err)
	}
	return &s, nil
}
