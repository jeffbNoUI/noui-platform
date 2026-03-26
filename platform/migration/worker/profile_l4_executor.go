package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
)

// L4Input is the JSON payload inside job.input_json for profile_l4 jobs.
type L4Input struct {
	ProfilingRunID string `json:"profiling_run_id"`
	EngagementID   string `json:"engagement_id"`
}

// ProfileL4Executor generates a canonical coverage report mapping source columns
// to schema version fields with gap analysis. It requires L2 completion (source_column
// data) and an active schema_version.
type ProfileL4Executor struct{}

// Ensure ProfileL4Executor satisfies the Executor interface at compile time.
var _ Executor = (*ProfileL4Executor)(nil)

// Execute implements the Executor interface for Level 4 profiling.
func (e *ProfileL4Executor) Execute(ctx context.Context, job *jobqueue.Job, q *jobqueue.Queue, migrationDB *sql.DB) error {
	if err := q.MarkRunning(ctx, job.JobID); err != nil {
		return fmt.Errorf("mark running: %w", err)
	}

	var input L4Input
	if err := json.Unmarshal(job.InputJSON, &input); err != nil {
		return fmt.Errorf("unmarshal L4 input: %w", err)
	}

	slog.Info("L4 executor: generating coverage report",
		"run_id", input.ProfilingRunID,
		"engagement_id", input.EngagementID,
	)

	// Step 0: Update profiling run status to RUNNING_L4.
	level := 4
	if err := db.UpdateProfilingRunStatus(migrationDB, input.ProfilingRunID, models.ProfilingStatusRunningL4, &level, nil); err != nil {
		return fmt.Errorf("update status to RUNNING_L4: %w", err)
	}

	_ = q.UpdateProgress(ctx, job.JobID, 5)

	// Step 1: Get tenant_id and load active schema version.
	tenantID, err := db.GetTenantIDForEngagement(migrationDB, input.EngagementID)
	if err != nil {
		return fmt.Errorf("get tenant_id: %w", err)
	}

	schemaVersionID, err := db.GetActiveSchemaVersionID(migrationDB, tenantID)
	if err != nil {
		return fmt.Errorf("get active schema version: %w", err)
	}

	canonicalFields, err := db.GetBaselineFields(migrationDB, schemaVersionID)
	if err != nil {
		return fmt.Errorf("get baseline fields: %w", err)
	}

	if len(canonicalFields) == 0 {
		return fmt.Errorf("no canonical fields found for schema version %s", schemaVersionID)
	}

	_ = q.UpdateProgress(ctx, job.JobID, 20)

	// Step 2: Load all source columns from the profiling run (from L1/L2).
	sourceColumns, err := db.ListSourceColumnsWithTableByRun(migrationDB, input.ProfilingRunID)
	if err != nil {
		return fmt.Errorf("list source columns: %w", err)
	}

	_ = q.UpdateProgress(ctx, job.JobID, 30)

	// Step 3: Check for existing field_mapping records (human-approved).
	existingMappings, err := db.GetExistingFieldMappingsForEngagement(migrationDB, input.EngagementID)
	if err != nil {
		// Non-fatal — field_mapping table may not have data yet.
		slog.Warn("L4 executor: could not load existing mappings, proceeding without", "error", err)
		existingMappings = make(map[string]string)
	}

	_ = q.UpdateProgress(ctx, job.JobID, 40)

	// Step 4: For each canonical field, find source column candidates.
	report := e.buildCoverageReport(input.ProfilingRunID, schemaVersionID, canonicalFields, sourceColumns, existingMappings)

	_ = q.UpdateProgress(ctx, job.JobID, 70)

	// Step 5: Persist the coverage report.
	reportID, err := db.InsertCoverageReport(migrationDB, report)
	if err != nil {
		return fmt.Errorf("insert coverage report: %w", err)
	}
	report.ReportID = reportID

	_ = q.UpdateProgress(ctx, job.JobID, 80)

	// Step 6: Update profiling_run aggregate columns.
	if err := db.UpdateProfilingRunCoverageAggregates(
		migrationDB, input.ProfilingRunID,
		report.TotalCanonicalFields, report.AutoMappedCount,
		report.ReviewRequiredCount, report.NoMatchCount,
		report.CoveragePct,
	); err != nil {
		return fmt.Errorf("update run aggregates: %w", err)
	}

	// Update status to level_reached=4.
	if err := db.UpdateProfilingRunStatus(migrationDB, input.ProfilingRunID, models.ProfilingStatusCoverageReportReady, &level, nil); err != nil {
		return fmt.Errorf("update status to COVERAGE_REPORT_READY: %w", err)
	}

	_ = q.UpdateProgress(ctx, job.JobID, 100)

	result, _ := json.Marshal(map[string]interface{}{
		"report_id":       reportID,
		"coverage_pct":    report.CoveragePct,
		"auto_mapped":     report.AutoMappedCount,
		"review_required": report.ReviewRequiredCount,
		"unmapped":        report.NoMatchCount,
		"engagement_id":   input.EngagementID,
		"total_canonical": report.TotalCanonicalFields,
	})

	return q.Complete(ctx, job.JobID, result)
}

