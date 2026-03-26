package db

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/noui/platform/migration/models"
)

// reconExecRunColumns is the standard column list for recon_execution_run queries.
const reconExecRunColumns = `execution_id, engagement_id, ruleset_id, parallel_run_id,
	status, total_evaluated, match_count, mismatch_count, p1_count, p2_count, p3_count,
	started_at, completed_at, error_message, created_at`

// scanReconExecRun scans a recon_execution_run row.
func scanReconExecRun(scanner interface{ Scan(...any) error }) (*models.ReconExecutionRun, error) {
	var r models.ReconExecutionRun
	err := scanner.Scan(
		&r.ExecutionID, &r.EngagementID, &r.RulesetID, &r.ParallelRunID,
		&r.Status, &r.TotalEvaluated, &r.MatchCount, &r.MismatchCount,
		&r.P1Count, &r.P2Count, &r.P3Count,
		&r.StartedAt, &r.CompletedAt, &r.ErrorMessage, &r.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// reconExecMismatchColumns is the standard column list for recon_execution_mismatch queries.
const reconExecMismatchColumns = `mismatch_id, execution_id, rule_id, member_id,
	canonical_entity, field_name, legacy_value, new_value, variance_amount,
	comparison_type, tolerance_value, priority, created_at`

// scanReconExecMismatch scans a recon_execution_mismatch row.
func scanReconExecMismatch(scanner interface{ Scan(...any) error }) (*models.ReconExecutionMismatch, error) {
	var m models.ReconExecutionMismatch
	err := scanner.Scan(
		&m.MismatchID, &m.ExecutionID, &m.RuleID, &m.MemberID,
		&m.CanonicalEntity, &m.FieldName, &m.LegacyValue, &m.NewValue,
		&m.VarianceAmount, &m.ComparisonType, &m.ToleranceValue, &m.Priority,
		&m.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// CreateReconExecutionRun inserts a new recon execution run in PENDING status.
func CreateReconExecutionRun(db *sql.DB, engagementID, rulesetID, parallelRunID string) (*models.ReconExecutionRun, error) {
	row := db.QueryRow(
		`INSERT INTO migration.recon_execution_run
		 (engagement_id, ruleset_id, parallel_run_id)
		 VALUES ($1, $2, $3)
		 RETURNING `+reconExecRunColumns,
		engagementID, rulesetID, parallelRunID,
	)
	return scanReconExecRun(row)
}

// GetReconExecutionRun retrieves a single recon execution run by ID.
func GetReconExecutionRun(db *sql.DB, executionID string) (*models.ReconExecutionRun, error) {
	row := db.QueryRow(
		`SELECT `+reconExecRunColumns+`
		 FROM migration.recon_execution_run
		 WHERE execution_id = $1`,
		executionID,
	)
	r, err := scanReconExecRun(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get recon execution run: %w", err)
	}
	return r, nil
}

// ListReconExecutionRuns returns paginated execution runs for an engagement (newest first).
func ListReconExecutionRuns(db *sql.DB, engagementID string, perPage, offset int) ([]models.ReconExecutionRun, error) {
	if perPage <= 0 || perPage > 100 {
		perPage = 20
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := db.Query(
		`SELECT `+reconExecRunColumns+`
		 FROM migration.recon_execution_run
		 WHERE engagement_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2 OFFSET $3`,
		engagementID, perPage, offset,
	)
	if err != nil {
		return nil, fmt.Errorf("list recon execution runs: %w", err)
	}
	defer rows.Close()

	var runs []models.ReconExecutionRun
	for rows.Next() {
		r, err := scanReconExecRun(rows)
		if err != nil {
			return nil, fmt.Errorf("scan recon execution run: %w", err)
		}
		runs = append(runs, *r)
	}
	return runs, rows.Err()
}

// UpdateReconExecutionRunStatus updates the status of an execution run.
// Sets started_at when transitioning to RUNNING, completed_at when transitioning to COMPLETED/FAILED.
func UpdateReconExecutionRunStatus(db *sql.DB, executionID string, status models.ReconExecutionRunStatus, errMsg *string) (*models.ReconExecutionRun, error) {
	setClauses := []string{"status = $2"}
	args := []any{executionID, string(status)}

	if status == models.ReconExecRunning {
		setClauses = append(setClauses, "started_at = now()")
	}
	if status == models.ReconExecCompleted || status == models.ReconExecFailed {
		setClauses = append(setClauses, "completed_at = now()")
	}
	if errMsg != nil {
		setClauses = append(setClauses, fmt.Sprintf("error_message = $%d", len(args)+1))
		args = append(args, *errMsg)
	}

	row := db.QueryRow(
		`UPDATE migration.recon_execution_run
		 SET `+strings.Join(setClauses, ", ")+`
		 WHERE execution_id = $1
		 RETURNING `+reconExecRunColumns,
		args...,
	)
	r, err := scanReconExecRun(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("update recon execution run status: %w", err)
	}
	return r, nil
}

// UpdateReconExecutionRunCounts atomically updates the match/mismatch/priority counts.
func UpdateReconExecutionRunCounts(db *sql.DB, executionID string, totalEvaluated, matchCount, mismatchCount, p1, p2, p3 int) error {
	_, err := db.Exec(
		`UPDATE migration.recon_execution_run
		 SET total_evaluated = $2, match_count = $3, mismatch_count = $4,
		     p1_count = $5, p2_count = $6, p3_count = $7
		 WHERE execution_id = $1`,
		executionID, totalEvaluated, matchCount, mismatchCount, p1, p2, p3,
	)
	if err != nil {
		return fmt.Errorf("update recon execution run counts: %w", err)
	}
	return nil
}

// InsertReconExecutionMismatches batch-inserts mismatches in a single transaction.
func InsertReconExecutionMismatches(db *sql.DB, mismatches []models.ReconExecutionMismatch) error {
	if len(mismatches) == 0 {
		return nil
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin insert mismatches tx: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(
		`INSERT INTO migration.recon_execution_mismatch
		 (execution_id, rule_id, member_id, canonical_entity, field_name,
		  legacy_value, new_value, variance_amount, comparison_type, tolerance_value, priority)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
	)
	if err != nil {
		return fmt.Errorf("prepare insert mismatch: %w", err)
	}
	defer stmt.Close()

	for _, m := range mismatches {
		_, err := stmt.Exec(
			m.ExecutionID, m.RuleID, m.MemberID, m.CanonicalEntity, m.FieldName,
			m.LegacyValue, m.NewValue, m.VarianceAmount,
			string(m.ComparisonType), m.ToleranceValue, string(m.Priority),
		)
		if err != nil {
			return fmt.Errorf("insert mismatch row: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit insert mismatches: %w", err)
	}
	return nil
}

// ListReconExecutionMismatches returns paginated mismatches with optional priority and entity filters.
func ListReconExecutionMismatches(db *sql.DB, executionID string, priorityFilter, entityFilter *string, perPage, offset int) ([]models.ReconExecutionMismatch, error) {
	if perPage <= 0 || perPage > 200 {
		perPage = 50
	}
	if offset < 0 {
		offset = 0
	}

	query := `SELECT ` + reconExecMismatchColumns + `
		 FROM migration.recon_execution_mismatch
		 WHERE execution_id = $1`
	args := []any{executionID}
	argIdx := 2

	if priorityFilter != nil && *priorityFilter != "" {
		query += fmt.Sprintf(` AND priority = $%d`, argIdx)
		args = append(args, *priorityFilter)
		argIdx++
	}
	if entityFilter != nil && *entityFilter != "" {
		query += fmt.Sprintf(` AND canonical_entity = $%d`, argIdx)
		args = append(args, *entityFilter)
		argIdx++
	}

	query += ` ORDER BY created_at DESC`
	query += fmt.Sprintf(` LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	args = append(args, perPage, offset)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list recon execution mismatches: %w", err)
	}
	defer rows.Close()

	var mismatches []models.ReconExecutionMismatch
	for rows.Next() {
		m, err := scanReconExecMismatch(rows)
		if err != nil {
			return nil, fmt.Errorf("scan recon execution mismatch: %w", err)
		}
		mismatches = append(mismatches, *m)
	}
	return mismatches, rows.Err()
}

// CountReconExecutionMismatches returns the total count of mismatches for an execution.
func CountReconExecutionMismatches(db *sql.DB, executionID string) (int, error) {
	var count int
	err := db.QueryRow(
		`SELECT COUNT(*) FROM migration.recon_execution_mismatch WHERE execution_id = $1`,
		executionID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count recon execution mismatches: %w", err)
	}
	return count, nil
}

// GetReconExecutionSummary returns aggregate metrics from the most recent COMPLETED execution.
func GetReconExecutionSummary(db *sql.DB, engagementID string) (*models.ReconExecutionSummary, error) {
	var s models.ReconExecutionSummary
	err := db.QueryRow(
		`SELECT total_evaluated, match_count, mismatch_count, p1_count, p2_count, p3_count
		 FROM migration.recon_execution_run
		 WHERE engagement_id = $1 AND status = 'COMPLETED'
		 ORDER BY completed_at DESC
		 LIMIT 1`,
		engagementID,
	).Scan(&s.TotalEvaluated, &s.MatchCount, &s.MismatchCount, &s.P1Count, &s.P2Count, &s.P3Count)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get recon execution summary: %w", err)
	}
	if s.TotalEvaluated > 0 {
		s.MatchRatio = float64(s.MatchCount) / float64(s.TotalEvaluated)
	}
	return &s, nil
}
