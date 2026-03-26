package profiler

import (
	"database/sql"
	"fmt"
	"regexp"
)

// DetectedPattern represents an encoding or format pattern discovered in a source column.
type DetectedPattern struct {
	Column     string  `json:"column"`
	Pattern    string  `json:"pattern"`    // regex that matches
	Label      string  `json:"label"`      // human-readable label
	MatchRate  float64 `json:"match_rate"` // fraction of non-null values matching (0.0–1.0)
	SampleSize int     `json:"sample_size"`
}

// knownPattern defines a regex pattern to test against column values.
type knownPattern struct {
	Label   string
	Regex   *regexp.Regexp
	RawExpr string // the regex string for JSON output
}

// pensionPatterns is the built-in library of pension-domain encoding patterns.
// These are common in AS400/DB2, Oracle, and SQL Server legacy pension systems.
//
// NOTE: This deterministic Go implementation handles known patterns. When the
// Python intelligence service (migration-intelligence, port 8100) is deployed,
// ML-based pattern discovery (frequency analysis, n-gram clustering) should
// replace this for unknown pattern detection. The Go version then becomes the
// fallback via the existing nil-safe intelligence.Scorer interface pattern.
// See: docs/plans/2026-03-20-migration-engine-design.md, Enhancement C.
var pensionPatterns = []knownPattern{
	{
		Label:   "CYYMMDD century-encoded date (AS400)",
		Regex:   regexp.MustCompile(`^[01]\d{6}$`),
		RawExpr: `^[01]\d{6}$`,
	},
	{
		Label:   "YYYYMMDD packed date",
		Regex:   regexp.MustCompile(`^(19|20)\d{6}$`),
		RawExpr: `^(19|20)\d{6}$`,
	},
	{
		Label:   "SSN format (NNN-NN-NNNN)",
		Regex:   regexp.MustCompile(`^\d{3}-\d{2}-\d{4}$`),
		RawExpr: `^\d{3}-\d{2}-\d{4}$`,
	},
	{
		Label:   "SSN format (NNNNNNNNN)",
		Regex:   regexp.MustCompile(`^\d{9}$`),
		RawExpr: `^\d{9}$`,
	},
	{
		Label:   "Implicit decimal (cents in last 2 digits)",
		Regex:   regexp.MustCompile(`^\d{4,12}$`),
		RawExpr: `^\d{4,12}$`,
	},
	{
		Label:   "Member ID with alpha prefix",
		Regex:   regexp.MustCompile(`^[A-Z]\d{4,10}$`),
		RawExpr: `^[A-Z]\d{4,10}$`,
	},
	{
		Label:   "Two-character status code",
		Regex:   regexp.MustCompile(`^[A-Z]{2}$`),
		RawExpr: `^[A-Z]{2}$`,
	},
}

// DefaultSampleSize is the number of non-null rows sampled per column.
const DefaultSampleSize = 1000

// MinMatchRate is the minimum match rate for a pattern to be reported.
const MinMatchRate = 0.50

// DetectPatterns samples values from VARCHAR/TEXT columns in a source table
// and tests each against the built-in pension-domain pattern library.
// Only patterns matching >= MinMatchRate of non-null sampled values are returned.
func DetectPatterns(db *sql.DB, table string, sampleSize int) ([]DetectedPattern, error) {
	if sampleSize <= 0 {
		sampleSize = DefaultSampleSize
	}

	quotedTable, err := QuoteIdent(table)
	if err != nil {
		return nil, fmt.Errorf("detect patterns: invalid table %q: %w", table, err)
	}

	// Discover VARCHAR/TEXT columns via information_schema.
	columns, err := discoverTextColumns(db, table)
	if err != nil {
		return nil, fmt.Errorf("detect patterns: %w", err)
	}

	var results []DetectedPattern
	for _, col := range columns {
		patterns, err := detectColumnPatterns(db, quotedTable, col, sampleSize)
		if err != nil {
			return nil, fmt.Errorf("detect patterns column %s: %w", col, err)
		}
		results = append(results, patterns...)
	}
	return results, nil
}

// discoverTextColumns returns VARCHAR/TEXT/CHAR column names for the given table.
func discoverTextColumns(db *sql.DB, table string) ([]string, error) {
	// Parse schema.table or just table name.
	schema, tableName := ParseSchemaTable(table)

	query := `SELECT column_name FROM information_schema.columns
		WHERE table_name = $1 AND data_type IN ('character varying', 'text', 'character', 'varchar', 'char', 'nvarchar')`
	args := []any{tableName}
	if schema != "" {
		query += ` AND table_schema = $2`
		args = append(args, schema)
	}
	query += ` ORDER BY ordinal_position`

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("discover text columns for %s: %w", table, err)
	}
	defer rows.Close()

	var columns []string
	for rows.Next() {
		var col string
		if err := rows.Scan(&col); err != nil {
			return nil, fmt.Errorf("scan column name: %w", err)
		}
		columns = append(columns, col)
	}
	return columns, rows.Err()
}

// parseSchemaTable splits "schema.table" into (schema, table). If no dot, returns ("", table).
func ParseSchemaTable(qualified string) (string, string) {
	for i, c := range qualified {
		if c == '.' {
			return qualified[:i], qualified[i+1:]
		}
	}
	return "", qualified
}

// detectColumnPatterns samples values from a single column and tests against known patterns.
func detectColumnPatterns(db *sql.DB, quotedTable, column string, sampleSize int) ([]DetectedPattern, error) {
	quotedCol, err := QuoteIdent(column)
	if err != nil {
		return nil, fmt.Errorf("invalid column %q: %w", column, err)
	}

	// Sample non-null values.
	query := fmt.Sprintf(
		"SELECT %s::TEXT FROM %s WHERE %s IS NOT NULL LIMIT $1",
		quotedCol, quotedTable, quotedCol,
	)
	rows, err := db.Query(query, sampleSize)
	if err != nil {
		return nil, fmt.Errorf("sample column %s: %w", column, err)
	}
	defer rows.Close()

	var values []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, fmt.Errorf("scan value from %s: %w", column, err)
		}
		values = append(values, v)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(values) == 0 {
		return nil, nil
	}

	var results []DetectedPattern
	for _, pat := range pensionPatterns {
		matched := 0
		for _, v := range values {
			if pat.Regex.MatchString(v) {
				matched++
			}
		}
		matchRate := float64(matched) / float64(len(values))
		if matchRate >= MinMatchRate {
			results = append(results, DetectedPattern{
				Column:     column,
				Pattern:    pat.RawExpr,
				Label:      pat.Label,
				MatchRate:  matchRate,
				SampleSize: len(values),
			})
		}
	}
	return results, nil
}