// buildCoverageReport generates the coverage report by matching canonical fields
// to source columns using deterministic name/type matching.
func (e *ProfileL4Executor) buildCoverageReport(
	runID, schemaVersionID string,
	canonicalFields []models.SchemaVersionField,
	sourceColumns []db.SourceColumnWithTable,
	existingMappings map[string]string,
) *models.CoverageReport {
	report := &models.CoverageReport{
		ProfilingRunID:       runID,
		SchemaVersionID:      schemaVersionID,
		TotalCanonicalFields: len(canonicalFields),
		FieldDetails:         make([]models.CoverageFieldDetail, 0, len(canonicalFields)),
	}

	for _, cf := range canonicalFields {
		detail := models.CoverageFieldDetail{
			CanonicalEntity:  cf.Entity,
			FieldName:        cf.FieldName,
			DataType:         cf.DataType,
			IsRequired:       cf.IsRequired,
			SourceCandidates: make([]models.CoverageSourceCandidate, 0),
		}

		mappingKey := cf.Entity + "." + cf.FieldName

		// Check if already mapped via field_mapping (human-approved).
		if _, hasMapped := existingMappings[mappingKey]; hasMapped {
			detail.Status = models.CoverageFieldMapped
			report.MappedFields++
			report.FieldDetails = append(report.FieldDetails, detail)
			continue
		}

		// Find source column candidates by name/type similarity.
		candidates := e.findCandidates(cf, sourceColumns)

		// Limit to top 5 candidates to prevent JSONB bloat.
		if len(candidates) > 5 {
			candidates = candidates[:5]
		}
		detail.SourceCandidates = candidates

		// Classify status based on best candidate confidence.
		if len(candidates) > 0 {
			bestConf := candidates[0].Confidence
			switch {
			case bestConf >= 0.8:
				detail.Status = models.CoverageFieldAutoMapped
				report.AutoMappedCount++
				report.MappedFields++
			case bestConf >= 0.5:
				detail.Status = models.CoverageFieldReviewRequired
				report.ReviewRequiredCount++
				report.MappedFields++
			default:
				detail.Status = models.CoverageFieldUnmapped
				report.NoMatchCount++
				report.UnmappedFields++
			}
		} else {
			detail.Status = models.CoverageFieldUnmapped
			report.NoMatchCount++
			report.UnmappedFields++
		}

		report.FieldDetails = append(report.FieldDetails, detail)
	}

	// Compute coverage percentage.
	if report.TotalCanonicalFields > 0 {
		report.CoveragePct = float64(report.MappedFields) / float64(report.TotalCanonicalFields) * 100.0
	}

	return report
}

