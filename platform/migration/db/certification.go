package db

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// CreateCertification inserts a new certification record. Certification records
// are immutable — there is no update path.
func CreateCertification(db *sql.DB, c *models.CertificationRecord) error {
	checklistBytes, err := json.Marshal(c.ChecklistJSON)
	if err != nil {
		return fmt.Errorf("marshal checklist: %w", err)
	}

	var notes *string
	if c.Notes != "" {
		notes = &c.Notes
	}

	err = db.QueryRow(
		`INSERT INTO migration.certification_record
			(engagement_id, gate_score, p1_count, checklist_json, certified_by, notes)
		 VALUES ($1, $2, $3, $4::jsonb, $5, $6)
		 RETURNING id, certified_at, created_at`,
		c.EngagementID, c.GateScore, c.P1Count, string(checklistBytes), c.CertifiedBy, notes,
	).Scan(&c.ID, &c.CertifiedAt, &c.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert certification: %w", err)
	}
	return nil
}

// GetLatestCertification returns the most recent certification record for an
// engagement, or nil if none exists.
func GetLatestCertification(db *sql.DB, engagementID string) (*models.CertificationRecord, error) {
	var c models.CertificationRecord
	var checklistBytes []byte
	var notes sql.NullString

	err := db.QueryRow(
		`SELECT id, engagement_id, gate_score, p1_count, checklist_json,
		        certified_by, certified_at, notes, created_at
		 FROM migration.certification_record
		 WHERE engagement_id = $1
		 ORDER BY created_at DESC
		 LIMIT 1`,
		engagementID,
	).Scan(
		&c.ID, &c.EngagementID, &c.GateScore, &c.P1Count, &checklistBytes,
		&c.CertifiedBy, &c.CertifiedAt, &notes, &c.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get latest certification: %w", err)
	}

	if err := json.Unmarshal(checklistBytes, &c.ChecklistJSON); err != nil {
		return nil, fmt.Errorf("unmarshal checklist: %w", err)
	}
	if notes.Valid {
		c.Notes = notes.String
	}

	return &c, nil
}
