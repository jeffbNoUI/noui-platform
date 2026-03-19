package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/noui/platform/crm/models"
	"github.com/noui/platform/dbcontext"
)

// ListOrgInteractions retrieves interactions linked to a specific organization.
// Returns matching interactions, total count, and any error.
func (s *Store) ListOrgInteractions(ctx context.Context, orgID string, category string, limit, offset int) ([]models.Interaction, int, error) {
	query := `
		SELECT
			interaction_id, tenant_id, conversation_id,
			contact_id, org_id, agent_id,
			channel, interaction_type, category, subcategory,
			outcome, direction,
			started_at, ended_at, duration_seconds,
			external_call_id, queue_name, wait_time_seconds,
			recording_url, transcript_url,
			message_subject, message_thread_id,
			summary,
			linked_case_id, linked_workflow_id,
			wrap_up_code, wrap_up_seconds,
			visibility,
			created_at, created_by,
			COUNT(*) OVER() AS total_count
		FROM crm_interaction
		WHERE org_id = $1`

	args := []interface{}{orgID}
	argIdx := 2

	if category != "" {
		query += fmt.Sprintf(" AND category = $%d", argIdx)
		args = append(args, category)
		argIdx++
	}

	query += " ORDER BY started_at DESC"

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, limit)
		argIdx++
	}
	if offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, offset)
	}

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing org interactions: %w", err)
	}
	defer rows.Close()

	var interactions []models.Interaction
	var totalCount int

	for rows.Next() {
		i, tc, err := scanInteractionRow(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning org interaction row: %w", err)
		}
		totalCount = tc
		interactions = append(interactions, i)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating org interaction rows: %w", err)
	}

	return interactions, totalCount, nil
}

// ListOrgContacts retrieves contacts associated with an organization, including their roles.
// Returns contacts with populated OrganizationRoles for this org.
func (s *Store) ListOrgContacts(ctx context.Context, orgID string, limit, offset int) ([]models.Contact, int, error) {
	query := `
		SELECT
			c.contact_id, c.tenant_id, c.contact_type,
			c.legacy_mbr_id,
			c.first_name, c.last_name, c.middle_name, c.suffix,
			c.date_of_birth, c.gender,
			c.primary_email, c.primary_phone, c.primary_phone_type,
			c.preferred_language, c.preferred_channel,
			c.identity_verified, c.security_flag,
			c.created_at, c.updated_at,
			oc.role, oc.is_primary_for_role, oc.title,
			oc.direct_phone, oc.direct_email,
			COUNT(*) OVER() AS total_count
		FROM crm_contact c
		JOIN crm_org_contact oc ON oc.contact_id = c.contact_id
		WHERE oc.org_id = $1 AND c.deleted_at IS NULL
		ORDER BY oc.role, c.last_name, c.first_name`

	args := []interface{}{orgID}
	argIdx := 2

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, limit)
		argIdx++
	}
	if offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, offset)
	}

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing org contacts: %w", err)
	}
	defer rows.Close()

	var contacts []models.Contact
	var totalCount int

	for rows.Next() {
		var c models.Contact
		var legacyMbrID, middleName, suffix sql.NullString
		var dob, gender sql.NullString
		var primaryEmail, primaryPhone, primaryPhoneType sql.NullString
		var securityFlag sql.NullString
		var role string
		var isPrimary bool
		var title, directPhone, directEmail sql.NullString

		err := rows.Scan(
			&c.ContactID, &c.TenantID, &c.ContactType,
			&legacyMbrID,
			&c.FirstName, &c.LastName, &middleName, &suffix,
			&dob, &gender,
			&primaryEmail, &primaryPhone, &primaryPhoneType,
			&c.PreferredLanguage, &c.PreferredChannel,
			&c.IdentityVerified, &securityFlag,
			&c.CreatedAt, &c.UpdatedAt,
			&role, &isPrimary, &title,
			&directPhone, &directEmail,
			&totalCount,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning org contact row: %w", err)
		}

		c.LegacyMemberID = nullStringToPtr(legacyMbrID)
		c.MiddleName = nullStringToPtr(middleName)
		c.Suffix = nullStringToPtr(suffix)
		c.DateOfBirth = nullStringToPtr(dob)
		c.Gender = nullStringToPtr(gender)
		c.PrimaryEmail = nullStringToPtr(primaryEmail)
		c.PrimaryPhone = nullStringToPtr(primaryPhone)
		c.PrimaryPhoneType = nullStringToPtr(primaryPhoneType)
		c.SecurityFlag = nullStringToPtr(securityFlag)

		c.OrganizationRoles = []models.OrgContactRole{{
			OrgID:            orgID,
			ContactID:        c.ContactID,
			Role:             role,
			IsPrimaryForRole: isPrimary,
			Title:            nullStringToPtr(title),
			DirectPhone:      nullStringToPtr(directPhone),
			DirectEmail:      nullStringToPtr(directEmail),
		}}

		contacts = append(contacts, c)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating org contact rows: %w", err)
	}

	return contacts, totalCount, nil
}
