package db

import (
	"context"
	"fmt"
	"strings"

	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/security/models"
)

// eventColumns is the shared SELECT list for security event queries.
const eventColumns = `
	e.id, e.tenant_id, e.event_type, e.actor_id, e.actor_email,
	e.ip_address, e.user_agent, e.metadata, e.created_at
`

// scanEvent scans a single security event row into a SecurityEvent.
func scanEvent(scanner interface{ Scan(dest ...any) error }) (*models.SecurityEvent, error) {
	var ev models.SecurityEvent
	err := scanner.Scan(
		&ev.ID, &ev.TenantID, &ev.EventType, &ev.ActorID, &ev.ActorEmail,
		&ev.IPAddress, &ev.UserAgent, &ev.Metadata, &ev.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &ev, nil
}

// CreateEvent inserts a new security event and returns the created record.
func (s *Store) CreateEvent(ctx context.Context, tenantID string, req models.CreateEventRequest) (*models.SecurityEvent, error) {
	metadata := req.Metadata
	if metadata == "" {
		metadata = "{}"
	}

	query := fmt.Sprintf(`
		INSERT INTO security_events (tenant_id, event_type, actor_id, actor_email, ip_address, user_agent, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING %s
	`, eventColumns)

	row := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		tenantID, req.EventType, req.ActorID, req.ActorEmail,
		req.IPAddress, req.UserAgent, metadata,
	)

	return scanEvent(row)
}

// ListEvents returns security events matching the filter, scoped to a tenant.
func (s *Store) ListEvents(ctx context.Context, tenantID string, f models.EventFilter) ([]models.SecurityEvent, int, error) {
	where := []string{"e.tenant_id = $1"}
	args := []any{tenantID}
	idx := 2

	if f.EventType != "" {
		where = append(where, fmt.Sprintf("e.event_type = $%d", idx))
		args = append(args, f.EventType)
		idx++
	}
	if f.ActorID != "" {
		where = append(where, fmt.Sprintf("e.actor_id = $%d", idx))
		args = append(args, f.ActorID)
		idx++
	}
	if f.DateFrom != "" {
		where = append(where, fmt.Sprintf("e.created_at >= $%d::timestamptz", idx))
		args = append(args, f.DateFrom)
		idx++
	}
	if f.DateTo != "" {
		where = append(where, fmt.Sprintf("e.created_at <= $%d::timestamptz", idx))
		args = append(args, f.DateTo)
		idx++
	}

	whereClause := "WHERE " + strings.Join(where, " AND ")

	// Count total
	var total int
	countQ := "SELECT COUNT(*) FROM security_events e " + whereClause
	if err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Fetch page
	limit := f.Limit
	if limit <= 0 {
		limit = 25
	}
	offset := f.Offset
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(
		"SELECT %s FROM security_events e %s ORDER BY e.created_at DESC LIMIT $%d OFFSET $%d",
		eventColumns, whereClause, idx, idx+1,
	)
	args = append(args, limit, offset)

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var events []models.SecurityEvent
	for rows.Next() {
		ev, err := scanEvent(rows)
		if err != nil {
			return nil, 0, err
		}
		events = append(events, *ev)
	}

	return events, total, rows.Err()
}

// GetEventStats returns aggregated security event metrics for a tenant.
func (s *Store) GetEventStats(ctx context.Context, tenantID string) (*models.EventStats, error) {
	stats := &models.EventStats{}

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `
		SELECT
			(SELECT COUNT(DISTINCT actor_id) FROM security_events
			 WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24 hours') AS active_users,
			(SELECT COUNT(*) FROM active_sessions
			 WHERE tenant_id = $1 AND last_seen_at > NOW() - INTERVAL '30 minutes') AS active_sessions,
			(SELECT COUNT(*) FROM security_events
			 WHERE tenant_id = $1 AND event_type = 'login_failure' AND created_at > NOW() - INTERVAL '24 hours') AS failed_logins_24h,
			(SELECT COUNT(*) FROM security_events
			 WHERE tenant_id = $1 AND event_type = 'role_change' AND created_at > NOW() - INTERVAL '7 days') AS role_changes_7d
	`, tenantID).Scan(&stats.ActiveUsers, &stats.ActiveSessions, &stats.FailedLogins24h, &stats.RoleChanges7d)
	if err != nil {
		return nil, err
	}

	return stats, nil
}
