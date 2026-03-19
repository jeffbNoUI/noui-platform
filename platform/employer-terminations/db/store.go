package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/noui/platform/dbcontext"
)

// Store wraps a database connection and exposes employer-terminations data-access methods.
type Store struct {
	DB *sql.DB
}

// NewStore creates a Store from an existing database connection.
func NewStore(database *sql.DB) *Store {
	return &Store{DB: database}
}

// --- Termination Certifications ---

// CreateCertification inserts a new termination certification.
func (s *Store) CreateCertification(ctx context.Context, cert *TerminationCertification) error {
	query := `
		INSERT INTO termination_certification
			(org_id, member_id, ssn_hash, first_name, last_name,
			 last_day_worked, termination_reason, final_contribution_date,
			 final_salary_amount, certification_status, submitted_by, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		cert.OrgID, cert.MemberID, cert.SSNHash, cert.FirstName, cert.LastName,
		cert.LastDayWorked, cert.TerminationReason, cert.FinalContributionDate,
		cert.FinalSalaryAmount, cert.CertificationStatus, cert.SubmittedBy, cert.Notes,
	).Scan(&cert.ID, &cert.CreatedAt, &cert.UpdatedAt)
}

// GetCertification retrieves a termination certification by ID.
func (s *Store) GetCertification(ctx context.Context, id string) (*TerminationCertification, error) {
	query := `
		SELECT
			id, org_id, member_id, ssn_hash, first_name, last_name,
			last_day_worked, termination_reason, final_contribution_date,
			final_salary_amount, certification_status, submitted_by,
			verified_by, verified_at, rejected_by, rejected_at, rejection_reason,
			notes, created_at, updated_at
		FROM termination_certification
		WHERE id = $1`

	cert := &TerminationCertification{}
	var memberID, finalContribDate, finalSalary sql.NullString
	var verifiedBy, rejectedBy, rejectionReason, notes sql.NullString
	var verifiedAt, rejectedAt sql.NullTime

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, id).Scan(
		&cert.ID, &cert.OrgID, &memberID, &cert.SSNHash, &cert.FirstName, &cert.LastName,
		&cert.LastDayWorked, &cert.TerminationReason, &finalContribDate,
		&finalSalary, &cert.CertificationStatus, &cert.SubmittedBy,
		&verifiedBy, &verifiedAt, &rejectedBy, &rejectedAt, &rejectionReason,
		&notes, &cert.CreatedAt, &cert.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	cert.MemberID = nullStr(memberID)
	cert.FinalContributionDate = nullStr(finalContribDate)
	cert.FinalSalaryAmount = nullStr(finalSalary)
	cert.VerifiedBy = nullStr(verifiedBy)
	if verifiedAt.Valid {
		cert.VerifiedAt = &verifiedAt.Time
	}
	cert.RejectedBy = nullStr(rejectedBy)
	if rejectedAt.Valid {
		cert.RejectedAt = &rejectedAt.Time
	}
	cert.RejectionReason = nullStr(rejectionReason)
	cert.Notes = nullStr(notes)

	return cert, nil
}

// ListCertifications retrieves certifications for an org with pagination.
func (s *Store) ListCertifications(ctx context.Context, orgID, status string, limit, offset int) ([]TerminationCertification, int, error) {
	countQuery := `SELECT COUNT(*) FROM termination_certification WHERE org_id = $1`
	listQuery := `
		SELECT
			id, org_id, member_id, ssn_hash, first_name, last_name,
			last_day_worked, termination_reason, final_contribution_date,
			final_salary_amount, certification_status, submitted_by,
			notes, created_at, updated_at
		FROM termination_certification
		WHERE org_id = $1`

	args := []interface{}{orgID}
	countArgs := []interface{}{orgID}

	if status != "" {
		countQuery += ` AND certification_status = $2`
		listQuery += ` AND certification_status = $2`
		args = append(args, status)
		countArgs = append(countArgs, status)
	}

	listQuery += ` ORDER BY created_at DESC LIMIT $` + fmt.Sprintf("%d", len(args)+1) + ` OFFSET $` + fmt.Sprintf("%d", len(args)+2)
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

	var certs []TerminationCertification
	for rows.Next() {
		var cert TerminationCertification
		var memberID, finalContribDate, finalSalary, notes sql.NullString
		if err := rows.Scan(
			&cert.ID, &cert.OrgID, &memberID, &cert.SSNHash, &cert.FirstName, &cert.LastName,
			&cert.LastDayWorked, &cert.TerminationReason, &finalContribDate,
			&finalSalary, &cert.CertificationStatus, &cert.SubmittedBy,
			&notes, &cert.CreatedAt, &cert.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		cert.MemberID = nullStr(memberID)
		cert.FinalContributionDate = nullStr(finalContribDate)
		cert.FinalSalaryAmount = nullStr(finalSalary)
		cert.Notes = nullStr(notes)
		certs = append(certs, cert)
	}

	return certs, total, rows.Err()
}

// VerifyCertification marks a certification as verified.
func (s *Store) VerifyCertification(ctx context.Context, id, verifiedBy string) error {
	query := `
		UPDATE termination_certification
		SET certification_status = 'VERIFIED', verified_by = $1, verified_at = NOW(), updated_at = NOW()
		WHERE id = $2 AND certification_status IN ('SUBMITTED', 'UNDER_REVIEW')`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, verifiedBy, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// RejectCertification marks a certification as rejected.
func (s *Store) RejectCertification(ctx context.Context, id, rejectedBy, reason string) error {
	query := `
		UPDATE termination_certification
		SET certification_status = 'REJECTED', rejected_by = $1, rejected_at = NOW(),
			rejection_reason = $2, updated_at = NOW()
		WHERE id = $3 AND certification_status NOT IN ('VERIFIED', 'REJECTED', 'CANCELLED')`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, rejectedBy, reason, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// FindCertificationBySSN looks up a certification by SSN hash and org.
func (s *Store) FindCertificationBySSN(ctx context.Context, orgID, ssnHash string) (*TerminationCertification, error) {
	query := `
		SELECT
			id, org_id, member_id, ssn_hash, first_name, last_name,
			last_day_worked, termination_reason, certification_status, submitted_by,
			created_at, updated_at
		FROM termination_certification
		WHERE org_id = $1 AND ssn_hash = $2 AND certification_status = 'VERIFIED'
		ORDER BY created_at DESC LIMIT 1`

	cert := &TerminationCertification{}
	var memberID sql.NullString
	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, orgID, ssnHash).Scan(
		&cert.ID, &cert.OrgID, &memberID, &cert.SSNHash, &cert.FirstName, &cert.LastName,
		&cert.LastDayWorked, &cert.TerminationReason, &cert.CertificationStatus, &cert.SubmittedBy,
		&cert.CreatedAt, &cert.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	cert.MemberID = nullStr(memberID)
	return cert, nil
}

// --- Certification Holds ---

// CreateHold inserts a new certification hold.
func (s *Store) CreateHold(ctx context.Context, hold *CertificationHold) error {
	query := `
		INSERT INTO certification_hold
			(refund_application_id, org_id, member_id, ssn_hash,
			 hold_status, hold_reason, countdown_days, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		hold.RefundApplicationID, hold.OrgID, hold.MemberID, hold.SSNHash,
		hold.HoldStatus, hold.HoldReason, hold.CountdownDays, hold.ExpiresAt,
	).Scan(&hold.ID, &hold.CreatedAt, &hold.UpdatedAt)
}

