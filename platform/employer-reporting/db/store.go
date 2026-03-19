package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/noui/platform/dbcontext"
)

// Store wraps a database connection and exposes employer-reporting data-access methods.
type Store struct {
	DB *sql.DB
}

// NewStore creates a Store from an existing database connection.
func NewStore(database *sql.DB) *Store {
	return &Store{DB: database}
}

// --- Contribution Files ---

// CreateFile inserts a new contribution file record.
func (s *Store) CreateFile(ctx context.Context, f *ContributionFile) error {
	query := `
		INSERT INTO contribution_file
			(org_id, uploaded_by, file_name, file_type, file_status,
			 period_start, period_end, division_code)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		f.OrgID, f.UploadedBy, f.FileName, f.FileType, f.FileStatus,
		f.PeriodStart, f.PeriodEnd, f.DivisionCode,
	).Scan(&f.ID, &f.CreatedAt, &f.UpdatedAt)
}

// GetFile retrieves a contribution file by ID.
func (s *Store) GetFile(ctx context.Context, fileID string) (*ContributionFile, error) {
	query := `
		SELECT
			id, org_id, uploaded_by, file_name, file_type, file_status,
			period_start, period_end, division_code,
			total_records, valid_records, failed_records,
			total_amount, validated_amount, replaces_file_id,
			validation_started_at, validation_completed_at,
			created_at, updated_at
		FROM contribution_file
		WHERE id = $1`

	f := &ContributionFile{}
	var replacesID sql.NullString
	var valStarted, valCompleted sql.NullTime

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, fileID).Scan(
		&f.ID, &f.OrgID, &f.UploadedBy, &f.FileName, &f.FileType, &f.FileStatus,
		&f.PeriodStart, &f.PeriodEnd, &f.DivisionCode,
		&f.TotalRecords, &f.ValidRecords, &f.FailedRecords,
		&f.TotalAmount, &f.ValidatedAmount, &replacesID,
		&valStarted, &valCompleted,
		&f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("getting file %s: %w", fileID, err)
	}

	f.ReplacesFileID = nullStringToPtr(replacesID)
	f.ValidationStartedAt = nullTimeToPtr(valStarted)
	f.ValidationCompletedAt = nullTimeToPtr(valCompleted)
	return f, nil
}

// ListFiles retrieves contribution files for an org with pagination.
func (s *Store) ListFiles(ctx context.Context, orgID string, limit, offset int) ([]ContributionFile, int, error) {
	query := `
		SELECT
			id, org_id, uploaded_by, file_name, file_type, file_status,
			period_start, period_end, division_code,
			total_records, valid_records, failed_records,
			total_amount, validated_amount, replaces_file_id,
			validation_started_at, validation_completed_at,
			created_at, updated_at,
			COUNT(*) OVER() AS total_count
		FROM contribution_file
		WHERE org_id = $1
		ORDER BY created_at DESC`

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
		return nil, 0, fmt.Errorf("listing files: %w", err)
	}
	defer rows.Close()

	var files []ContributionFile
	var totalCount int

	for rows.Next() {
		var f ContributionFile
		var replacesID sql.NullString
		var valStarted, valCompleted sql.NullTime

		err := rows.Scan(
			&f.ID, &f.OrgID, &f.UploadedBy, &f.FileName, &f.FileType, &f.FileStatus,
			&f.PeriodStart, &f.PeriodEnd, &f.DivisionCode,
			&f.TotalRecords, &f.ValidRecords, &f.FailedRecords,
			&f.TotalAmount, &f.ValidatedAmount, &replacesID,
			&valStarted, &valCompleted,
			&f.CreatedAt, &f.UpdatedAt,
			&totalCount,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning file row: %w", err)
		}

		f.ReplacesFileID = nullStringToPtr(replacesID)
		f.ValidationStartedAt = nullTimeToPtr(valStarted)
		f.ValidationCompletedAt = nullTimeToPtr(valCompleted)
		files = append(files, f)
	}

	if files == nil {
		files = []ContributionFile{}
	}
	return files, totalCount, rows.Err()
}

// UpdateFileStatus updates file status and optional validation counters.
func (s *Store) UpdateFileStatus(ctx context.Context, fileID, status string, totalRecords, validRecords, failedRecords int, totalAmount, validatedAmount string) error {
	query := `
		UPDATE contribution_file
		SET file_status = $2, total_records = $3, valid_records = $4, failed_records = $5,
		    total_amount = $6, validated_amount = $7, updated_at = now()
		WHERE id = $1`

	result, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query,
		fileID, status, totalRecords, validRecords, failedRecords, totalAmount, validatedAmount)
	if err != nil {
		return fmt.Errorf("updating file status: %w", err)
	}

	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteFile removes a contribution file (only if UPLOADED status).
func (s *Store) DeleteFile(ctx context.Context, fileID string) error {
	query := `DELETE FROM contribution_file WHERE id = $1 AND file_status = 'UPLOADED'`
	result, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, fileID)
	if err != nil {
		return fmt.Errorf("deleting file: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// --- Contribution Records ---

// CreateRecords bulk-inserts contribution records for a file.
func (s *Store) CreateRecords(ctx context.Context, records []ContributionRecord) error {
	query := `
		INSERT INTO contribution_record
			(file_id, row_number, ssn_hash, member_name, division_code,
			 is_safety_officer, is_orp, gross_salary,
			 member_contribution, employer_contribution,
			 aed_amount, saed_amount, aap_amount, dc_supplement_amount, total_amount)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING id, created_at`

	for i := range records {
		r := &records[i]
		err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
			r.FileID, r.RowNumber, r.SSNHash, r.MemberName, r.DivisionCode,
			r.IsSafetyOfficer, r.IsORP, r.GrossSalary,
			r.MemberContribution, r.EmployerContribution,
			r.AEDAmount, r.SAEDAmount, r.AAPAmount, r.DCSupplementAmount, r.TotalAmount,
		).Scan(&r.ID, &r.CreatedAt)
		if err != nil {
			return fmt.Errorf("inserting record row %d: %w", r.RowNumber, err)
		}
	}
	return nil
}

// ListRecords retrieves contribution records for a file with pagination.
func (s *Store) ListRecords(ctx context.Context, fileID string, limit, offset int) ([]ContributionRecord, int, error) {
	query := `
		SELECT
			id, file_id, row_number, ssn_hash, member_name, member_id,
			division_code, is_safety_officer, is_orp,
			gross_salary, member_contribution, employer_contribution,
			aed_amount, saed_amount, aap_amount, dc_supplement_amount, total_amount,
			record_status, validation_errors, created_at,
			COUNT(*) OVER() AS total_count
		FROM contribution_record
		WHERE file_id = $1
		ORDER BY row_number`

	args := []interface{}{fileID}
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
		return nil, 0, fmt.Errorf("listing records: %w", err)
	}
	defer rows.Close()

	var records []ContributionRecord
	var totalCount int

	for rows.Next() {
		var r ContributionRecord
		var memberName, memberID, valErrors sql.NullString

		err := rows.Scan(
			&r.ID, &r.FileID, &r.RowNumber, &r.SSNHash, &memberName, &memberID,
			&r.DivisionCode, &r.IsSafetyOfficer, &r.IsORP,
			&r.GrossSalary, &r.MemberContribution, &r.EmployerContribution,
			&r.AEDAmount, &r.SAEDAmount, &r.AAPAmount, &r.DCSupplementAmount, &r.TotalAmount,
			&r.RecordStatus, &valErrors, &r.CreatedAt,
			&totalCount,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning record row: %w", err)
		}

		r.MemberName = nullStringToPtr(memberName)
		r.MemberID = nullStringToPtr(memberID)
		r.ValidationErrors = nullStringToPtr(valErrors)
		records = append(records, r)
	}

	if records == nil {
		records = []ContributionRecord{}
	}
	return records, totalCount, rows.Err()
}

// UpdateRecordStatus updates a record's status and validation errors.
func (s *Store) UpdateRecordStatus(ctx context.Context, recordID, status string, validationErrors *string) error {
	query := `
		UPDATE contribution_record
		SET record_status = $2, validation_errors = $3
		WHERE id = $1`

	_, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, recordID, status, validationErrors)
	return err
}

// --- Exceptions ---

// CreateException inserts a new exception record.
func (s *Store) CreateException(ctx context.Context, e *ContributionException) error {
	query := `
		INSERT INTO contribution_exception
			(file_id, record_id, org_id, exception_type, exception_status,
			 description, expected_value, submitted_value)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		e.FileID, e.RecordID, e.OrgID, e.ExceptionType, e.ExceptionStatus,
		e.Description, e.ExpectedValue, e.SubmittedValue,
	).Scan(&e.ID, &e.CreatedAt, &e.UpdatedAt)
}

