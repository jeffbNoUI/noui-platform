package db

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/noui/platform/crm/models"
)

// ListContacts searches contacts by name, email, phone, or legacy member ID with pagination.
// Returns matching contacts, total count, and any error.
func (s *Store) ListContacts(tenantID string, params models.ContactSearchParams) ([]models.Contact, int, error) {
	query := `
		SELECT
			contact_id, tenant_id, contact_type, legacy_mbr_id,
			first_name, last_name, middle_name, suffix,
			date_of_birth, gender,
			primary_email, primary_phone, primary_phone_type,
			preferred_language, preferred_channel,
			identity_verified, identity_verified_at, identity_verified_by,
			security_flag, security_flag_note,
			email_deliverable, email_validated_at, phone_validated_at,
			mail_returned, mail_returned_at,
			merged_into_id, merge_date,
			created_at, updated_at, created_by, updated_by,
			COUNT(*) OVER() AS total_count
		FROM crm_contact
		WHERE tenant_id = $1 AND deleted_at IS NULL`

	args := []interface{}{tenantID}
	argIdx := 2

	if params.ContactType != "" {
		query += fmt.Sprintf(" AND contact_type = $%d", argIdx)
		args = append(args, params.ContactType)
		argIdx++
	}

	if params.Query != "" {
		searchTerm := "%" + strings.ToLower(params.Query) + "%"
		query += fmt.Sprintf(` AND (
			LOWER(first_name) LIKE $%d OR
			LOWER(last_name) LIKE $%d OR
			LOWER(primary_email) LIKE $%d OR
			primary_phone LIKE $%d OR
			legacy_mbr_id LIKE $%d
		)`, argIdx, argIdx, argIdx, argIdx, argIdx)
		args = append(args, searchTerm)
		argIdx++
	}

	query += " ORDER BY last_name, first_name"

	if params.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, params.Limit)
		argIdx++
	}
	if params.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, params.Offset)
		argIdx++
	}

	rows, err := s.DB.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing contacts: %w", err)
	}
	defer rows.Close()

	var contacts []models.Contact
	var totalCount int

	for rows.Next() {
		var c models.Contact
		var legacyMbrID, middleName, suffix, dob, gender sql.NullString
		var primaryEmail, primaryPhone, primaryPhoneType sql.NullString
		var identityVerifiedAt sql.NullTime
		var identityVerifiedBy sql.NullString
		var securityFlag, securityFlagNote sql.NullString
		var emailDeliverable sql.NullBool
		var emailValidatedAt, phoneValidatedAt sql.NullTime
		var mailReturnedAt sql.NullTime
		var mergedIntoID sql.NullString
		var mergeDate sql.NullTime

		err := rows.Scan(
			&c.ContactID, &c.TenantID, &c.ContactType, &legacyMbrID,
			&c.FirstName, &c.LastName, &middleName, &suffix,
			&dob, &gender,
			&primaryEmail, &primaryPhone, &primaryPhoneType,
			&c.PreferredLanguage, &c.PreferredChannel,
			&c.IdentityVerified, &identityVerifiedAt, &identityVerifiedBy,
			&securityFlag, &securityFlagNote,
			&emailDeliverable, &emailValidatedAt, &phoneValidatedAt,
			&c.MailReturned, &mailReturnedAt,
			&mergedIntoID, &mergeDate,
			&c.CreatedAt, &c.UpdatedAt, &c.CreatedBy, &c.UpdatedBy,
			&totalCount,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning contact row: %w", err)
		}

		c.LegacyMemberID = nullStringToPtr(legacyMbrID)
		c.MiddleName = nullStringToPtr(middleName)
		c.Suffix = nullStringToPtr(suffix)
		c.DateOfBirth = nullStringToPtr(dob)
		c.Gender = nullStringToPtr(gender)
		c.PrimaryEmail = nullStringToPtr(primaryEmail)
		c.PrimaryPhone = nullStringToPtr(primaryPhone)
		c.PrimaryPhoneType = nullStringToPtr(primaryPhoneType)
		c.IdentityVerifiedAt = nullTimeToPtr(identityVerifiedAt)
		c.IdentityVerifiedBy = nullStringToPtr(identityVerifiedBy)
		c.SecurityFlag = nullStringToPtr(securityFlag)
		c.SecurityFlagNote = nullStringToPtr(securityFlagNote)
		c.EmailDeliverable = nullBoolToPtr(emailDeliverable)
		c.EmailValidatedAt = nullTimeToPtr(emailValidatedAt)
		c.PhoneValidatedAt = nullTimeToPtr(phoneValidatedAt)
		c.MailReturnedAt = nullTimeToPtr(mailReturnedAt)
		c.MergedIntoID = nullStringToPtr(mergedIntoID)
		c.MergeDate = nullTimeToPtr(mergeDate)

		contacts = append(contacts, c)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating contact rows: %w", err)
	}

	return contacts, totalCount, nil
}

