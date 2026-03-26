package db

import (
	"database/sql"
	"fmt"
	"regexp"

	"github.com/noui/platform/migration/models"
)

// versionLabelRe validates schema version labels: v1.0, v2.1, etc.
var versionLabelRe = regexp.MustCompile(`^v\d+\.\d+$`)

// schemaVersionColumns is the standard column list for schema_version queries.
const schemaVersionColumns = `version_id, tenant_id, label, description, is_active, created_at, updated_at`

// scanSchemaVersion scans a schema_version row.
func scanSchemaVersion(scanner interface{ Scan(...any) error }) (*models.SchemaVersion, error) {
	var v models.SchemaVersion
	err := scanner.Scan(
		&v.VersionID, &v.TenantID, &v.Label, &v.Description,
		&v.IsActive, &v.CreatedAt, &v.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// schemaVersionFieldColumns is the standard column list for schema_version_field queries.
const schemaVersionFieldColumns = `field_id, version_id, entity, field_name, data_type, is_required, description, created_at`

// scanSchemaVersionField scans a schema_version_field row.
func scanSchemaVersionField(scanner interface{ Scan(...any) error }) (*models.SchemaVersionField, error) {
	var f models.SchemaVersionField
	err := scanner.Scan(
		&f.FieldID, &f.VersionID, &f.Entity, &f.FieldName,
		&f.DataType, &f.IsRequired, &f.Description, &f.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// CreateSchemaVersion inserts a new schema version and its fields atomically.
// Returns the created version with all fields.
func CreateSchemaVersion(db *sql.DB, tenantID, label string, description *string, fields []models.CreateSchemaVersionFieldReq) (*models.SchemaVersionWithFields, error) {
	if !versionLabelRe.MatchString(label) {
		return nil, fmt.Errorf("invalid version label %q: must match ^v\\d+\\.\\d+$", label)
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	// Insert the version.
	row := tx.QueryRow(
		`INSERT INTO migration.schema_version (tenant_id, label, description)
		 VALUES ($1, $2, $3)
		 RETURNING `+schemaVersionColumns,
		tenantID, label, description,
	)
	ver, err := scanSchemaVersion(row)
	if err != nil {
		return nil, fmt.Errorf("insert schema_version: %w", err)
	}

	// Insert fields.
	var insertedFields []models.SchemaVersionField
	for _, f := range fields {
		fRow := tx.QueryRow(
			`INSERT INTO migration.schema_version_field (version_id, entity, field_name, data_type, is_required, description)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 RETURNING `+schemaVersionFieldColumns,
			ver.VersionID, f.Entity, f.FieldName, f.DataType, f.IsRequired, f.Description,
		)
		field, err := scanSchemaVersionField(fRow)
		if err != nil {
			return nil, fmt.Errorf("insert schema_version_field: %w", err)
		}
		insertedFields = append(insertedFields, *field)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return &models.SchemaVersionWithFields{
		Version: *ver,
		Fields:  insertedFields,
	}, nil
}

// ListSchemaVersions returns all schema versions for a tenant, ordered by creation date descending.
func ListSchemaVersions(db *sql.DB, tenantID string) ([]models.SchemaVersion, error) {
	rows, err := db.Query(
		`SELECT `+schemaVersionColumns+`
		 FROM migration.schema_version
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("list schema_versions: %w", err)
	}
	defer rows.Close()

	var versions []models.SchemaVersion
	for rows.Next() {
		v, err := scanSchemaVersion(rows)
		if err != nil {
			return nil, fmt.Errorf("scan schema_version: %w", err)
		}
		versions = append(versions, *v)
	}
	return versions, rows.Err()
}

// GetSchemaVersion retrieves a single schema version by ID, including its fields.
func GetSchemaVersion(db *sql.DB, versionID string) (*models.SchemaVersionWithFields, error) {
	row := db.QueryRow(
		`SELECT `+schemaVersionColumns+`
		 FROM migration.schema_version
		 WHERE version_id = $1`,
		versionID,
	)
	ver, err := scanSchemaVersion(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get schema_version: %w", err)
	}

	fields, err := listFieldsForVersion(db, ver.VersionID)
	if err != nil {
		return nil, err
	}

	return &models.SchemaVersionWithFields{
		Version: *ver,
		Fields:  fields,
	}, nil
}

// listFieldsForVersion retrieves all fields for a given version.
func listFieldsForVersion(db *sql.DB, versionID string) ([]models.SchemaVersionField, error) {
	rows, err := db.Query(
		`SELECT `+schemaVersionFieldColumns+`
		 FROM migration.schema_version_field
		 WHERE version_id = $1
		 ORDER BY entity, field_name`,
		versionID,
	)
	if err != nil {
		return nil, fmt.Errorf("list schema_version_fields: %w", err)
	}
	defer rows.Close()

	var fields []models.SchemaVersionField
	for rows.Next() {
		f, err := scanSchemaVersionField(rows)
		if err != nil {
			return nil, fmt.Errorf("scan schema_version_field: %w", err)
		}
		fields = append(fields, *f)
	}
	return fields, rows.Err()
}

// ActivateSchemaVersion sets a version as the single active version for its tenant.
// Deactivates the current active version and activates the target in a single transaction.
func ActivateSchemaVersion(db *sql.DB, versionID string) (*models.SchemaVersion, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	// Look up the target version to get its tenant_id.
	row := tx.QueryRow(
		`SELECT `+schemaVersionColumns+`
		 FROM migration.schema_version
		 WHERE version_id = $1`,
		versionID,
	)
	target, err := scanSchemaVersion(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get target version: %w", err)
	}

	// Deactivate any currently active version for this tenant.
	_, err = tx.Exec(
		`UPDATE migration.schema_version
		 SET is_active = false, updated_at = now()
		 WHERE tenant_id = $1 AND is_active = true`,
		target.TenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("deactivate current: %w", err)
	}

	// Activate the target.
	activated := tx.QueryRow(
		`UPDATE migration.schema_version
		 SET is_active = true, updated_at = now()
		 WHERE version_id = $1
		 RETURNING `+schemaVersionColumns,
		versionID,
	)
	result, err := scanSchemaVersion(activated)
	if err != nil {
		return nil, fmt.Errorf("activate target: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return result, nil
}

// DiffSchemaVersions computes the set difference between two schema versions.
// Returns added fields (in toID but not fromID), removed fields (in fromID but not toID),
// and type-changed fields (same entity+field_name, different data_type).
func DiffSchemaVersions(db *sql.DB, fromID, toID string) (*models.SchemaVersionDiff, error) {
	fromFields, err := listFieldsForVersion(db, fromID)
	if err != nil {
		return nil, fmt.Errorf("list from fields: %w", err)
	}
	toFields, err := listFieldsForVersion(db, toID)
	if err != nil {
		return nil, fmt.Errorf("list to fields: %w", err)
	}

	// Look up version labels for the response.
	var fromLabel, toLabel string
	err = db.QueryRow(`SELECT label FROM migration.schema_version WHERE version_id = $1`, fromID).Scan(&fromLabel)
	if err != nil {
		return nil, fmt.Errorf("get from version label: %w", err)
	}
	err = db.QueryRow(`SELECT label FROM migration.schema_version WHERE version_id = $1`, toID).Scan(&toLabel)
	if err != nil {
		return nil, fmt.Errorf("get to version label: %w", err)
	}

	// Build maps keyed by entity+field_name.
	type fieldKey struct {
		Entity    string
		FieldName string
	}
	fromMap := make(map[fieldKey]models.SchemaVersionField, len(fromFields))
	for _, f := range fromFields {
		fromMap[fieldKey{f.Entity, f.FieldName}] = f
	}
	toMap := make(map[fieldKey]models.SchemaVersionField, len(toFields))
	for _, f := range toFields {
		toMap[fieldKey{f.Entity, f.FieldName}] = f
	}

	diff := &models.SchemaVersionDiff{
		FromVersion: fromLabel,
		ToVersion:   toLabel,
	}

	// Added: in toMap but not fromMap.
	for key, f := range toMap {
		if _, exists := fromMap[key]; !exists {
			diff.Added = append(diff.Added, f)
		}
	}

	// Removed: in fromMap but not toMap.
	for key, f := range fromMap {
		if _, exists := toMap[key]; !exists {
			diff.Removed = append(diff.Removed, f)
		}
	}

	// Type changed: in both but different data_type.
	for key, fromField := range fromMap {
		if toField, exists := toMap[key]; exists {
			if fromField.DataType != toField.DataType {
				diff.TypeChanged = append(diff.TypeChanged, models.FieldTypeChange{
					Entity:    key.Entity,
					FieldName: key.FieldName,
					OldType:   fromField.DataType,
					NewType:   toField.DataType,
				})
			}
		}
	}

	return diff, nil
}