// ListExceptions retrieves exceptions for an org, optionally filtered by status.
func (s *Store) ListExceptions(ctx context.Context, orgID string, status string, limit, offset int) ([]ContributionException, int, error) {
	query := `
		SELECT
			id, file_id, record_id, org_id, exception_type, exception_status,
			description, expected_value, submitted_value,
			assigned_to, resolution_note, resolved_by,
			resolved_at, escalated_at, dc_routed_at,
			created_at, updated_at,
			COUNT(*) OVER() AS total_count
		FROM contribution_exception
		WHERE org_id = $1`

	args := []interface{}{orgID}
	argIdx := 2

	if status != "" {
		query += fmt.Sprintf(" AND exception_status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

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
		return nil, 0, fmt.Errorf("listing exceptions: %w", err)
	}
	defer rows.Close()

	var exceptions []ContributionException
	var totalCount int

	for rows.Next() {
		var e ContributionException
		var recordID, expectedVal, submittedVal sql.NullString
		var assignedTo, resNote, resolvedBy sql.NullString
		var resolvedAt, escalatedAt, dcRoutedAt sql.NullTime

		err := rows.Scan(
			&e.ID, &e.FileID, &recordID, &e.OrgID, &e.ExceptionType, &e.ExceptionStatus,
			&e.Description, &expectedVal, &submittedVal,
			&assignedTo, &resNote, &resolvedBy,
			&resolvedAt, &escalatedAt, &dcRoutedAt,
			&e.CreatedAt, &e.UpdatedAt,
			&totalCount,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning exception row: %w", err)
		}

		e.RecordID = nullStringToPtr(recordID)
		e.ExpectedValue = nullStringToPtr(expectedVal)
		e.SubmittedValue = nullStringToPtr(submittedVal)
		e.AssignedTo = nullStringToPtr(assignedTo)
		e.ResolutionNote = nullStringToPtr(resNote)
		e.ResolvedBy = nullStringToPtr(resolvedBy)
		e.ResolvedAt = nullTimeToPtr(resolvedAt)
		e.EscalatedAt = nullTimeToPtr(escalatedAt)
		e.DCRoutedAt = nullTimeToPtr(dcRoutedAt)
		exceptions = append(exceptions, e)
	}

	if exceptions == nil {
		exceptions = []ContributionException{}
	}
	return exceptions, totalCount, rows.Err()
}

// GetException retrieves a single exception by ID.
func (s *Store) GetException(ctx context.Context, exceptionID string) (*ContributionException, error) {
	query := `
		SELECT
			id, file_id, record_id, org_id, exception_type, exception_status,
			description, expected_value, submitted_value,
			assigned_to, resolution_note, resolved_by,
			resolved_at, escalated_at, dc_routed_at,
			created_at, updated_at
		FROM contribution_exception
		WHERE id = $1`

	e := &ContributionException{}
	var recordID, expectedVal, submittedVal sql.NullString
	var assignedTo, resNote, resolvedBy sql.NullString
	var resolvedAt, escalatedAt, dcRoutedAt sql.NullTime

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, exceptionID).Scan(
		&e.ID, &e.FileID, &recordID, &e.OrgID, &e.ExceptionType, &e.ExceptionStatus,
		&e.Description, &expectedVal, &submittedVal,
		&assignedTo, &resNote, &resolvedBy,
		&resolvedAt, &escalatedAt, &dcRoutedAt,
		&e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("getting exception %s: %w", exceptionID, err)
	}

	e.RecordID = nullStringToPtr(recordID)
	e.ExpectedValue = nullStringToPtr(expectedVal)
	e.SubmittedValue = nullStringToPtr(submittedVal)
	e.AssignedTo = nullStringToPtr(assignedTo)
	e.ResolutionNote = nullStringToPtr(resNote)
	e.ResolvedBy = nullStringToPtr(resolvedBy)
	e.ResolvedAt = nullTimeToPtr(resolvedAt)
	e.EscalatedAt = nullTimeToPtr(escalatedAt)
	e.DCRoutedAt = nullTimeToPtr(dcRoutedAt)
	return e, nil
}

