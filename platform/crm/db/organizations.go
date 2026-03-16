package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/noui/platform/crm/models"
	"github.com/noui/platform/dbcontext"
)

// ListOrganizations retrieves organizations for a tenant with optional type filter.
// Returns matching organizations, total count, and any error.
func (s *Store) ListOrganizations(ctx context.Context, tenantID string, orgType string, limit, offset int) ([]models.Organization, int, error) {
	query := `
		SELECT
			org_id, tenant_id, org_type, org_name, org_short_name,
			legacy_employer_id, ein,
			address_line1, address_line2, city, state_code, zip_code,
			main_phone, main_email, website_url,
			employer_status, member_count, last_contribution_date,
			reporting_frequency,
			contract_reference, contract_start_date, contract_end_date,
			created_at, updated_at, created_by, updated_by,
			COUNT(*) OVER() AS total_count
		FROM crm_organization
		WHERE tenant_id = $1 AND deleted_at IS NULL`

	args := []interface{}{tenantID}
	argIdx := 2

	if orgType != "" {
		query += fmt.Sprintf(" AND org_type = $%d", argIdx)
		args = append(args, orgType)
		argIdx++
	}

	query += " ORDER BY org_name"

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, limit)
		argIdx++
	}
	if offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, offset)
		argIdx++
	}

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing organizations: %w", err)
	}
	defer rows.Close()

	var orgs []models.Organization
	var totalCount int

	for rows.Next() {
		org, tc, err := scanOrganizationRow(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning organization row: %w", err)
		}
		totalCount = tc
		orgs = append(orgs, org)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating organization rows: %w", err)
	}

	return orgs, totalCount, nil
}

// GetOrganization retrieves a single organization by ID, including contact roles.
func (s *Store) GetOrganization(ctx context.Context, orgID string) (*models.Organization, error) {
	query := `
		SELECT
			org_id, tenant_id, org_type, org_name, org_short_name,
			legacy_employer_id, ein,
			address_line1, address_line2, city, state_code, zip_code,
			main_phone, main_email, website_url,
			employer_status, member_count, last_contribution_date,
			reporting_frequency,
			contract_reference, contract_start_date, contract_end_date,
			created_at, updated_at, created_by, updated_by
		FROM crm_organization
		WHERE org_id = $1 AND deleted_at IS NULL`

	var org models.Organization
	var orgShortName, legacyEmployerID, ein sql.NullString
	var addressLine1, addressLine2, city, stateCode, zipCode sql.NullString
	var mainPhone, mainEmail, websiteURL sql.NullString
	var employerStatus sql.NullString
	var memberCount sql.NullInt64
	var lastContributionDate sql.NullString
	var reportingFrequency sql.NullString
	var contractReference, contractStartDate, contractEndDate sql.NullString

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, orgID).Scan(
		&org.OrgID, &org.TenantID, &org.OrgType, &org.OrgName, &orgShortName,
		&legacyEmployerID, &ein,
		&addressLine1, &addressLine2, &city, &stateCode, &zipCode,
		&mainPhone, &mainEmail, &websiteURL,
		&employerStatus, &memberCount, &lastContributionDate,
		&reportingFrequency,
		&contractReference, &contractStartDate, &contractEndDate,
		&org.CreatedAt, &org.UpdatedAt, &org.CreatedBy, &org.UpdatedBy,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting organization %s: %w", orgID, err)
	}

	org.OrgShortName = nullStringToPtr(orgShortName)
	org.LegacyEmployerID = nullStringToPtr(legacyEmployerID)
	org.EIN = nullStringToPtr(ein)
	org.AddressLine1 = nullStringToPtr(addressLine1)
	org.AddressLine2 = nullStringToPtr(addressLine2)
	org.City = nullStringToPtr(city)
	org.StateCode = nullStringToPtr(stateCode)
	org.ZipCode = nullStringToPtr(zipCode)
	org.MainPhone = nullStringToPtr(mainPhone)
	org.MainEmail = nullStringToPtr(mainEmail)
	org.WebsiteURL = nullStringToPtr(websiteURL)
	org.EmployerStatus = nullStringToPtr(employerStatus)
	org.MemberCount = nullInt64ToIntPtr(memberCount)
	org.LastContributionDate = nullStringToPtr(lastContributionDate)
	org.ReportingFrequency = nullStringToPtr(reportingFrequency)
	org.ContractReference = nullStringToPtr(contractReference)
	org.ContractStartDate = nullStringToPtr(contractStartDate)
	org.ContractEndDate = nullStringToPtr(contractEndDate)

	// Load contact roles
	contacts, err := s.getOrgContactRoles(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("getting contacts for organization %s: %w", orgID, err)
	}
	org.Contacts = contacts

	return &org, nil
}

