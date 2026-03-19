package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/noui/platform/dbcontext"
)

// Store wraps a database connection and exposes employer-waret data-access methods.
type Store struct {
	DB *sql.DB
}

// NewStore creates a Store from an existing database connection.
func NewStore(database *sql.DB) *Store {
	return &Store{DB: database}
}

// --- Designations ---

// CreateDesignation inserts a new WARET designation.
func (s *Store) CreateDesignation(ctx context.Context, d *WaretDesignation) error {
	query := `
		INSERT INTO waret_designation
			(org_id, retiree_id, ssn_hash, first_name, last_name,
			 designation_type, calendar_year, day_limit, hour_limit,
			 consecutive_years, district_id, orp_exempt,
			 designation_status, peracare_conflict, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING id, created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		d.OrgID, d.RetireeID, d.SSNHash, d.FirstName, d.LastName,
		d.DesignationType, d.CalendarYear, d.DayLimit, d.HourLimit,
		d.ConsecutiveYears, d.DistrictID, d.ORPExempt,
		d.DesignationStatus, d.PERACareConflict, d.Notes,
	).Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt)
}

// GetDesignation retrieves a designation by ID.
func (s *Store) GetDesignation(ctx context.Context, id string) (*WaretDesignation, error) {
	query := `
		SELECT
			id, org_id, retiree_id, ssn_hash, first_name, last_name,
			designation_type, calendar_year, day_limit, hour_limit,
			consecutive_years, district_id, orp_exempt,
			designation_status,
			peracare_conflict, peracare_letter_sent_at, peracare_response_due, peracare_resolved,
			approved_by, approved_at, revoked_by, revoked_at, revocation_reason,
			notes, created_at, updated_at
		FROM waret_designation
		WHERE id = $1`

	d := &WaretDesignation{}
	var retireeID, districtID, approvedBy, revokedBy, revocationReason, notes sql.NullString
	var dayLimit, hourLimit sql.NullInt64
	var approvedAt, revokedAt, pcLetterSent, pcResponseDue sql.NullTime

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, id).Scan(
		&d.ID, &d.OrgID, &retireeID, &d.SSNHash, &d.FirstName, &d.LastName,
		&d.DesignationType, &d.CalendarYear, &dayLimit, &hourLimit,
		&d.ConsecutiveYears, &districtID, &d.ORPExempt,
		&d.DesignationStatus,
		&d.PERACareConflict, &pcLetterSent, &pcResponseDue, &d.PERACareResolved,
		&approvedBy, &approvedAt, &revokedBy, &revokedAt, &revocationReason,
		&notes, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	d.RetireeID = nullStr(retireeID)
	d.DistrictID = nullStr(districtID)
	if dayLimit.Valid {
		v := int(dayLimit.Int64)
		d.DayLimit = &v
	}
	if hourLimit.Valid {
		v := int(hourLimit.Int64)
		d.HourLimit = &v
	}
	d.ApprovedBy = nullStr(approvedBy)
	if approvedAt.Valid {
		d.ApprovedAt = &approvedAt.Time
	}
	d.RevokedBy = nullStr(revokedBy)
	if revokedAt.Valid {
		d.RevokedAt = &revokedAt.Time
	}
	d.RevocationReason = nullStr(revocationReason)
	if pcLetterSent.Valid {
		d.PERACarLetterSentAt = &pcLetterSent.Time
	}
	if pcResponseDue.Valid {
		d.PERACareResponseDue = &pcResponseDue.Time
	}
	d.Notes = nullStr(notes)

	return d, nil
}

// ListDesignations retrieves designations for an org with optional filters.
func (s *Store) ListDesignations(ctx context.Context, orgID string, year int, status string, limit, offset int) ([]WaretDesignation, int, error) {
	countQuery := `SELECT COUNT(*) FROM waret_designation WHERE org_id = $1`
	listQuery := `
		SELECT
			id, org_id, retiree_id, ssn_hash, first_name, last_name,
			designation_type, calendar_year, day_limit, hour_limit,
			consecutive_years, district_id, orp_exempt,
			designation_status, peracare_conflict,
			notes, created_at, updated_at
		FROM waret_designation
		WHERE org_id = $1`

	args := []interface{}{orgID}
	countArgs := []interface{}{orgID}
	paramIdx := 2

	if year > 0 {
		countQuery += fmt.Sprintf(` AND calendar_year = $%d`, paramIdx)
		listQuery += fmt.Sprintf(` AND calendar_year = $%d`, paramIdx)
		args = append(args, year)
		countArgs = append(countArgs, year)
		paramIdx++
	}
	if status != "" {
		countQuery += fmt.Sprintf(` AND designation_status = $%d`, paramIdx)
		listQuery += fmt.Sprintf(` AND designation_status = $%d`, paramIdx)
		args = append(args, status)
		countArgs = append(countArgs, status)
		paramIdx++
	}

	listQuery += fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, paramIdx, paramIdx+1)
	args = append(args, limit, offset)

	var total int
	if err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var designations []WaretDesignation
	for rows.Next() {
		var d WaretDesignation
		var retireeID, districtID, notes sql.NullString
		var dayLimit, hourLimit sql.NullInt64
		if err := rows.Scan(
			&d.ID, &d.OrgID, &retireeID, &d.SSNHash, &d.FirstName, &d.LastName,
			&d.DesignationType, &d.CalendarYear, &dayLimit, &hourLimit,
			&d.ConsecutiveYears, &districtID, &d.ORPExempt,
			&d.DesignationStatus, &d.PERACareConflict,
			&notes, &d.CreatedAt, &d.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		d.RetireeID = nullStr(retireeID)
		d.DistrictID = nullStr(districtID)
		if dayLimit.Valid {
			v := int(dayLimit.Int64)
			d.DayLimit = &v
		}
		if hourLimit.Valid {
			v := int(hourLimit.Int64)
			d.HourLimit = &v
		}
		d.Notes = nullStr(notes)
		designations = append(designations, d)
	}

	return designations, total, rows.Err()
}

// ApproveDesignation marks a designation as approved.
func (s *Store) ApproveDesignation(ctx context.Context, id, approvedBy string) error {
	query := `
		UPDATE waret_designation
		SET designation_status = 'APPROVED', approved_by = $1, approved_at = NOW(), updated_at = NOW()
		WHERE id = $2 AND designation_status = 'PENDING'`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, approvedBy, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// RevokeDesignation marks a designation as revoked.
func (s *Store) RevokeDesignation(ctx context.Context, id, revokedBy, reason string) error {
	query := `
		UPDATE waret_designation
		SET designation_status = 'REVOKED', revoked_by = $1, revoked_at = NOW(),
			revocation_reason = $2, updated_at = NOW()
		WHERE id = $3 AND designation_status NOT IN ('REVOKED', 'EXPIRED')`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, revokedBy, reason, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// Count140DayInDistrict counts active 140-day designations for a district in a year.
func (s *Store) Count140DayInDistrict(ctx context.Context, districtID string, year int) (int, error) {
	query := `
		SELECT COUNT(*) FROM waret_designation
		WHERE district_id = $1 AND calendar_year = $2
		AND designation_type = '140_DAY'
		AND designation_status IN ('PENDING', 'APPROVED', 'ACTIVE')`
	var count int
	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, districtID, year).Scan(&count)
	return count, err
}

// CountConsecutiveYears counts how many consecutive prior years a retiree has a designation at an org.
func (s *Store) CountConsecutiveYears(ctx context.Context, orgID, ssnHash string, beforeYear int) (int, error) {
	query := `
		WITH RECURSIVE years AS (
			SELECT calendar_year
			FROM waret_designation
			WHERE org_id = $1 AND ssn_hash = $2 AND calendar_year = $3
			AND designation_status IN ('APPROVED', 'ACTIVE', 'EXPIRED')
			UNION ALL
			SELECT d.calendar_year
			FROM waret_designation d
			INNER JOIN years y ON d.calendar_year = y.calendar_year - 1
			WHERE d.org_id = $1 AND d.ssn_hash = $2
			AND d.designation_status IN ('APPROVED', 'ACTIVE', 'EXPIRED')
		)
		SELECT COUNT(*) FROM years`
	var count int
	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, orgID, ssnHash, beforeYear-1).Scan(&count)
	return count, err
}

// SetPERACareConflict marks a designation as having a PERACare conflict.
func (s *Store) SetPERACareConflict(ctx context.Context, id string, responseDue time.Time) error {
	query := `
		UPDATE waret_designation
		SET peracare_conflict = true, peracare_letter_sent_at = NOW(),
			peracare_response_due = $1, updated_at = NOW()
		WHERE id = $2`
	_, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, responseDue, id)
	return err
}

// ResolvePERACareConflict marks a PERACare conflict as resolved.
func (s *Store) ResolvePERACareConflict(ctx context.Context, id string) error {
	query := `
		UPDATE waret_designation
		SET peracare_resolved = true, updated_at = NOW()
		WHERE id = $1 AND peracare_conflict = true`
	_, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, id)
	return err
}

// --- Tracking ---

// CreateTracking inserts a new work tracking record.
func (s *Store) CreateTracking(ctx context.Context, t *WaretTracking) error {
	query := `
		INSERT INTO waret_tracking
			(designation_id, org_id, retiree_id, work_date, hours_worked,
			 counts_as_day, ytd_days, ytd_hours, entry_status, submitted_by, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		t.DesignationID, t.OrgID, t.RetireeID, t.WorkDate, t.HoursWorked,
		t.CountsAsDay, t.YTDDays, t.YTDHours, t.EntryStatus, t.SubmittedBy, t.Notes,
	).Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
}

