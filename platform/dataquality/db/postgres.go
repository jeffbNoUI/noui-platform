// Package db provides PostgreSQL database connectivity and data access for the Data Quality service.
package db

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	_ "github.com/lib/pq"

	"github.com/noui/platform/dataquality/models"
	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/envutil"
)

// Store wraps a database connection and exposes Data Quality data-access methods.
type Store struct {
	DB *sql.DB
}

// NewStore creates a Store from an existing database connection.
func NewStore(db *sql.DB) *Store {
	return &Store{DB: db}
}

// Config holds database connection parameters.
type Config struct {
	Host         string
	Port         string
	User         string
	Password     string
	DBName       string
	SSLMode      string
	MaxOpenConns int
	MaxIdleConns int
}

// ConfigFromEnv creates a Config from environment variables with sensible defaults.
func ConfigFromEnv() Config {
	return Config{
		Host:         envutil.GetEnv("DB_HOST", "localhost"),
		Port:         envutil.GetEnv("DB_PORT", "5432"),
		User:         envutil.GetEnv("DB_USER", "noui"),
		Password:     envutil.GetEnv("DB_PASSWORD", "noui"),
		DBName:       envutil.GetEnv("DB_NAME", "noui"),
		SSLMode:      envutil.GetEnv("DB_SSLMODE", "disable"),
		MaxOpenConns: envutil.GetEnvInt("DB_MAX_OPEN_CONNS", 5),
		MaxIdleConns: envutil.GetEnvInt("DB_MAX_IDLE_CONNS", 2),
	}
}

// Connect establishes a database connection with retry logic.
func Connect(cfg Config) (*sql.DB, error) {
	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
	)

	var db *sql.DB
	var err error

	for attempt := 1; attempt <= 3; attempt++ {
		db, err = sql.Open("postgres", connStr)
		if err != nil {
			slog.Warn("database connection failed, retrying", "attempt", attempt, "error", err)
			time.Sleep(2 * time.Second)
			continue
		}

		err = db.Ping()
		if err != nil {
			slog.Warn("database connection failed, retrying", "attempt", attempt, "error", err)
			db.Close()
			time.Sleep(2 * time.Second)
			continue
		}

		if cfg.MaxIdleConns > cfg.MaxOpenConns {
			slog.Warn("MaxIdleConns exceeds MaxOpenConns, will be capped by database/sql",
				"max_idle_conns", cfg.MaxIdleConns, "max_open_conns", cfg.MaxOpenConns)
		}
		db.SetMaxOpenConns(cfg.MaxOpenConns)
		db.SetMaxIdleConns(cfg.MaxIdleConns)
		db.SetConnMaxLifetime(5 * time.Minute)

		slog.Info("database connected", "host", cfg.Host, "dbname", cfg.DBName, "max_open_conns", cfg.MaxOpenConns, "max_idle_conns", cfg.MaxIdleConns)
		return db, nil
	}

	return nil, fmt.Errorf("failed to connect after 3 attempts: %w", err)
}

// ============================================================
// CHECK DEFINITION QUERIES
// ============================================================

// ListChecks returns check definitions filtered by optional parameters.
func (s *Store) ListChecks(ctx context.Context, tenantID, category string, activeOnly bool, limit, offset int) ([]models.DQCheckDefinition, int, error) {
	where := "WHERE d.tenant_id = $1 AND d.deleted_at IS NULL"
	args := []interface{}{tenantID}
	argIdx := 2

	if activeOnly {
		where += " AND d.is_active = true"
	}
	if category != "" {
		where += fmt.Sprintf(" AND d.category = $%d", argIdx)
		args = append(args, category)
		argIdx++
	}

	var total int
	if err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, "SELECT COUNT(*) FROM dq_check_definition d "+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count checks: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT d.check_id, d.tenant_id, d.check_name, d.check_code, d.description,
		       d.category, d.severity, d.target_table, d.check_query, d.threshold,
		       d.is_active, d.schedule, d.created_at, d.updated_at, d.created_by, d.updated_by
		FROM dq_check_definition d
		%s
		ORDER BY d.category, d.severity DESC, d.check_name
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list checks: %w", err)
	}
	defer rows.Close()

	var checks []models.DQCheckDefinition
	for rows.Next() {
		var c models.DQCheckDefinition
		if err := rows.Scan(
			&c.CheckID, &c.TenantID, &c.CheckName, &c.CheckCode, &c.Description,
			&c.Category, &c.Severity, &c.TargetTable, &c.CheckQuery, &c.Threshold,
			&c.IsActive, &c.Schedule, &c.CreatedAt, &c.UpdatedAt, &c.CreatedBy, &c.UpdatedBy,
		); err != nil {
			return nil, 0, fmt.Errorf("scan check: %w", err)
		}
		checks = append(checks, c)
	}

	return checks, total, rows.Err()
}