// ResolveException marks an exception as resolved.
func (s *Store) ResolveException(ctx context.Context, exceptionID, resolvedBy, note string) error {
	query := `
		UPDATE contribution_exception
		SET exception_status = 'RESOLVED', resolution_note = $2, resolved_by = $3,
		    resolved_at = $4, updated_at = now()
		WHERE id = $1 AND exception_status IN ('UNRESOLVED', 'PENDING_RESPONSE', 'ESCALATED')`

	result, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query,
		exceptionID, note, resolvedBy, time.Now())
	if err != nil {
		return fmt.Errorf("resolving exception: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// EscalateException marks an exception as escalated.
func (s *Store) EscalateException(ctx context.Context, exceptionID string) error {
	query := `
		UPDATE contribution_exception
		SET exception_status = 'ESCALATED', escalated_at = $2, updated_at = now()
		WHERE id = $1 AND exception_status IN ('UNRESOLVED', 'PENDING_RESPONSE')`

	result, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, exceptionID, time.Now())
	if err != nil {
		return fmt.Errorf("escalating exception: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// --- Payments ---

// CreatePayment inserts a new payment record.
func (s *Store) CreatePayment(ctx context.Context, p *ContributionPayment) error {
	query := `
		INSERT INTO contribution_payment
			(file_id, org_id, payment_method, payment_status, amount, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		p.FileID, p.OrgID, p.PaymentMethod, p.PaymentStatus, p.Amount, p.CreatedBy,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

// ListPayments retrieves payments for an org with pagination.
func (s *Store) ListPayments(ctx context.Context, orgID string, limit, offset int) ([]ContributionPayment, int, error) {
	query := `
		SELECT
			id, file_id, org_id, payment_method, payment_status,
			amount, scheduled_date, processed_date, reference_number,
			discrepancy_amount, created_by, created_at, updated_at,
			COUNT(*) OVER() AS total_count
		FROM contribution_payment
		WHERE org_id = $1
		ORDER BY created_at DESC`

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
		return nil, 0, fmt.Errorf("listing payments: %w", err)
	}
	defer rows.Close()

	var payments []ContributionPayment
	var totalCount int

	for rows.Next() {
		var p ContributionPayment
		var scheduledDate, processedDate, refNum, discrepancy, createdBy sql.NullString

		err := rows.Scan(
			&p.ID, &p.FileID, &p.OrgID, &p.PaymentMethod, &p.PaymentStatus,
			&p.Amount, &scheduledDate, &processedDate, &refNum,
			&discrepancy, &createdBy, &p.CreatedAt, &p.UpdatedAt,
			&totalCount,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning payment row: %w", err)
		}

		p.ScheduledDate = nullStringToPtr(scheduledDate)
		p.ProcessedDate = nullStringToPtr(processedDate)
		p.ReferenceNumber = nullStringToPtr(refNum)
		p.DiscrepancyAmount = nullStringToPtr(discrepancy)
		p.CreatedBy = nullStringToPtr(createdBy)
		payments = append(payments, p)
	}

	if payments == nil {
		payments = []ContributionPayment{}
	}
	return payments, totalCount, rows.Err()
}

// CancelPayment deletes a pending payment.
func (s *Store) CancelPayment(ctx context.Context, paymentID string) error {
	query := `DELETE FROM contribution_payment WHERE id = $1 AND payment_status = 'PENDING'`
	result, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, paymentID)
	if err != nil {
		return fmt.Errorf("cancelling payment: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// --- Late Interest ---

// ListInterest retrieves late interest accruals for an org.
func (s *Store) ListInterest(ctx context.Context, orgID string) ([]LateInterestAccrual, error) {
	query := `
		SELECT
			id, org_id, file_id, period_start, period_end,
			days_late, base_amount, interest_rate, interest_amount,
			minimum_charge_applied, payment_id, created_at
		FROM late_interest_accrual
		WHERE org_id = $1
		ORDER BY created_at DESC`

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, orgID)
	if err != nil {
		return nil, fmt.Errorf("listing interest: %w", err)
	}
	defer rows.Close()

	var accruals []LateInterestAccrual

	for rows.Next() {
		var a LateInterestAccrual
		var fileID, paymentID sql.NullString

		err := rows.Scan(
			&a.ID, &a.OrgID, &fileID, &a.PeriodStart, &a.PeriodEnd,
			&a.DaysLate, &a.BaseAmount, &a.InterestRate, &a.InterestAmount,
			&a.MinimumChargeApplied, &paymentID, &a.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning interest row: %w", err)
		}

		a.FileID = nullStringToPtr(fileID)
		a.PaymentID = nullStringToPtr(paymentID)
		accruals = append(accruals, a)
	}

	if accruals == nil {
		accruals = []LateInterestAccrual{}
	}
	return accruals, rows.Err()
}

// --- Rate Lookup (for validation) ---

// LookupRate finds the effective contribution rate for a division, safety officer flag, and date.
func (s *Store) LookupRate(ctx context.Context, divisionCode string, isSafetyOfficer bool, asOfDate string) (*RateRow, error) {
	query := `
		SELECT
			member_rate, employer_base_rate, aed_rate, saed_rate,
			aap_rate, dc_supplement_rate, employer_total_rate
		FROM contribution_rate_table
		WHERE division_code = $1
		  AND is_safety_officer = $2
		  AND effective_from <= $3::date
		  AND (effective_to IS NULL OR effective_to >= $3::date)
		ORDER BY effective_from DESC
		LIMIT 1`

	r := &RateRow{}
	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		divisionCode, isSafetyOfficer, asOfDate,
	).Scan(
		&r.MemberRate, &r.EmployerBaseRate, &r.AEDRate, &r.SAEDRate,
		&r.AAPRate, &r.DCSupplementRate, &r.EmployerTotalRate,
	)
	if err != nil {
		return nil, fmt.Errorf("looking up rate for %s safety=%v date=%s: %w",
			divisionCode, isSafetyOfficer, asOfDate, err)
	}
	return r, nil
}

// RateRow holds rate values from the contribution_rate_table for validation.
type RateRow struct {
	MemberRate        string
	EmployerBaseRate  string
	AEDRate           string
	SAEDRate          string
	AAPRate           string
	DCSupplementRate  string
	EmployerTotalRate string
}