// GetHold retrieves a certification hold by ID.
func (s *Store) GetHold(ctx context.Context, id string) (*CertificationHold, error) {
	query := `
		SELECT
			id, refund_application_id, org_id, member_id, ssn_hash,
			hold_status, hold_reason, countdown_days, expires_at,
			reminder_sent_at, escalated_at,
			resolved_by, resolved_at, resolution_note, certification_id,
			created_at, updated_at
		FROM certification_hold
		WHERE id = $1`

	h := &CertificationHold{}
	var memberID, resolvedBy, resolutionNote, certID sql.NullString
	var reminderSent, escalatedAt, resolvedAt sql.NullTime

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, id).Scan(
		&h.ID, &h.RefundApplicationID, &h.OrgID, &memberID, &h.SSNHash,
		&h.HoldStatus, &h.HoldReason, &h.CountdownDays, &h.ExpiresAt,
		&reminderSent, &escalatedAt,
		&resolvedBy, &resolvedAt, &resolutionNote, &certID,
		&h.CreatedAt, &h.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	h.MemberID = nullStr(memberID)
	if reminderSent.Valid {
		h.ReminderSentAt = &reminderSent.Time
	}
	if escalatedAt.Valid {
		h.EscalatedAt = &escalatedAt.Time
	}
	h.ResolvedBy = nullStr(resolvedBy)
	if resolvedAt.Valid {
		h.ResolvedAt = &resolvedAt.Time
	}
	h.ResolutionNote = nullStr(resolutionNote)
	h.CertificationID = nullStr(certID)

	return h, nil
}