// ListTracking retrieves tracking records for a designation.
func (s *Store) ListTracking(ctx context.Context, designationID string, limit, offset int) ([]WaretTracking, int, error) {
	countQuery := `SELECT COUNT(*) FROM waret_tracking WHERE designation_id = $1 AND entry_status != 'VOIDED'`
	listQuery := `
		SELECT
			id, designation_id, org_id, retiree_id,
			work_date, hours_worked, counts_as_day,
			ytd_days, ytd_hours, entry_status,
			submitted_by, verified_by, verified_at, notes,
			created_at, updated_at
		FROM waret_tracking
		WHERE designation_id = $1 AND entry_status != 'VOIDED'
		ORDER BY work_date DESC
		LIMIT $2 OFFSET $3`

	var total int
	if err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, countQuery, designationID).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, listQuery, designationID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var records []WaretTracking
	for rows.Next() {
		var t WaretTracking
		var retireeID, verifiedBy, notes sql.NullString
		var verifiedAt sql.NullTime
		if err := rows.Scan(
			&t.ID, &t.DesignationID, &t.OrgID, &retireeID,
			&t.WorkDate, &t.HoursWorked, &t.CountsAsDay,
			&t.YTDDays, &t.YTDHours, &t.EntryStatus,
			&t.SubmittedBy, &verifiedBy, &verifiedAt, &notes,
			&t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		t.RetireeID = nullStr(retireeID)
		t.VerifiedBy = nullStr(verifiedBy)
		if verifiedAt.Valid {
			t.VerifiedAt = &verifiedAt.Time
		}
		t.Notes = nullStr(notes)
		records = append(records, t)
	}

	return records, total, rows.Err()
}

