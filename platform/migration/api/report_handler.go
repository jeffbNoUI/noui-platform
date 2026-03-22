package api

import (
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
)

// --- Mapping Specification Report types ---

// MappingSpecReport is the auditable source-to-target mapping document.
type MappingSpecReport struct {
	EngagementID  string             `json:"engagement_id"`
	SourceSystem  string             `json:"source_system"`
	GeneratedAt   string             `json:"generated_at"`
	SchemaVersion string             `json:"schema_version"`
	Tables        []TableMappingSpec `json:"tables"`
	TotalMappings int                `json:"total_mappings"`
	ApprovedCount int                `json:"approved_count"`
	PendingCount  int                `json:"pending_count"`
	RejectedCount int                `json:"rejected_count"`
	CodeMappings  int                `json:"code_mappings"`
	Assumptions   []string           `json:"assumptions"`
	Exclusions    []string           `json:"exclusions"`
}

// TableMappingSpec groups field and code mappings by canonical table.
type TableMappingSpec struct {
	CanonicalTable string             `json:"canonical_table"`
	FieldMappings  []FieldMappingSpec `json:"field_mappings"`
	CodeMappings   []CodeMappingSpec  `json:"code_mappings"`
	ExceptionCount int                `json:"exception_count"`
}

// FieldMappingSpec is a single field-level mapping entry.
type FieldMappingSpec struct {
	SourceTable     string  `json:"source_table"`
	SourceColumn    string  `json:"source_column"`
	CanonicalColumn string  `json:"canonical_column"`
	Confidence      float64 `json:"confidence"`
	AgreementStatus string  `json:"agreement_status"`
	ApprovalStatus  string  `json:"approval_status"`
	ApprovedBy      *string `json:"approved_by,omitempty"`
}

// CodeMappingSpec is a single code-value mapping entry.
type CodeMappingSpec struct {
	SourceTable    string  `json:"source_table"`
	SourceColumn   string  `json:"source_column"`
	SourceValue    string  `json:"source_value"`
	CanonicalValue string  `json:"canonical_value"`
	ApprovedBy     *string `json:"approved_by,omitempty"`
}

