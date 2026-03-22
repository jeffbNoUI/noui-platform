package db

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"fmt"
	"time"

	"github.com/noui/platform/dbcontext"
)

// AuditEntry represents a single row in the crm_audit_log table.
type AuditEntry struct {
	AuditID       int64
	TenantID      string
	EventTime     time.Time
	EventType     string
	EntityType    string
	EntityID      *string
	AgentID       string
	AgentIP       *string
	AgentDevice   *string
	FieldChanges  *string // JSON string
	Summary       *string
	PrevAuditHash *string
	RecordHash    string
}

// WriteAuditLog appends a new entry to the CRM audit log.
func (s *Store) WriteAuditLog(ctx context.Context, entry *AuditEntry) error {
	query := `
		INSERT INTO crm_audit_log (
			tenant_id, event_time, event_type,
			entity_type, entity_id,
			agent_id, agent_ip, agent_device,
			field_changes, summary,
			prev_audit_hash, record_hash
		) VALUES (
			$1, $2, $3,
			$4, $5,
			$6, $7, $8,
			$9, $10,
			$11, $12
		)
		RETURNING audit_id, event_time`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx,
		query,
		entry.TenantID, entry.EventTime, entry.EventType,
		entry.EntityType, entry.EntityID,
		entry.AgentID, entry.AgentIP, entry.AgentDevice,
		entry.FieldChanges, entry.Summary,
		entry.PrevAuditHash, entry.RecordHash,
	).Scan(&entry.AuditID, &entry.EventTime)
}

// GetAuditLog retrieves audit log entries for a given entity or tenant scope.
// If entityType and entityID are provided, results are scoped to that entity.
// If only entityType is provided, results are scoped to that entity type within the tenant.
// AuditFilter holds optional filter parameters for audit log queries.
type AuditFilter struct {
	EntityType string
	EntityID   string
	AgentID    string
	DateFrom   string // RFC 3339 or YYYY-MM-DD
	DateTo     string // RFC 3339 or YYYY-MM-DD
	Limit      int
}

func (s *Store) GetAuditLog(ctx context.Context, tenantID string, filter AuditFilter) ([]AuditEntry, error) {
	query := `
		SELECT
			audit_id, tenant_id, event_time, event_type,
			entity_type, entity_id,
			agent_id, agent_ip, agent_device,
			field_changes, summary,
			prev_audit_hash, record_hash
		FROM crm_audit_log
		WHERE tenant_id = $1`

	args := []interface{}{tenantID}
	argIdx := 2

	if filter.EntityType != "" {
		query += fmt.Sprintf(" AND entity_type = $%d", argIdx)
		args = append(args, filter.EntityType)
		argIdx++
	}
	if filter.EntityID != "" {
		query += fmt.Sprintf(" AND entity_id = $%d", argIdx)
		args = append(args, filter.EntityID)
		argIdx++
	}
	if filter.AgentID != "" {
		query += fmt.Sprintf(" AND agent_id = $%d", argIdx)
		args = append(args, filter.AgentID)
		argIdx++
	}
	if filter.DateFrom != "" {
		query += fmt.Sprintf(" AND event_time >= $%d", argIdx)
		args = append(args, filter.DateFrom)
		argIdx++
	}
	if filter.DateTo != "" {
		query += fmt.Sprintf(" AND event_time <= $%d", argIdx)
		args = append(args, filter.DateTo)
		argIdx++
	}

	query += " ORDER BY event_time DESC"

	if filter.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, filter.Limit)
		argIdx++
	}

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("getting audit log: %w", err)
	}
	defer rows.Close()

	var entries []AuditEntry
	for rows.Next() {
		var e AuditEntry
		var entityIDVal sql.NullString
		var agentIP, agentDevice sql.NullString
		var fieldChanges, summary sql.NullString
		var prevAuditHash sql.NullString

		err := rows.Scan(
			&e.AuditID, &e.TenantID, &e.EventTime, &e.EventType,
			&e.EntityType, &entityIDVal,
			&e.AgentID, &agentIP, &agentDevice,
			&fieldChanges, &summary,
			&prevAuditHash, &e.RecordHash,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning audit log row: %w", err)
		}

		e.EntityID = nullStringToPtr(entityIDVal)
		e.AgentIP = nullStringToPtr(agentIP)
		e.AgentDevice = nullStringToPtr(agentDevice)
		e.FieldChanges = nullStringToPtr(fieldChanges)
		e.Summary = nullStringToPtr(summary)
		e.PrevAuditHash = nullStringToPtr(prevAuditHash)

		entries = append(entries, e)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating audit log rows: %w", err)
	}

	return entries, nil
}

// GetLastAuditHash returns the record_hash of the most recent audit entry for a tenant.
// Returns empty string if no entries exist (first entry in chain).
func (s *Store) GetLastAuditHash(ctx context.Context, tenantID string) (string, error) {
	var hash sql.NullString
	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx,
		`SELECT record_hash FROM crm_audit_log WHERE tenant_id = $1 ORDER BY audit_id DESC LIMIT 1`,
		tenantID,
	).Scan(&hash)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("getting last audit hash: %w", err)
	}
	return hash.String, nil
}

// ComputeAuditHash produces a SHA-256 hex digest for an audit entry.
func ComputeAuditHash(tenantID, eventType, entityType, entityID, agentID, summary string, eventTime time.Time) string {
	payload := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		tenantID, eventType, entityType, entityID, agentID, summary,
		eventTime.UTC().Format(time.RFC3339Nano))
	h := sha256.Sum256([]byte(payload))
	return fmt.Sprintf("%x", h)
}
