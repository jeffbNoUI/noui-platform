package db

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// CompareEngagements returns side-by-side metrics for the given engagement IDs.
func CompareEngagements(db *sql.DB, engagementIDs []string) (*models.CompareResult, error) {
	result := &models.CompareResult{
		Engagements: make([]models.CompareEngagement, 0, len(engagementIDs)),
	}

	for _, eid := range engagementIDs {
		var ce models.CompareEngagement
		ce.EngagementID = eid

		// Get engagement info.
		err := db.QueryRow(
			`SELECT source_system_name, status
			 FROM migration.engagement
			 WHERE engagement_id = $1`,
			eid,
		).Scan(&ce.SourceSystemName, &ce.Status)
		if err == sql.ErrNoRows {
			continue // skip unknown engagement IDs
		}
		if err != nil {
			return nil, fmt.Errorf("compare get engagement %s: %w", eid, err)
		}

		// Quality scores from quality_profile average.
		var qs models.QualityScores
		var hasQuality bool
		err = db.QueryRow(
			`SELECT
				COALESCE(AVG(accuracy), 0),
				COALESCE(AVG(completeness), 0),
				COALESCE(AVG(consistency), 0),
				COALESCE(AVG(timeliness), 0),
				COALESCE(AVG(validity), 0),
				COALESCE(AVG(uniqueness), 0),
				COUNT(*) > 0
			 FROM migration.quality_profile
			 WHERE engagement_id = $1`,
			eid,
		).Scan(&qs.Accuracy, &qs.Completeness, &qs.Consistency,
			&qs.Timeliness, &qs.Validity, &qs.Uniqueness, &hasQuality)
		if err != nil {
			return nil, fmt.Errorf("compare quality scores %s: %w", eid, err)
		}
		if hasQuality {
			ce.QualityScores = &qs
		}

		// Batch count and average error rate.
		err = db.QueryRow(
			`SELECT COUNT(*), COALESCE(AVG(error_rate), 0)
			 FROM migration.batch
			 WHERE engagement_id = $1`,
			eid,
		).Scan(&ce.BatchCount, &ce.ErrorRate)
		if err != nil {
			return nil, fmt.Errorf("compare batch stats %s: %w", eid, err)
		}

		// Reconciliation gate score.
		err = db.QueryRow(
			`SELECT CASE WHEN COUNT(*) > 0
				THEN COUNT(*) FILTER (WHERE r.category = 'MATCH')::DECIMAL / COUNT(*)
				ELSE 0
			 END
			 FROM migration.reconciliation r
			 JOIN migration.batch b ON b.batch_id = r.batch_id
			 WHERE b.engagement_id = $1`,
			eid,
		).Scan(&ce.ReconGateScore)
		if err != nil {
			return nil, fmt.Errorf("compare recon score %s: %w", eid, err)
		}

		result.Engagements = append(result.Engagements, ce)
	}

	return result, nil
}
