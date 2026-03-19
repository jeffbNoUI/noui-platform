// Package jobs contains background job functions for the security service.
package jobs

import (
	"context"
	"database/sql"
	"log/slog"

	"github.com/noui/platform/security/models"
)

// CleanupExpiredSessions deletes sessions that are idle or exceeded max lifetime.
func CleanupExpiredSessions(db *sql.DB, cfg models.JobConfig) {
	result, err := db.ExecContext(context.Background(),
		`DELETE FROM active_sessions
		 WHERE last_seen_at < NOW() - ($1 || ' minutes')::INTERVAL
		    OR started_at < NOW() - ($2 || ' hours')::INTERVAL`,
		cfg.SessionIdleTimeoutMin, cfg.SessionMaxLifetimeHr,
	)
	if err != nil {
		slog.Error("session cleanup failed", "error", err)
		return
	}

	count, _ := result.RowsAffected()
	if count > 0 {
		slog.Info("cleaned up expired sessions", "count", count,
			"idle_timeout_min", cfg.SessionIdleTimeoutMin,
			"max_lifetime_hr", cfg.SessionMaxLifetimeHr)
	}
}
