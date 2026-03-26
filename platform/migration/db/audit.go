package db

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"fmt"
	"log/slog"

	"github.com/noui/platform/migration/models"
	"github.com/noui/platform/migration/reconciler"
)

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

// ComputeReconIntegrityHashFromFields computes a SHA-256 hash from individual field values.
// NULL/empty fields should be passed as empty strings.
func ComputeReconIntegrityHashFromFields(batchID, memberID, calcName, legacyValue, recomputedValue, canonicalValue, varianceAmount string) string {
	canonical := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		batchID, memberID, calcName, legacyValue, recomputedValue, canonicalValue, varianceAmount)

	hash := sha256.Sum256([]byte(canonical))
	return fmt.Sprintf("%x", hash)
}
