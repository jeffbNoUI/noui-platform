// Package profiler implements ISO 8000 six-dimension data quality profiling
// for migration source databases.
package profiler

import (
	"database/sql"
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"
)

// validIdentifier matches safe SQL identifiers: letters, digits, underscores.
// Used to prevent SQL injection when interpolating table/column names.
var validIdentifier = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_.]*$`)

// quoteIdent validates and double-quotes a SQL identifier to prevent injection.
// Supports schema-qualified names (e.g. "src_prism.prism_member" → "src_prism"."prism_member").
func quoteIdent(id string) (string, error) {
	if id == "" {
		return "", fmt.Errorf("empty identifier")
	}
	if !validIdentifier.MatchString(id) {
		return "", fmt.Errorf("unsafe SQL identifier: %q", id)
	}
	// Handle schema-qualified names: split on dot and quote each part
	parts := strings.Split(id, ".")
	for i, p := range parts {
		parts[i] = `"` + strings.ReplaceAll(p, `"`, `""`) + `"`
	}
	return strings.Join(parts, "."), nil
}

// PatternCheck defines a regex pattern to validate against a column's values.
type PatternCheck struct {
	Column  string `json:"column"`
	Pattern string `json:"pattern"` // SQL LIKE or ~ regex pattern
}

// FKReference defines a foreign key relationship for consistency checking.
type FKReference struct {
	Column           string `json:"column"`
	ReferencedTable  string `json:"referenced_table"`
	ReferencedColumn string `json:"referenced_column"`
}

// BusinessRule defines a SQL WHERE condition that valid rows must satisfy.
type BusinessRule struct {
	Name      string `json:"name"`
	Condition string `json:"condition"` // SQL boolean expression, e.g. "salary > 0"
}

// ProfileCompleteness measures the proportion of non-null values across required columns.
// Score = 1 - (avg null rate across columns). Returns 1.0 if no columns specified.
func ProfileCompleteness(db *sql.DB, table string, requiredColumns []string) (QualityDimension, error) {
	dim := QualityDimension{Name: "completeness", Score: 1.0}

	if len(requiredColumns) == 0 {
		dim.Details = "no required columns specified"
		return dim, nil
	}

	quotedTable, err := quoteIdent(table)
	if err != nil {
		return dim, fmt.Errorf("profile completeness: %w", err)
	}

	// Build a query that counts nulls for each required column in one pass.
	query := "SELECT COUNT(*)"
	for _, col := range requiredColumns {
		qc, err := quoteIdent(col)
		if err != nil {
			return dim, fmt.Errorf("profile completeness: %w", err)
		}
		query += fmt.Sprintf(", SUM(CASE WHEN %s IS NULL THEN 1 ELSE 0 END)", qc)
	}
	query += " FROM " + quotedTable

	row := db.QueryRow(query)

	// Scan results
	dest := make([]interface{}, len(requiredColumns)+1)
	ptrs := make([]int64, len(requiredColumns)+1)
	for i := range dest {
		dest[i] = &ptrs[i]
	}

	if err := row.Scan(dest...); err != nil {
		return dim, fmt.Errorf("profile completeness: %w", err)
	}

	total := ptrs[0]
	if total == 0 {
		dim.Score = 1.0
		dim.Details = "table is empty"
		return dim, nil
	}

	var totalNullRate float64
	for i := 1; i <= len(requiredColumns); i++ {
		nullRate := float64(ptrs[i]) / float64(total)
		totalNullRate += nullRate
	}
	avgNullRate := totalNullRate / float64(len(requiredColumns))
	dim.Score = 1.0 - avgNullRate
	dim.Details = fmt.Sprintf("%.1f%% complete across %d columns", dim.Score*100, len(requiredColumns))

	return dim, nil
}

