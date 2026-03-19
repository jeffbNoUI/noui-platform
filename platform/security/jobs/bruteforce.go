package jobs

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"

	"github.com/noui/platform/security/models"
)

const defaultTenantID = "00000000-0000-0000-0000-000000000001"

// CheckBruteForce detects actors who exceeded the failed login threshold and creates alert events.
func CheckBruteForce(db *sql.DB, cfg models.JobConfig) {
	ctx := context.Background()

	// Find actors above threshold
	rows, err := db.QueryContext(ctx,
		`SELECT actor_id, actor_email, ip_address, COUNT(*) AS fail_count
		 FROM security_events
		 WHERE event_type = 'login_failure'
		   AND created_at > NOW() - ($1 || ' minutes')::INTERVAL
		 GROUP BY actor_id, actor_email, ip_address
		 HAVING COUNT(*) >= $2`,
		cfg.BruteForceWindowMin, cfg.BruteForceThreshold,
	)
	if err != nil {
		slog.Error("brute-force check query failed", "error", err)
		return
	}
	defer rows.Close()

	var actors []models.BruteForceActor
	for rows.Next() {
		var a models.BruteForceActor
		if err := rows.Scan(&a.ActorID, &a.ActorEmail, &a.IPAddress, &a.FailCount); err != nil {
			slog.Error("brute-force scan failed", "error", err)
			return
		}
		actors = append(actors, a)
	}
	if err := rows.Err(); err != nil {
		slog.Error("brute-force rows error", "error", err)
		return
	}

	for _, actor := range actors {
		// Dedup: check if alert already exists for this actor in the window
		var alertCount int
		err := db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM security_events
			 WHERE event_type = 'brute_force_detected'
			   AND actor_id = $1
			   AND created_at > NOW() - ($2 || ' minutes')::INTERVAL`,
			actor.ActorID, cfg.BruteForceWindowMin,
		).Scan(&alertCount)
		if err != nil {
			slog.Error("brute-force dedup check failed", "error", err, "actor_id", actor.ActorID)
			continue
		}
		if alertCount > 0 {
			continue
		}

		// Insert alert event — resolve tenant_id from the actor's existing events
		metaMap := map[string]interface{}{
			"failed_count":   actor.FailCount,
			"window_minutes": cfg.BruteForceWindowMin,
			"ip_address":     actor.IPAddress,
		}
		metaBytes, err := json.Marshal(metaMap)
		if err != nil {
			slog.Error("failed to marshal metadata", "error", err)
			continue
		}
		metadata := string(metaBytes)

		_, err = db.ExecContext(ctx,
			`INSERT INTO security_events (tenant_id, event_type, actor_id, actor_email, ip_address, metadata)
			 VALUES ((SELECT COALESCE(
			   (SELECT DISTINCT tenant_id FROM security_events WHERE actor_id = $1 ORDER BY tenant_id LIMIT 1),
			   '`+defaultTenantID+`'::UUID
			 )), 'brute_force_detected', $1, $2, $3, $4)`,
			actor.ActorID, actor.ActorEmail, actor.IPAddress, metadata,
		)
		if err != nil {
			slog.Error("brute-force alert insert failed", "error", err, "actor_id", actor.ActorID)
			continue
		}

		slog.Warn("brute-force detected",
			"actor_id", actor.ActorID,
			"actor_email", actor.ActorEmail,
			"ip_address", actor.IPAddress,
			"failed_count", actor.FailCount,
			"window_minutes", cfg.BruteForceWindowMin)
	}
}
