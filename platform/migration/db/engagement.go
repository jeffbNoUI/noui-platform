package db

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// CreateEngagement inserts a new migration engagement and returns the created record.
func CreateEngagement(db *sql.DB, tenantID, sourceSystemName string) (*models.Engagement, error) {
	var e models.Engagement
	err := db.QueryRow(
		`INSERT INTO migration.engagement (tenant_id, source_system_name)
		 VALUES ($1, $2)
		 RETURNING engagement_id, tenant_id, source_system_name, canonical_schema_version,
		           status, quality_baseline_approved_at, created_at, updated_at`,
		tenantID, sourceSystemName,
	).Scan(
		&e.EngagementID, &e.TenantID, &e.SourceSystemName, &e.CanonicalSchemaVersion,
		&e.Status, &e.QualityBaselineApprovedAt, &e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create engagement: %w", err)
	}
	return &e, nil
}

// GetEngagement retrieves a single engagement by its ID.
func GetEngagement(db *sql.DB, engagementID string) (*models.Engagement, error) {
	var e models.Engagement
	err := db.QueryRow(
		`SELECT engagement_id, tenant_id, source_system_name, canonical_schema_version,
		        status, quality_baseline_approved_at, created_at, updated_at
		 FROM migration.engagement
		 WHERE engagement_id = $1`,
		engagementID,
	).Scan(
		&e.EngagementID, &e.TenantID, &e.SourceSystemName, &e.CanonicalSchemaVersion,
		&e.Status, &e.QualityBaselineApprovedAt, &e.CreatedAt, &e.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get engagement: %w", err)
	}
	return &e, nil
}

// UpdateEngagementStatus updates an engagement's status and returns the updated record.
func UpdateEngagementStatus(db *sql.DB, engagementID string, newStatus models.EngagementStatus) (*models.Engagement, error) {
	var e models.Engagement
	err := db.QueryRow(
		`UPDATE migration.engagement
		 SET status = $2, updated_at = now()
		 WHERE engagement_id = $1
		 RETURNING engagement_id, tenant_id, source_system_name, canonical_schema_version,
		           status, quality_baseline_approved_at, created_at, updated_at`,
		engagementID, string(newStatus),
	).Scan(
		&e.EngagementID, &e.TenantID, &e.SourceSystemName, &e.CanonicalSchemaVersion,
		&e.Status, &e.QualityBaselineApprovedAt, &e.CreatedAt, &e.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("update engagement status: %w", err)
	}
	return &e, nil
}

// ListEngagements returns all engagements for a tenant, ordered by creation date descending.
func ListEngagements(db *sql.DB, tenantID string) ([]models.Engagement, error) {
	rows, err := db.Query(
		`SELECT engagement_id, tenant_id, source_system_name, canonical_schema_version,
		        status, quality_baseline_approved_at, created_at, updated_at
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
		var e models.Engagement
		if err := rows.Scan(
			&e.EngagementID, &e.TenantID, &e.SourceSystemName, &e.CanonicalSchemaVersion,
			&e.Status, &e.QualityBaselineApprovedAt, &e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan engagement: %w", err)
		}
		engagements = append(engagements, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list engagements rows: %w", err)
	}
	return engagements, nil
}
