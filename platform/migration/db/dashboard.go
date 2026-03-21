package db

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// GetDashboardSummary returns aggregate metrics across all engagements for a tenant.
func GetDashboardSummary(db *sql.DB, tenantID string) (*models.DashboardSummary, error) {
	var s models.DashboardSummary

	// Active engagements (not COMPLETE).
	err := db.QueryRow(
		`SELECT COUNT(*) FROM migration.engagement
		 WHERE tenant_id = $1 AND status NOT IN ('COMPLETE')`,
		tenantID,
	).Scan(&s.ActiveEngagements)
	if err != nil {
		return nil, fmt.Errorf("dashboard active engagements: %w", err)
	}

	// Running batches.
	err = db.QueryRow(
		`SELECT COUNT(*) FROM migration.batch b
		 JOIN migration.engagement e ON e.engagement_id = b.engagement_id
		 WHERE e.tenant_id = $1 AND b.status = 'RUNNING'`,
		tenantID,
	).Scan(&s.BatchesRunning)
	if err != nil {
		return nil, fmt.Errorf("dashboard running batches: %w", err)
	}

	// Average error rate from batches.
	err = db.QueryRow(
		`SELECT COALESCE(AVG(b.error_rate), 0) FROM migration.batch b
		 JOIN migration.engagement e ON e.engagement_id = b.engagement_id
		 WHERE e.tenant_id = $1`,
		tenantID,
	).Scan(&s.AvgErrorRate)
	if err != nil {
		return nil, fmt.Errorf("dashboard avg error rate: %w", err)
	}

	// Best reconciliation score — computed as match rate per batch.
	// A batch's recon score = count of MATCH / total count. We take the max across batches.
	err = db.QueryRow(
		`SELECT COALESCE(MAX(match_rate), 0) FROM (
			SELECT r.batch_id,
				CASE WHEN COUNT(*) = 0 THEN 0
				     ELSE COUNT(*) FILTER (WHERE r.category = 'MATCH')::float / COUNT(*)
				END AS match_rate
			FROM migration.reconciliation r
			JOIN migration.batch b ON b.batch_id = r.batch_id
			JOIN migration.engagement e ON e.engagement_id = b.engagement_id
			WHERE e.tenant_id = $1
			GROUP BY r.batch_id
		 ) sub`,
		tenantID,
	).Scan(&s.BestReconScore)
	if err != nil {
		return nil, fmt.Errorf("dashboard best recon score: %w", err)
	}

	// Open risks (P1 and total).
	err = db.QueryRow(
		`SELECT
			COUNT(*) FILTER (WHERE severity = 'P1') AS p1_count,
			COUNT(*) AS total_count
		 FROM migration.risk
		 WHERE tenant_id = $1 AND status = 'OPEN'`,
		tenantID,
	).Scan(&s.OpenRisksP1, &s.OpenRisksTotal)
	if err != nil {
		return nil, fmt.Errorf("dashboard open risks: %w", err)
	}

	return &s, nil
}

// GetSystemHealth checks database connectivity and returns health status.
func GetSystemHealth(db *sql.DB) *models.SystemHealthStatus {
	status := &models.SystemHealthStatus{
		MigrationService:    "ok",
		IntelligenceService: "unknown", // would need HTTP check to intelligence service
	}

	if err := db.Ping(); err != nil {
		status.DatabaseConnected = false
	} else {
		status.DatabaseConnected = true
	}

	return status
}