// ProfileAccuracy measures the pattern match rate for known-format columns.
// Score = average match rate across all pattern checks. Returns 1.0 if no checks specified.
func ProfileAccuracy(db *sql.DB, table string, patternChecks []PatternCheck) (QualityDimension, error) {
	dim := QualityDimension{Name: "accuracy", Score: 1.0}

	if len(patternChecks) == 0 {
		dim.Details = "no pattern checks specified"
		return dim, nil
	}

	quotedTable, err := quoteIdent(table)
	if err != nil {
		return dim, fmt.Errorf("profile accuracy: %w", err)
	}

	var totalMatchRate float64
	for _, pc := range patternChecks {
		qc, err := quoteIdent(pc.Column)
		if err != nil {
			return dim, fmt.Errorf("profile accuracy: %w", err)
		}
		query := fmt.Sprintf(
			"SELECT COUNT(*), SUM(CASE WHEN %s ~ $1 THEN 1 ELSE 0 END) FROM %s WHERE %s IS NOT NULL",
			qc, quotedTable, qc,
		)
		var total, matched int64
		if err := db.QueryRow(query, pc.Pattern).Scan(&total, &matched); err != nil {
			return dim, fmt.Errorf("profile accuracy for column %s: %w", pc.Column, err)
		}
		if total > 0 {
			totalMatchRate += float64(matched) / float64(total)
		} else {
			totalMatchRate += 1.0 // empty column is vacuously accurate
		}
	}

	dim.Score = totalMatchRate / float64(len(patternChecks))
	dim.Details = fmt.Sprintf("%.1f%% pattern match rate across %d checks", dim.Score*100, len(patternChecks))

	return dim, nil
}

// ProfileConsistency measures FK referential integrity (non-orphan percentage).
// Score = average non-orphan rate across all FK references. Returns 1.0 if no refs specified.
func ProfileConsistency(db *sql.DB, table string, fkRefs []FKReference) (QualityDimension, error) {
	dim := QualityDimension{Name: "consistency", Score: 1.0}

	if len(fkRefs) == 0 {
		dim.Details = "no FK references specified"
		return dim, nil
	}

	quotedTable, err := quoteIdent(table)
	if err != nil {
		return dim, fmt.Errorf("profile consistency: %w", err)
	}

	var totalValidRate float64
	for _, fk := range fkRefs {
		qCol, err := quoteIdent(fk.Column)
		if err != nil {
			return dim, fmt.Errorf("profile consistency: %w", err)
		}
		qRefCol, err := quoteIdent(fk.ReferencedColumn)
		if err != nil {
			return dim, fmt.Errorf("profile consistency: %w", err)
		}
		qRefTable, err := quoteIdent(fk.ReferencedTable)
		if err != nil {
			return dim, fmt.Errorf("profile consistency: %w", err)
		}
		query := fmt.Sprintf(
			`SELECT COUNT(*),
			        SUM(CASE WHEN %s IN (SELECT %s FROM %s) THEN 1 ELSE 0 END)
			 FROM %s WHERE %s IS NOT NULL`,
			qCol, qRefCol, qRefTable, quotedTable, qCol,
		)
		var total, valid int64
		if err := db.QueryRow(query).Scan(&total, &valid); err != nil {
			return dim, fmt.Errorf("profile consistency for column %s: %w", fk.Column, err)
		}
		if total > 0 {
			totalValidRate += float64(valid) / float64(total)
		} else {
			totalValidRate += 1.0
		}
	}

	dim.Score = totalValidRate / float64(len(fkRefs))
	dim.Details = fmt.Sprintf("%.1f%% referential integrity across %d FK checks", dim.Score*100, len(fkRefs))

	return dim, nil
}

// ProfileTimeliness measures how recent the data is based on date columns.
// Score is based on recency: 1.0 if most recent record is within 30 days,
// decaying toward 0.0 for older data (halving every 180 days).
// Returns 1.0 if no date columns specified.
func ProfileTimeliness(db *sql.DB, table string, dateColumns []string) (QualityDimension, error) {
	dim := QualityDimension{Name: "timeliness", Score: 1.0}

	if len(dateColumns) == 0 {
		dim.Details = "no date columns specified"
		return dim, nil
	}

	quotedTable, err := quoteIdent(table)
	if err != nil {
		return dim, fmt.Errorf("profile timeliness: %w", err)
	}

	// Find the most recent date across all date columns
	var mostRecent time.Time
	found := false

	for _, col := range dateColumns {
		qc, err := quoteIdent(col)
		if err != nil {
			return dim, fmt.Errorf("profile timeliness: %w", err)
		}
		query := fmt.Sprintf("SELECT MAX(%s) FROM %s", qc, quotedTable)
		var maxDate sql.NullTime
		if err := db.QueryRow(query).Scan(&maxDate); err != nil {
			return dim, fmt.Errorf("profile timeliness for column %s: %w", col, err)
		}
		if maxDate.Valid {
			if !found || maxDate.Time.After(mostRecent) {
				mostRecent = maxDate.Time
				found = true
			}
		}
	}

	if !found {
		dim.Score = 0.0
		dim.Details = "no date values found"
		return dim, nil
	}

	daysSince := time.Since(mostRecent).Hours() / 24
	if daysSince <= 30 {
		dim.Score = 1.0
	} else {
		// Exponential decay: halves every 180 days past the 30-day grace period
		dim.Score = math.Pow(0.5, (daysSince-30)/180)
	}
	dim.Details = fmt.Sprintf("most recent record: %.0f days ago", daysSince)

	return dim, nil
}

