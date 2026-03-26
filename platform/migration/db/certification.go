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

	var autoEval *string
	if len(c.AutoEvaluated) > 0 {
		s := string(c.AutoEvaluated)
		autoEval = &s
	}

	err = db.QueryRow(
		`INSERT INTO migration.certification_record
			(engagement_id, gate_score, p1_count, checklist_json, auto_evaluated, certified_by, notes)
		 VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
		 RETURNING id, certified_at, created_at`,
		c.EngagementID, c.GateScore, c.P1Count, string(checklistBytes), autoEval, c.CertifiedBy, notes,
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
	var autoEvalBytes []byte
	var notes sql.NullString

	err := db.QueryRow(
		`SELECT id, engagement_id, gate_score, p1_count, checklist_json,
		        auto_evaluated, certified_by, certified_at, notes, created_at
		 FROM migration.certification_record
		 WHERE engagement_id = $1
		 ORDER BY created_at DESC
		 LIMIT 1`,
		engagementID,
	).Scan(
		&c.ID, &c.EngagementID, &c.GateScore, &c.P1Count, &checklistBytes,
		&autoEvalBytes, &c.CertifiedBy, &c.CertifiedAt, &notes, &c.CreatedAt,
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
	if autoEvalBytes != nil {
		c.AutoEvaluated = autoEvalBytes
	}
	if notes.Valid {
		c.Notes = notes.String
	}

	return &c, nil
}

// ListCertifications returns paginated certification records for an engagement.
func ListCertifications(db *sql.DB, engagementID string, page, perPage int) (*models.CertificationListResponse, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}

	var total int
	err := db.QueryRow(
		`SELECT COUNT(*) FROM migration.certification_record WHERE engagement_id = $1`,
		engagementID,
	).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("count certifications: %w", err)
	}

	offset := (page - 1) * perPage
	rows, err := db.Query(
		`SELECT id, engagement_id, gate_score, p1_count, checklist_json,
		        auto_evaluated, certified_by, certified_at, notes, created_at
		 FROM migration.certification_record
		 WHERE engagement_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2 OFFSET $3`,
		engagementID, perPage, offset,
	)
	if err != nil {
		return nil, fmt.Errorf("list certifications: %w", err)
	}
	defer rows.Close()

	var certs []models.CertificationRecord
	for rows.Next() {
		var c models.CertificationRecord
		var checklistBytes, autoEvalBytes []byte
		var notes sql.NullString
		if err := rows.Scan(
			&c.ID, &c.EngagementID, &c.GateScore, &c.P1Count, &checklistBytes,
			&autoEvalBytes, &c.CertifiedBy, &c.CertifiedAt, &notes, &c.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan certification: %w", err)
		}
		if err := json.Unmarshal(checklistBytes, &c.ChecklistJSON); err != nil {
			return nil, fmt.Errorf("unmarshal checklist: %w", err)
		}
		if autoEvalBytes != nil {
			c.AutoEvaluated = autoEvalBytes
		}
		if notes.Valid {
			c.Notes = notes.String
		}
		certs = append(certs, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list certifications rows: %w", err)
	}

	if certs == nil {
		certs = []models.CertificationRecord{}
	}

	return &models.CertificationListResponse{
		Certifications: certs,
		Total:          total,
		Page:           page,
		PerPage:        perPage,
	}, nil
}

// HasCompletedParallelRun returns true if at least one parallel run with status
// 'COMPLETED' exists for the engagement.
func HasCompletedParallelRun(db *sql.DB, engagementID string) (bool, error) {
	var count int
	err := db.QueryRow(
		`SELECT COUNT(*) FROM migration.parallel_run WHERE engagement_id = $1 AND status = 'COMPLETED'`,
		engagementID,
	).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("has completed parallel run: %w", err)
	}
	return count > 0, nil
}
