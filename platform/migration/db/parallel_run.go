package db

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/noui/platform/migration/models"
)

// parallelRunColumns is the standard column list for parallel_run queries.
const parallelRunColumns = `run_id, engagement_id, name, description, status,
		legacy_source, canonical_source, comparison_mode, sample_rate,
		started_by, started_at, completed_at, created_at`

// scanParallelRun scans a parallel_run row into a ParallelRun struct.
func scanParallelRun(scanner interface{ Scan(...any) error }) (*models.ParallelRun, error) {
	var r models.ParallelRun
	err := scanner.Scan(
		&r.RunID, &r.EngagementID, &r.Name, &r.Description, &r.Status,
		&r.LegacySource, &r.CanonicalSource, &r.ComparisonMode, &r.SampleRate,
		&r.StartedBy, &r.StartedAt, &r.CompletedAt, &r.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// parallelRunResultColumns is the standard column list for parallel_run_result queries.
const parallelRunResultColumns = `result_id, run_id, member_id, canonical_entity, field_name,
		legacy_value, new_value, match, variance_amount, variance_pct, checked_at`

// scanParallelRunResult scans a parallel_run_result row into a ParallelRunResult struct.
func scanParallelRunResult(scanner interface{ Scan(...any) error }) (*models.ParallelRunResult, error) {
	var r models.ParallelRunResult
	err := scanner.Scan(
		&r.ResultID, &r.RunID, &r.MemberID, &r.CanonicalEntity, &r.FieldName,
		&r.LegacyValue, &r.NewValue, &r.Match, &r.VarianceAmount, &r.VariancePct,
		&r.CheckedAt,
	)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// CreateParallelRun inserts a new parallel run and returns the created record.
func CreateParallelRun(db *sql.DB, r *models.ParallelRun) (*models.ParallelRun, error) {
	row := db.QueryRow(
		`INSERT INTO migration.parallel_run
		 (engagement_id, name, description, status, legacy_source, canonical_source,
		  comparison_mode, sample_rate, started_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING `+parallelRunColumns,
		r.EngagementID, r.Name, r.Description, string(r.Status),
		r.LegacySource, r.CanonicalSource, string(r.ComparisonMode),
		r.SampleRate, r.StartedBy,
	)
	created, err := scanParallelRun(row)
	if err != nil {
		return nil, fmt.Errorf("create parallel run: %w", err)
	}
	return created, nil
}

// GetParallelRun retrieves a single parallel run by ID.
func GetParallelRun(db *sql.DB, runID string) (*models.ParallelRun, error) {
	row := db.QueryRow(
		`SELECT `+parallelRunColumns+`
		 FROM migration.parallel_run
		 WHERE run_id = $1`,
		runID,
	)
	r, err := scanParallelRun(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get parallel run: %w", err)
	}
	return r, nil
}

// ListParallelRuns returns parallel runs for an engagement, ordered by created_at DESC.
// If statusFilter is non-empty, only runs with that status are returned.
func ListParallelRuns(db *sql.DB, engagementID string, statusFilter *string) ([]models.ParallelRun, error) {
	query := `SELECT ` + parallelRunColumns + `
		 FROM migration.parallel_run
		 WHERE engagement_id = $1`
	args := []any{engagementID}

	if statusFilter != nil && *statusFilter != "" {
		query += ` AND status = $2`
		args = append(args, *statusFilter)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list parallel runs: %w", err)
	}
	defer rows.Close()

	var runs []models.ParallelRun
	for rows.Next() {
		r, err := scanParallelRun(rows)
		if err != nil {
			return nil, fmt.Errorf("scan parallel run: %w", err)
		}
		runs = append(runs, *r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list parallel runs rows: %w", err)
	}
	return runs, nil
}

// UpdateParallelRunStatus updates the status of a parallel run with transition validation.
// Returns the updated record or an error if the transition is invalid.
func UpdateParallelRunStatus(db *sql.DB, runID string, newStatus models.ParallelRunStatus) (*models.ParallelRun, error) {
	// Read current status for transition validation.
	current, err := GetParallelRun(db, runID)
	if err != nil {
		return nil, fmt.Errorf("update parallel run status: %w", err)
	}
	if current == nil {
		return nil, fmt.Errorf("update parallel run status: run %s not found", runID)
	}

	if err := current.Status.ValidateTransition(newStatus); err != nil {
		return nil, err
	}

	// Build SET clause based on the target status.
	setClauses := []string{"status = $2"}
	args := []any{runID, string(newStatus)}
	if newStatus == models.ParallelRunRunning && current.Status == models.ParallelRunPending {
		setClauses = append(setClauses, "started_at = now()")
	}
	if newStatus == models.ParallelRunCompleted || newStatus == models.ParallelRunFailed || newStatus == models.ParallelRunCancelled {
		setClauses = append(setClauses, "completed_at = now()")
	}

	row := db.QueryRow(
		`UPDATE migration.parallel_run
		 SET `+strings.Join(setClauses, ", ")+`
		 WHERE run_id = $1
		 RETURNING `+parallelRunColumns,
		args...,
	)
	updated, err := scanParallelRun(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("update parallel run status: %w", err)
	}
	return updated, nil
}

// InsertParallelRunResults batch-inserts results using ON CONFLICT DO NOTHING for idempotent retries.
// Returns the number of rows actually inserted (excluding conflicts).
func InsertParallelRunResults(db *sql.DB, results []models.ParallelRunResult) (int, error) {
	if len(results) == 0 {
		return 0, nil
	}

	tx, err := db.Begin()
	if err != nil {
		return 0, fmt.Errorf("begin insert results tx: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(
		`INSERT INTO migration.parallel_run_result
		 (run_id, member_id, canonical_entity, field_name, legacy_value, new_value,
		  match, variance_amount, variance_pct)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (run_id, member_id, canonical_entity, field_name) DO NOTHING`)
	if err != nil {
		return 0, fmt.Errorf("prepare insert result: %w", err)
	}
	defer stmt.Close()

	inserted := 0
	for _, r := range results {
		res, err := stmt.Exec(
			r.RunID, r.MemberID, r.CanonicalEntity, r.FieldName,
			r.LegacyValue, r.NewValue, r.Match, r.VarianceAmount, r.VariancePct,
		)
		if err != nil {
			return inserted, fmt.Errorf("insert result row: %w", err)
		}
		n, _ := res.RowsAffected()
		inserted += int(n)
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("commit insert results: %w", err)
	}
	return inserted, nil
}

// GetParallelRunResults retrieves paginated results for a parallel run.
// matchFilter: nil=all, true=matches only, false=mismatches only.
// entityFilter: nil=all entities, non-empty=filter by canonical_entity.
// perPage max is 200. offset is 0-based.
func GetParallelRunResults(db *sql.DB, runID string, matchFilter *bool, entityFilter *string, perPage, offset int) ([]models.ParallelRunResult, error) {
	if perPage <= 0 || perPage > 200 {
		perPage = 200
	}
	if offset < 0 {
		offset = 0
	}

	query := `SELECT ` + parallelRunResultColumns + `
		 FROM migration.parallel_run_result
		 WHERE run_id = $1`
	args := []any{runID}
	argIdx := 2

	if matchFilter != nil {
		query += fmt.Sprintf(` AND match = $%d`, argIdx)
		args = append(args, *matchFilter)
		argIdx++
	}

	if entityFilter != nil && *entityFilter != "" {
		query += fmt.Sprintf(` AND canonical_entity = $%d`, argIdx)
		args = append(args, *entityFilter)
		argIdx++
	}

	query += ` ORDER BY checked_at DESC`
	query += fmt.Sprintf(` LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	args = append(args, perPage, offset)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("get parallel run results: %w", err)
	}
	defer rows.Close()

	var results []models.ParallelRunResult
	for rows.Next() {
		r, err := scanParallelRunResult(rows)
		if err != nil {
			return nil, fmt.Errorf("scan parallel run result: %w", err)
		}
		results = append(results, *r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("get parallel run results rows: %w", err)
	}
	return results, nil
}

// GetAllParallelRunResults retrieves ALL results for a parallel run without pagination.
// Used by the recon execution engine which needs the full dataset to avoid evaluation gaps.
func GetAllParallelRunResults(db *sql.DB, runID string) ([]models.ParallelRunResult, error) {
	rows, err := db.Query(
		`SELECT `+parallelRunResultColumns+`
		 FROM migration.parallel_run_result
		 WHERE run_id = $1
		 ORDER BY checked_at`,
		runID,
	)
	if err != nil {
		return nil, fmt.Errorf("get all parallel run results: %w", err)
	}
	defer rows.Close()

	var results []models.ParallelRunResult
	for rows.Next() {
		r, err := scanParallelRunResult(rows)
		if err != nil {
			return nil, fmt.Errorf("scan parallel run result: %w", err)
		}
		results = append(results, *r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("get all parallel run results rows: %w", err)
	}
	return results, nil
}

// CountParallelRunResults returns the total number of results matching the given filters.
func CountParallelRunResults(db *sql.DB, runID string, matchFilter *bool, entityFilter *string) (int, error) {
	query := `SELECT COUNT(*) FROM migration.parallel_run_result WHERE run_id = $1`
	args := []any{runID}
	argIdx := 2

	if matchFilter != nil {
		query += fmt.Sprintf(` AND match = $%d`, argIdx)
		args = append(args, *matchFilter)
		argIdx++
	}

	if entityFilter != nil && *entityFilter != "" {
		query += fmt.Sprintf(` AND canonical_entity = $%d`, argIdx)
		args = append(args, *entityFilter)
		argIdx++
	}

	var count int
	if err := db.QueryRow(query, args...).Scan(&count); err != nil {
		return 0, fmt.Errorf("count parallel run results: %w", err)
	}
	return count, nil
}

// GetParallelRunSummary returns aggregate match/mismatch metrics via SQL COUNT/SUM.
func GetParallelRunSummary(db *sql.DB, runID string) (*models.ParallelRunSummary, error) {
	// Aggregate by entity in a single query.
	rows, err := db.Query(
		`SELECT canonical_entity,
		        COUNT(*) FILTER (WHERE match = true) AS match_count,
		        COUNT(*) FILTER (WHERE match = false) AS mismatch_count
		 FROM migration.parallel_run_result
		 WHERE run_id = $1
		 GROUP BY canonical_entity`,
		runID,
	)
	if err != nil {
		return nil, fmt.Errorf("get parallel run summary: %w", err)
	}
	defer rows.Close()

	summary := &models.ParallelRunSummary{
		ByEntity: make(map[string]models.EntityMatchSummary),
	}

	for rows.Next() {
		var entity string
		var matchCount, mismatchCount int
		if err := rows.Scan(&entity, &matchCount, &mismatchCount); err != nil {
			return nil, fmt.Errorf("scan parallel run summary: %w", err)
		}
		summary.ByEntity[entity] = models.EntityMatchSummary{
			MatchCount:    matchCount,
			MismatchCount: mismatchCount,
		}
		summary.MatchCount += matchCount
		summary.MismatchCount += mismatchCount
		summary.TotalCompared += matchCount + mismatchCount
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("parallel run summary rows: %w", err)
	}

	if summary.TotalCompared > 0 {
		summary.MatchRatePct = float64(summary.MatchCount) / float64(summary.TotalCompared) * 100.0
	}

	return summary, nil
}
