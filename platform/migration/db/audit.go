package db

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/noui/platform/migration/models"
	"github.com/noui/platform/migration/reconciler"
)

// MaxExportRows is the safety threshold for audit export. If the estimated
// row count exceeds this limit, the export is rejected with 422 to prevent
// timeout on very large audit trails.
const MaxExportRows = 50_000

// ExportOptions holds optional filters for audit log export.
type ExportOptions struct {
	From       *time.Time
	To         *time.Time
	EntityType *string
	Actor      *string
}

// RetentionPolicy holds the configurable retention periods per engagement.
type RetentionPolicy struct {
	EventRetentionDays    int `json:"event_retention_days"`
	AuditLogRetentionDays int `json:"audit_log_retention_days"`
}

// MinRetentionDays is the minimum allowed retention period (1 year).
const MinRetentionDays = 365

// AuditLogger writes immutable audit entries to migration.audit_log.
// Audit INSERTs are non-blocking: if the INSERT fails, the error is logged
// via slog.Error and the caller receives nil. Audit failure must not fail
// the parent mutation.
type AuditLogger struct {
	DB *sql.DB
}

// NewAuditLogger creates an AuditLogger wrapping the given database connection.
func NewAuditLogger(db *sql.DB) *AuditLogger {
	return &AuditLogger{DB: db}
}

