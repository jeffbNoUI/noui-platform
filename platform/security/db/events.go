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

	query := `
		INSERT INTO security_events (tenant_id, event_type, actor_id, actor_email, ip_address, user_agent, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, tenant_id, event_type, actor_id, actor_email, ip_address, user_agent, metadata, created_at
	`

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
			 WHERE tenant_id = $1 AND event_type = 'role_change' AND created_at > NOW() - INTERVAL '7 days') AS role_changes_7d,
			(SELECT COUNT(*) FROM security_events
			 WHERE tenant_id = $1 AND event_type = 'brute_force_detected' AND created_at > NOW() - INTERVAL '24 hours') AS brute_force_alerts_24h
	`, tenantID).Scan(&stats.ActiveUsers, &stats.ActiveSessions, &stats.FailedLogins24h, &stats.RoleChanges7d, &stats.BruteForceAlerts24h)
	if err != nil {
		return nil, err
	}

	return stats, nil
}

// CountFailedLoginsByActor returns actors who exceeded the failed login threshold within the window.
func (s *Store) CountFailedLoginsByActor(ctx context.Context, threshold, windowMin int) ([]models.BruteForceActor, error) {
	rows, err := s.DB.QueryContext(ctx,
		`SELECT actor_id, actor_email, ip_address, COUNT(*) AS fail_count
		 FROM security_events
		 WHERE event_type = 'login_failure'
		   AND created_at > NOW() - ($1 || ' minutes')::INTERVAL
		 GROUP BY actor_id, actor_email, ip_address
		 HAVING COUNT(*) >= $2`,
		windowMin, threshold,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var actors []models.BruteForceActor
	for rows.Next() {
		var a models.BruteForceActor
		if err := rows.Scan(&a.ActorID, &a.ActorEmail, &a.IPAddress, &a.FailCount); err != nil {
			return nil, err
		}
		actors = append(actors, a)
	}
	return actors, rows.Err()
}

// HasRecentBruteForceAlert checks if a brute_force_detected event exists for the actor in the window.
func (s *Store) HasRecentBruteForceAlert(ctx context.Context, actorID string, windowMin int) (bool, error) {
	var count int
	err := s.DB.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM security_events
		 WHERE event_type = 'brute_force_detected'
		   AND actor_id = $1
		   AND created_at > NOW() - ($2 || ' minutes')::INTERVAL`,
		actorID, windowMin,
	).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
