package monitor

import (
	"fmt"
	"strings"

	"github.com/noui/platform/connector/schema"
)

// SchemaResolver maps concept tags to actual table names and column roles to
// actual column names, using a tagged SchemaManifest. Column role mapping is
// signal-based — derived from column name patterns rather than hardcoded mappings.
//
// This enables the TagDrivenAdapter to build SQL queries dynamically for any
// schema that the tagger can understand, without knowing table or column names
// in advance.
type SchemaResolver struct {
	manifest schema.SchemaManifest
	// tagToTable maps concept tag → table name (first match wins)
	tagToTable map[string]string
	// tagToTableInfo maps concept tag → full TableInfo
	tagToTableInfo map[string]schema.TableInfo
}

// NewSchemaResolver builds a resolver from a tagged manifest.
// It indexes all tables by their NoUI tags for fast lookup.
func NewSchemaResolver(manifest schema.SchemaManifest) *SchemaResolver {
	r := &SchemaResolver{
		manifest:       manifest,
		tagToTable:     make(map[string]string),
		tagToTableInfo: make(map[string]schema.TableInfo),
	}

	// Build tag → table mapping with specificity preference:
	// When multiple tables share the same tag, prefer the table where this is
	// the only tag (more specific match). Among equal specificity, prefer the
	// table with more rows (primary data table). This prevents benefit_payment
	// (tagged salary-history + benefit-payment) from shadowing salary_hist
	// (tagged salary-history only).
	type candidate struct {
		table    schema.TableInfo
		tagCount int // how many tags this table has (fewer = more specific)
	}
	tagCandidates := make(map[string][]candidate)

	for _, t := range manifest.Tables {
		for _, tag := range t.NoUITags {
			tagCandidates[tag] = append(tagCandidates[tag], candidate{
				table:    t,
				tagCount: len(t.NoUITags),
			})
		}
	}

	for tag, candidates := range tagCandidates {
		best := candidates[0]
		for _, c := range candidates[1:] {
			// Prefer fewer tags (more specific), then higher row count
			if c.tagCount < best.tagCount ||
				(c.tagCount == best.tagCount && c.table.RowCount > best.table.RowCount) {
				best = c
			}
		}
		r.tagToTable[tag] = best.table.Name
		r.tagToTableInfo[tag] = best.table
	}

	return r
}

// HasTag returns true if the manifest contains any table with the given tag.
func (r *SchemaResolver) HasTag(tag string) bool {
	_, ok := r.tagToTable[tag]
	return ok
}

// TableName returns the actual table name for a concept tag, or empty if not found.
func (r *SchemaResolver) TableName(tag string) string {
	return r.tagToTable[tag]
}

// TableInfo returns the full TableInfo for a concept tag, or empty if not found.
func (r *SchemaResolver) TableInfo(tag string) (schema.TableInfo, bool) {
	t, ok := r.tagToTableInfo[tag]
	return t, ok
}

// QuotedTable returns the table name for a tag, quoted for PostgreSQL (double quotes).
// Returns empty string if the tag is not found.
func (r *SchemaResolver) QuotedTable(tag string) string {
	name := r.tagToTable[tag]
	if name == "" {
		return ""
	}
	return `"` + name + `"`
}

// ColumnRole resolves a semantic column role to the actual column name in the
// table associated with the given concept tag. Column role resolution uses
// pattern matching against column names — the same signal-based approach as
// the tagger.
//
// Role resolution priority:
//  1. Exact match (column name == role name)
//  2. Suffix match (column name ends with role pattern)
//  3. Contains match (column name contains role pattern)
//
// The patterns parameter provides alternative patterns for the role.
// Returns the first matching column name, or empty string if none found.
func (r *SchemaResolver) ColumnRole(tag string, patterns []string) string {
	ti, ok := r.tagToTableInfo[tag]
	if !ok {
		return ""
	}
	return resolveColumn(ti, patterns)
}

// ColumnRoleFrom resolves a column role against a specific table (by name),
// rather than by tag. Useful when a check needs to reference columns across
// multiple tables.
func (r *SchemaResolver) ColumnRoleFrom(tableName string, patterns []string) string {
	for _, t := range r.manifest.Tables {
		if t.Name == tableName {
			return resolveColumn(t, patterns)
		}
	}
	return ""
}

// resolveColumn finds the best matching column name from a table using pattern priority.
func resolveColumn(ti schema.TableInfo, patterns []string) string {
	// Pass 1: exact match
	for _, col := range ti.Columns {
		lower := strings.ToLower(col.Name)
		for _, p := range patterns {
			if lower == strings.ToLower(p) {
				return col.Name
			}
		}
	}
	// Pass 2: suffix match (e.g., "employee_name" matches "name" pattern at end)
	for _, col := range ti.Columns {
		lower := strings.ToLower(col.Name)
		for _, p := range patterns {
			if strings.HasSuffix(lower, "_"+strings.ToLower(p)) {
				return col.Name
			}
		}
	}
	// Pass 3: contains match
	for _, col := range ti.Columns {
		lower := strings.ToLower(col.Name)
		for _, p := range patterns {
			if strings.Contains(lower, strings.ToLower(p)) {
				return col.Name
			}
		}
	}
	return ""
}

// MemberIDColumn returns the column that links a table to the member/employee
// master record. Looks for FK references first, then falls back to column name patterns.
func (r *SchemaResolver) MemberIDColumn(tag string) string {
	ti, ok := r.tagToTableInfo[tag]
	if !ok {
		return ""
	}

	// Check FK references to employee-master table
	masterTable := r.TableName("employee-master")
	if masterTable != "" {
		for _, fk := range ti.ForeignKeys {
			if strings.EqualFold(fk.ReferencedTable, masterTable) {
				return fk.Column
			}
		}
	}

	// Fall back to common ID column patterns
	return resolveColumn(ti, []string{
		"member_id", "employee_id", "employee", "emp_id",
		"name", // ERPNext uses "name" as PK/FK
	})
}

// PrimaryKeyColumn returns the primary key column for a table by tag.
func (r *SchemaResolver) PrimaryKeyColumn(tag string) string {
	ti, ok := r.tagToTableInfo[tag]
	if !ok {
		return ""
	}
	for _, col := range ti.Columns {
		if col.IsKey == "PRI" {
			return col.Name
		}
	}
	return ""
}

// SkipReason returns a human-readable reason why a check should be skipped.
func SkipReason(checkName string, missingTags ...string) string {
	return fmt.Sprintf("%s: skipped (required concept tags not found: %s)",
		checkName, strings.Join(missingTags, ", "))
}
