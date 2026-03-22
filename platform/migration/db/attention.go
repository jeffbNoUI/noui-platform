package db

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// GetAttentionItems returns unified attention items for an engagement.
// It combines open risks and P1 reconciliation issues into a single view.
func GetAttentionItems(db *sql.DB, engagementID string, priority, source *string) ([]models.AttentionItem, error) {
	query := `
		-- Risks as attention items
		SELECT risk_id::text AS id, 'RISK' AS source, 'PROFILING' AS phase, severity AS priority,
		       description AS summary, COALESCE(evidence, '') AS detail,
		       COALESCE(mitigation, '') AS suggested_action,
		       '' AS batch_id, COALESCE(engagement_id::text, '') AS engagement_id,
		       detected_at::text AS created_at, (status = 'CLOSED') AS resolved
		FROM migration.risk
		WHERE (engagement_id = $1 OR engagement_id IS NULL)
		  AND status != 'CLOSED'

		UNION ALL

		-- P1 reconciliation items
		SELECT r.recon_id::text AS id, 'RECONCILIATION' AS source, 'RECONCILING' AS phase,
		       COALESCE(r.priority, 'P2') AS priority, r.calc_name AS summary,
		       COALESCE('Legacy: ' || r.legacy_value || ' vs Recomputed: ' || r.recomputed_value, '') AS detail,
		       '' AS suggested_action,
		       r.batch_id::text AS batch_id, $1 AS engagement_id,
		       '' AS created_at, (r.resolved) AS resolved
		FROM migration.reconciliation r
		JOIN migration.batch b ON r.batch_id = b.batch_id
		WHERE b.engagement_id = $1 AND r.priority = 'P1'

		ORDER BY priority ASC, created_at DESC
	`
	rows, err := db.Query(query, engagementID)
	if err != nil {
		return nil, fmt.Errorf("get attention items: %w", err)
	}
	defer rows.Close()

	var items []models.AttentionItem
	for rows.Next() {
		var item models.AttentionItem
		if err := rows.Scan(
			&item.ID, &item.Source, &item.Phase, &item.Priority,
			&item.Summary, &item.Detail, &item.SuggestedAction,
			&item.BatchID, &item.EngagementID, &item.CreatedAt, &item.Resolved,
		); err != nil {
			return nil, fmt.Errorf("scan attention item: %w", err)
		}
		// Apply in-memory filters if provided.
		if priority != nil && item.Priority != *priority {
			continue
		}
		if source != nil && item.Source != *source {
			continue
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("get attention items rows: %w", err)
	}
	return items, nil
}

// GetAttentionSummary returns aggregate attention item counts across all engagements for a tenant.
func GetAttentionSummary(db *sql.DB, tenantID string) (*models.AttentionSummary, error) {
	summary := &models.AttentionSummary{
		ByEngagement: make(map[string]int),
	}

	rows, err := db.Query(
		`SELECT severity, COUNT(*), COALESCE(engagement_id::text, 'global')
		 FROM migration.risk
		 WHERE tenant_id = $1 AND status != 'CLOSED'
		 GROUP BY severity, engagement_id`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("get attention summary: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var sev string
		var count int
		var eid string
		if err := rows.Scan(&sev, &count, &eid); err != nil {
			return nil, fmt.Errorf("scan attention summary: %w", err)
		}
		summary.Total += count
		switch sev {
		case "P1":
			summary.P1 += count
		case "P2":
			summary.P2 += count
		case "P3":
			summary.P3 += count
		}
		summary.ByEngagement[eid] += count
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("get attention summary rows: %w", err)
	}

	return summary, nil
}
