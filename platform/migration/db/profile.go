package db

import (
	"database/sql"
	"fmt"
	"time"
)

// QualityProfileRow represents a row from the migration.quality_profile table.
type QualityProfileRow struct {
	ProfileID         string    `json:"profile_id"`
	EngagementID      string    `json:"engagement_id"`
	SourceTable       string    `json:"source_table"`
	AccuracyScore     float64   `json:"accuracy_score"`
	CompletenessScore float64   `json:"completeness_score"`
	ConsistencyScore  float64   `json:"consistency_score"`
	TimelinessScore   float64   `json:"timeliness_score"`
	ValidityScore     float64   `json:"validity_score"`
	UniquenessScore   float64   `json:"uniqueness_score"`
	RowCount          int       `json:"row_count"`
	ProfiledAt        time.Time `json:"profiled_at"`
}

// ListProfiles returns all quality profiles for an engagement, ordered by source_table.
func ListProfiles(db *sql.DB, engagementID string) ([]QualityProfileRow, error) {
	rows, err := db.Query(
		`SELECT profile_id, engagement_id, source_table,
		        accuracy_score, completeness_score, consistency_score,
		        timeliness_score, validity_score, uniqueness_score,
		        row_count, profiled_at
		 FROM migration.quality_profile
		 WHERE engagement_id = $1
		 ORDER BY source_table`,
		engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("list profiles: %w", err)
	}
	defer rows.Close()

	var profiles []QualityProfileRow
	for rows.Next() {
		var p QualityProfileRow
		if err := rows.Scan(
			&p.ProfileID, &p.EngagementID, &p.SourceTable,
			&p.AccuracyScore, &p.CompletenessScore, &p.ConsistencyScore,
			&p.TimelinessScore, &p.ValidityScore, &p.UniquenessScore,
			&p.RowCount, &p.ProfiledAt,
		); err != nil {
			return nil, fmt.Errorf("scan profile row: %w", err)
		}
		profiles = append(profiles, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate profiles: %w", err)
	}
	return profiles, nil
}

// ApproveBaseline sets quality_baseline_approved_at = now() on the engagement.
func ApproveBaseline(db *sql.DB, engagementID string) error {
	_, err := db.Exec(
		`UPDATE migration.engagement
		 SET quality_baseline_approved_at = now(), updated_at = now()
		 WHERE engagement_id = $1`,
		engagementID,
	)
	if err != nil {
		return fmt.Errorf("approve baseline: %w", err)
	}
	return nil
}
