package db

import (
	"context"

	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/issues/models"
)

// GetIssueStats returns aggregated issue metrics for a tenant.
func (s *Store) GetIssueStats(ctx context.Context, tenantID string) (*models.IssueStats, error) {
	stats := &models.IssueStats{}

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE status IN ('open', 'triaged', 'in-work')) AS open_count,
			COUNT(*) FILTER (WHERE severity = 'critical') AS critical_count,
			COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - reported_at)) / 86400)
				FILTER (WHERE resolved_at IS NOT NULL), 0) AS avg_resolution,
			COUNT(*) FILTER (WHERE status IN ('resolved', 'closed') AND resolved_at IS NOT NULL) AS resolved_count
		FROM issues
		WHERE tenant_id = $1
	`, tenantID).Scan(&stats.OpenCount, &stats.CriticalCount, &stats.AvgResolution, &stats.ResolvedCount)
	if err != nil {
		return nil, err
	}

	return stats, nil
}
