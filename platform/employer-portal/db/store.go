package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/noui/platform/dbcontext"
)

// Store wraps a database connection and exposes employer-portal data-access methods.
type Store struct {
	DB *sql.DB
}

// NewStore creates a Store from an existing database connection.
func NewStore(database *sql.DB) *Store {
	return &Store{DB: database}
}

// --- Portal Users ---

// ListPortalUsers retrieves portal users for an organization with pagination.
// Returns matching users, total count, and any error.
func (s *Store) ListPortalUsers(ctx context.Context, orgID string, limit, offset int) ([]PortalUser, int, error) {
	query := `
		SELECT
			id, org_id, contact_id, portal_role, is_active,
			last_login_at, onboarding_completed_at,
			created_at, updated_at,
			COUNT(*) OVER() AS total_count
		FROM employer_portal_user
		WHERE org_id = $1`

	args := []interface{}{orgID}
	argIdx := 2

	query += " ORDER BY created_at DESC"

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
		return nil, 0, fmt.Errorf("listing portal users: %w", err)
	}
	defer rows.Close()

	var users []PortalUser
	var totalCount int

	for rows.Next() {
		var u PortalUser
		var lastLogin, onboarding sql.NullTime
		var tc int

		err := rows.Scan(
			&u.ID, &u.OrgID, &u.ContactID, &u.PortalRole, &u.IsActive,
			&lastLogin, &onboarding,
			&u.CreatedAt, &u.UpdatedAt,
			&tc,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning portal user row: %w", err)
		}
		u.LastLoginAt = nullTimeToPtr(lastLogin)
		u.OnboardingCompletedAt = nullTimeToPtr(onboarding)
		totalCount = tc
		users = append(users, u)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating portal user rows: %w", err)
	}

	return users, totalCount, nil
}

// CreatePortalUser inserts a new portal user record.
func (s *Store) CreatePortalUser(ctx context.Context, user *PortalUser) error {
	query := `
		INSERT INTO employer_portal_user (
			id, org_id, contact_id, portal_role, is_active
		) VALUES ($1, $2, $3, $4, $5)
		RETURNING created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx,
		query,
		user.ID, user.OrgID, user.ContactID, user.PortalRole, user.IsActive,
	).Scan(&user.CreatedAt, &user.UpdatedAt)
}

// UpdatePortalUserRole updates the role of a portal user.
func (s *Store) UpdatePortalUserRole(ctx context.Context, id, role string) error {
	query := `
		UPDATE employer_portal_user
		SET portal_role = $1, updated_at = $2
		WHERE id = $3`

	result, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, role, time.Now().UTC(), id)
	if err != nil {
		return fmt.Errorf("updating portal user role: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeactivatePortalUser sets is_active = false for a portal user.
func (s *Store) DeactivatePortalUser(ctx context.Context, id string) error {
	query := `
		UPDATE employer_portal_user
		SET is_active = false, updated_at = $1
		WHERE id = $2`

	result, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, time.Now().UTC(), id)
	if err != nil {
		return fmt.Errorf("deactivating portal user: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// --- Alerts ---

// ListAlerts retrieves active alerts for an organization (including system-wide alerts).
func (s *Store) ListAlerts(ctx context.Context, orgID string) ([]Alert, error) {
	query := `
		SELECT
			id, org_id, alert_type, title, body,
			effective_from, effective_to, created_by, created_at
		FROM employer_alert
		WHERE (org_id = $1 OR org_id IS NULL)
		  AND effective_from <= NOW()
		  AND (effective_to IS NULL OR effective_to >= NOW())
		ORDER BY effective_from DESC`

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, orgID)
	if err != nil {
		return nil, fmt.Errorf("listing alerts: %w", err)
	}
	defer rows.Close()

	var alerts []Alert
	for rows.Next() {
		var a Alert
		var orgIDNull sql.NullString
		var body, createdBy sql.NullString
		var effectiveTo sql.NullTime

		err := rows.Scan(
			&a.ID, &orgIDNull, &a.AlertType, &a.Title, &body,
			&a.EffectiveFrom, &effectiveTo, &createdBy, &a.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning alert row: %w", err)
		}
		a.OrgID = nullStringToPtr(orgIDNull)
		a.Body = nullStringToPtr(body)
		a.CreatedBy = nullStringToPtr(createdBy)
		a.EffectiveTo = nullTimeToPtr(effectiveTo)
		alerts = append(alerts, a)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating alert rows: %w", err)
	}

	return alerts, nil
}

// CreateAlert inserts a new alert record.
func (s *Store) CreateAlert(ctx context.Context, alert *Alert) error {
	query := `
		INSERT INTO employer_alert (
			id, org_id, alert_type, title, body,
			effective_from, effective_to, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING created_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx,
		query,
		alert.ID, alert.OrgID, alert.AlertType, alert.Title, alert.Body,
		alert.EffectiveFrom, alert.EffectiveTo, alert.CreatedBy,
	).Scan(&alert.CreatedAt)
}

// --- Rate Tables ---