// GetCheck returns a single check definition with its latest result.
func (s *Store) GetCheck(ctx context.Context, checkID string) (*models.DQCheckDefinition, error) {
	row := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `
		SELECT check_id, tenant_id, check_name, check_code, description,
		       category, severity, target_table, check_query, threshold,
		       is_active, schedule, created_at, updated_at, created_by, updated_by
		FROM dq_check_definition
		WHERE check_id = $1 AND deleted_at IS NULL
	`, checkID)

	var c models.DQCheckDefinition
	if err := row.Scan(
		&c.CheckID, &c.TenantID, &c.CheckName, &c.CheckCode, &c.Description,
		&c.Category, &c.Severity, &c.TargetTable, &c.CheckQuery, &c.Threshold,
		&c.IsActive, &c.Schedule, &c.CreatedAt, &c.UpdatedAt, &c.CreatedBy, &c.UpdatedBy,
	); err != nil {
		return nil, err
	}

	// Get latest result
	result, err := s.getLatestResult(ctx, checkID)
	if err == nil {
		c.LatestResult = result
	}

	return &c, nil
}

// ============================================================
// CHECK RESULT QUERIES
// ============================================================

func (s *Store) getLatestResult(ctx context.Context, checkID string) (*models.DQCheckResult, error) {
	row := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `
		SELECT result_id, check_id, tenant_id, run_at, records_checked,
		       records_passed, records_failed, pass_rate, status, duration_ms,
		       error_message, created_at
		FROM dq_check_result
		WHERE check_id = $1
		ORDER BY run_at DESC
		LIMIT 1
	`, checkID)

	var r models.DQCheckResult
	if err := row.Scan(
		&r.ResultID, &r.CheckID, &r.TenantID, &r.RunAt, &r.RecordsChecked,
		&r.RecordsPassed, &r.RecordsFailed, &r.PassRate, &r.Status, &r.DurationMs,
		&r.ErrorMessage, &r.CreatedAt,
	); err != nil {
		return nil, err
	}
	return &r, nil
}