// ProfileValidity measures business rule pass rate.
// Score = average pass rate across all rules. Returns 1.0 if no rules specified.
func ProfileValidity(db *sql.DB, table string, rules []BusinessRule) (QualityDimension, error) {
	dim := QualityDimension{Name: "validity", Score: 1.0}

	if len(rules) == 0 {
		dim.Details = "no business rules specified"
		return dim, nil
	}

	quotedTable, err := quoteIdent(table)
	if err != nil {
		return dim, fmt.Errorf("profile validity: %w", err)
	}

	var totalPassRate float64
	for _, rule := range rules {
		// NOTE: rule.Condition is a SQL boolean expression (e.g. "salary > 0").
		// It cannot be parameterized. This function MUST only be called with
		// system-defined rules, never with user-supplied conditions. The API
		// handler is responsible for validating or restricting conditions.
		query := fmt.Sprintf(
			"SELECT COUNT(*), SUM(CASE WHEN %s THEN 1 ELSE 0 END) FROM %s",
			rule.Condition, quotedTable,
		)
		var total, passed int64
		if err := db.QueryRow(query).Scan(&total, &passed); err != nil {
			return dim, fmt.Errorf("profile validity rule %q: %w", rule.Name, err)
		}
		if total > 0 {
			totalPassRate += float64(passed) / float64(total)
		} else {
			totalPassRate += 1.0
		}
	}

	dim.Score = totalPassRate / float64(len(rules))
	dim.Details = fmt.Sprintf("%.1f%% rule pass rate across %d rules", dim.Score*100, len(rules))

	return dim, nil
}

// ProfileUniqueness measures the duplicate rate on key columns.
// Score = (distinct count) / (total count). Returns 1.0 if no key columns specified.
func ProfileUniqueness(db *sql.DB, table string, keyColumns []string) (QualityDimension, error) {
	dim := QualityDimension{Name: "uniqueness", Score: 1.0}

	if len(keyColumns) == 0 {
		dim.Details = "no key columns specified"
		return dim, nil
	}

	quotedTable, err := quoteIdent(table)
	if err != nil {
		return dim, fmt.Errorf("profile uniqueness: %w", err)
	}

	// Build quoted column list for COUNT(DISTINCT (col1, col2)) — PostgreSQL row-value syntax
	quotedCols := make([]string, len(keyColumns))
	for i, col := range keyColumns {
		qc, err := quoteIdent(col)
		if err != nil {
			return dim, fmt.Errorf("profile uniqueness: %w", err)
		}
		quotedCols[i] = qc
	}
	colList := strings.Join(quotedCols, ", ")

	query := fmt.Sprintf(
		"SELECT COUNT(*), COUNT(DISTINCT (%s)) FROM %s",
		colList, quotedTable,
	)

	var total, distinct int64
	if err := db.QueryRow(query).Scan(&total, &distinct); err != nil {
		return dim, fmt.Errorf("profile uniqueness: %w", err)
	}

	if total == 0 {
		dim.Score = 1.0
		dim.Details = "table is empty"
		return dim, nil
	}

	dim.Score = float64(distinct) / float64(total)
	dim.Details = fmt.Sprintf("%.1f%% unique across key columns (%d/%d)", dim.Score*100, distinct, total)

	return dim, nil
}
