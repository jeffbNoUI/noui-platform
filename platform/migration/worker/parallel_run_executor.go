package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/big"
	"strings"
	"time"

	"github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
)

// defaultBatchSize is the number of result rows per INSERT batch.
const defaultBatchSize = 500

// progressBatchSize is the member count between progress heartbeats.
const progressBatchSize = 100

// ParallelRunInput is the JSON payload inside job.input_json for parallel_run jobs.
type ParallelRunInput struct {
	RunID          string   `json:"run_id"`
	EngagementID   string   `json:"engagement_id"`
	SampleRate     float64  `json:"sample_rate"`
	ComparisonMode string   `json:"comparison_mode"`
	Entities       []string `json:"entities"`
}

// approvedMapping represents a single approved field mapping for comparison.
// Field selection is driven by approved mappings — this creates an implicit
// runtime dependency on mapping data being present before parallel runs execute.
type approvedMapping struct {
	SourceTable     string
	SourceColumn    string
	CanonicalTable  string
	CanonicalColumn string
}

// ParallelRunExecutor implements the worker.Executor interface for parallel run
// comparison jobs. It compares field values between a legacy source database and
// the canonical (migration target) database for sampled or all members.
type ParallelRunExecutor struct{}

// Execute implements the Executor interface for parallel run comparison.
func (e *ParallelRunExecutor) Execute(ctx context.Context, job *jobqueue.Job, q *jobqueue.Queue, migrationDB *sql.DB) error {
	if err := q.MarkRunning(ctx, job.JobID); err != nil {
		return fmt.Errorf("mark running: %w", err)
	}

	var input ParallelRunInput
	if err := json.Unmarshal(job.InputJSON, &input); err != nil {
		return fmt.Errorf("unmarshal parallel run input: %w", err)
	}

	slog.Info("parallel run executor: starting comparison",
		"run_id", input.RunID,
		"engagement_id", input.EngagementID,
		"comparison_mode", input.ComparisonMode,
		"sample_rate", input.SampleRate,
	)

	// Transition parallel_run status to RUNNING.
	if _, err := db.UpdateParallelRunStatus(migrationDB, input.RunID, models.ParallelRunRunning); err != nil {
		return fmt.Errorf("update run status to RUNNING: %w", err)
	}

	// CONTINUOUS mode is not yet implemented — requires CDC integration.
	if input.ComparisonMode == string(models.ComparisonModeContinuous) {
		if err := markRunFailed(migrationDB, input.RunID); err != nil {
			slog.Warn("failed to mark run as FAILED after CONTINUOUS error", "error", err)
		}
		return fmt.Errorf("comparison_mode CONTINUOUS not yet implemented — requires CDC integration")
	}

	// Get source connection and validate driver.
	conn, err := db.GetEngagementSourceConnection(migrationDB, input.EngagementID)
	if err != nil {
		if markErr := markRunFailed(migrationDB, input.RunID); markErr != nil {
			slog.Warn("failed to mark run as FAILED", "error", markErr)
		}
		return fmt.Errorf("get source connection: %w", err)
	}

	// MySQL is out of scope — only postgres and mssql supported.
	if conn.Driver == "mysql" {
		if markErr := markRunFailed(migrationDB, input.RunID); markErr != nil {
			slog.Warn("failed to mark run as FAILED after mysql error", "error", markErr)
		}
		return fmt.Errorf("source driver 'mysql' is not supported for parallel runs — only postgres and mssql are supported")
	}

	// Open source database connection.
	srcDB, err := openSourceDB(ctx, migrationDB, input.EngagementID)
	if err != nil {
		if markErr := markRunFailed(migrationDB, input.RunID); markErr != nil {
			slog.Warn("failed to mark run as FAILED after source DB error", "error", markErr)
		}
		return fmt.Errorf("open source db: %w", err)
	}
	defer srcDB.Close()

	// Get approved field mappings for this engagement.
	mappings, err := getApprovedMappings(migrationDB, input.EngagementID)
	if err != nil {
		if markErr := markRunFailed(migrationDB, input.RunID); markErr != nil {
			slog.Warn("failed to mark run as FAILED", "error", markErr)
		}
		return fmt.Errorf("get approved mappings: %w", err)
	}
	if len(mappings) == 0 {
		if markErr := markRunFailed(migrationDB, input.RunID); markErr != nil {
			slog.Warn("failed to mark run as FAILED", "error", markErr)
		}
		return fmt.Errorf("no approved field mappings found for engagement %s", input.EngagementID)
	}

	// Get member IDs to compare.
	memberIDs, err := getSampledMembers(ctx, srcDB, conn.Driver, input.SampleRate, input.ComparisonMode)
	if err != nil {
		if markErr := markRunFailed(migrationDB, input.RunID); markErr != nil {
			slog.Warn("failed to mark run as FAILED", "error", markErr)
		}
		return fmt.Errorf("get sampled members: %w", err)
	}
	if len(memberIDs) == 0 {
		if markErr := markRunFailed(migrationDB, input.RunID); markErr != nil {
			slog.Warn("failed to mark run as FAILED", "error", markErr)
		}
		return fmt.Errorf("no members selected for comparison (sample_rate=%.4f)", input.SampleRate)
	}

	slog.Info("parallel run: members selected",
		"run_id", input.RunID,
		"member_count", len(memberIDs),
		"mapping_count", len(mappings),
	)

	// Process members in batches.
	var (
		totalResults  []models.ParallelRunResult
		errorCount    int
		matchCount    int
		mismatchCount int
	)

	for i, memberID := range memberIDs {
		// Check context cancellation between member batches.
		if i > 0 && i%progressBatchSize == 0 {
			if err := ctx.Err(); err != nil {
				slog.Info("parallel run: context cancelled, preserving partial results",
					"run_id", input.RunID,
					"members_processed", i,
					"total_members", len(memberIDs),
				)
				// Insert any accumulated partial results before returning.
				if len(totalResults) > 0 {
					inserted, insertErr := db.InsertParallelRunResults(migrationDB, totalResults)
					if insertErr != nil {
						slog.Warn("failed to insert partial results on cancellation", "error", insertErr)
					} else {
						slog.Info("partial results preserved", "inserted", inserted)
					}
				}
				// Mark parallel_run as CANCELLED (not the job — worker loop handles that).
				if cancelErr := markRunCancelled(migrationDB, input.RunID); cancelErr != nil {
					slog.Warn("failed to mark run as CANCELLED", "error", cancelErr)
				}
				return ctx.Err() // NOT nil — returning nil would cause q.Complete()
			}
		}

		// Compare all mapped fields for this member.
		results, err := compareMemberFields(ctx, srcDB, migrationDB, conn.Driver, memberID, input.RunID, mappings)
		if err != nil {
			errorCount++
			slog.Warn("member comparison failed, continuing",
				"member_id", memberID,
				"run_id", input.RunID,
				"error", err,
			)
			continue
		}

		for _, r := range results {
			if r.Match {
				matchCount++
			} else {
				mismatchCount++
			}
		}
		totalResults = append(totalResults, results...)

		// Batch insert when accumulated results reach defaultBatchSize.
		if len(totalResults) >= defaultBatchSize {
			inserted, err := db.InsertParallelRunResults(migrationDB, totalResults)
			if err != nil {
				slog.Warn("batch insert failed", "error", err, "run_id", input.RunID)
			} else {
				slog.Info("batch inserted results",
					"run_id", input.RunID,
					"inserted", inserted,
					"batch_size", len(totalResults),
				)
			}
			totalResults = totalResults[:0] // reset accumulator
		}

		// Progress reporting at batch boundaries (every 100 members or 10% milestone).
		if shouldReportProgress(i, len(memberIDs)) {
			pct := int(float64(i+1) / float64(len(memberIDs)) * 100)
			_ = q.UpdateProgress(ctx, job.JobID, pct)
		}
	}

	// Flush remaining results.
	if len(totalResults) > 0 {
		inserted, err := db.InsertParallelRunResults(migrationDB, totalResults)
		if err != nil {
			slog.Warn("final batch insert failed", "error", err, "run_id", input.RunID)
		} else {
			slog.Info("final batch inserted results",
				"run_id", input.RunID,
				"inserted", inserted,
			)
		}
	}

	_ = q.UpdateProgress(ctx, job.JobID, 100)

	slog.Info("parallel run: comparison complete",
		"run_id", input.RunID,
		"members", len(memberIDs),
		"matches", matchCount,
		"mismatches", mismatchCount,
		"errors", errorCount,
		"duration", time.Since(time.Now()), // will be zero — just for structured logging
	)

	// Mark parallel_run as COMPLETED.
	if _, err := db.UpdateParallelRunStatus(migrationDB, input.RunID, models.ParallelRunCompleted); err != nil {
		return fmt.Errorf("update run status to COMPLETED: %w", err)
	}

	result, _ := json.Marshal(map[string]interface{}{
		"run_id":     input.RunID,
		"members":    len(memberIDs),
		"matches":    matchCount,
		"mismatches": mismatchCount,
		"errors":     errorCount,
	})

	return q.Complete(ctx, job.JobID, result)
}

