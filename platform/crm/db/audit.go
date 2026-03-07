package db

import (
	"database/sql"
	"fmt"
	"time"
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
func (s *Store) WriteAuditLog(entry *AuditEntry) error {
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

	return s.DB.QueryRow(
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
func (s *Store) GetAuditLog(tenantID string, entityType string, entityID string, limit int) ([]AuditEntry, error) {
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

	if entityType != "" {
		query += fmt.Sprintf(" AND entity_type = $%d", argIdx)
		args = append(args, entityType)
		argIdx++
	}
	if entityID != "" {
		query += fmt.Sprintf(" AND entity_id = $%d", argIdx)
		args = append(args, entityID)
		argIdx++
	}

	query += " ORDER BY event_time DESC"

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, limit)
		argIdx++
	}

	rows, err := s.DB.Query(query, args...)
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
