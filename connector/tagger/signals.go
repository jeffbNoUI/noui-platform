package tagger

import (
	"fmt"
	"strings"

	"github.com/noui/platform/connector/schema"
)

// hasColumnMatching returns true if any column name contains any of the given substrings.
// Matching is case-insensitive. Returns the first match as evidence.
func hasColumnMatching(table schema.TableInfo, substrings []string) (bool, string) {
	for _, col := range table.Columns {
		lower := strings.ToLower(col.Name)
		for _, sub := range substrings {
			if strings.Contains(lower, strings.ToLower(sub)) {
				return true, fmt.Sprintf("column '%s' matches pattern '%s'", col.Name, sub)
			}
		}
	}
	return false, ""
}

// columnsMatching returns all column names that match any of the given substrings.
func columnsMatching(table schema.TableInfo, substrings []string) []string {
	var matches []string
	for _, col := range table.Columns {
		lower := strings.ToLower(col.Name)
		for _, sub := range substrings {
			if strings.Contains(lower, strings.ToLower(sub)) {
				matches = append(matches, col.Name)
				break
			}
		}
	}
	return matches
}

// countColumnsMatching returns how many columns match any of the given substrings.
func countColumnsMatching(table schema.TableInfo, substrings []string) int {
	return len(columnsMatching(table, substrings))
}

// hasColumnPair returns true if the table has columns matching both pattern sets.
func hasColumnPair(table schema.TableInfo, patternsA, patternsB []string) (bool, string) {
	foundA, evA := hasColumnMatching(table, patternsA)
	foundB, evB := hasColumnMatching(table, patternsB)
	if foundA && foundB {
		return true, fmt.Sprintf("%s AND %s", evA, evB)
	}
	return false, ""
}

// tableNameContains returns true if the table name contains any of the given substrings.
func tableNameContains(table schema.TableInfo, substrings []string) (bool, string) {
	lower := strings.ToLower(table.Name)
	for _, sub := range substrings {
		if strings.Contains(lower, strings.ToLower(sub)) {
			return true, fmt.Sprintf("table name '%s' contains '%s'", table.Name, sub)
		}
	}
	return false, ""
}

// tableNameContainsButNot returns true if the table name contains any of the include
// substrings but none of the exclude substrings.
func tableNameContainsButNot(table schema.TableInfo, include, exclude []string) (bool, string) {
	lower := strings.ToLower(table.Name)
	for _, ex := range exclude {
		if strings.Contains(lower, strings.ToLower(ex)) {
			return false, ""
		}
	}
	return tableNameContains(table, include)
}

// decimalColumnRatio returns the fraction of columns that are decimal/numeric types.
func decimalColumnRatio(table schema.TableInfo) float64 {
	if len(table.Columns) == 0 {
		return 0
	}
	count := 0
	for _, col := range table.Columns {
		dt := strings.ToLower(col.DataType)
		if dt == "decimal" || dt == "numeric" || dt == "double" || dt == "float" || dt == "money" {
			count++
		}
	}
	return float64(count) / float64(len(table.Columns))
}

// dateColumnCount returns the number of date/datetime/timestamp columns,
// excluding common framework columns (creation, modified) that appear on most tables.
func dateColumnCount(table schema.TableInfo) int {
	frameworkCols := map[string]bool{
		"creation": true,
		"modified": true,
	}
	count := 0
	for _, col := range table.Columns {
		if frameworkCols[strings.ToLower(col.Name)] {
			continue
		}
		dt := strings.ToLower(col.DataType)
		if dt == "date" || dt == "datetime" || dt == "timestamp" {
			count++
		}
	}
	return count
}

// hasDateRangePattern detects from_date/to_date or start_date/end_date column pairs.
func hasDateRangePattern(table schema.TableInfo) (bool, string) {
	startPatterns := []string{"from_date", "start_date", "begin_date", "period_start"}
	endPatterns := []string{"to_date", "end_date", "finish_date", "period_end"}
	return hasColumnPair(table, startPatterns, endPatterns)
}

// fkReferencesTableLike returns true if any FK references a table whose name
// matches one of the given substrings.
func fkReferencesTableLike(table schema.TableInfo, substrings []string) (bool, string) {
	for _, fk := range table.ForeignKeys {
		lower := strings.ToLower(fk.ReferencedTable)
		for _, sub := range substrings {
			if strings.Contains(lower, strings.ToLower(sub)) {
				return true, fmt.Sprintf("FK '%s' references '%s' (matches '%s')", fk.Column, fk.ReferencedTable, sub)
			}
		}
	}
	return false, ""
}

// hasColumnLinkToTableLike returns true if any column name suggests a link to
// an entity matching the given substrings (e.g., a column named "employee"
// suggests a link to an employee table, even without a formal FK).
func hasColumnLinkToTableLike(table schema.TableInfo, substrings []string) (bool, string) {
	for _, col := range table.Columns {
		lower := strings.ToLower(col.Name)
		for _, sub := range substrings {
			if lower == strings.ToLower(sub) || lower == strings.ToLower(sub)+"_id" || lower == strings.ToLower(sub)+"_name" {
				return true, fmt.Sprintf("column '%s' suggests link to '%s' entity", col.Name, sub)
			}
		}
	}
	return false, ""
}

// hasStatusColumn detects a status-like column.
func hasStatusColumn(table schema.TableInfo) (bool, string) {
	return hasColumnMatching(table, []string{"status"})
}
