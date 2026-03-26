package api

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
	"github.com/noui/platform/migration/report"
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

	report, err := BuildMappingSpec(h.DB, id, engagement.SourceSystemName, engagement.CanonicalSchemaVersion)
	if err != nil {
		slog.Error("mapping spec: failed to build report", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to build mapping specification")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", report)
}

// BuildMappingSpec assembles the full mapping specification report from the
// database. Exported for cross-package use by the PDF renderer — single data
// path shared with the JSON endpoint.
func BuildMappingSpec(db *sql.DB, engagementID, sourceSystem, schemaVersion string) (*MappingSpecReport, error) {
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
	// Group exceptions by handler_name (migration 036 replaced canonical_table with handler_name).
	rows, err := db.Query(
		`SELECT COALESCE(e.handler_name, 'unknown'), COUNT(*)
		 FROM migration.exception e
		 JOIN migration.batch b ON b.batch_id = e.batch_id
		 WHERE b.engagement_id = $1
		 GROUP BY e.handler_name`,
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

// sanitizeFilename replaces non-alphanumeric characters (except hyphens) with
// hyphens and collapses multiple hyphens. Prevents path traversal in
// Content-Disposition filenames.
var nonAlphaNum = regexp.MustCompile(`[^a-zA-Z0-9-]+`)

func sanitizeFilename(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = nonAlphaNum.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "unnamed"
	}
	return s
}

// maxPDFFieldCount is the safety threshold for very large engagements.
// Engagements with more than this many field mappings must use JSON export.
const maxPDFFieldCount = 5000

// maxLineageEntriesPerHandler is the truncation limit per handler group in the
// lineage report (AC-1). Prevents unbounded PDF generation for large batches.
const maxLineageEntriesPerHandler = 500

// maxReconRecordsPerTier is the truncation limit per tier in the reconciliation
// report (AC-4). Prevents unbounded PDF generation for large engagements.
const maxReconRecordsPerTier = 200

// maxReconTotalForPDF is the guard for total reconciliation records (AC-6).
// Engagements with more than this many records must use filtered JSON export.
const maxReconTotalForPDF = 10000

// --- Lineage Traceability Report types ---

// LineageReport is the data structure for the lineage traceability PDF.
type LineageReport struct {
	EngagementID  string                `json:"engagement_id"`
	SourceSystem  string                `json:"source_system"`
	BatchID       string                `json:"batch_id"`
	BatchStatus   string                `json:"batch_status"`
	GeneratedAt   string                `json:"generated_at"`
	Summary       models.LineageSummary `json:"summary"`
	HandlerGroups []HandlerGroup        `json:"handler_groups"`
}

// HandlerGroup groups lineage entries by handler_name for the report.
type HandlerGroup struct {
	HandlerName string                 `json:"handler_name"`
	Entries     []models.LineageRecord `json:"entries"`
	Truncated   bool                   `json:"truncated"`
	TotalCount  int                    `json:"total_count"`
}

// ReconciliationReport is the data structure for the reconciliation summary PDF.
type ReconciliationReport struct {
	EngagementID   string                             `json:"engagement_id"`
	SourceSystem   string                             `json:"source_system"`
	SchemaVersion  string                             `json:"schema_version"`
	GeneratedAt    string                             `json:"generated_at"`
	Summary        models.ReconciliationSummaryResult `json:"summary"`
	TierBreakdowns []TierBreakdown                    `json:"tier_breakdowns"`
	Patterns       []models.ReconciliationPattern     `json:"patterns"`
}

// TierBreakdown contains reconciliation records for a single tier.
type TierBreakdown struct {
	Tier       int                                `json:"tier"`
	Records    []migrationdb.ReconciliationRecord `json:"records"`
	Truncated  bool                               `json:"truncated"`
	TotalCount int                                `json:"total_count"`
}

// BuildLineageReport assembles the lineage traceability report for a specific batch.
// Exported for cross-package use by the PDF renderer (AC-1).
func BuildLineageReport(db *sql.DB, engagementID, batchID, batchScope string) (*LineageReport, error) {
	summary, err := migrationdb.GetLineageSummary(db, batchID)
	if err != nil {
		return nil, fmt.Errorf("lineage summary: %w", err)
	}

	rpt := &LineageReport{
		EngagementID:  engagementID,
		BatchID:       batchID,
		BatchStatus:   batchScope,
		GeneratedAt:   time.Now().UTC().Format(time.RFC3339),
		Summary:       *summary,
		HandlerGroups: make([]HandlerGroup, 0),
	}

	// Build per-handler groups from the summary's transformation types.
	for _, handler := range summary.TransformationTypes {
		entries, err := queryLineageByHandler(db, batchID, handler, maxLineageEntriesPerHandler+1)
		if err != nil {
			return nil, fmt.Errorf("lineage entries for %s: %w", handler, err)
		}

		group := HandlerGroup{
			HandlerName: handler,
			TotalCount:  len(entries),
		}

		if len(entries) > maxLineageEntriesPerHandler {
			group.Entries = entries[:maxLineageEntriesPerHandler]
			group.Truncated = true
		} else {
			group.Entries = entries
		}

		rpt.HandlerGroups = append(rpt.HandlerGroups, group)
	}

	return rpt, nil
}

// BuildReconciliationReport assembles the reconciliation summary for an engagement (AC-4).
func BuildReconciliationReport(db *sql.DB, engagementID, sourceSystem, schemaVersion string) (*ReconciliationReport, error) {
	summary, err := migrationdb.GetReconciliationSummary(db, engagementID)
	if err != nil {
		return nil, fmt.Errorf("reconciliation summary: %w", err)
	}

	rpt := &ReconciliationReport{
		EngagementID:   engagementID,
		SourceSystem:   sourceSystem,
		SchemaVersion:  schemaVersion,
		GeneratedAt:    time.Now().UTC().Format(time.RFC3339),
		Summary:        *summary,
		TierBreakdowns: make([]TierBreakdown, 0, 3),
	}

	// Per-tier breakdown.
	for tier := 1; tier <= 3; tier++ {
		records, err := migrationdb.GetReconciliationByTier(db, engagementID, tier)
		if err != nil {
			return nil, fmt.Errorf("reconciliation tier %d: %w", tier, err)
		}
		if records == nil {
			records = []migrationdb.ReconciliationRecord{}
		}

		bd := TierBreakdown{
			Tier:       tier,
			TotalCount: len(records),
		}

		if len(records) > maxReconRecordsPerTier {
			bd.Records = records[:maxReconRecordsPerTier]
			bd.Truncated = true
		} else {
			bd.Records = records
		}

		rpt.TierBreakdowns = append(rpt.TierBreakdowns, bd)
	}

	// Pattern analysis.
	patterns, err := migrationdb.GetPatternsByEngagement(db, engagementID)
	if err != nil {
		// Patterns are non-critical — log but don't fail.
		rpt.Patterns = []models.ReconciliationPattern{}
	} else if patterns == nil {
		rpt.Patterns = []models.ReconciliationPattern{}
	} else {
		rpt.Patterns = patterns
	}

	return rpt, nil
}

// queryLineageByHandler fetches lineage records for a specific handler name,
// ordered by column_name then row_key. Internal query helper consistent with
// queryMappingSpecFields and queryMappingSpecCodes.
func queryLineageByHandler(db *sql.DB, batchID, handlerName string, limit int) ([]models.LineageRecord, error) {
	rows, err := db.Query(
		`SELECT lineage_id, batch_id, row_key, handler_name, column_name,
		        COALESCE(source_value, ''), COALESCE(result_value, ''),
		        created_at::TEXT
		 FROM migration.lineage
		 WHERE batch_id = $1 AND handler_name = $2
		 ORDER BY column_name, row_key
		 LIMIT $3`,
		batchID, handlerName, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []models.LineageRecord
	for rows.Next() {
		var rec models.LineageRecord
		if err := rows.Scan(
			&rec.LineageID, &rec.BatchID, &rec.RowKey, &rec.HandlerName,
			&rec.ColumnName, &rec.SourceValue, &rec.ResultValue, &rec.CreatedAt,
		); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	if records == nil {
		records = []models.LineageRecord{}
	}
	return records, rows.Err()
}

// pdfTimeout is 5 seconds shorter than the server's 30s WriteTimeout,
// guaranteeing the handler can write a JSON error before the connection dies.
const pdfTimeout = 25 * time.Second

// MappingSpecPDF handles GET /api/v1/migration/engagements/{id}/reports/mapping-spec/pdf.
// It renders the mapping specification as a PDF download using the same data
// assembler as the JSON endpoint (BuildMappingSpec).
func (h *Handler) MappingSpecPDF(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	if h.Renderer == nil {
		apiresponse.WriteError(w, http.StatusServiceUnavailable, "migration", "RENDERER_UNAVAILABLE", "PDF rendering is not available")
		return
	}

	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("mapping spec pdf: failed to get engagement", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", id))
		return
	}

	start := time.Now()
	spec, err := BuildMappingSpec(h.DB, id, engagement.SourceSystemName, engagement.CanonicalSchemaVersion)
	if err != nil {
		slog.Error("mapping spec pdf: failed to build report", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to build mapping specification")
		return
	}

	if spec.TotalMappings == 0 {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NO_MAPPINGS", "no field mappings found for this engagement")
		return
	}

	// Guard against very large engagements that would timeout.
	if spec.TotalMappings > maxPDFFieldCount {
		apiresponse.WriteError(w, http.StatusUnprocessableEntity, "migration", "TOO_LARGE",
			fmt.Sprintf("engagement has %d field mappings (max %d for PDF); use JSON export instead", spec.TotalMappings, maxPDFFieldCount))
		return
	}

	// Render HTML from template.
	html, err := report.RenderMappingSpecHTML(spec)
	if err != nil {
		slog.Error("mapping spec pdf: template render failed", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "TEMPLATE_ERROR", "failed to render report template")
		return
	}

	// Convert HTML to PDF with timeout.
	ctx, cancel := context.WithTimeout(r.Context(), pdfTimeout)
	defer cancel()

	opts := report.DefaultPDFOptions()
	pdfBytes, err := h.Renderer.RenderHTML(ctx, html, opts)
	if err != nil {
		duration := time.Since(start)
		if ctx.Err() == context.DeadlineExceeded {
			slog.Warn("mapping spec pdf: generation timed out", "engagement_id", id, "duration", duration)
			apiresponse.WriteError(w, http.StatusGatewayTimeout, "migration", "PDF_GENERATION_TIMEOUT", "pdf generation timed out")
			return
		}
		slog.Error("mapping spec pdf: render failed", "error", err, "engagement_id", id, "duration", duration)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "RENDER_FAILED", "failed to generate PDF")
		return
	}

	duration := time.Since(start)
	slog.Info("mapping spec pdf generated",
		"engagement_id", id,
		"duration", duration,
		"file_size", len(pdfBytes),
		"total_mappings", spec.TotalMappings,
	)

	// Sanitize filename.
	name := sanitizeFilename(engagement.SourceSystemName)
	date := time.Now().Format("2006-01-02")
	filename := fmt.Sprintf("mapping-spec-%s-%s.pdf", name, date)

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pdfBytes)
}

// LineageReportPDF handles GET /api/v1/migration/engagements/{id}/reports/lineage/{batch_id}/pdf.
// AC-3: Returns the lineage traceability report as a PDF for a specific batch.
func (h *Handler) LineageReportPDF(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	batchID := r.PathValue("batch_id")
	if id == "" || batchID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and batch_id are required")
		return
	}

	if h.Renderer == nil {
		apiresponse.WriteError(w, http.StatusServiceUnavailable, "migration", "RENDERER_UNAVAILABLE", "PDF rendering is not available")
		return
	}

	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("lineage report pdf: failed to get engagement", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", id))
		return
	}

	batch, err := migrationdb.GetBatch(h.DB, batchID)
	if err != nil {
		slog.Error("lineage report pdf: failed to get batch", "error", err, "batch_id", batchID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get batch")
		return
	}
	if batch == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("batch %s not found", batchID))
		return
	}

	start := time.Now()
	rpt, err := BuildLineageReport(h.DB, id, batchID, batch.BatchScope)
	if err != nil {
		slog.Error("lineage report pdf: failed to build report", "error", err, "engagement_id", id, "batch_id", batchID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to build lineage report")
		return
	}

	if rpt.Summary.TotalRecords == 0 {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NO_LINEAGE", "no lineage records found for this batch")
		return
	}

	rpt.SourceSystem = engagement.SourceSystemName

	html, err := report.RenderLineageReportHTML(rpt)
	if err != nil {
		slog.Error("lineage report pdf: template render failed", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "TEMPLATE_ERROR", "failed to render lineage report template")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), pdfTimeout)
	defer cancel()

	opts := report.DefaultPDFOptions()
	pdfBytes, err := h.Renderer.RenderHTML(ctx, html, opts)
	if err != nil {
		duration := time.Since(start)
		if ctx.Err() == context.DeadlineExceeded {
			slog.Warn("lineage report pdf: generation timed out", "engagement_id", id, "batch_id", batchID, "duration", duration)
			apiresponse.WriteError(w, http.StatusGatewayTimeout, "migration", "PDF_GENERATION_TIMEOUT", "pdf generation timed out")
			return
		}
		slog.Error("lineage report pdf: render failed", "error", err, "engagement_id", id, "duration", duration)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "RENDER_FAILED", "failed to generate PDF")
		return
	}

	duration := time.Since(start)
	slog.Info("lineage report pdf generated",
		"engagement_id", id,
		"batch_id", batchID,
		"duration", duration,
		"file_size", len(pdfBytes),
		"total_records", rpt.Summary.TotalRecords,
	)

	date := time.Now().Format("2006-01-02")
	filename := fmt.Sprintf("lineage-%s-%s.pdf", sanitizeFilename(batchID), date)

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pdfBytes)
}