// ListHolds retrieves certification holds for an org with pagination.
func (s *Store) ListHolds(ctx context.Context, orgID, status string, limit, offset int) ([]CertificationHold, int, error) {
	countQuery := `SELECT COUNT(*) FROM certification_hold WHERE org_id = $1`
	listQuery := `
		SELECT
			id, refund_application_id, org_id, member_id, ssn_hash,
			hold_status, hold_reason, countdown_days, expires_at,
			reminder_sent_at, escalated_at, certification_id,
			created_at, updated_at
		FROM certification_hold
		WHERE org_id = $1`

	args := []interface{}{orgID}
	countArgs := []interface{}{orgID}

	if status != "" {
		countQuery += ` AND hold_status = $2`
		listQuery += ` AND hold_status = $2`
		args = append(args, status)
		countArgs = append(countArgs, status)
	}

	listQuery += ` ORDER BY expires_at ASC LIMIT $` + fmt.Sprintf("%d", len(args)+1) + ` OFFSET $` + fmt.Sprintf("%d", len(args)+2)
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

	var holds []CertificationHold
	for rows.Next() {
		var h CertificationHold
		var memberID, certID sql.NullString
		var reminderSent, escalatedAt sql.NullTime
		if err := rows.Scan(
			&h.ID, &h.RefundApplicationID, &h.OrgID, &memberID, &h.SSNHash,
			&h.HoldStatus, &h.HoldReason, &h.CountdownDays, &h.ExpiresAt,
			&reminderSent, &escalatedAt, &certID,
			&h.CreatedAt, &h.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		h.MemberID = nullStr(memberID)
		if reminderSent.Valid {
			h.ReminderSentAt = &reminderSent.Time
		}
		if escalatedAt.Valid {
			h.EscalatedAt = &escalatedAt.Time
		}
		h.CertificationID = nullStr(certID)
		holds = append(holds, h)
	}

	return holds, total, rows.Err()
}

// ResolveHold marks a hold as resolved with the linked certification.
func (s *Store) ResolveHold(ctx context.Context, id, resolvedBy, note, certificationID string) error {
	query := `
		UPDATE certification_hold
		SET hold_status = 'RESOLVED', resolved_by = $1, resolved_at = NOW(),
			resolution_note = $2, certification_id = $3, updated_at = NOW()
		WHERE id = $4 AND hold_status IN ('PENDING', 'REMINDER_SENT', 'ESCALATED')`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, resolvedBy, note, certificationID, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// EscalateHold marks a hold as escalated.
func (s *Store) EscalateHold(ctx context.Context, id string) error {
	query := `
		UPDATE certification_hold
		SET hold_status = 'ESCALATED', escalated_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND hold_status IN ('PENDING', 'REMINDER_SENT')`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// --- Refund Applications ---

// CreateRefundApplication inserts a new refund application.
func (s *Store) CreateRefundApplication(ctx context.Context, app *RefundApplication) error {
	query := `
		INSERT INTO refund_application
			(member_id, ssn_hash, first_name, last_name,
			 hire_date, termination_date, separation_date, years_of_service,
			 is_vested, has_disability_app, disability_app_date,
			 employee_contributions, application_status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		app.MemberID, app.SSNHash, app.FirstName, app.LastName,
		app.HireDate, app.TerminationDate, app.SeparationDate, app.YearsOfService,
		app.IsVested, app.HasDisabilityApp, app.DisabilityAppDate,
		app.EmployeeContributions, app.ApplicationStatus,
	).Scan(&app.ID, &app.CreatedAt, &app.UpdatedAt)
}

// GetRefundApplication retrieves a refund application by ID.
func (s *Store) GetRefundApplication(ctx context.Context, id string) (*RefundApplication, error) {
	query := `
		SELECT
			id, member_id, ssn_hash, first_name, last_name,
			hire_date, termination_date, separation_date, years_of_service,
			is_vested, has_disability_app, disability_app_date,
			employee_contributions, interest_rate, interest_amount,
			gross_refund, federal_tax_withholding, dro_deduction, net_refund,
			payment_method, rollover_amount, direct_amount,
			ach_routing_number, ach_account_number,
			rollover_institution, rollover_account,
			application_status,
			forfeiture_acknowledged, forfeiture_acknowledged_at,
			member_signature, notarized, w9_received,
			submitted_at, eligibility_checked_at, calculated_at,
			payment_scheduled_at, payment_locked_at, disbursed_at,
			denied_at, denial_reason, processed_by,
			created_at, updated_at
		FROM refund_application
		WHERE id = $1`

	app := &RefundApplication{}
	var memberID, termDate, sepDate, yos sql.NullString
	var disabilityDate, interestRate sql.NullString
	var paymentMethod, rolloverAmt, directAmt sql.NullString
	var achRouting, achAccount, rolloverInst, rolloverAcct sql.NullString
	var denialReason, processedBy sql.NullString
	var forfeitureAckAt sql.NullTime
	var submittedAt, eligAt, calcAt, paySchedAt, payLockAt, disbAt, deniedAt sql.NullTime

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, id).Scan(
		&app.ID, &memberID, &app.SSNHash, &app.FirstName, &app.LastName,
		&app.HireDate, &termDate, &sepDate, &yos,
		&app.IsVested, &app.HasDisabilityApp, &disabilityDate,
		&app.EmployeeContributions, &interestRate, &app.InterestAmount,
		&app.GrossRefund, &app.FederalTaxWithholding, &app.DRODeduction, &app.NetRefund,
		&paymentMethod, &rolloverAmt, &directAmt,
		&achRouting, &achAccount,
		&rolloverInst, &rolloverAcct,
		&app.ApplicationStatus,
		&app.ForfeitureAcknowledged, &forfeitureAckAt,
		&app.MemberSignature, &app.Notarized, &app.W9Received,
		&submittedAt, &eligAt, &calcAt,
		&paySchedAt, &payLockAt, &disbAt,
		&deniedAt, &denialReason, &processedBy,
		&app.CreatedAt, &app.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	app.MemberID = nullStr(memberID)
	app.TerminationDate = nullStr(termDate)
	app.SeparationDate = nullStr(sepDate)
	app.YearsOfService = nullStr(yos)
	app.DisabilityAppDate = nullStr(disabilityDate)
	app.InterestRate = nullStr(interestRate)
	app.PaymentMethod = nullStr(paymentMethod)
	app.RolloverAmount = nullStr(rolloverAmt)
	app.DirectAmount = nullStr(directAmt)
	app.ACHRoutingNumber = nullStr(achRouting)
	app.ACHAccountNumber = nullStr(achAccount)
	app.RolloverInstitution = nullStr(rolloverInst)
	app.RolloverAccount = nullStr(rolloverAcct)
	if forfeitureAckAt.Valid {
		app.ForfeitureAcknowledgedAt = &forfeitureAckAt.Time
	}
	app.DenialReason = nullStr(denialReason)
	app.ProcessedBy = nullStr(processedBy)
	if submittedAt.Valid {
		app.SubmittedAt = &submittedAt.Time
	}
	if eligAt.Valid {
		app.EligibilityCheckedAt = &eligAt.Time
	}
	if calcAt.Valid {
		app.CalculatedAt = &calcAt.Time
	}
	if paySchedAt.Valid {
		app.PaymentScheduledAt = &paySchedAt.Time
	}
	if payLockAt.Valid {
		app.PaymentLockedAt = &payLockAt.Time
	}
	if disbAt.Valid {
		app.DisbursedAt = &disbAt.Time
	}
	if deniedAt.Valid {
		app.DeniedAt = &deniedAt.Time
	}

	return app, nil
}

// ListRefundApplications retrieves refund applications with optional status filter.
func (s *Store) ListRefundApplications(ctx context.Context, ssnHash, status string, limit, offset int) ([]RefundApplication, int, error) {
	countQuery := `SELECT COUNT(*) FROM refund_application WHERE ssn_hash = $1`
	listQuery := `
		SELECT
			id, member_id, ssn_hash, first_name, last_name,
			hire_date, termination_date, separation_date,
			employee_contributions, interest_amount, gross_refund,
			federal_tax_withholding, dro_deduction, net_refund,
			application_status, is_vested,
			created_at, updated_at
		FROM refund_application
		WHERE ssn_hash = $1`

	args := []interface{}{ssnHash}
	countArgs := []interface{}{ssnHash}

	if status != "" {
		countQuery += ` AND application_status = $2`
		listQuery += ` AND application_status = $2`
		args = append(args, status)
		countArgs = append(countArgs, status)
	}

	listQuery += ` ORDER BY created_at DESC LIMIT $` + fmt.Sprintf("%d", len(args)+1) + ` OFFSET $` + fmt.Sprintf("%d", len(args)+2)
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

	var apps []RefundApplication
	for rows.Next() {
		var app RefundApplication
		var memberID, termDate, sepDate sql.NullString
		if err := rows.Scan(
			&app.ID, &memberID, &app.SSNHash, &app.FirstName, &app.LastName,
			&app.HireDate, &termDate, &sepDate,
			&app.EmployeeContributions, &app.InterestAmount, &app.GrossRefund,
			&app.FederalTaxWithholding, &app.DRODeduction, &app.NetRefund,
			&app.ApplicationStatus, &app.IsVested,
			&app.CreatedAt, &app.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		app.MemberID = nullStr(memberID)
		app.TerminationDate = nullStr(termDate)
		app.SeparationDate = nullStr(sepDate)
		apps = append(apps, app)
	}

	return apps, total, rows.Err()
}

// UpdateRefundCalculation writes the calculated refund amounts.
func (s *Store) UpdateRefundCalculation(ctx context.Context, id string, interestRate, interestAmt, gross, tax, dro, net string) error {
	query := `
		UPDATE refund_application
		SET interest_rate = $1, interest_amount = $2, gross_refund = $3,
			federal_tax_withholding = $4, dro_deduction = $5, net_refund = $6,
			application_status = 'CALCULATION_COMPLETE', calculated_at = NOW(), updated_at = NOW()
		WHERE id = $7`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, interestRate, interestAmt, gross, tax, dro, net, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// UpdateRefundStatus updates the status of a refund application.
func (s *Store) UpdateRefundStatus(ctx context.Context, id, status string) error {
	query := `UPDATE refund_application SET application_status = $1, updated_at = NOW() WHERE id = $2`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, status, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// SetupRefundPayment configures the payment method for a refund.
func (s *Store) SetupRefundPayment(ctx context.Context, id string, method string, rolloverAmt, directAmt, achRouting, achAccount, rolloverInst, rolloverAcct *string) error {
	query := `
		UPDATE refund_application
		SET payment_method = $1, rollover_amount = $2, direct_amount = $3,
			ach_routing_number = $4, ach_account_number = $5,
			rollover_institution = $6, rollover_account = $7,
			application_status = 'PAYMENT_SCHEDULED', payment_scheduled_at = NOW(), updated_at = NOW()
		WHERE id = $8 AND application_status = 'CALCULATION_COMPLETE'`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query,
		method, rolloverAmt, directAmt, achRouting, achAccount, rolloverInst, rolloverAcct, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DenyRefund marks a refund as denied.
func (s *Store) DenyRefund(ctx context.Context, id, reason, processedBy string) error {
	query := `
		UPDATE refund_application
		SET application_status = 'DENIED', denial_reason = $1, denied_at = NOW(),
			processed_by = $2, updated_at = NOW()
		WHERE id = $3 AND application_status NOT IN ('DISBURSED', 'DENIED', 'CANCELLED')`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, reason, processedBy, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// nullStr converts sql.NullString to *string.
func nullStr(ns sql.NullString) *string {
	if ns.Valid {
		return &ns.String
	}
	return nil
}
