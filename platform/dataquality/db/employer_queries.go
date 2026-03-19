package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/noui/platform/dataquality/models"
	"github.com/noui/platform/dbcontext"
)

// employerTargetTablePlaceholders returns a comma-separated list of $N placeholders
// for EmployerTargetTables, starting at startIdx. Also returns the args slice.
func employerTargetTablePlaceholders(startIdx int) (string, []interface{}) {
	var placeholders []string
	var args []interface{}
	for i, table := range models.EmployerTargetTables {
		placeholders = append(placeholders, fmt.Sprintf("$%d", startIdx+i))
		args = append(args, table)
	}
	return strings.Join(placeholders, ", "), args
}

// GetEmployerScore returns a DQ score scoped to employer-domain target tables.
func (s *Store) GetEmployerScore(ctx context.Context, tenantID, orgID string) (*models.EmployerDQSummary, error) {
	placeholders, tableArgs := employerTargetTablePlaceholders(2)

	query := fmt.Sprintf(`
		SELECT
			COUNT(*) AS total_checks,
			COUNT(*) FILTER (WHERE lr.pass_rate >= COALESCE(c.threshold, 0.95)) AS passing_checks
		FROM dq_check_definition c
		LEFT JOIN LATERAL (
			SELECT pass_rate FROM dq_check_result
			WHERE check_id = c.check_id AND tenant_id = c.tenant_id
			ORDER BY run_at DESC LIMIT 1
		) lr ON true
		WHERE c.tenant_id = $1 AND c.is_active = true
		  AND c.target_table IN (%s)`, placeholders)

	args := []interface{}{tenantID}
	args = append(args, tableArgs...)

	var summary models.EmployerDQSummary
	summary.OrgID = orgID

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, args...).Scan(
		&summary.TotalChecks, &summary.PassingChecks,
	)
	if err != nil {
		return nil, fmt.Errorf("getting employer DQ score: %w", err)
	}

	if summary.TotalChecks > 0 {
		summary.OverallScore = float64(summary.PassingChecks) / float64(summary.TotalChecks) * 100
	}

	// Count open issues in employer tables
	issueQuery := fmt.Sprintf(`
		SELECT
			COUNT(*) AS open_issues,
			COUNT(*) FILTER (WHERE severity = 'critical') AS critical_issues
		FROM dq_issue
		WHERE tenant_id = $1 AND status = 'open'
		  AND record_table IN (%s)`, placeholders)

	err = dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, issueQuery, args...).Scan(
		&summary.OpenIssues, &summary.CriticalIssues,
	)
	if err != nil {
		return nil, fmt.Errorf("getting employer DQ issue counts: %w", err)
	}

	return &summary, nil
}

// ListEmployerIssues returns DQ issues scoped to employer-domain target tables.
func (s *Store) ListEmployerIssues(ctx context.Context, tenantID, orgID, severity, status string, limit, offset int) ([]models.DQIssue, int, error) {
	placeholders, tableArgs := employerTargetTablePlaceholders(2)

	where := fmt.Sprintf("WHERE i.tenant_id = $1 AND i.record_table IN (%s)", placeholders)
	args := []interface{}{tenantID}
	args = append(args, tableArgs...)
	argIdx := 2 + len(models.EmployerTargetTables)

	if severity != "" {
		where += fmt.Sprintf(" AND i.severity = $%d", argIdx)
		args = append(args, severity)
		argIdx++
	}
	if status != "" {
		where += fmt.Sprintf(" AND i.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	var total int
	countQuery := "SELECT COUNT(*) FROM dq_issue i " + where
	if err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting employer DQ issues: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT issue_id, result_id, check_id, tenant_id, severity,
		       record_table, record_id, field_name, current_value,
		       expected_pattern, description, status,
		       resolved_at, resolved_by, resolution_note,
		       created_at, updated_at
		FROM dq_issue i
		%s
		ORDER BY i.created_at DESC
		LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing employer DQ issues: %w", err)
	}
	defer rows.Close()

	var issues []models.DQIssue
	for rows.Next() {
		var issue models.DQIssue
		var fieldName, currentValue, expectedPattern sql.NullString
		var resolvedAt sql.NullTime
		var resolvedBy, resolutionNote sql.NullString

		err := rows.Scan(
			&issue.IssueID, &issue.ResultID, &issue.CheckID, &issue.TenantID, &issue.Severity,
			&issue.RecordTable, &issue.RecordID, &fieldName, &currentValue,
			&expectedPattern, &issue.Description, &issue.Status,
			&resolvedAt, &resolvedBy, &resolutionNote,
			&issue.CreatedAt, &issue.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning employer DQ issue: %w", err)
		}

		if fieldName.Valid {
			issue.FieldName = &fieldName.String
		}
		if currentValue.Valid {
			issue.CurrentValue = &currentValue.String
		}
		if expectedPattern.Valid {
			issue.ExpectedPattern = &expectedPattern.String
		}
		if resolvedAt.Valid {
			issue.ResolvedAt = &resolvedAt.Time
		}
		if resolvedBy.Valid {
			issue.ResolvedBy = &resolvedBy.String
		}
		if resolutionNote.Valid {
			issue.ResolutionNote = &resolutionNote.String
		}

		issues = append(issues, issue)
	}

	return issues, total, rows.Err()
}

// ListEmployerChecks returns DQ check definitions for employer-domain target tables.
func (s *Store) ListEmployerChecks(ctx context.Context, tenantID string, limit, offset int) ([]models.DQCheckDefinition, int, error) {
	placeholders, tableArgs := employerTargetTablePlaceholders(2)

	query := fmt.Sprintf(`
		SELECT check_id, tenant_id, check_name, check_code, description,
		       category, severity, target_table, check_query, threshold,
		       is_active, schedule, created_at, updated_at, created_by, updated_by,
		       COUNT(*) OVER() AS total_count
		FROM dq_check_definition
		WHERE tenant_id = $1 AND target_table IN (%s) AND is_active = true
		ORDER BY category, severity, check_name
		LIMIT $%d OFFSET $%d`, placeholders, 2+len(models.EmployerTargetTables), 3+len(models.EmployerTargetTables))

	args := []interface{}{tenantID}
	args = append(args, tableArgs...)
	args = append(args, limit, offset)

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing employer DQ checks: %w", err)
	}
	defer rows.Close()

	var checks []models.DQCheckDefinition
	var totalCount int

	for rows.Next() {
		var c models.DQCheckDefinition
		var description, checkQuery sql.NullString
		var threshold sql.NullFloat64

		err := rows.Scan(
			&c.CheckID, &c.TenantID, &c.CheckName, &c.CheckCode, &description,
			&c.Category, &c.Severity, &c.TargetTable, &checkQuery, &threshold,
			&c.IsActive, &c.Schedule, &c.CreatedAt, &c.UpdatedAt, &c.CreatedBy, &c.UpdatedBy,
			&totalCount,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning employer DQ check: %w", err)
		}

		if description.Valid {
			c.Description = &description.String
		}
		if checkQuery.Valid {
			c.CheckQuery = &checkQuery.String
		}
		if threshold.Valid {
			c.Threshold = &threshold.Float64
		}

		checks = append(checks, c)
	}

	return checks, totalCount, rows.Err()
}
