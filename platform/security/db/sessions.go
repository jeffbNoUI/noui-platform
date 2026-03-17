package db

import (
	"context"
	"fmt"

	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/security/models"
)

// sessionColumns is the shared SELECT list for active session queries.
const sessionColumns = `
	s.id, s.tenant_id, s.user_id, s.session_id, s.email,
	s.role, s.ip_address, s.user_agent, s.started_at, s.last_seen_at
`

// scanSession scans a single active session row into an ActiveSession.
func scanSession(scanner interface{ Scan(dest ...any) error }) (*models.ActiveSession, error) {
	var sess models.ActiveSession
	err := scanner.Scan(
		&sess.ID, &sess.TenantID, &sess.UserID, &sess.SessionID, &sess.Email,
		&sess.Role, &sess.IPAddress, &sess.UserAgent, &sess.StartedAt, &sess.LastSeenAt,
	)
	if err != nil {
		return nil, err
	}
	return &sess, nil
}

// UpsertSession registers or updates an active session (upsert by session_id).
func (s *Store) UpsertSession(ctx context.Context, tenantID string, req models.CreateSessionRequest) (*models.ActiveSession, error) {
	query := `
		INSERT INTO active_sessions (tenant_id, user_id, session_id, email, role, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (session_id) DO UPDATE SET
			last_seen_at = NOW(),
			email = EXCLUDED.email,
			role = EXCLUDED.role,
			ip_address = EXCLUDED.ip_address,
			user_agent = EXCLUDED.user_agent
		RETURNING id, tenant_id, user_id, session_id, email, role, ip_address, user_agent, started_at, last_seen_at
	`

	row := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		tenantID, req.UserID, req.SessionID, req.Email,
		req.Role, req.IPAddress, req.UserAgent,
	)

	return scanSession(row)
}

// ListActiveSessions returns sessions that have been seen within the last 30 minutes.
func (s *Store) ListActiveSessions(ctx context.Context, tenantID string) ([]models.ActiveSession, error) {
	query := fmt.Sprintf(
		"SELECT %s FROM active_sessions s WHERE s.tenant_id = $1 AND s.last_seen_at > NOW() - INTERVAL '30 minutes' ORDER BY s.last_seen_at DESC",
		sessionColumns,
	)

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []models.ActiveSession
	for rows.Next() {
		sess, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, *sess)
	}

	return sessions, rows.Err()
}

// DeleteSession removes an active session by session_id, scoped to tenant.
func (s *Store) DeleteSession(ctx context.Context, tenantID, sessionID string) error {
	result, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx,
		"DELETE FROM active_sessions WHERE session_id = $1 AND tenant_id = $2",
		sessionID, tenantID,
	)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}
