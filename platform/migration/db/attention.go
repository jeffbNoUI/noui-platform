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
		  AND status NOT IN ('CLOSED', 'DEFERRED')

		UNION ALL

		-- P1 reconciliation items (unresolved only)
		SELECT r.recon_id::text AS id, 'RECONCILIATION' AS source, 'RECONCILING' AS phase,
		       COALESCE(r.priority, 'P2') AS priority, r.calc_name AS summary,
		       COALESCE('Legacy: ' || r.legacy_value || ' vs Recomputed: ' || r.recomputed_value, '') AS detail,
		       '' AS suggested_action,
		       r.batch_id::text AS batch_id, $1::text AS engagement_id,
		       '' AS created_at, r.resolved
		FROM migration.reconciliation r
		JOIN migration.batch b ON r.batch_id = b.batch_id
		WHERE b.engagement_id = $1 AND r.priority = 'P1' AND r.resolved = FALSE

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
		 WHERE tenant_id = $1 AND status NOT IN ('CLOSED', 'DEFERRED')
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

// ResolveAttentionItem marks an attention item as resolved.
// For RISK: sets status to targetStatus (CLOSED), sets acknowledged_by and resolution_note.
// For RECONCILIATION: sets resolved=TRUE, resolved_by, resolution_note.
// Returns rows affected (0 = not found or already resolved → caller returns 409).
// Engagement ID is used for defense-in-depth scoping on reconciliation.
func ResolveAttentionItem(db *sql.DB, source, itemID, engagementID, resolvedBy, note string) (int64, error) {
	var result sql.Result
	var err error

	switch source {
	case "RISK":
		result, err = db.Exec(
			`UPDATE migration.risk
			 SET status = $1, acknowledged_by = $2, resolution_note = $3
			 WHERE risk_id = $4
			   AND (engagement_id = $5 OR engagement_id IS NULL)
			   AND status NOT IN ('CLOSED', 'DEFERRED')`,
			"CLOSED", resolvedBy, note, itemID, engagementID,
		)
	case "RECONCILIATION":
		result, err = db.Exec(
			`UPDATE migration.reconciliation
			 SET resolved = TRUE, resolved_by = $1, resolution_note = $2
			 WHERE recon_id = $3
			   AND resolved = FALSE
			   AND batch_id IN (
			     SELECT batch_id FROM migration.batch WHERE engagement_id = $4
			   )`,
			resolvedBy, note, itemID, engagementID,
		)
	default:
		return 0, fmt.Errorf("invalid source: %s", source)
	}

	if err != nil {
		return 0, fmt.Errorf("resolve attention item: %w", err)
	}
	return result.RowsAffected()
}

// DeferAttentionItem marks an attention item as deferred.
// For RISK: sets status to DEFERRED.
// For RECONCILIATION: sets resolution_note recording deferral reason (resolved stays false).
// Returns rows affected (0 = not found or already resolved → caller returns 409).
func DeferAttentionItem(db *sql.DB, source, itemID, engagementID, deferredBy, note string) (int64, error) {
	var result sql.Result
	var err error

	switch source {
	case "RISK":
		result, err = db.Exec(
			`UPDATE migration.risk
			 SET status = $1, acknowledged_by = $2, resolution_note = $3
			 WHERE risk_id = $4
			   AND (engagement_id = $5 OR engagement_id IS NULL)
			   AND status NOT IN ('CLOSED', 'DEFERRED')`,
			"DEFERRED", deferredBy, note, itemID, engagementID,
		)
	case "RECONCILIATION":
		result, err = db.Exec(
			`UPDATE migration.reconciliation
			 SET resolution_note = $1, resolved_by = $2
			 WHERE recon_id = $3
			   AND resolved = FALSE
			   AND batch_id IN (
			     SELECT batch_id FROM migration.batch WHERE engagement_id = $4
			   )`,
			note, deferredBy, itemID, engagementID,
		)
	default:
		return 0, fmt.Errorf("invalid source: %s", source)
	}

	if err != nil {
		return 0, fmt.Errorf("defer attention item: %w", err)
	}
	return result.RowsAffected()
}
