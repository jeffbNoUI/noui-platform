package db

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// GetReconciliationSummary returns aggregate reconciliation metrics for an engagement.
func GetReconciliationSummary(db *sql.DB, engagementID string) (*models.ReconciliationSummaryResult, error) {
	var s models.ReconciliationSummaryResult

	err := db.QueryRow(
		`SELECT
			COUNT(*) AS total_records,
			COUNT(*) FILTER (WHERE r.category = 'MATCH') AS match_count,
			COUNT(*) FILTER (WHERE r.category = 'MINOR') AS minor_count,
			COUNT(*) FILTER (WHERE r.category = 'MAJOR') AS major_count,
			COUNT(*) FILTER (WHERE r.category = 'ERROR') AS error_count,
			CASE WHEN COUNT(*) > 0
				THEN COUNT(*) FILTER (WHERE r.category = 'MATCH')::DECIMAL / COUNT(*)
				ELSE 0
			END AS gate_score,
			COUNT(*) FILTER (WHERE r.priority = 'P1') AS p1_count,
			CASE WHEN COUNT(*) FILTER (WHERE r.tier = 1) > 0
				THEN COUNT(*) FILTER (WHERE r.tier = 1 AND r.category = 'MATCH')::DECIMAL / COUNT(*) FILTER (WHERE r.tier = 1)
				ELSE 0
			END AS tier1_score,
			CASE WHEN COUNT(*) FILTER (WHERE r.tier = 2) > 0
				THEN COUNT(*) FILTER (WHERE r.tier = 2 AND r.category = 'MATCH')::DECIMAL / COUNT(*) FILTER (WHERE r.tier = 2)
				ELSE 0
			END AS tier2_score,
			CASE WHEN COUNT(*) FILTER (WHERE r.tier = 3) > 0
				THEN COUNT(*) FILTER (WHERE r.tier = 3 AND r.category = 'MATCH')::DECIMAL / COUNT(*) FILTER (WHERE r.tier = 3)
				ELSE 0
			END AS tier3_score
		 FROM migration.reconciliation r
		 JOIN migration.batch b ON b.batch_id = r.batch_id
		 WHERE b.engagement_id = $1`,
		engagementID,
	).Scan(
		&s.TotalRecords, &s.MatchCount, &s.MinorCount, &s.MajorCount, &s.ErrorCount,
		&s.GateScore, &s.P1Count, &s.Tier1Score, &s.Tier2Score, &s.Tier3Score,
	)
	if err != nil {
		return nil, fmt.Errorf("reconciliation summary: %w", err)
	}
	return &s, nil
}

// ReconciliationRecord represents a single reconciliation result row.
type ReconciliationRecord struct {
	ReconciliationID string  `json:"reconciliation_id"`
	BatchID          string  `json:"batch_id"`
	MemberID         string  `json:"member_id"`
	FieldName        string  `json:"field_name"`
	SourceValue      *string `json:"source_value"`
	TargetValue      *string `json:"target_value"`
	Category         string  `json:"category"`
	Priority         *string `json:"priority"`
	Tier             int     `json:"tier"`
}

// GetReconciliationByTier returns reconciliation records for a specific tier within an engagement.
func GetReconciliationByTier(db *sql.DB, engagementID string, tier int) ([]ReconciliationRecord, error) {
	rows, err := db.Query(
		`SELECT r.reconciliation_id, r.batch_id, r.member_id, r.field_name,
		        r.source_value, r.target_value, r.category, r.priority, r.tier
		 FROM migration.reconciliation r
		 JOIN migration.batch b ON b.batch_id = r.batch_id
		 WHERE b.engagement_id = $1 AND r.tier = $2
		 ORDER BY r.priority NULLS LAST, r.category`,
		engagementID, tier,
	)
	if err != nil {
		return nil, fmt.Errorf("reconciliation by tier: %w", err)
	}
	defer rows.Close()

	var records []ReconciliationRecord
	for rows.Next() {
		var rec ReconciliationRecord
		if err := rows.Scan(
			&rec.ReconciliationID, &rec.BatchID, &rec.MemberID, &rec.FieldName,
			&rec.SourceValue, &rec.TargetValue, &rec.Category, &rec.Priority, &rec.Tier,
		); err != nil {
			return nil, fmt.Errorf("scan reconciliation record: %w", err)
		}
		records = append(records, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reconciliation by tier rows: %w", err)
	}
	return records, nil
}
