package mapper

import (
	"database/sql"
	"fmt"
	"strings"
)

// CodeColumnCandidate represents a column identified as likely needing value mapping.
type CodeColumnCandidate struct {
	ColumnName     string   `json:"column_name"`
	Cardinality    int      `json:"cardinality"`
	DistinctValues []string `json:"distinct_values"` // up to 50
	LikelyDomain   string   `json:"likely_domain"`   // "status", "gender", "plan_type", etc.
}

// CodeMapping represents a stored code value mapping record.
type CodeMapping struct {
	CodeMappingID  string  `json:"code_mapping_id"`
	EngagementID   string  `json:"engagement_id"`
	SourceTable    string  `json:"source_table"`
	SourceColumn   string  `json:"source_column"`
	SourceValue    string  `json:"source_value"`
	CanonicalValue string  `json:"canonical_value"`
	ApprovedBy     *string `json:"approved_by"`
	ApprovedAt     *string `json:"approved_at"`
}

// DiscoverCodeColumns identifies columns with low cardinality that likely need value mapping.
// Heuristic: columns with cardinality < 50 AND cardinality < (rowCount * 0.01) are likely code columns.
func DiscoverCodeColumns(db *sql.DB, table string, rowCount int) ([]CodeColumnCandidate, error) {
	if rowCount <= 0 {
		return nil, nil
	}

	// Get column names from information_schema.
	colRows, err := db.Query(
		`SELECT column_name FROM information_schema.columns
		 WHERE table_name = $1
		 ORDER BY ordinal_position`, table)
	if err != nil {
		return nil, fmt.Errorf("query columns for table %s: %w", table, err)
	}
	defer colRows.Close()

	var columns []string
	for colRows.Next() {
		var col string
		if err := colRows.Scan(&col); err != nil {
			return nil, fmt.Errorf("scan column name: %w", err)
		}
		columns = append(columns, col)
	}
	if err := colRows.Err(); err != nil {
		return nil, fmt.Errorf("iterate columns: %w", err)
	}

	threshold := float64(rowCount) * 0.01

	var candidates []CodeColumnCandidate
	for _, col := range columns {
		// Count distinct values for this column.
		var cardinality int
		err := db.QueryRow(
			fmt.Sprintf(`SELECT COUNT(DISTINCT %s) FROM %s`, quoteIdent(col), quoteIdent(table)),
		).Scan(&cardinality)
		if err != nil {
			continue // skip columns we can't count (e.g., binary)
		}

		if cardinality >= 50 || float64(cardinality) >= threshold {
			continue
		}

		// Fetch distinct values (up to 50).
		valRows, err := db.Query(
			fmt.Sprintf(`SELECT DISTINCT CAST(%s AS VARCHAR) FROM %s WHERE %s IS NOT NULL ORDER BY 1 LIMIT 50`,
				quoteIdent(col), quoteIdent(table), quoteIdent(col)),
		)
		if err != nil {
			continue
		}

		var values []string
		for valRows.Next() {
			var v string
			if err := valRows.Scan(&v); err != nil {
				break
			}
			values = append(values, v)
		}
		valRows.Close()

		candidates = append(candidates, CodeColumnCandidate{
			ColumnName:     col,
			Cardinality:    cardinality,
			DistinctValues: values,
			LikelyDomain:   InferDomain(col),
		})
	}

	return candidates, nil
}

// InferDomain guesses the semantic domain of a column based on its name.
func InferDomain(columnName string) string {
	lower := strings.ToLower(columnName)

	switch {
	case strings.Contains(lower, "status") || strings.Contains(lower, "stat"):
		return "status"
	case strings.Contains(lower, "gender") || strings.Contains(lower, "sex"):
		return "gender"
	case strings.Contains(lower, "plan") || strings.Contains(lower, "type"):
		return "plan_type"
	case strings.Contains(lower, "tier"):
		return "tier"
	case strings.Contains(lower, "code") || strings.Contains(lower, "cd"):
		return "code"
	default:
		return "unknown"
	}
}

// ListCodeMappings returns all code mappings for an engagement.
func ListCodeMappings(db *sql.DB, engagementID string) ([]CodeMapping, error) {
	rows, err := db.Query(
		`SELECT code_mapping_id, engagement_id, source_table, source_column,
		        source_value, canonical_value, approved_by, approved_at
		 FROM migration.code_mapping
		 WHERE engagement_id = $1
		 ORDER BY source_table, source_column, source_value`, engagementID)
	if err != nil {
		return nil, fmt.Errorf("query code mappings: %w", err)
	}
	defer rows.Close()

	var mappings []CodeMapping
	for rows.Next() {
		var m CodeMapping
		if err := rows.Scan(
			&m.CodeMappingID, &m.EngagementID, &m.SourceTable, &m.SourceColumn,
			&m.SourceValue, &m.CanonicalValue, &m.ApprovedBy, &m.ApprovedAt,
		); err != nil {
			return nil, fmt.Errorf("scan code mapping: %w", err)
		}
		mappings = append(mappings, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate code mappings: %w", err)
	}

	return mappings, nil
}

// UpdateCodeMapping updates the canonical value (and optionally approval) for a code mapping.
func UpdateCodeMapping(db *sql.DB, engagementID, mappingID, canonicalValue, approvedBy string) (*CodeMapping, error) {
	var m CodeMapping
	err := db.QueryRow(
		`UPDATE migration.code_mapping
		 SET canonical_value = $1, approved_by = $2, approved_at = NOW()
		 WHERE code_mapping_id = $3 AND engagement_id = $4
		 RETURNING code_mapping_id, engagement_id, source_table, source_column,
		           source_value, canonical_value, approved_by, approved_at`,
		canonicalValue, approvedBy, mappingID, engagementID,
	).Scan(
		&m.CodeMappingID, &m.EngagementID, &m.SourceTable, &m.SourceColumn,
		&m.SourceValue, &m.CanonicalValue, &m.ApprovedBy, &m.ApprovedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// ResolveCode looks up the canonical value for a source code value.
// Returns the canonical value and true if found, or empty string and false if not mapped.
func ResolveCode(db *sql.DB, engagementID, sourceTable, sourceColumn, sourceValue string) (string, bool, error) {
	var canonical string
	err := db.QueryRow(
		`SELECT canonical_value FROM migration.code_mapping
		 WHERE engagement_id = $1 AND source_table = $2
		   AND source_column = $3 AND source_value = $4`,
		engagementID, sourceTable, sourceColumn, sourceValue,
	).Scan(&canonical)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", false, nil
		}
		return "", false, fmt.Errorf("resolve code: %w", err)
	}
	return canonical, true, nil
}

// quoteIdent wraps an identifier in double quotes for safe SQL interpolation.
func quoteIdent(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}