// findCandidates scores source columns against a canonical field using deterministic
// name and type matching. Returns candidates sorted by confidence descending.
func (e *ProfileL4Executor) findCandidates(
	cf models.SchemaVersionField,
	sourceColumns []db.SourceColumnWithTable,
) []models.CoverageSourceCandidate {
	normalizedCanonical := normalizeName(cf.FieldName)
	var candidates []models.CoverageSourceCandidate

	for _, sc := range sourceColumns {
		normalizedSource := normalizeName(sc.ColumnName)

		var confidence float64
		var matchReason string

		// Exact name match (after normalization).
		if normalizedSource == normalizedCanonical {
			confidence = 0.95
			matchReason = "exact_name"
		} else if nameSimilarity(normalizedSource, normalizedCanonical) >= 0.7 {
			// Name similarity after normalization.
			confidence = 0.8
			matchReason = "name_similarity"
		} else if dataTypeCompatible(sc.DataType, cf.DataType) && partialNameMatch(normalizedSource, normalizedCanonical) {
			// Type compatibility + partial name match.
			confidence = 0.6
			matchReason = "type_compatible"
		}

		if confidence > 0 {
			candidates = append(candidates, models.CoverageSourceCandidate{
				SourceTable:  sc.TableName,
				SourceColumn: sc.ColumnName,
				Confidence:   confidence,
				MatchReason:  matchReason,
			})
		}
	}

	// Sort by confidence descending (simple insertion sort for small lists).
	for i := 1; i < len(candidates); i++ {
		for j := i; j > 0 && candidates[j].Confidence > candidates[j-1].Confidence; j-- {
			candidates[j], candidates[j-1] = candidates[j-1], candidates[j]
		}
	}

	return candidates
}

// normalizeName converts a column name to a canonical form for matching:
// lowercase, strip common prefixes (fk_, idx_, pk_, tbl_, src_), underscores preserved.
func normalizeName(name string) string {
	n := strings.ToLower(strings.TrimSpace(name))
	// Strip common prefixes.
	for _, prefix := range []string{"fk_", "idx_", "pk_", "tbl_", "src_", "col_"} {
		n = strings.TrimPrefix(n, prefix)
	}
	return n
}

// nameSimilarity computes a simple similarity score between two normalized names.
// Returns 1.0 for exact match, lower for partial matches.
func nameSimilarity(a, b string) float64 {
	if a == b {
		return 1.0
	}
	if a == "" || b == "" {
		return 0.0
	}

	// Check containment.
	if strings.Contains(a, b) || strings.Contains(b, a) {
		shorter := len(a)
		if len(b) < shorter {
			shorter = len(b)
		}
		longer := len(a)
		if len(b) > longer {
			longer = len(b)
		}
		return float64(shorter) / float64(longer)
	}

	// Token-based similarity: split on underscores and count matching tokens.
	tokensA := strings.Split(a, "_")
	tokensB := strings.Split(b, "_")

	matches := 0
	for _, ta := range tokensA {
		for _, tb := range tokensB {
			if ta == tb && ta != "" {
				matches++
				break
			}
		}
	}

	total := len(tokensA)
	if len(tokensB) > total {
		total = len(tokensB)
	}
	if total == 0 {
		return 0.0
	}
	return float64(matches) / float64(total)
}

// dataTypeCompatible checks if a source data type is compatible with a canonical data type.
func dataTypeCompatible(sourceType, canonicalType string) bool {
	srcLower := strings.ToLower(sourceType)
	canonLower := strings.ToLower(canonicalType)

	// Map to type families.
	srcFamily := typeFamily(srcLower)
	canonFamily := typeFamily(canonLower)

	return srcFamily != "" && srcFamily == canonFamily
}

// typeFamily maps a SQL data type to a general family for compatibility checks.
func typeFamily(dt string) string {
	switch {
	case strings.Contains(dt, "int") || strings.Contains(dt, "serial"):
		return "integer"
	case strings.Contains(dt, "numeric") || strings.Contains(dt, "decimal") ||
		strings.Contains(dt, "money") || strings.Contains(dt, "float") ||
		strings.Contains(dt, "real") || strings.Contains(dt, "double"):
		return "numeric"
	case strings.Contains(dt, "varchar") || strings.Contains(dt, "text") ||
		strings.Contains(dt, "char") || strings.Contains(dt, "string"):
		return "text"
	case strings.Contains(dt, "timestamp") || strings.Contains(dt, "datetime"):
		return "timestamp"
	case strings.Contains(dt, "date"):
		return "date"
	case strings.Contains(dt, "bool"):
		return "boolean"
	case strings.Contains(dt, "uuid"):
		return "uuid"
	case strings.Contains(dt, "json"):
		return "json"
	default:
		return ""
	}
}

// partialNameMatch returns true if the two names share at least one meaningful token.
func partialNameMatch(a, b string) bool {
	tokensA := strings.Split(a, "_")
	tokensB := strings.Split(b, "_")

	for _, ta := range tokensA {
		if len(ta) < 2 {
			continue // skip single chars like "a", "b"
		}
		for _, tb := range tokensB {
			if ta == tb {
				return true
			}
		}
	}
	return false
}