// GetYTDSummary retrieves the year-to-date summary for a designation.
func (s *Store) GetYTDSummary(ctx context.Context, designationID string) (*WaretYTDSummary, error) {
	query := `SELECT * FROM waret_ytd_summary WHERE designation_id = $1`

	sum := &WaretYTDSummary{}
	var retireeID sql.NullString
	var dayLimit, hourLimit sql.NullInt64
	var daysRemaining sql.NullInt64
	var hoursRemaining sql.NullString

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, designationID).Scan(
		&sum.DesignationID, &sum.OrgID, &retireeID, &sum.SSNHash,
		&sum.CalendarYear, &sum.DesignationType, &dayLimit, &hourLimit,
		&sum.ORPExempt, &sum.TotalDays, &sum.TotalHours,
		&daysRemaining, &hoursRemaining, &sum.OverLimit,
	)
	if err != nil {
		return nil, err
	}

	sum.RetireeID = nullStr(retireeID)
	if dayLimit.Valid {
		v := int(dayLimit.Int64)
		sum.DayLimit = &v
	}
	if hourLimit.Valid {
		v := int(hourLimit.Int64)
		sum.HourLimit = &v
	}
	if daysRemaining.Valid {
		v := int(daysRemaining.Int64)
		sum.DaysRemaining = &v
	}
	sum.HoursRemaining = nullStr(hoursRemaining)

	return sum, nil
}

