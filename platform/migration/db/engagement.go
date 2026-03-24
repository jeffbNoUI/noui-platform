package db

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// scanEngagement scans an engagement row including the source_connection JSONB column.
func scanEngagement(scanner interface{ Scan(...any) error }) (*models.Engagement, error) {
	var e models.Engagement
	var connJSON []byte
	err := scanner.Scan(
		&e.EngagementID, &e.TenantID, &e.SourceSystemName, &e.CanonicalSchemaVersion,
		&e.Status, &e.SourcePlatformType, &e.QualityBaselineApprovedAt, &connJSON,
		&e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if connJSON != nil {
		var sc models.SourceConnection
		if err := json.Unmarshal(connJSON, &sc); err != nil {
			return nil, fmt.Errorf("unmarshal source_connection: %w", err)
		}
		e.SourceConnection = &sc
	}
	return &e, nil
}

// engagementColumns is the standard column list for engagement queries.
const engagementColumns = `engagement_id, tenant_id, source_system_name, canonical_schema_version,
		status, source_platform_type, quality_baseline_approved_at, source_connection, created_at, updated_at`

// CreateEngagement inserts a new migration engagement and returns the created record.
func CreateEngagement(db *sql.DB, tenantID, sourceSystemName string, platformType *string) (*models.Engagement, error) {
	row := db.QueryRow(
		`INSERT INTO migration.engagement (tenant_id, source_system_name, source_platform_type)
		 VALUES ($1, $2, $3)
		 RETURNING `+engagementColumns,
		tenantID, sourceSystemName, platformType,
	)
	e, err := scanEngagement(row)
	if err != nil {
		return nil, fmt.Errorf("create engagement: %w", err)
	}
	return e, nil
}

// GetEngagement retrieves a single engagement by its ID.
func GetEngagement(db *sql.DB, engagementID string) (*models.Engagement, error) {
	row := db.QueryRow(
		`SELECT `+engagementColumns+`
		 FROM migration.engagement
		 WHERE engagement_id = $1`,
		engagementID,
	)
	e, err := scanEngagement(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get engagement: %w", err)
	}
	return e, nil
}

// UpdateEngagementStatus updates an engagement's status and returns the updated record.
func UpdateEngagementStatus(db *sql.DB, engagementID string, newStatus models.EngagementStatus) (*models.Engagement, error) {
	row := db.QueryRow(
		`UPDATE migration.engagement
		 SET status = $2, updated_at = now()
		 WHERE engagement_id = $1
		 RETURNING `+engagementColumns,
		engagementID, string(newStatus),
	)
	e, err := scanEngagement(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("update engagement status: %w", err)
	}
	return e, nil
}

// ListEngagements returns all engagements for a tenant, ordered by creation date descending.
func ListEngagements(db *sql.DB, tenantID string) ([]models.Engagement, error) {
	rows, err := db.Query(
		`SELECT `+engagementColumns+`
		 FROM migration.engagement
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("list engagements: %w", err)
	}
	defer rows.Close()

	var engagements []models.Engagement
	for rows.Next() {
		e, err := scanEngagement(rows)
		if err != nil {
			return nil, fmt.Errorf("scan engagement: %w", err)
		}
		engagements = append(engagements, *e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list engagements rows: %w", err)
	}
	return engagements, nil
}