// GetContact retrieves a single contact by ID, including addresses and preferences.
func (s *Store) GetContact(contactID string) (*models.Contact, error) {
	query := `
		SELECT
			contact_id, tenant_id, contact_type, legacy_mbr_id,
			first_name, last_name, middle_name, suffix,
			date_of_birth, gender,
			primary_email, primary_phone, primary_phone_type,
			preferred_language, preferred_channel,
			identity_verified, identity_verified_at, identity_verified_by,
			security_flag, security_flag_note,
			email_deliverable, email_validated_at, phone_validated_at,
			mail_returned, mail_returned_at,
			merged_into_id, merge_date,
			created_at, updated_at, created_by, updated_by
		FROM crm_contact
		WHERE contact_id = $1 AND deleted_at IS NULL`

	var c models.Contact
	var legacyMbrID, middleName, suffix, dob, gender sql.NullString
	var primaryEmail, primaryPhone, primaryPhoneType sql.NullString
	var identityVerifiedAt sql.NullTime
	var identityVerifiedBy sql.NullString
	var securityFlag, securityFlagNote sql.NullString
	var emailDeliverable sql.NullBool
	var emailValidatedAt, phoneValidatedAt sql.NullTime
	var mailReturnedAt sql.NullTime
	var mergedIntoID sql.NullString
	var mergeDate sql.NullTime

	err := s.DB.QueryRow(query, contactID).Scan(
		&c.ContactID, &c.TenantID, &c.ContactType, &legacyMbrID,
		&c.FirstName, &c.LastName, &middleName, &suffix,
		&dob, &gender,
		&primaryEmail, &primaryPhone, &primaryPhoneType,
		&c.PreferredLanguage, &c.PreferredChannel,
		&c.IdentityVerified, &identityVerifiedAt, &identityVerifiedBy,
		&securityFlag, &securityFlagNote,
		&emailDeliverable, &emailValidatedAt, &phoneValidatedAt,
		&c.MailReturned, &mailReturnedAt,
		&mergedIntoID, &mergeDate,
		&c.CreatedAt, &c.UpdatedAt, &c.CreatedBy, &c.UpdatedBy,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting contact %s: %w", contactID, err)
	}

	c.LegacyMemberID = nullStringToPtr(legacyMbrID)
	c.MiddleName = nullStringToPtr(middleName)
	c.Suffix = nullStringToPtr(suffix)
	c.DateOfBirth = nullStringToPtr(dob)
	c.Gender = nullStringToPtr(gender)
	c.PrimaryEmail = nullStringToPtr(primaryEmail)
	c.PrimaryPhone = nullStringToPtr(primaryPhone)
	c.PrimaryPhoneType = nullStringToPtr(primaryPhoneType)
	c.IdentityVerifiedAt = nullTimeToPtr(identityVerifiedAt)
	c.IdentityVerifiedBy = nullStringToPtr(identityVerifiedBy)
	c.SecurityFlag = nullStringToPtr(securityFlag)
	c.SecurityFlagNote = nullStringToPtr(securityFlagNote)
	c.EmailDeliverable = nullBoolToPtr(emailDeliverable)
	c.EmailValidatedAt = nullTimeToPtr(emailValidatedAt)
	c.PhoneValidatedAt = nullTimeToPtr(phoneValidatedAt)
	c.MailReturnedAt = nullTimeToPtr(mailReturnedAt)
	c.MergedIntoID = nullStringToPtr(mergedIntoID)
	c.MergeDate = nullTimeToPtr(mergeDate)

	// Load addresses
	addresses, err := s.getContactAddresses(contactID)
	if err != nil {
		return nil, fmt.Errorf("getting addresses for contact %s: %w", contactID, err)
	}
	c.Addresses = addresses

	// Load preferences
	preferences, err := s.getContactPreferences(contactID)
	if err != nil {
		return nil, fmt.Errorf("getting preferences for contact %s: %w", contactID, err)
	}
	c.Preferences = preferences

	return &c, nil
}

// CreateContact inserts a new contact record.
func (s *Store) CreateContact(c *models.Contact) error {
	query := `
		INSERT INTO crm_contact (
			contact_id, tenant_id, contact_type, legacy_mbr_id,
			first_name, last_name, middle_name, suffix,
			date_of_birth, gender,
			primary_email, primary_phone, primary_phone_type,
			preferred_language, preferred_channel,
			identity_verified,
			created_by, updated_by
		) VALUES (
			$1, $2, $3, $4,
			$5, $6, $7, $8,
			$9, $10,
			$11, $12, $13,
			$14, $15,
			$16,
			$17, $18
		)
		RETURNING created_at, updated_at`

	return s.DB.QueryRow(
		query,
		c.ContactID, c.TenantID, c.ContactType, c.LegacyMemberID,
		c.FirstName, c.LastName, c.MiddleName, c.Suffix,
		c.DateOfBirth, c.Gender,
		c.PrimaryEmail, c.PrimaryPhone, c.PrimaryPhoneType,
		c.PreferredLanguage, c.PreferredChannel,
		c.IdentityVerified,
		c.CreatedBy, c.UpdatedBy,
	).Scan(&c.CreatedAt, &c.UpdatedAt)
}