// ListRateTables retrieves contribution rate rows with optional division and safety officer filters.
func (s *Store) ListRateTables(ctx context.Context, divisionCode string, safetyOfficer *bool) ([]RateTableRow, error) {
	query := `
		SELECT
			id, division_code, is_safety_officer,
			member_rate::text, employer_base_rate::text,
			aed_rate::text, saed_rate::text, aap_rate::text,
			dc_supplement_rate::text, employer_total_rate::text,
			health_care_trust_rate::text,
			effective_from::text, effective_to::text,
			board_resolution_ref, created_at
		FROM contribution_rate_table
		WHERE 1=1`

	args := []interface{}{}
	argIdx := 1

	if divisionCode != "" {
		query += fmt.Sprintf(" AND division_code = $%d", argIdx)
		args = append(args, divisionCode)
		argIdx++
	}
	if safetyOfficer != nil {
		query += fmt.Sprintf(" AND is_safety_officer = $%d", argIdx)
		args = append(args, *safetyOfficer)
		argIdx++
	}

	query += " ORDER BY division_code, is_safety_officer, effective_from DESC"

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing rate tables: %w", err)
	}
	defer rows.Close()

	var rates []RateTableRow
	for rows.Next() {
		var r RateTableRow
		var effectiveTo, boardRef sql.NullString

		err := rows.Scan(
			&r.ID, &r.DivisionCode, &r.IsSafetyOfficer,
			&r.MemberRate, &r.EmployerBaseRate,
			&r.AEDRate, &r.SAEDRate, &r.AAPRate,
			&r.DCSupplementRate, &r.EmployerTotalRate,
			&r.HealthCareTrustRate,
			&r.EffectiveFrom, &effectiveTo,
			&boardRef, &r.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning rate table row: %w", err)
		}
		r.EffectiveTo = nullStringToPtr(effectiveTo)
		r.BoardResolutionRef = nullStringToPtr(boardRef)
		rates = append(rates, r)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating rate table rows: %w", err)
	}

	return rates, nil
}

// GetCurrentRate retrieves the currently effective rate for a division and safety officer flag.
func (s *Store) GetCurrentRate(ctx context.Context, divisionCode string, isSafetyOfficer bool) (*RateTableRow, error) {
	query := `
		SELECT
			id, division_code, is_safety_officer,
			member_rate::text, employer_base_rate::text,
			aed_rate::text, saed_rate::text, aap_rate::text,
			dc_supplement_rate::text, employer_total_rate::text,
			health_care_trust_rate::text,
			effective_from::text, effective_to::text,
			board_resolution_ref, created_at
		FROM contribution_rate_table
		WHERE division_code = $1
		  AND is_safety_officer = $2
		  AND effective_from <= CURRENT_DATE
		  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
		ORDER BY effective_from DESC
		LIMIT 1`

	var r RateTableRow
	var effectiveTo, boardRef sql.NullString

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, divisionCode, isSafetyOfficer).Scan(
		&r.ID, &r.DivisionCode, &r.IsSafetyOfficer,
		&r.MemberRate, &r.EmployerBaseRate,
		&r.AEDRate, &r.SAEDRate, &r.AAPRate,
		&r.DCSupplementRate, &r.EmployerTotalRate,
		&r.HealthCareTrustRate,
		&r.EffectiveFrom, &effectiveTo,
		&boardRef, &r.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	r.EffectiveTo = nullStringToPtr(effectiveTo)
	r.BoardResolutionRef = nullStringToPtr(boardRef)
	return &r, nil
}

// --- Divisions ---

// ListDivisions retrieves all employer divisions.
func (s *Store) ListDivisions(ctx context.Context) ([]Division, error) {
	query := `
		SELECT
			division_code, division_name, governing_statute,
			effective_date::text, created_at
		FROM employer_division
		ORDER BY division_code`

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("listing divisions: %w", err)
	}
	defer rows.Close()

	var divisions []Division
	for rows.Next() {
		var d Division
		var statute sql.NullString

		err := rows.Scan(
			&d.DivisionCode, &d.DivisionName, &statute,
			&d.EffectiveDate, &d.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning division row: %w", err)
		}
		d.GoverningStatute = nullStringToPtr(statute)
		divisions = append(divisions, d)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating division rows: %w", err)
	}

	return divisions, nil
}

// --- Dashboard ---

// GetDashboardSummary returns dashboard summary counts for an organization.
// Initial implementation returns zeros — will be wired to real data in Phase 2.
func (s *Store) GetDashboardSummary(ctx context.Context, orgID string) (*DashboardSummary, error) {
	// Phase 1: return zero counts. Phase 2 will wire these to real queries.
	summary := &DashboardSummary{
		PendingExceptions: 0,
		UnresolvedTasks:   0,
		RecentSubmissions: 0,
		ActiveAlerts:      0,
	}

	// Count active alerts for this org (including system-wide)
	alertQuery := `
		SELECT COUNT(*)
		FROM employer_alert
		WHERE (org_id = $1 OR org_id IS NULL)
		  AND effective_from <= NOW()
		  AND (effective_to IS NULL OR effective_to >= NOW())`

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, alertQuery, orgID).Scan(&summary.ActiveAlerts)
	if err != nil {
		return nil, fmt.Errorf("counting active alerts: %w", err)
	}

	return summary, nil
}