// --- Penalties ---

// CreatePenalty inserts a new penalty record.
func (s *Store) CreatePenalty(ctx context.Context, p *WaretPenalty) error {
	query := `
		INSERT INTO waret_penalty
			(designation_id, retiree_id, ssn_hash,
			 penalty_type, penalty_month, monthly_benefit,
			 days_over_limit, penalty_rate, penalty_amount,
			 employer_recovery, retiree_recovery,
			 spread_months, monthly_deduction,
			 penalty_status, assessed_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING id, assessed_at, created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		p.DesignationID, p.RetireeID, p.SSNHash,
		p.PenaltyType, p.PenaltyMonth, p.MonthlyBenefit,
		p.DaysOverLimit, p.PenaltyRate, p.PenaltyAmount,
		p.EmployerRecovery, p.RetireeRecovery,
		p.SpreadMonths, p.MonthlyDeduction,
		p.PenaltyStatus, p.AssessedBy,
	).Scan(&p.ID, &p.AssessedAt, &p.CreatedAt, &p.UpdatedAt)
}

// ListPenalties retrieves penalties for a designation.
func (s *Store) ListPenalties(ctx context.Context, designationID string, limit, offset int) ([]WaretPenalty, int, error) {
	countQuery := `SELECT COUNT(*) FROM waret_penalty WHERE designation_id = $1`
	listQuery := `
		SELECT
			id, designation_id, retiree_id, ssn_hash,
			penalty_type, penalty_month, monthly_benefit,
			days_over_limit, penalty_rate, penalty_amount,
			employer_recovery, retiree_recovery,
			spread_months, monthly_deduction,
			penalty_status, assessed_by, assessed_at,
			created_at, updated_at
		FROM waret_penalty
		WHERE designation_id = $1
		ORDER BY penalty_month DESC
		LIMIT $2 OFFSET $3`

	var total int
	if err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, countQuery, designationID).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, listQuery, designationID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var penalties []WaretPenalty
	for rows.Next() {
		var p WaretPenalty
		var retireeID, assessedBy sql.NullString
		if err := rows.Scan(
			&p.ID, &p.DesignationID, &retireeID, &p.SSNHash,
			&p.PenaltyType, &p.PenaltyMonth, &p.MonthlyBenefit,
			&p.DaysOverLimit, &p.PenaltyRate, &p.PenaltyAmount,
			&p.EmployerRecovery, &p.RetireeRecovery,
			&p.SpreadMonths, &p.MonthlyDeduction,
			&p.PenaltyStatus, &assessedBy, &p.AssessedAt,
			&p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		p.RetireeID = nullStr(retireeID)
		p.AssessedBy = nullStr(assessedBy)
		penalties = append(penalties, p)
	}

	return penalties, total, rows.Err()
}

// AppealPenalty marks a penalty as appealed.
func (s *Store) AppealPenalty(ctx context.Context, id, note string) error {
	query := `
		UPDATE waret_penalty
		SET penalty_status = 'APPEALED', appealed_at = NOW(), appeal_note = $1, updated_at = NOW()
		WHERE id = $2 AND penalty_status = 'ASSESSED'`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, note, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// WaivePenalty marks a penalty as waived.
func (s *Store) WaivePenalty(ctx context.Context, id, waivedBy, reason string) error {
	query := `
		UPDATE waret_penalty
		SET penalty_status = 'WAIVED', waived_by = $1, waived_at = NOW(),
			waiver_reason = $2, updated_at = NOW()
		WHERE id = $3 AND penalty_status IN ('ASSESSED', 'APPEALED')`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, waivedBy, reason, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// --- IC Disclosures ---

// CreateICDisclosure inserts a new IC disclosure.
func (s *Store) CreateICDisclosure(ctx context.Context, d *WaretICDisclosure) error {
	query := `
		INSERT INTO waret_ic_disclosure
			(retiree_id, ssn_hash, org_id, calendar_year,
			 ic_start_date, ic_end_date, ic_description,
			 estimated_hours, estimated_compensation,
			 disclosure_status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, submitted_at, created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		d.RetireeID, d.SSNHash, d.OrgID, d.CalendarYear,
		d.ICStartDate, d.ICEndDate, d.ICDescription,
		d.EstimatedHours, d.EstimatedCompensation,
		d.DisclosureStatus,
	).Scan(&d.ID, &d.SubmittedAt, &d.CreatedAt, &d.UpdatedAt)
}