// UpdateContact modifies mutable fields on an existing contact.
func (s *Store) UpdateContact(c *models.Contact) error {
	query := `
		UPDATE crm_contact SET
			first_name = $2,
			last_name = $3,
			middle_name = $4,
			suffix = $5,
			primary_email = $6,
			primary_phone = $7,
			primary_phone_type = $8,
			preferred_language = $9,
			preferred_channel = $10,
			security_flag = $11,
			security_flag_note = $12,
			updated_by = $13,
			updated_at = NOW()
		WHERE contact_id = $1 AND deleted_at IS NULL
		RETURNING updated_at`

	err := s.DB.QueryRow(
		query,
		c.ContactID,
		c.FirstName, c.LastName, c.MiddleName, c.Suffix,
		c.PrimaryEmail, c.PrimaryPhone, c.PrimaryPhoneType,
		c.PreferredLanguage, c.PreferredChannel,
		c.SecurityFlag, c.SecurityFlagNote,
		c.UpdatedBy,
	).Scan(&c.UpdatedAt)
	if err == sql.ErrNoRows {
		return fmt.Errorf("contact %s not found", c.ContactID)
	}
	return err
}

// GetContactByLegacyID retrieves a contact by tenant and legacy member ID.
func (s *Store) GetContactByLegacyID(tenantID, legacyMbrID string) (*models.Contact, error) {
	query := `
		SELECT contact_id
		FROM crm_contact
		WHERE tenant_id = $1 AND legacy_mbr_id = $2 AND deleted_at IS NULL
		LIMIT 1`

	var contactID string
	err := s.DB.QueryRow(query, tenantID, legacyMbrID).Scan(&contactID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("looking up legacy member %s: %w", legacyMbrID, err)
	}

	return s.GetContact(contactID)
}

// getContactAddresses retrieves all addresses for a contact.
func (s *Store) getContactAddresses(contactID string) ([]models.ContactAddress, error) {
	query := `
		SELECT
			address_id, contact_id, address_type, is_primary,
			line1, line2, city, state_code, zip_code, country_code,
			validated, validated_at, standardized_line1,
			effective_from, effective_to
		FROM crm_contact_address
		WHERE contact_id = $1
		ORDER BY is_primary DESC, effective_from DESC`

	rows, err := s.DB.Query(query, contactID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var addresses []models.ContactAddress
	for rows.Next() {
		var a models.ContactAddress
		var line2, standardizedLine1 sql.NullString
		var validatedAt sql.NullTime
		var effectiveTo sql.NullString

		err := rows.Scan(
			&a.AddressID, &a.ContactID, &a.AddressType, &a.IsPrimary,
			&a.Line1, &line2, &a.City, &a.StateCode, &a.ZipCode, &a.CountryCode,
			&a.Validated, &validatedAt, &standardizedLine1,
			&a.EffectiveFrom, &effectiveTo,
		)
		if err != nil {
			return nil, err
		}

		a.Line2 = nullStringToPtr(line2)
		a.ValidatedAt = nullTimeToPtr(validatedAt)
		a.StandardizedLine1 = nullStringToPtr(standardizedLine1)
		a.EffectiveTo = nullStringToPtr(effectiveTo)

		addresses = append(addresses, a)
	}

	return addresses, rows.Err()
}

// getContactPreferences retrieves all preferences for a contact.
func (s *Store) getContactPreferences(contactID string) ([]models.ContactPreference, error) {
	query := `
		SELECT
			preference_id, contact_id,
			preference_type, preference_value,
			consent_source, consent_date
		FROM crm_contact_preference
		WHERE contact_id = $1
		ORDER BY preference_type`

	rows, err := s.DB.Query(query, contactID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prefs []models.ContactPreference
	for rows.Next() {
		var p models.ContactPreference
		var consentSource sql.NullString

		err := rows.Scan(
			&p.PreferenceID, &p.ContactID,
			&p.PreferenceType, &p.PreferenceValue,
			&consentSource, &p.ConsentDate,
		)
		if err != nil {
			return nil, err
		}

		p.ConsentSource = nullStringToPtr(consentSource)
		prefs = append(prefs, p)
	}

	return prefs, rows.Err()
}