// MappingSpec handles GET /api/v1/migration/engagements/{id}/reports/mapping-spec.
// It assembles the full source-to-target mapping specification from existing
// field_mapping, code_mapping, and exception data.
func (h *Handler) MappingSpec(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("mapping spec: failed to get engagement", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", id))
		return
	}

	report, err := buildMappingSpec(h.DB, id, engagement.SourceSystemName, engagement.CanonicalSchemaVersion)
	if err != nil {
		slog.Error("mapping spec: failed to build report", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to build mapping specification")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", report)
}

func buildMappingSpec(db *sql.DB, engagementID, sourceSystem, schemaVersion string) (*MappingSpecReport, error) {
	report := &MappingSpecReport{
		EngagementID:  engagementID,
		SourceSystem:  sourceSystem,
		GeneratedAt:   time.Now().UTC().Format(time.RFC3339),
		SchemaVersion: schemaVersion,
		Tables:        make([]TableMappingSpec, 0),
		Assumptions:   make([]string, 0),
		Exclusions:    make([]string, 0),
	}

	// Query field mappings grouped by canonical table.
	fieldMappings, err := queryMappingSpecFields(db, engagementID)
	if err != nil {
		return nil, fmt.Errorf("field mappings: %w", err)
	}

	// Query code mappings.
	codeMappings, err := queryMappingSpecCodes(db, engagementID)
	if err != nil {
		return nil, fmt.Errorf("code mappings: %w", err)
	}

	// Query exception counts by canonical table.
	exceptionCounts, err := queryExceptionCounts(db, engagementID)
	if err != nil {
		return nil, fmt.Errorf("exception counts: %w", err)
	}

	// Group field mappings by canonical table.
	tableFields := make(map[string][]FieldMappingSpec)
	for _, fm := range fieldMappings {
		tableFields[fm.canonicalTable] = append(tableFields[fm.canonicalTable], FieldMappingSpec{
			SourceTable:     fm.sourceTable,
			SourceColumn:    fm.sourceColumn,
			CanonicalColumn: fm.canonicalColumn,
			Confidence:      fm.confidence,
			AgreementStatus: fm.agreementStatus,
			ApprovalStatus:  fm.approvalStatus,
			ApprovedBy:      fm.approvedBy,
		})
		report.TotalMappings++
		switch fm.approvalStatus {
		case "APPROVED":
			report.ApprovedCount++
		case "PROPOSED":
			report.PendingCount++
		case "REJECTED":
			report.RejectedCount++
		}
	}

	// Group code mappings by canonical table (via source_table).
	tableCodes := make(map[string][]CodeMappingSpec)
	for _, cm := range codeMappings {
		// Attribute code mappings to the canonical table via field mapping.
		key := cm.sourceTable
		tableCodes[key] = append(tableCodes[key], CodeMappingSpec{
			SourceTable:    cm.sourceTable,
			SourceColumn:   cm.sourceColumn,
			SourceValue:    cm.sourceValue,
			CanonicalValue: cm.canonicalValue,
			ApprovedBy:     cm.approvedBy,
		})
		report.CodeMappings++
	}

	// Build table specs — collect all unique canonical tables.
	allTables := make(map[string]bool)
	for t := range tableFields {
		allTables[t] = true
	}
	for t := range exceptionCounts {
		allTables[t] = true
	}

	for tbl := range allTables {
		spec := TableMappingSpec{
			CanonicalTable: tbl,
			FieldMappings:  tableFields[tbl],
			CodeMappings:   tableCodes[tbl],
			ExceptionCount: exceptionCounts[tbl],
		}
		if spec.FieldMappings == nil {
			spec.FieldMappings = make([]FieldMappingSpec, 0)
		}
		if spec.CodeMappings == nil {
			spec.CodeMappings = make([]CodeMappingSpec, 0)
		}
		report.Tables = append(report.Tables, spec)
	}

	// Query assumptions (DERIVED lineage count).
	derivedCount, err := queryDerivedCount(db, engagementID)
	if err == nil && derivedCount > 0 {
		report.Assumptions = append(report.Assumptions,
			fmt.Sprintf("%d canonical records derived from related source data (not direct mapping)", derivedCount))
	}

	// Query exclusions (EXCLUDED exception count).
	excludedCount, err := queryExcludedCount(db, engagementID)
	if err == nil && excludedCount > 0 {
		report.Exclusions = append(report.Exclusions,
			fmt.Sprintf("%d source records excluded due to constraint violations", excludedCount))
	}

	return report, nil
}

// --- Internal query types ---

type fieldMappingRow struct {
	canonicalTable  string
	sourceTable     string
	sourceColumn    string
	canonicalColumn string
	confidence      float64
	agreementStatus string
	approvalStatus  string
	approvedBy      *string
}

type codeMappingRow struct {
	sourceTable    string
	sourceColumn   string
	sourceValue    string
	canonicalValue string
	approvedBy     *string
}

// --- Query helpers ---

func queryMappingSpecFields(db *sql.DB, engagementID string) ([]fieldMappingRow, error) {
	rows, err := db.Query(
		`SELECT canonical_table, source_table, source_column, canonical_column,
		        GREATEST(COALESCE(template_confidence, 0), COALESCE(signal_confidence, 0)),
		        agreement_status, approval_status, approved_by
		 FROM migration.field_mapping
		 WHERE engagement_id = $1
		 ORDER BY canonical_table, canonical_column`,
		engagementID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []fieldMappingRow
	for rows.Next() {
		var r fieldMappingRow
		if err := rows.Scan(&r.canonicalTable, &r.sourceTable, &r.sourceColumn,
			&r.canonicalColumn, &r.confidence, &r.agreementStatus,
			&r.approvalStatus, &r.approvedBy); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

func queryMappingSpecCodes(db *sql.DB, engagementID string) ([]codeMappingRow, error) {
	rows, err := db.Query(
		`SELECT source_table, source_column, source_value, canonical_value, approved_by
		 FROM migration.code_mapping
		 WHERE engagement_id = $1
		 ORDER BY source_table, source_column, source_value`,
		engagementID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []codeMappingRow
	for rows.Next() {
		var r codeMappingRow
		if err := rows.Scan(&r.sourceTable, &r.sourceColumn, &r.sourceValue,
			&r.canonicalValue, &r.approvedBy); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

func queryExceptionCounts(db *sql.DB, engagementID string) (map[string]int, error) {
	rows, err := db.Query(
		`SELECT COALESCE(e.canonical_table, 'unknown'), COUNT(*)
		 FROM migration.exception e
		 JOIN migration.batch b ON b.batch_id = e.batch_id
		 WHERE b.engagement_id = $1
		 GROUP BY e.canonical_table`,
		engagementID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var table string
		var count int
		if err := rows.Scan(&table, &count); err != nil {
			return nil, err
		}
		counts[table] = count
	}
	return counts, rows.Err()
}

func queryDerivedCount(db *sql.DB, engagementID string) (int, error) {
	var count int
	err := db.QueryRow(
		`SELECT COUNT(*)
		 FROM migration.lineage l
		 JOIN migration.batch b ON b.batch_id = l.batch_id
		 WHERE b.engagement_id = $1 AND l.confidence_level = 'DERIVED'`,
		engagementID,
	).Scan(&count)
	return count, err
}

func queryExcludedCount(db *sql.DB, engagementID string) (int, error) {
	var count int
	err := db.QueryRow(
		`SELECT COUNT(*)
		 FROM migration.exception e
		 JOIN migration.batch b ON b.batch_id = e.batch_id
		 WHERE b.engagement_id = $1 AND e.disposition = 'EXCLUDED'`,
		engagementID,
	).Scan(&count)
	return count, err
}