// ReconciliationReportPDF handles GET /api/v1/migration/engagements/{id}/reports/reconciliation/pdf.
// AC-6: Returns the reconciliation summary as a PDF download.
func (h *Handler) ReconciliationReportPDF(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	if h.Renderer == nil {
		apiresponse.WriteError(w, http.StatusServiceUnavailable, "migration", "RENDERER_UNAVAILABLE", "PDF rendering is not available")
		return
	}

	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("reconciliation report pdf: failed to get engagement", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", id))
		return
	}

	// Guard: check total record count before building full report.
	summary, err := migrationdb.GetReconciliationSummary(h.DB, id)
	if err != nil {
		slog.Error("reconciliation report pdf: failed to get summary", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to get reconciliation summary")
		return
	}
	if summary.TotalRecords == 0 {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NO_RECONCILIATION", "no reconciliation data found for this engagement")
		return
	}
	if summary.TotalRecords > maxReconTotalForPDF {
		apiresponse.WriteError(w, http.StatusUnprocessableEntity, "migration", "TOO_LARGE",
			fmt.Sprintf("engagement has %d reconciliation records (max %d for PDF); use filtered JSON export instead",
				summary.TotalRecords, maxReconTotalForPDF))
		return
	}

	start := time.Now()
	rpt, err := BuildReconciliationReport(h.DB, id, engagement.SourceSystemName, engagement.CanonicalSchemaVersion)
	if err != nil {
		slog.Error("reconciliation report pdf: failed to build report", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to build reconciliation report")
		return
	}

	html, err := report.RenderReconciliationReportHTML(rpt)
	if err != nil {
		slog.Error("reconciliation report pdf: template render failed", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "TEMPLATE_ERROR", "failed to render reconciliation report template")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), pdfTimeout)
	defer cancel()

	opts := report.DefaultPDFOptions()
	pdfBytes, err := h.Renderer.RenderHTML(ctx, html, opts)
	if err != nil {
		duration := time.Since(start)
		if ctx.Err() == context.DeadlineExceeded {
			slog.Warn("reconciliation report pdf: generation timed out", "engagement_id", id, "duration", duration)
			apiresponse.WriteError(w, http.StatusGatewayTimeout, "migration", "PDF_GENERATION_TIMEOUT", "pdf generation timed out")
			return
		}
		slog.Error("reconciliation report pdf: render failed", "error", err, "engagement_id", id, "duration", duration)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "RENDER_FAILED", "failed to generate PDF")
		return
	}

	duration := time.Since(start)
	slog.Info("reconciliation report pdf generated",
		"engagement_id", id,
		"duration", duration,
		"file_size", len(pdfBytes),
		"total_records", summary.TotalRecords,
	)

	name := sanitizeFilename(engagement.SourceSystemName)
	date := time.Now().Format("2006-01-02")
	filename := fmt.Sprintf("reconciliation-%s-%s.pdf", name, date)

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pdfBytes)
}