// CreateOrganization inserts a new organization record.
func (s *Store) CreateOrganization(ctx context.Context, o *models.Organization) error {
	query := `
		INSERT INTO crm_organization (
			org_id, tenant_id, org_type, org_name, org_short_name,
			legacy_employer_id, ein,
			address_line1, address_line2, city, state_code, zip_code,
			main_phone, main_email, website_url,
			employer_status, member_count, last_contribution_date,
			reporting_frequency,
			contract_reference, contract_start_date, contract_end_date,
			created_by, updated_by
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7,
			$8, $9, $10, $11, $12,
			$13, $14, $15,
			$16, $17, $18,
			$19,
			$20, $21, $22,
			$23, $24
		)
		RETURNING created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx,
		query,
		o.OrgID, o.TenantID, o.OrgType, o.OrgName, o.OrgShortName,
		o.LegacyEmployerID, o.EIN,
		o.AddressLine1, o.AddressLine2, o.City, o.StateCode, o.ZipCode,
		o.MainPhone, o.MainEmail, o.WebsiteURL,
		o.EmployerStatus, o.MemberCount, o.LastContributionDate,
		o.ReportingFrequency,
		o.ContractReference, o.ContractStartDate, o.ContractEndDate,
		o.CreatedBy, o.UpdatedBy,
	).Scan(&o.CreatedAt, &o.UpdatedAt)
}

// getOrgContactRoles retrieves all contact roles for an organization.
func (s *Store) getOrgContactRoles(ctx context.Context, orgID string) ([]models.OrgContactRole, error) {
	query := `
		SELECT
			org_contact_id, org_id, contact_id,
			role, is_primary_for_role,
			title, direct_phone, direct_email,
			effective_from, effective_to
		FROM crm_org_contact
		WHERE org_id = $1
		ORDER BY role, is_primary_for_role DESC`

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []models.OrgContactRole
	for rows.Next() {
		var r models.OrgContactRole
		var title, directPhone, directEmail sql.NullString
		var effectiveTo sql.NullString

		err := rows.Scan(
			&r.OrgContactID, &r.OrgID, &r.ContactID,
			&r.Role, &r.IsPrimaryForRole,
			&title, &directPhone, &directEmail,
			&r.EffectiveFrom, &effectiveTo,
		)
		if err != nil {
			return nil, err
		}

		r.Title = nullStringToPtr(title)
		r.DirectPhone = nullStringToPtr(directPhone)
		r.DirectEmail = nullStringToPtr(directEmail)
		r.EffectiveTo = nullStringToPtr(effectiveTo)

		roles = append(roles, r)
	}

	return roles, rows.Err()
}

// scanOrganizationRow scans a single organization row that includes a total_count column.
func scanOrganizationRow(rows *sql.Rows) (models.Organization, int, error) {
	var org models.Organization
	var totalCount int
	var orgShortName, legacyEmployerID, ein sql.NullString
	var addressLine1, addressLine2, city, stateCode, zipCode sql.NullString
	var mainPhone, mainEmail, websiteURL sql.NullString
	var employerStatus sql.NullString
	var memberCount sql.NullInt64
	var lastContributionDate sql.NullString
	var reportingFrequency sql.NullString
	var contractReference, contractStartDate, contractEndDate sql.NullString

	err := rows.Scan(
		&org.OrgID, &org.TenantID, &org.OrgType, &org.OrgName, &orgShortName,
		&legacyEmployerID, &ein,
		&addressLine1, &addressLine2, &city, &stateCode, &zipCode,
		&mainPhone, &mainEmail, &websiteURL,
		&employerStatus, &memberCount, &lastContributionDate,
		&reportingFrequency,
		&contractReference, &contractStartDate, &contractEndDate,
		&org.CreatedAt, &org.UpdatedAt, &org.CreatedBy, &org.UpdatedBy,
		&totalCount,
	)
	if err != nil {
		return org, 0, err
	}

	org.OrgShortName = nullStringToPtr(orgShortName)
	org.LegacyEmployerID = nullStringToPtr(legacyEmployerID)
	org.EIN = nullStringToPtr(ein)
	org.AddressLine1 = nullStringToPtr(addressLine1)
	org.AddressLine2 = nullStringToPtr(addressLine2)
	org.City = nullStringToPtr(city)
	org.StateCode = nullStringToPtr(stateCode)
	org.ZipCode = nullStringToPtr(zipCode)
	org.MainPhone = nullStringToPtr(mainPhone)
	org.MainEmail = nullStringToPtr(mainEmail)
	org.WebsiteURL = nullStringToPtr(websiteURL)
	org.EmployerStatus = nullStringToPtr(employerStatus)
	org.MemberCount = nullInt64ToIntPtr(memberCount)
	org.LastContributionDate = nullStringToPtr(lastContributionDate)
	org.ReportingFrequency = nullStringToPtr(reportingFrequency)
	org.ContractReference = nullStringToPtr(contractReference)
	org.ContractStartDate = nullStringToPtr(contractStartDate)
	org.ContractEndDate = nullStringToPtr(contractEndDate)

	return org, totalCount, nil
}
