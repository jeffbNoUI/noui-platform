package db

import (
	"encoding/json"
	"fmt"
	"math"

	"github.com/noui/platform/migration/models"
)

// SourceColumnInfo holds information about a column discovered in the source database.
type SourceColumnInfo struct {
	TableName  string
	ColumnName string
	DataType   string
}

// TableRowInfo holds baseline row count information for a table.
type TableRowInfo struct {
	TableName     string
	BaselineCount int64
}

// ComputeSchemaDrift compares baseline schema version fields against current source columns
// and returns drift records for any detected changes.
//
// mappedCols is a map of "table.column" → approval_status for columns in field_mapping.
// This is used to determine severity and affects_mapping.
func ComputeSchemaDrift(
	baseline []models.SchemaVersionField,
	sourceColumns []SourceColumnInfo,
	mappedCols map[string]string, // key: "table.column", value: approval_status
) []models.DriftRecord {
	var records []models.DriftRecord

	// Build maps for comparison.
	// Baseline: keyed by entity.field_name
	type fieldKey struct{ Table, Column string }
	baselineMap := make(map[fieldKey]models.SchemaVersionField, len(baseline))
	baselineTables := make(map[string]bool)
	for _, f := range baseline {
		baselineMap[fieldKey{f.Entity, f.FieldName}] = f
		baselineTables[f.Entity] = true
	}

	// Source: keyed by table.column
	sourceMap := make(map[fieldKey]SourceColumnInfo, len(sourceColumns))
	sourceTables := make(map[string]bool)
	for _, c := range sourceColumns {
		sourceMap[fieldKey{c.TableName, c.ColumnName}] = c
		sourceTables[c.TableName] = true
	}

	// Detect table-level drift first.
	// Tables added (in source but not in baseline).
	for table := range sourceTables {
		if !baselineTables[table] {
			records = append(records, models.DriftRecord{
				ChangeType:     models.DriftTableAdded,
				Entity:         table,
				Detail:         mustJSONBytes(map[string]string{"table": table}),
				Severity:       models.DriftSeverityLow,
				AffectsMapping: false,
			})
		}
	}

	// Tables removed (in baseline but not in source).
	for table := range baselineTables {
		if !sourceTables[table] {
			// Check if any column from this table is mapped.
			affectsMapping, severity := tableMappingSeverity(table, baseline, mappedCols)
			if severity == "" {
				severity = models.DriftSeverityMedium
			}
			records = append(records, models.DriftRecord{
				ChangeType:     models.DriftTableRemoved,
				Entity:         table,
				Detail:         mustJSONBytes(map[string]string{"table": table}),
				Severity:       severity,
				AffectsMapping: affectsMapping,
			})
		}
	}

	// Detect column-level drift.
	// Columns added (in source but not in baseline).
	for key, src := range sourceMap {
		if _, exists := baselineMap[key]; !exists {
			// Only report if the table existed in baseline (new columns in new tables
			// are already covered by TABLE_ADDED).
			if !baselineTables[key.Table] {
				continue
			}
			records = append(records, models.DriftRecord{
				ChangeType: models.DriftColumnAdded,
				Entity:     fmt.Sprintf("%s.%s", key.Table, key.Column),
				Detail: mustJSONBytes(map[string]string{
					"new_type": src.DataType,
				}),
				Severity:       models.DriftSeverityLow,
				AffectsMapping: false,
			})
		}
	}

	// Columns removed (in baseline but not in source).
	for key, base := range baselineMap {
		if _, exists := sourceMap[key]; !exists {
			// Only report if the table still exists (removed tables already reported).
			if !sourceTables[key.Table] {
				continue
			}
			colKey := fmt.Sprintf("%s.%s", key.Table, key.Column)
			affects, severity := columnMappingSeverity(colKey, mappedCols)
			if severity == "" {
				severity = models.DriftSeverityMedium
			}
			records = append(records, models.DriftRecord{
				ChangeType: models.DriftColumnRemoved,
				Entity:     colKey,
				Detail: mustJSONBytes(map[string]string{
					"old_type": base.DataType,
				}),
				Severity:       severity,
				AffectsMapping: affects,
			})
		}
	}

	// Columns with type changed (exists in both, different data_type).
	for key, base := range baselineMap {
		if src, exists := sourceMap[key]; exists {
			if base.DataType != src.DataType {
				colKey := fmt.Sprintf("%s.%s", key.Table, key.Column)
				affects, severity := columnMappingSeverity(colKey, mappedCols)
				if severity == "" {
					severity = models.DriftSeverityMedium
				}
				records = append(records, models.DriftRecord{
					ChangeType: models.DriftColumnTypeChanged,
					Entity:     colKey,
					Detail: mustJSONBytes(map[string]string{
						"old_type": base.DataType,
						"new_type": src.DataType,
					}),
					Severity:       severity,
					AffectsMapping: affects,
				})
			}
		}
	}

	return records
}

