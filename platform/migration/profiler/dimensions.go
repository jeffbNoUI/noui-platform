// Package profiler implements ISO 8000 six-dimension data quality profiling
// for migration source databases.
package profiler

import (
	"database/sql"
	"fmt"
	"math"
	"time"
)

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

	// Build a query that counts nulls for each required column in one pass.
	// SELECT COUNT(*) AS total,
	//        SUM(CASE WHEN col1 IS NULL THEN 1 ELSE 0 END) AS null_col1,
	//        ...
	// FROM table
	query := "SELECT COUNT(*)"
	for _, col := range requiredColumns {
		query += fmt.Sprintf(", SUM(CASE WHEN %s IS NULL THEN 1 ELSE 0 END)", col)
	}
	query += fmt.Sprintf(" FROM %s", table)

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

	var totalMatchRate float64
	for _, pc := range patternChecks {
		query := fmt.Sprintf(
			"SELECT COUNT(*), SUM(CASE WHEN %s ~ $1 THEN 1 ELSE 0 END) FROM %s WHERE %s IS NOT NULL",
			pc.Column, table, pc.Column,
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

	var totalValidRate float64
	for _, fk := range fkRefs {
		query := fmt.Sprintf(
			`SELECT COUNT(*),
			        SUM(CASE WHEN %s IN (SELECT %s FROM %s) THEN 1 ELSE 0 END)
			 FROM %s WHERE %s IS NOT NULL`,
			fk.Column, fk.ReferencedColumn, fk.ReferencedTable, table, fk.Column,
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

	// Find the most recent date across all date columns
	var mostRecent time.Time
	found := false

	for _, col := range dateColumns {
		query := fmt.Sprintf("SELECT MAX(%s) FROM %s", col, table)
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

	var totalPassRate float64
	for _, rule := range rules {
		query := fmt.Sprintf(
			"SELECT COUNT(*), SUM(CASE WHEN %s THEN 1 ELSE 0 END) FROM %s",
			rule.Condition, table,
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

	// Build column list for GROUP BY
	colList := keyColumns[0]
	for _, col := range keyColumns[1:] {
		colList += ", " + col
	}

	query := fmt.Sprintf(
		"SELECT COUNT(*), COUNT(DISTINCT (%s)) FROM %s",
		colList, table,
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