// ListResults returns check results with optional filtering.
func (s *Store) ListResults(ctx context.Context, tenantID, checkID string, limit int) ([]models.DQCheckResult, error) {
	where := "WHERE r.tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if checkID != "" {
		where += fmt.Sprintf(" AND r.check_id = $%d", argIdx)
		args = append(args, checkID)
		argIdx++
	}

	query := fmt.Sprintf(`
		SELECT r.result_id, r.check_id, r.tenant_id, r.run_at, r.records_checked,
		       r.records_passed, r.records_failed, r.pass_rate, r.status, r.duration_ms,
		       r.error_message, r.created_at
		FROM dq_check_result r
		%s
		ORDER BY r.run_at DESC
		LIMIT $%d
	`, where, argIdx)
	args = append(args, limit)

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list results: %w", err)
	}
	defer rows.Close()

	var results []models.DQCheckResult
	for rows.Next() {
		var r models.DQCheckResult
		if err := rows.Scan(
			&r.ResultID, &r.CheckID, &r.TenantID, &r.RunAt, &r.RecordsChecked,
			&r.RecordsPassed, &r.RecordsFailed, &r.PassRate, &r.Status, &r.DurationMs,
			&r.ErrorMessage, &r.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan result: %w", err)
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

// ============================================================
// DQ SCORE QUERIES
// ============================================================

// GetScore calculates the aggregate DQ score from latest results.
// Critical checks have 3x weight, warning 2x, info 1x.
func (s *Store) GetScore(ctx context.Context, tenantID string) (*models.DQScore, error) {
	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, `
		SELECT d.category, d.severity, r.pass_rate, r.run_at
		FROM dq_check_definition d
		INNER JOIN LATERAL (
			SELECT pass_rate, run_at
			FROM dq_check_result
			WHERE check_id = d.check_id
			ORDER BY run_at DESC
			LIMIT 1
		) r ON true
		WHERE d.tenant_id = $1 AND d.is_active = true AND d.deleted_at IS NULL
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("get score: %w", err)
	}
	defer rows.Close()

	categoryTotals := make(map[string]struct{ weightedSum, totalWeight float64 })
	var totalWeight, weightedSum float64
	var totalChecks, passingChecks int
	var lastRunAt *time.Time

	for rows.Next() {
		var category, severity string
		var passRate float64
		var runAt time.Time
		if err := rows.Scan(&category, &severity, &passRate, &runAt); err != nil {
			return nil, err
		}

		weight := 1.0
		switch severity {
		case "critical":
			weight = 3.0
		case "warning":
			weight = 2.0
		}

		totalWeight += weight
		weightedSum += passRate * weight
		totalChecks++
		if passRate >= 95.0 {
			passingChecks++
		}

		cat := categoryTotals[category]
		cat.weightedSum += passRate * weight
		cat.totalWeight += weight
		categoryTotals[category] = cat

		if lastRunAt == nil || runAt.After(*lastRunAt) {
			lastRunAt = &runAt
		}
	}

	score := &models.DQScore{
		TotalChecks:    totalChecks,
		PassingChecks:  passingChecks,
		CategoryScores: make(map[string]float64),
		LastRunAt:      lastRunAt,
	}

	if totalWeight > 0 {
		score.OverallScore = weightedSum / totalWeight
	}

	for cat, totals := range categoryTotals {
		if totals.totalWeight > 0 {
			score.CategoryScores[cat] = totals.weightedSum / totals.totalWeight
		}
	}

	// Count open issues
	dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `
		SELECT COUNT(*) FROM dq_issue
		WHERE tenant_id = $1 AND status = 'open'
	`, tenantID).Scan(&score.OpenIssues)

	dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `
		SELECT COUNT(*) FROM dq_issue
		WHERE tenant_id = $1 AND status = 'open' AND severity = 'critical'
	`, tenantID).Scan(&score.CriticalIssues)

	return score, nil
}

// GetScoreTrend returns daily scores for the specified number of days.
func (s *Store) GetScoreTrend(ctx context.Context, tenantID string, days int) ([]models.DQScoreTrend, error) {
	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, `
		SELECT DATE(r.run_at) AS run_date,
		       SUM(r.pass_rate * CASE d.severity
		           WHEN 'critical' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END) /
		       NULLIF(SUM(CASE d.severity
		           WHEN 'critical' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END), 0) AS daily_score
		FROM dq_check_result r
		INNER JOIN dq_check_definition d ON d.check_id = r.check_id
		WHERE r.tenant_id = $1 AND r.run_at >= NOW() - INTERVAL '1 day' * $2
		GROUP BY DATE(r.run_at)
		ORDER BY run_date
	`, tenantID, days)
	if err != nil {
		return nil, fmt.Errorf("get score trend: %w", err)
	}
	defer rows.Close()

	var trend []models.DQScoreTrend
	for rows.Next() {
		var t models.DQScoreTrend
		if err := rows.Scan(&t.Date, &t.Score); err != nil {
			return nil, err
		}
		trend = append(trend, t)
	}
	return trend, rows.Err()
}

// ============================================================
// ISSUE QUERIES
// ============================================================

// ListIssues returns DQ issues with optional filtering.
func (s *Store) ListIssues(ctx context.Context, tenantID, severity, status string, limit, offset int) ([]models.DQIssue, int, error) {
	where := "WHERE i.tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

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
	if err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, "SELECT COUNT(*) FROM dq_issue i "+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count issues: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT i.issue_id, i.result_id, i.check_id, i.tenant_id, i.severity,
		       i.record_table, i.record_id, i.field_name, i.current_value,
		       i.expected_pattern, i.description, i.status, i.resolved_at,
		       i.resolved_by, i.resolution_note, i.created_at, i.updated_at
		FROM dq_issue i
		%s
		ORDER BY
			CASE i.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
			i.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list issues: %w", err)
	}
	defer rows.Close()

	var issues []models.DQIssue
	for rows.Next() {
		var iss models.DQIssue
		if err := rows.Scan(
			&iss.IssueID, &iss.ResultID, &iss.CheckID, &iss.TenantID, &iss.Severity,
			&iss.RecordTable, &iss.RecordID, &iss.FieldName, &iss.CurrentValue,
			&iss.ExpectedPattern, &iss.Description, &iss.Status, &iss.ResolvedAt,
			&iss.ResolvedBy, &iss.ResolutionNote, &iss.CreatedAt, &iss.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan issue: %w", err)
		}
		issues = append(issues, iss)
	}

	return issues, total, rows.Err()
}

// GetIssue returns a single issue.
func (s *Store) GetIssue(ctx context.Context, issueID string) (*models.DQIssue, error) {
	row := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `
		SELECT issue_id, result_id, check_id, tenant_id, severity,
		       record_table, record_id, field_name, current_value,
		       expected_pattern, description, status, resolved_at,
		       resolved_by, resolution_note, created_at, updated_at
		FROM dq_issue
		WHERE issue_id = $1
	`, issueID)

	var iss models.DQIssue
	if err := row.Scan(
		&iss.IssueID, &iss.ResultID, &iss.CheckID, &iss.TenantID, &iss.Severity,
		&iss.RecordTable, &iss.RecordID, &iss.FieldName, &iss.CurrentValue,
		&iss.ExpectedPattern, &iss.Description, &iss.Status, &iss.ResolvedAt,
		&iss.ResolvedBy, &iss.ResolutionNote, &iss.CreatedAt, &iss.UpdatedAt,
	); err != nil {
		return nil, err
	}

	return &iss, nil
}

// ============================================================
// SUPPRESSION QUERIES
// ============================================================

// GetSuppressedCheckCodes returns the check_codes that should be suppressed
// for the given tenant and context (e.g., context_key="contribution_model", context_value="employer_paid").
func (s *Store) GetSuppressedCheckCodes(ctx context.Context, tenantID, contextKey, contextValue string) ([]string, error) {
	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, `
		SELECT check_code FROM dq_suppression_rule
		WHERE tenant_id = $1 AND context_key = $2 AND context_value = $3
	`, tenantID, contextKey, contextValue)
	if err != nil {
		return nil, fmt.Errorf("get suppressed check codes: %w", err)
	}
	defer rows.Close()

	var codes []string
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			return nil, err
		}
		codes = append(codes, code)
	}
	return codes, rows.Err()
}

// ListIssuesWithSuppression returns issues excluding those from suppressed check codes.
// The suppressedCodes slice contains check_code values (e.g., "CONTRIB_NONNEG") to exclude.
func (s *Store) ListIssuesWithSuppression(ctx context.Context, tenantID, severity, status string, limit, offset int, suppressedCodes []string) ([]models.DQIssue, int, error) {
	if len(suppressedCodes) == 0 {
		return s.ListIssues(ctx, tenantID, severity, status, limit, offset)
	}

	where := "WHERE i.tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

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

	// Exclude issues whose check_id belongs to a suppressed check_code
	suppressPlaceholders := make([]string, len(suppressedCodes))
	for i, code := range suppressedCodes {
		suppressPlaceholders[i] = fmt.Sprintf("$%d", argIdx)
		args = append(args, code)
		argIdx++
	}
	where += fmt.Sprintf(` AND i.check_id NOT IN (
		SELECT d.check_id FROM dq_check_definition d
		WHERE d.tenant_id = $1 AND d.check_code IN (%s)
	)`, joinStrings(suppressPlaceholders, ", "))

	var total int
	if err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, "SELECT COUNT(*) FROM dq_issue i "+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count issues (suppressed): %w", err)
	}

	query := fmt.Sprintf(`
		SELECT i.issue_id, i.result_id, i.check_id, i.tenant_id, i.severity,
		       i.record_table, i.record_id, i.field_name, i.current_value,
		       i.expected_pattern, i.description, i.status, i.resolved_at,
		       i.resolved_by, i.resolution_note, i.created_at, i.updated_at
		FROM dq_issue i
		%s
		ORDER BY
			CASE i.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
			i.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list issues (suppressed): %w", err)
	}
	defer rows.Close()

	var issues []models.DQIssue
	for rows.Next() {
		var iss models.DQIssue
		if err := rows.Scan(
			&iss.IssueID, &iss.ResultID, &iss.CheckID, &iss.TenantID, &iss.Severity,
			&iss.RecordTable, &iss.RecordID, &iss.FieldName, &iss.CurrentValue,
			&iss.ExpectedPattern, &iss.Description, &iss.Status, &iss.ResolvedAt,
			&iss.ResolvedBy, &iss.ResolutionNote, &iss.CreatedAt, &iss.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan issue (suppressed): %w", err)
		}
		issues = append(issues, iss)
	}

	return issues, total, rows.Err()
}

// GetScoreWithSuppression calculates the aggregate DQ score excluding suppressed check codes.
func (s *Store) GetScoreWithSuppression(ctx context.Context, tenantID string, suppressedCodes []string) (*models.DQScore, error) {
	if len(suppressedCodes) == 0 {
		return s.GetScore(ctx, tenantID)
	}

	// Build the suppression filter
	args := []interface{}{tenantID}
	argIdx := 2
	suppressPlaceholders := make([]string, len(suppressedCodes))
	for i, code := range suppressedCodes {
		suppressPlaceholders[i] = fmt.Sprintf("$%d", argIdx)
		args = append(args, code)
		argIdx++
	}
	suppressFilter := fmt.Sprintf("AND d.check_code NOT IN (%s)", joinStrings(suppressPlaceholders, ", "))

	query := fmt.Sprintf(`
		SELECT d.category, d.severity, r.pass_rate, r.run_at
		FROM dq_check_definition d
		INNER JOIN LATERAL (
			SELECT pass_rate, run_at
			FROM dq_check_result
			WHERE check_id = d.check_id
			ORDER BY run_at DESC
			LIMIT 1
		) r ON true
		WHERE d.tenant_id = $1 AND d.is_active = true AND d.deleted_at IS NULL
		%s
	`, suppressFilter)

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("get score (suppressed): %w", err)
	}
	defer rows.Close()

	categoryTotals := make(map[string]struct{ weightedSum, totalWeight float64 })
	var totalWeight, weightedSum float64
	var totalChecks, passingChecks int
	var lastRunAt *time.Time

	for rows.Next() {
		var category, sev string
		var passRate float64
		var runAt time.Time
		if err := rows.Scan(&category, &sev, &passRate, &runAt); err != nil {
			return nil, err
		}

		weight := 1.0
		switch sev {
		case "critical":
			weight = 3.0
		case "warning":
			weight = 2.0
		}

		totalWeight += weight
		weightedSum += passRate * weight
		totalChecks++
		if passRate >= 95.0 {
			passingChecks++
		}

		ct := categoryTotals[category]
		ct.weightedSum += passRate * weight
		ct.totalWeight += weight
		categoryTotals[category] = ct

		if lastRunAt == nil || runAt.After(*lastRunAt) {
			lastRunAt = &runAt
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var overall float64
	if totalWeight > 0 {
		overall = weightedSum / totalWeight
	}

	catScores := make(map[string]float64, len(categoryTotals))
	for cat, ct := range categoryTotals {
		if ct.totalWeight > 0 {
			catScores[cat] = ct.weightedSum / ct.totalWeight
		}
	}

	score := &models.DQScore{
		OverallScore:   overall,
		TotalChecks:    totalChecks,
		PassingChecks:  passingChecks,
		CategoryScores: catScores,
		LastRunAt:      lastRunAt,
	}

	return score, nil
}

// joinStrings joins string slices with a separator (avoids importing strings package).
func joinStrings(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	result := strs[0]
	for _, s := range strs[1:] {
		result += sep + s
	}
	return result
}

// UpdateIssue updates an issue's status and resolution fields.
func (s *Store) UpdateIssue(ctx context.Context, iss *models.DQIssue) error {
	_, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, `
		UPDATE dq_issue
		SET status = $2, resolved_at = $3, resolved_by = $4, resolution_note = $5, updated_at = NOW()
		WHERE issue_id = $1
	`, iss.IssueID, iss.Status, iss.ResolvedAt, iss.ResolvedBy, iss.ResolutionNote)
	return err
}