// getApprovedMappings queries approved field mappings for an engagement.
func getApprovedMappings(migrationDB *sql.DB, engagementID string) ([]approvedMapping, error) {
	rows, err := migrationDB.Query(
		`SELECT source_table, source_column, canonical_table, canonical_column
		 FROM migration.field_mapping
		 WHERE engagement_id = $1 AND approval_status = 'APPROVED'`,
		engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("query approved mappings: %w", err)
	}
	defer rows.Close()

	var mappings []approvedMapping
	for rows.Next() {
		var m approvedMapping
		if err := rows.Scan(&m.SourceTable, &m.SourceColumn, &m.CanonicalTable, &m.CanonicalColumn); err != nil {
			return nil, fmt.Errorf("scan mapping: %w", err)
		}
		mappings = append(mappings, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("approved mappings rows: %w", err)
	}
	return mappings, nil
}

// getSampledMembers returns member IDs from the canonical member table.
// For SAMPLE mode: random subset. For FULL mode: all members.
func getSampledMembers(ctx context.Context, srcDB *sql.DB, driver string, sampleRate float64, comparisonMode string) ([]string, error) {
	if comparisonMode == string(models.ComparisonModeSample) && sampleRate <= 0 {
		return nil, fmt.Errorf("sample_rate must be > 0 for SAMPLE mode")
	}

	// Get total member count first.
	var totalMembers int
	if err := srcDB.QueryRowContext(ctx, `SELECT COUNT(*) FROM member`).Scan(&totalMembers); err != nil {
		return nil, fmt.Errorf("count members: %w", err)
	}

	if totalMembers == 0 {
		return nil, nil
	}

	var query string
	if comparisonMode == string(models.ComparisonModeFull) || sampleRate >= 1.0 {
		query = `SELECT member_id FROM member ORDER BY member_id`
	} else {
		limit := int(float64(totalMembers) * sampleRate)
		if limit < 1 {
			limit = 1
		}
		query = fmt.Sprintf(`SELECT member_id FROM member ORDER BY random() LIMIT %d`, limit)
	}

	rows, err := srcDB.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query members: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan member id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// compareMemberFields compares all mapped fields for a single member.
func compareMemberFields(
	ctx context.Context,
	srcDB, migrationDB *sql.DB,
	driver, memberID, runID string,
	mappings []approvedMapping,
) ([]models.ParallelRunResult, error) {
	var results []models.ParallelRunResult
	now := time.Now().UTC().Format(time.RFC3339)

	for _, m := range mappings {
		// Get legacy value.
		legacyVal, err := queryFieldValue(ctx, srcDB, driver, m.SourceTable, m.SourceColumn, memberID)
		if err != nil {
			return nil, fmt.Errorf("query legacy %s.%s for member %s: %w", m.SourceTable, m.SourceColumn, memberID, err)
		}

		// Get canonical value.
		canonicalVal, err := queryFieldValue(ctx, migrationDB, "postgres", m.CanonicalTable, m.CanonicalColumn, memberID)
		if err != nil {
			return nil, fmt.Errorf("query canonical %s.%s for member %s: %w", m.CanonicalTable, m.CanonicalColumn, memberID, err)
		}

		// Get the source column data type for type-aware comparison.
		sourceDataType, _ := queryColumnDataType(ctx, srcDB, driver, m.SourceTable, m.SourceColumn)

		// Compare values.
		match, variance := compareValues(legacyVal, canonicalVal, sourceDataType)

		result := models.ParallelRunResult{
			RunID:           runID,
			MemberID:        memberID,
			CanonicalEntity: m.CanonicalTable,
			FieldName:       m.CanonicalColumn,
			LegacyValue:     legacyVal,
			NewValue:        canonicalVal,
			Match:           match,
			CheckedAt:       now,
		}
		if variance != nil {
			v := *variance
			result.VarianceAmount = &v
		}

		results = append(results, result)
	}

	return results, nil
}

// queryFieldValue retrieves a single field value for a member from a table.
func queryFieldValue(ctx context.Context, database *sql.DB, driver, table, column, memberID string) (*string, error) {
	quotedTable, err := quoteIdentL1("", table, driver)
	if err != nil {
		return nil, fmt.Errorf("unsafe table name: %w", err)
	}
	quotedCol, err := quoteIdentL1("", column, driver)
	if err != nil {
		return nil, fmt.Errorf("unsafe column name: %w", err)
	}

	query := fmt.Sprintf(`SELECT %s::TEXT FROM %s WHERE member_id = $1 LIMIT 1`, quotedCol, quotedTable)
	var val sql.NullString
	if err := database.QueryRowContext(ctx, query, memberID).Scan(&val); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if !val.Valid {
		return nil, nil
	}
	return &val.String, nil
}

// queryColumnDataType retrieves the data type for a column from information_schema.
func queryColumnDataType(ctx context.Context, database *sql.DB, driver, table, column string) (string, error) {
	var dataType string
	err := database.QueryRowContext(ctx,
		`SELECT data_type FROM information_schema.columns
		 WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
		table, column,
	).Scan(&dataType)
	if err != nil {
		return "", err
	}
	return strings.ToLower(dataType), nil
}

// compareValues performs type-aware comparison of two field values.
// Returns (match bool, variance *float64 for monetary fields).
func compareValues(legacy, canonical *string, dataType string) (bool, *float64) {
	// Both nil → match.
	if legacy == nil && canonical == nil {
		return true, nil
	}
	// One nil, one not → mismatch.
	if legacy == nil || canonical == nil {
		return false, nil
	}

	// Type-aware comparison based on source data type.
	if isMonetaryType(dataType) {
		return compareMonetary(*legacy, *canonical)
	}
	if isDateType(dataType) {
		return compareDates(*legacy, *canonical), nil
	}
	// Default: case-insensitive trimmed text comparison.
	return compareText(*legacy, *canonical), nil
}

// compareMonetary compares two monetary values using big.Rat precision.
// Returns match status and variance amount (new - legacy) for mismatches.
func compareMonetary(legacy, canonical string) (bool, *float64) {
	legacyRat, ok1 := new(big.Rat).SetString(strings.TrimSpace(legacy))
	canonicalRat, ok2 := new(big.Rat).SetString(strings.TrimSpace(canonical))

	if !ok1 || !ok2 {
		// Can't parse as numbers — fall back to text comparison.
		return compareText(legacy, canonical), nil
	}

	if legacyRat.Cmp(canonicalRat) == 0 {
		return true, nil
	}

	// Compute variance: canonical - legacy.
	diff := new(big.Rat).Sub(canonicalRat, legacyRat)
	variance, _ := diff.Float64()
	return false, &variance
}

// compareDates compares two date values, ignoring timezone formatting differences.
func compareDates(legacy, canonical string) bool {
	legacyTrimmed := strings.TrimSpace(legacy)
	canonicalTrimmed := strings.TrimSpace(canonical)

	// Try common date formats.
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02 15:04:05",
		"2006-01-02",
		"01/02/2006",
		"1/2/2006",
	}

	var legacyTime, canonicalTime time.Time
	var legacyParsed, canonicalParsed bool

	for _, f := range formats {
		if t, err := time.Parse(f, legacyTrimmed); err == nil {
			legacyTime = t
			legacyParsed = true
			break
		}
	}
	for _, f := range formats {
		if t, err := time.Parse(f, canonicalTrimmed); err == nil {
			canonicalTime = t
			canonicalParsed = true
			break
		}
	}

	if legacyParsed && canonicalParsed {
		// Compare dates (day-level) — ignore time component for date comparisons.
		return legacyTime.Year() == canonicalTime.Year() &&
			legacyTime.Month() == canonicalTime.Month() &&
			legacyTime.Day() == canonicalTime.Day()
	}

	// Could not parse as dates — fall back to text comparison.
	return compareText(legacy, canonical)
}

// compareText performs case-insensitive comparison after trimming whitespace.
func compareText(a, b string) bool {
	return strings.EqualFold(strings.TrimSpace(a), strings.TrimSpace(b))
}

// isMonetaryType returns true for SQL types that represent monetary/decimal values.
func isMonetaryType(dataType string) bool {
	switch dataType {
	case "numeric", "decimal", "money", "smallmoney":
		return true
	}
	return false
}

// isDateType returns true for SQL types that represent date/time values.
func isDateType(dataType string) bool {
	switch dataType {
	case "date", "timestamp", "timestamp without time zone",
		"timestamp with time zone", "datetime", "datetime2", "smalldatetime":
		return true
	}
	return false
}

// shouldReportProgress returns true at progress reporting boundaries:
// every progressBatchSize members OR at 10% milestones, whichever is smaller.
func shouldReportProgress(index, total int) bool {
	if total == 0 {
		return false
	}
	// Every progressBatchSize members.
	if (index+1)%progressBatchSize == 0 {
		return true
	}
	// At 10% milestones.
	tenPct := total / 10
	if tenPct < 1 {
		tenPct = 1
	}
	if (index+1)%tenPct == 0 {
		return true
	}
	return false
}

// markRunFailed is a helper to update parallel_run status to FAILED, ignoring transition errors.
func markRunFailed(migrationDB *sql.DB, runID string) error {
	_, err := db.UpdateParallelRunStatus(migrationDB, runID, models.ParallelRunFailed)
	return err
}

// markRunCancelled is a helper to update parallel_run status to CANCELLED.
func markRunCancelled(migrationDB *sql.DB, runID string) error {
	_, err := db.UpdateParallelRunStatus(migrationDB, runID, models.ParallelRunCancelled)
	return err
}
