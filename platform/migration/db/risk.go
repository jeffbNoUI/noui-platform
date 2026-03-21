package db

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// CreateRisk inserts a new risk and returns the created record.
func CreateRisk(db *sql.DB, tenantID string, req models.CreateRiskRequest) (*models.Risk, error) {
	var r models.Risk
	err := db.QueryRow(
		`INSERT INTO migration.risk (tenant_id, engagement_id, source, severity, description, evidence, mitigation)
		 VALUES ($1, $2, 'STATIC', $3, $4, $5, $6)
		 RETURNING risk_id, engagement_id, tenant_id, source, severity, description,
		           evidence, mitigation, status, detected_at, acknowledged_by, closed_at`,
		tenantID, req.EngagementID, req.Severity, req.Description, req.Evidence, req.Mitigation,
	).Scan(
		&r.RiskID, &r.EngagementID, &r.TenantID, &r.Source, &r.Severity, &r.Description,
		&r.Evidence, &r.Mitigation, &r.Status, &r.DetectedAt, &r.AcknowledgedBy, &r.ClosedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create risk: %w", err)
	}
	return &r, nil
}

// ListRisks returns risks filtered by tenant, with optional engagement_id filter.
func ListRisks(db *sql.DB, tenantID string, engagementID *string) ([]models.Risk, error) {
	var query string
	var args []any

	if engagementID != nil {
		query = `SELECT risk_id, engagement_id, tenant_id, source, severity, description,
		                evidence, mitigation, status, detected_at, acknowledged_by, closed_at
		         FROM migration.risk
		         WHERE tenant_id = $1 AND engagement_id = $2
		         ORDER BY detected_at DESC`
		args = []any{tenantID, *engagementID}
	} else {
		query = `SELECT risk_id, engagement_id, tenant_id, source, severity, description,
		                evidence, mitigation, status, detected_at, acknowledged_by, closed_at
		         FROM migration.risk
		         WHERE tenant_id = $1
		         ORDER BY detected_at DESC`
		args = []any{tenantID}
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list risks: %w", err)
	}
	defer rows.Close()

	var risks []models.Risk
	for rows.Next() {
		var r models.Risk
		if err := rows.Scan(
			&r.RiskID, &r.EngagementID, &r.TenantID, &r.Source, &r.Severity, &r.Description,
			&r.Evidence, &r.Mitigation, &r.Status, &r.DetectedAt, &r.AcknowledgedBy, &r.ClosedAt,
		); err != nil {
			return nil, fmt.Errorf("scan risk: %w", err)
		}
		risks = append(risks, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list risks rows: %w", err)
	}
	return risks, nil
}

// GetRisk retrieves a single risk by its ID.
func GetRisk(db *sql.DB, riskID string) (*models.Risk, error) {
	var r models.Risk
	err := db.QueryRow(
		`SELECT risk_id, engagement_id, tenant_id, source, severity, description,
		        evidence, mitigation, status, detected_at, acknowledged_by, closed_at
		 FROM migration.risk
		 WHERE risk_id = $1`,
		riskID,
	).Scan(
		&r.RiskID, &r.EngagementID, &r.TenantID, &r.Source, &r.Severity, &r.Description,
		&r.Evidence, &r.Mitigation, &r.Status, &r.DetectedAt, &r.AcknowledgedBy, &r.ClosedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get risk: %w", err)
	}
	return &r, nil
}

// UpdateRisk updates a risk's status and/or mitigation fields.
func UpdateRisk(db *sql.DB, riskID string, req models.UpdateRiskRequest) (*models.Risk, error) {
	var r models.Risk

	// Build dynamic update based on provided fields.
	query := `UPDATE migration.risk SET `
	args := []any{}
	argIdx := 1
	setClauses := ""

	if req.Status != nil {
		setClauses += fmt.Sprintf("status = $%d", argIdx)
		args = append(args, *req.Status)
		argIdx++

		// If closing, set closed_at.
		if *req.Status == "CLOSED" {
			setClauses += fmt.Sprintf(", closed_at = now()")
		}
	}
	if req.Mitigation != nil {
		if setClauses != "" {
			setClauses += ", "
		}
		setClauses += fmt.Sprintf("mitigation = $%d", argIdx)
		args = append(args, *req.Mitigation)
		argIdx++
	}

	if setClauses == "" {
		return nil, fmt.Errorf("update risk: no fields to update")
	}

	query += setClauses + fmt.Sprintf(" WHERE risk_id = $%d", argIdx)
	args = append(args, riskID)

	query += ` RETURNING risk_id, engagement_id, tenant_id, source, severity, description,
	                     evidence, mitigation, status, detected_at, acknowledged_by, closed_at`

	err := db.QueryRow(query, args...).Scan(
		&r.RiskID, &r.EngagementID, &r.TenantID, &r.Source, &r.Severity, &r.Description,
		&r.Evidence, &r.Mitigation, &r.Status, &r.DetectedAt, &r.AcknowledgedBy, &r.ClosedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("update risk: %w", err)
	}
	return &r, nil
}

// DeleteRisk deletes a risk by its ID. Returns true if a row was deleted.
func DeleteRisk(db *sql.DB, riskID string) (bool, error) {
	result, err := db.Exec(`DELETE FROM migration.risk WHERE risk_id = $1`, riskID)
	if err != nil {
		return false, fmt.Errorf("delete risk: %w", err)
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("delete risk rows affected: %w", err)
	}
	return rows > 0, nil
}