// computeRowCountDrift compares baseline row counts against current counts
// and returns drift records where delta exceeds the threshold.
func ComputeRowCountDrift(
	tables []TableRowInfo,
	currentCounts map[string]int64, // key: table_name
	thresholdPct float64,
) []models.DriftRecord {
	var records []models.DriftRecord

	for _, t := range tables {
		if t.BaselineCount == 0 {
			continue // can't compute delta percentage on zero baseline
		}

		current, exists := currentCounts[t.TableName]
		if !exists {
			continue // table may have been removed — handled by schema drift
		}

		delta := float64(current-t.BaselineCount) / float64(t.BaselineCount)
		absDelta := math.Abs(delta)

		if absDelta < thresholdPct {
			continue
		}

		severity := rowCountSeverity(absDelta)

		records = append(records, models.DriftRecord{
			ChangeType: models.DriftRowCountDrift,
			Entity:     t.TableName,
			Detail: mustJSONBytes(map[string]interface{}{
				"baseline_count": t.BaselineCount,
				"current_count":  current,
				"delta_pct":      math.Round(delta*10000) / 10000, // 4 decimal places
			}),
			Severity:       severity,
			AffectsMapping: false, // row count drift doesn't affect field-level mapping
		})
	}

	return records
}

// columnMappingSeverity determines severity based on whether a column is mapped.
// Returns (affects_mapping, severity).
// CRITICAL if APPROVED mapping, HIGH if PROPOSED, empty string if not mapped.
func columnMappingSeverity(colKey string, mappedCols map[string]string) (bool, models.DriftSeverity) {
	status, exists := mappedCols[colKey]
	if !exists {
		return false, ""
	}
	if status == "APPROVED" {
		return true, models.DriftSeverityCritical
	}
	return true, models.DriftSeverityHigh
}

// tableMappingSeverity checks if any column from a table is mapped.
func tableMappingSeverity(table string, baseline []models.SchemaVersionField, mappedCols map[string]string) (bool, models.DriftSeverity) {
	var maxSeverity models.DriftSeverity
	affects := false
	for _, f := range baseline {
		if f.Entity != table {
			continue
		}
		colKey := fmt.Sprintf("%s.%s", f.Entity, f.FieldName)
		a, s := columnMappingSeverity(colKey, mappedCols)
		if a {
			affects = true
			if s == models.DriftSeverityCritical {
				return true, models.DriftSeverityCritical
			}
			if s == models.DriftSeverityHigh {
				maxSeverity = models.DriftSeverityHigh
			}
		}
	}
	if maxSeverity != "" {
		return affects, maxSeverity
	}
	return affects, ""
}

// rowCountSeverity determines severity based on absolute delta percentage.
// CRITICAL > 50%, HIGH > 25%, MEDIUM > 10%.
func rowCountSeverity(absDelta float64) models.DriftSeverity {
	if absDelta > 0.50 {
		return models.DriftSeverityCritical
	}
	if absDelta > 0.25 {
		return models.DriftSeverityHigh
	}
	return models.DriftSeverityMedium
}

// mustJSONBytes marshals v to JSON RawMessage, returning "{}" on error.
func mustJSONBytes(v interface{}) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		return json.RawMessage(`{}`)
	}
	return json.RawMessage(b)
}