// ListICDisclosures retrieves IC disclosures for a retiree.
func (s *Store) ListICDisclosures(ctx context.Context, ssnHash string, year int, limit, offset int) ([]WaretICDisclosure, int, error) {
	countQuery := `SELECT COUNT(*) FROM waret_ic_disclosure WHERE ssn_hash = $1`
	listQuery := `
		SELECT
			id, retiree_id, ssn_hash, org_id, calendar_year,
			ic_start_date, ic_end_date, ic_description,
			estimated_hours, estimated_compensation,
			disclosure_status, submitted_at,
			reviewed_by, reviewed_at, review_note,
			created_at, updated_at
		FROM waret_ic_disclosure
		WHERE ssn_hash = $1`

	args := []interface{}{ssnHash}
	countArgs := []interface{}{ssnHash}
	paramIdx := 2

	if year > 0 {
		countQuery += fmt.Sprintf(` AND calendar_year = $%d`, paramIdx)
		listQuery += fmt.Sprintf(` AND calendar_year = $%d`, paramIdx)
		args = append(args, year)
		countArgs = append(countArgs, year)
		paramIdx++
	}

	listQuery += fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, paramIdx, paramIdx+1)
	args = append(args, limit, offset)

	var total int
	if err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var disclosures []WaretICDisclosure
	for rows.Next() {
		var d WaretICDisclosure
		var retireeID, icEndDate, estHours, estComp sql.NullString
		var reviewedBy, reviewNote sql.NullString
		var reviewedAt sql.NullTime
		if err := rows.Scan(
			&d.ID, &retireeID, &d.SSNHash, &d.OrgID, &d.CalendarYear,
			&d.ICStartDate, &icEndDate, &d.ICDescription,
			&estHours, &estComp,
			&d.DisclosureStatus, &d.SubmittedAt,
			&reviewedBy, &reviewedAt, &reviewNote,
			&d.CreatedAt, &d.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		d.RetireeID = nullStr(retireeID)
		d.ICEndDate = nullStr(icEndDate)
		d.EstimatedHours = nullStr(estHours)
		d.EstimatedCompensation = nullStr(estComp)
		d.ReviewedBy = nullStr(reviewedBy)
		if reviewedAt.Valid {
			d.ReviewedAt = &reviewedAt.Time
		}
		d.ReviewNote = nullStr(reviewNote)
		disclosures = append(disclosures, d)
	}

	return disclosures, total, rows.Err()
}

// nullStr converts sql.NullString to *string.
func nullStr(ns sql.NullString) *string {
	if ns.Valid {
		return &ns.String
	}
	return nil
}