// Log inserts an audit entry into migration.audit_log.
// Non-blocking: returns nil even if the INSERT fails. Failures are logged.
func (a *AuditLogger) Log(ctx context.Context, entry models.AuditEntry) error {
	if a == nil || a.DB == nil {
		return nil
	}

	_, err := a.DB.ExecContext(ctx,
		`INSERT INTO migration.audit_log
			(engagement_id, actor, action, entity_type, entity_id, before_state, after_state, metadata)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		entry.EngagementID,
		entry.Actor,
		entry.Action,
		entry.EntityType,
		entry.EntityID,
		auditNullableJSON(entry.BeforeState),
		auditNullableJSON(entry.AfterState),
		auditNullableJSON(entry.Metadata),
	)
	if err != nil {
		slog.Error("audit log INSERT failed",
			"error", err,
			"engagement_id", entry.EngagementID,
			"entity_type", entry.EntityType,
			"entity_id", entry.EntityID,
			"action", entry.Action,
		)
		// Non-blocking: swallow error, return nil.
		return nil
	}
	return nil
}

// auditNullableJSON returns nil if the raw JSON is empty or null, otherwise returns the value.
func auditNullableJSON(raw []byte) interface{} {
	if len(raw) == 0 {
		return nil
	}
	return raw
}

// AuditLogFilter holds optional filters for listing audit log entries.
type AuditLogFilter struct {
	EntityType *string
	EntityID   *string
	Actor      *string
	Page       int
	PerPage    int
}

// ListAuditLog returns paginated audit entries for an engagement with optional filters.
func ListAuditLog(db *sql.DB, engagementID string, filter AuditLogFilter) (*models.AuditLogResponse, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PerPage < 1 {
		filter.PerPage = 50
	}
	if filter.PerPage > 200 {
		filter.PerPage = 200
	}

	// Build WHERE clause with optional filters.
	where := "WHERE engagement_id = $1"
	args := []interface{}{engagementID}
	argN := 2

	if filter.EntityType != nil {
		where += fmt.Sprintf(" AND entity_type = $%d", argN)
		args = append(args, *filter.EntityType)
		argN++
	}
	if filter.EntityID != nil {
		where += fmt.Sprintf(" AND entity_id = $%d", argN)
		args = append(args, *filter.EntityID)
		argN++
	}
	if filter.Actor != nil {
		where += fmt.Sprintf(" AND actor = $%d", argN)
		args = append(args, *filter.Actor)
		argN++
	}

	// Count total matching entries.
	var total int
	countSQL := "SELECT COUNT(*) FROM migration.audit_log " + where
	if err := db.QueryRow(countSQL, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("audit log count: %w", err)
	}

	// Fetch the page.
	offset := (filter.Page - 1) * filter.PerPage
	selectSQL := fmt.Sprintf(
		`SELECT log_id, engagement_id, actor, action, entity_type, entity_id,
		        before_state, after_state, metadata, created_at
		 FROM migration.audit_log %s
		 ORDER BY created_at DESC
		 LIMIT $%d OFFSET $%d`,
		where, argN, argN+1,
	)
	args = append(args, filter.PerPage, offset)

	rows, err := db.Query(selectSQL, args...)
	if err != nil {
		return nil, fmt.Errorf("audit log query: %w", err)
	}
	defer rows.Close()

	var entries []models.AuditLogEntry
	for rows.Next() {
		var e models.AuditLogEntry
		var beforeState, afterState, metadata []byte
		if err := rows.Scan(
			&e.LogID, &e.EngagementID, &e.Actor, &e.Action,
			&e.EntityType, &e.EntityID, &beforeState, &afterState,
			&metadata, &e.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan audit log entry: %w", err)
		}
		if beforeState != nil {
			e.BeforeState = beforeState
		}
		if afterState != nil {
			e.AfterState = afterState
		}
		if metadata != nil {
			e.Metadata = metadata
		}
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("audit log rows: %w", err)
	}

	if entries == nil {
		entries = []models.AuditLogEntry{}
	}

	return &models.AuditLogResponse{
		Entries: entries,
		Total:   total,
		Page:    filter.Page,
		PerPage: filter.PerPage,
	}, nil
}

// ComputeReconIntegrityHash computes a SHA-256 hash over a canonical string
// representation of a reconciliation result. NULL fields are represented as
// empty strings. The hash is deterministic for the same inputs.
func ComputeReconIntegrityHash(r *reconciler.ReconciliationResult) string {
	batchID := r.BatchID
	memberID := r.MemberID
	// ReconciliationResult does not have CalcName — use empty string.
	// The DB has calc_name but the reconciler struct does not carry it.
	calcName := ""
	legacyValue := r.SourceValue
	recomputedValue := r.RecomputedValue
	canonicalValue := r.CanonicalValue
	varianceAmount := r.VarianceAmount

	canonical := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		batchID, memberID, calcName, legacyValue, recomputedValue, canonicalValue, varianceAmount)

	hash := sha256.Sum256([]byte(canonical))
	return fmt.Sprintf("%x", hash)
}

// buildExportWhereClause constructs the WHERE clause and args for export queries.
// Returns (whereSQL, args, nextArgN).
func buildExportWhereClause(engagementID string, opts ExportOptions) (string, []interface{}, int) {
	where := "WHERE engagement_id = $1"
	args := []interface{}{engagementID}
	argN := 2

	if opts.From != nil {
		where += fmt.Sprintf(" AND created_at >= $%d", argN)
		args = append(args, *opts.From)
		argN++
	}
	if opts.To != nil {
		where += fmt.Sprintf(" AND created_at <= $%d", argN)
		args = append(args, *opts.To)
		argN++
	}
	if opts.EntityType != nil {
		where += fmt.Sprintf(" AND entity_type = $%d", argN)
		args = append(args, *opts.EntityType)
		argN++
	}
	if opts.Actor != nil {
		where += fmt.Sprintf(" AND actor = $%d", argN)
		args = append(args, *opts.Actor)
		argN++
	}
	return where, args, argN
}

// CountAuditExport returns the total number of rows that would be exported
// with the given filters. This runs the same UNION ALL as GetAuditExport
// but only counts rows.
func CountAuditExport(db *sql.DB, engagementID string, opts ExportOptions) (int, error) {
	auditWhere, auditArgs, _ := buildExportWhereClause(engagementID, opts)

	// Build gate_transition WHERE clause separately (different column names).
	gateWhere, gateArgs, _ := buildGateExportWhereClause(engagementID, opts)

	// Rewrite gate args to use parameter positions after audit args.
	offset := len(auditArgs)
	rewrittenGateWhere := rewriteArgPositions(gateWhere, offset)
	allArgs := append(auditArgs, gateArgs...)

	query := fmt.Sprintf(`
		SELECT (
			(SELECT COUNT(*) FROM migration.audit_log %s)
			+
			(SELECT COUNT(*) FROM migration.gate_transition %s)
		)`, auditWhere, rewrittenGateWhere)

	var total int
	if err := db.QueryRow(query, allArgs...).Scan(&total); err != nil {
		return 0, fmt.Errorf("count audit export: %w", err)
	}
	return total, nil
}

// GetAuditExport returns a streaming sql.Rows iterator over the UNION ALL
// of audit_log and gate_transition records for a given engagement. The
// caller MUST close the returned rows.
//
// Columns returned: log_id, actor, action, entity_type, entity_id,
// before_state, after_state, metadata, created_at.
func GetAuditExport(db *sql.DB, engagementID string, opts ExportOptions) (*sql.Rows, error) {
	auditWhere, auditArgs, _ := buildExportWhereClause(engagementID, opts)
	gateWhere, gateArgs, _ := buildGateExportWhereClause(engagementID, opts)

	offset := len(auditArgs)
	rewrittenGateWhere := rewriteArgPositions(gateWhere, offset)
	allArgs := append(auditArgs, gateArgs...)

	query := fmt.Sprintf(`
		SELECT log_id::TEXT, actor, action, entity_type, entity_id,
		       before_state, after_state, metadata, created_at
		FROM migration.audit_log %s

		UNION ALL

		SELECT id::TEXT AS log_id,
		       authorized_by AS actor,
		       'phase_transition' AS action,
		       'gate' AS entity_type,
		       COALESCE(from_phase, '') || '->' || COALESCE(to_phase, '') AS entity_id,
		       to_jsonb(from_phase) AS before_state,
		       jsonb_build_object('to_phase', to_phase, 'gate_metrics', gate_metrics) AS after_state,
		       jsonb_build_object('direction', direction, 'notes', notes) AS metadata,
		       authorized_at AS created_at
		FROM migration.gate_transition %s

		ORDER BY created_at DESC`,
		auditWhere, rewrittenGateWhere)

	rows, err := db.Query(query, allArgs...)
	if err != nil {
		return nil, fmt.Errorf("audit export query: %w", err)
	}
	return rows, nil
}

// buildGateExportWhereClause constructs WHERE clause for gate_transition.
func buildGateExportWhereClause(engagementID string, opts ExportOptions) (string, []interface{}, int) {
	where := "WHERE engagement_id = $1"
	args := []interface{}{engagementID}
	argN := 2

	if opts.From != nil {
		where += fmt.Sprintf(" AND authorized_at >= $%d", argN)
		args = append(args, *opts.From)
		argN++
	}
	if opts.To != nil {
		where += fmt.Sprintf(" AND authorized_at <= $%d", argN)
		args = append(args, *opts.To)
		argN++
	}
	// entity_type filter: gate_transition entries are always entity_type='gate'.
	// If entity_type filter is set and != "gate", gate rows are excluded.
	if opts.EntityType != nil && *opts.EntityType != "gate" {
		where += " AND FALSE" // exclude all gate_transition rows
	}
	// Actor filter maps to authorized_by.
	if opts.Actor != nil {
		where += fmt.Sprintf(" AND authorized_by = $%d", argN)
		args = append(args, *opts.Actor)
		argN++
	}
	return where, args, argN
}

// rewriteArgPositions rewrites $1, $2, ... in a WHERE clause to $offset+1, $offset+2, ...
func rewriteArgPositions(where string, offset int) string {
	if offset == 0 {
		return where
	}
	// Simple approach: replace $N with $(N+offset) starting from highest N down.
	result := where
	for i := 10; i >= 1; i-- {
		old := fmt.Sprintf("$%d", i)
		new := fmt.Sprintf("$%d", i+offset)
		result = replaceAll(result, old, new)
	}
	return result
}

// replaceAll is a simple string replacement (avoids importing strings for one use).
func replaceAll(s, old, new string) string {
	for {
		idx := indexOf(s, old)
		if idx < 0 {
			break
		}
		// Make sure we're not matching a longer number (e.g., $1 in $10).
		nextIdx := idx + len(old)
		if nextIdx < len(s) && s[nextIdx] >= '0' && s[nextIdx] <= '9' {
			// Skip this match — it's part of a longer number.
			// This won't happen since we iterate from 10 down.
			break
		}
		s = s[:idx] + new + s[nextIdx:]
	}
	return s
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			// Check it's not part of a longer $N.
			return i
		}
	}
	return -1
}

// GetRetentionPolicy retrieves the audit retention policy for an engagement.
// Returns nil if no policy is set.
func GetRetentionPolicy(db *sql.DB, engagementID string) (*RetentionPolicy, error) {
	var raw []byte
	err := db.QueryRow(
		`SELECT audit_retention_policy FROM migration.engagement WHERE engagement_id = $1`,
		engagementID,
	).Scan(&raw)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get retention policy: %w", err)
	}
	if raw == nil {
		return nil, nil
	}

	var policy RetentionPolicy
	if err := json.Unmarshal(raw, &policy); err != nil {
		return nil, fmt.Errorf("unmarshal retention policy: %w", err)
	}
	return &policy, nil
}

// SetRetentionPolicy updates the audit retention policy for an engagement.
// Returns an error if either retention period is less than MinRetentionDays.
func SetRetentionPolicy(db *sql.DB, engagementID string, policy RetentionPolicy) error {
	if policy.EventRetentionDays < MinRetentionDays {
		return fmt.Errorf("event_retention_days must be >= %d, got %d", MinRetentionDays, policy.EventRetentionDays)
	}
	if policy.AuditLogRetentionDays < MinRetentionDays {
		return fmt.Errorf("audit_log_retention_days must be >= %d, got %d", MinRetentionDays, policy.AuditLogRetentionDays)
	}

	raw, err := json.Marshal(policy)
	if err != nil {
		return fmt.Errorf("marshal retention policy: %w", err)
	}

	_, err = db.Exec(
		`UPDATE migration.engagement SET audit_retention_policy = $2, updated_at = now() WHERE engagement_id = $1`,
		engagementID, raw,
	)
	if err != nil {
		return fmt.Errorf("set retention policy: %w", err)
	}
	return nil
}

// PurgeExpiredEvents soft-archives or deletes expired event rows for engagements
// that have a retention policy set. It sets the session variable app.retention_purge
// to allow the BEFORE DELETE trigger to pass.
//
// For each engagement with a non-null audit_retention_policy, it deletes event
// rows where created_at < NOW() - event_retention_days.
func PurgeExpiredEvents(db *sql.DB) (int64, error) {
	tx, err := db.Begin()
	if err != nil {
		return 0, fmt.Errorf("begin purge tx: %w", err)
	}
	defer tx.Rollback()

	// Set session variable to allow retention deletes past the trigger.
	if _, err := tx.Exec("SET LOCAL app.retention_purge = 'true'"); err != nil {
		return 0, fmt.Errorf("set retention_purge: %w", err)
	}

	// Delete expired events for all engagements with retention policies.
	result, err := tx.Exec(`
		DELETE FROM migration.event e
		USING migration.engagement eng
		WHERE e.engagement_id = eng.engagement_id
		  AND eng.audit_retention_policy IS NOT NULL
		  AND e.created_at < NOW() - (
			  (eng.audit_retention_policy->>'event_retention_days')::INT * INTERVAL '1 day'
		  )
	`)
	if err != nil {
		return 0, fmt.Errorf("purge expired events: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("commit purge tx: %w", err)
	}

	return rowsAffected, nil
}

// RetentionLoop runs the retention purge on a configurable interval.
// It logs results via slog and respects context cancellation.
func RetentionLoop(ctx context.Context, db *sql.DB, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	slog.Info("retention loop started", "interval", interval)

	for {
		select {
		case <-ctx.Done():
			slog.Info("retention loop stopped")
			return
		case <-ticker.C:
			purged, err := PurgeExpiredEvents(db)
			if err != nil {
				slog.Error("retention purge failed", "error", err)
			} else if purged > 0 {
				slog.Info("retention purge completed", "rows_purged", purged)
			}
		}
	}
}

// ComputeReconIntegrityHashFromFields computes a SHA-256 hash from individual field values.
// NULL/empty fields should be passed as empty strings.
func ComputeReconIntegrityHashFromFields(batchID, memberID, calcName, legacyValue, recomputedValue, canonicalValue, varianceAmount string) string {
	canonical := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		batchID, memberID, calcName, legacyValue, recomputedValue, canonicalValue, varianceAmount)

	hash := sha256.Sum256([]byte(canonical))
	return fmt.Sprintf("%x", hash)
}
