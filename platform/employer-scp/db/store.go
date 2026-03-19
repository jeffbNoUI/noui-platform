package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/noui/platform/dbcontext"
)

// Store wraps a database connection and exposes employer-scp data-access methods.
type Store struct {
	DB *sql.DB
}

// NewStore creates a Store from an existing database connection.
func NewStore(database *sql.DB) *Store {
	return &Store{DB: database}
}

// --- Cost Factors ---

// GetCostFactor looks up the current cost factor for a given tier, hire date, and age.
func (s *Store) GetCostFactor(ctx context.Context, tier, hireDate string, ageAtPurchase int) (*SCPCostFactor, error) {
	query := `
		SELECT id, tier, hire_date_from, hire_date_to, age_at_purchase,
			effective_date, expiry_date, cost_factor,
			source_document, notes, created_at, updated_at
		FROM scp_cost_factor
		WHERE tier = $1
		AND age_at_purchase = $2
		AND hire_date_from <= $3::DATE
		AND hire_date_to >= $3::DATE
		AND expiry_date IS NULL
		ORDER BY effective_date DESC
		LIMIT 1`

	f := &SCPCostFactor{}
	var expiryDate, sourceDoc, notes sql.NullString

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, tier, ageAtPurchase, hireDate).Scan(
		&f.ID, &f.Tier, &f.HireDateFrom, &f.HireDateTo, &f.AgeAtPurchase,
		&f.EffectiveDate, &expiryDate, &f.CostFactor,
		&sourceDoc, &notes, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	f.ExpiryDate = nullStr(expiryDate)
	f.SourceDocument = nullStr(sourceDoc)
	f.Notes = nullStr(notes)

	return f, nil
}

// ListCostFactors retrieves cost factors with optional tier filter.
func (s *Store) ListCostFactors(ctx context.Context, tier string, activeOnly bool, limit, offset int) ([]SCPCostFactor, int, error) {
	countQuery := `SELECT COUNT(*) FROM scp_cost_factor WHERE 1=1`
	listQuery := `
		SELECT id, tier, hire_date_from, hire_date_to, age_at_purchase,
			effective_date, expiry_date, cost_factor,
			source_document, notes, created_at, updated_at
		FROM scp_cost_factor
		WHERE 1=1`

	args := []interface{}{}
	countArgs := []interface{}{}
	paramIdx := 1

	if tier != "" {
		countQuery += fmt.Sprintf(` AND tier = $%d`, paramIdx)
		listQuery += fmt.Sprintf(` AND tier = $%d`, paramIdx)
		args = append(args, tier)
		countArgs = append(countArgs, tier)
		paramIdx++
	}
	if activeOnly {
		countQuery += ` AND expiry_date IS NULL`
		listQuery += ` AND expiry_date IS NULL`
	}

	listQuery += fmt.Sprintf(` ORDER BY tier, age_at_purchase LIMIT $%d OFFSET $%d`, paramIdx, paramIdx+1)
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

	var factors []SCPCostFactor
	for rows.Next() {
		var f SCPCostFactor
		var expiryDate, sourceDoc, notes sql.NullString
		if err := rows.Scan(
			&f.ID, &f.Tier, &f.HireDateFrom, &f.HireDateTo, &f.AgeAtPurchase,
			&f.EffectiveDate, &expiryDate, &f.CostFactor,
			&sourceDoc, &notes, &f.CreatedAt, &f.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		f.ExpiryDate = nullStr(expiryDate)
		f.SourceDocument = nullStr(sourceDoc)
		f.Notes = nullStr(notes)
		factors = append(factors, f)
	}

	return factors, total, rows.Err()
}

// CreateCostFactor inserts a new cost factor record.
func (s *Store) CreateCostFactor(ctx context.Context, f *SCPCostFactor) error {
	query := `
		INSERT INTO scp_cost_factor
			(tier, hire_date_from, hire_date_to, age_at_purchase,
			 effective_date, expiry_date, cost_factor,
			 source_document, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		f.Tier, f.HireDateFrom, f.HireDateTo, f.AgeAtPurchase,
		f.EffectiveDate, f.ExpiryDate, f.CostFactor,
		f.SourceDocument, f.Notes,
	).Scan(&f.ID, &f.CreatedAt, &f.UpdatedAt)
}

// --- SCP Requests ---

// CreateSCPRequest inserts a new service credit purchase request.
// Exclusion flags are set to true at creation and enforced immutable by DB trigger.
func (s *Store) CreateSCPRequest(ctx context.Context, r *SCPRequest) error {
	query := `
		INSERT INTO scp_request
			(org_id, member_id, ssn_hash, first_name, last_name,
			 service_type, tier, years_requested,
			 excludes_from_rule_of_75_85, excludes_from_ipr, excludes_from_vesting,
			 request_status, submitted_by, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		r.OrgID, r.MemberID, r.SSNHash, r.FirstName, r.LastName,
		r.ServiceType, r.Tier, r.YearsRequested,
		true, true, true, // exclusion flags always true
		r.RequestStatus, r.SubmittedBy, r.Notes,
	).Scan(&r.ID, &r.CreatedAt, &r.UpdatedAt)
}

// GetSCPRequest retrieves a request by ID.
func (s *Store) GetSCPRequest(ctx context.Context, id string) (*SCPRequest, error) {
	query := `
		SELECT
			id, org_id, member_id, ssn_hash, first_name, last_name,
			service_type, tier, years_requested,
			cost_factor_id, cost_factor, annual_salary_at_purchase, total_cost,
			payment_method, amount_paid, amount_remaining,
			quote_date, quote_expires, quote_recalculated,
			documentation_received, documentation_verified, verified_by, verified_at,
			excludes_from_rule_of_75_85, excludes_from_ipr, excludes_from_vesting,
			request_status,
			submitted_by, submitted_at, reviewed_by, reviewed_at, review_note,
			approved_by, approved_at, denied_by, denied_at, denial_reason,
			notes, created_at, updated_at
		FROM scp_request
		WHERE id = $1`

	r := &SCPRequest{}
	var memberID, costFactorID, costFactor, annualSalary, totalCost sql.NullString
	var paymentMethod, quoteDate, quoteExpires sql.NullString
	var verifiedBy, submittedBy, reviewedBy, reviewNote sql.NullString
	var approvedBy, deniedBy, denialReason, notes sql.NullString
	var verifiedAt, submittedAt, reviewedAt, approvedAt, deniedAt sql.NullTime

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, id).Scan(
		&r.ID, &r.OrgID, &memberID, &r.SSNHash, &r.FirstName, &r.LastName,
		&r.ServiceType, &r.Tier, &r.YearsRequested,
		&costFactorID, &costFactor, &annualSalary, &totalCost,
		&paymentMethod, &r.AmountPaid, &r.AmountRemaining,
		&quoteDate, &quoteExpires, &r.QuoteRecalculated,
		&r.DocumentationReceived, &r.DocumentationVerified, &verifiedBy, &verifiedAt,
		&r.ExcludesFromRuleOf7585, &r.ExcludesFromIPR, &r.ExcludesFromVesting,
		&r.RequestStatus,
		&submittedBy, &submittedAt, &reviewedBy, &reviewedAt, &reviewNote,
		&approvedBy, &approvedAt, &deniedBy, &deniedAt, &denialReason,
		&notes, &r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	r.MemberID = nullStr(memberID)
	r.CostFactorID = nullStr(costFactorID)
	r.CostFactor = nullStr(costFactor)
	r.AnnualSalaryAtPurchase = nullStr(annualSalary)
	r.TotalCost = nullStr(totalCost)
	r.PaymentMethod = nullStr(paymentMethod)
	r.QuoteDate = nullStr(quoteDate)
	r.QuoteExpires = nullStr(quoteExpires)
	r.VerifiedBy = nullStr(verifiedBy)
	if verifiedAt.Valid {
		r.VerifiedAt = &verifiedAt.Time
	}
	r.SubmittedBy = nullStr(submittedBy)
	if submittedAt.Valid {
		r.SubmittedAt = &submittedAt.Time
	}
	r.ReviewedBy = nullStr(reviewedBy)
	if reviewedAt.Valid {
		r.ReviewedAt = &reviewedAt.Time
	}
	r.ReviewNote = nullStr(reviewNote)
	r.ApprovedBy = nullStr(approvedBy)
	if approvedAt.Valid {
		r.ApprovedAt = &approvedAt.Time
	}
	r.DeniedBy = nullStr(deniedBy)
	if deniedAt.Valid {
		r.DeniedAt = &deniedAt.Time
	}
	r.DenialReason = nullStr(denialReason)
	r.Notes = nullStr(notes)

	return r, nil
}

// ListSCPRequests retrieves requests for an org with optional status filter.
func (s *Store) ListSCPRequests(ctx context.Context, orgID, status string, limit, offset int) ([]SCPRequest, int, error) {
	countQuery := `SELECT COUNT(*) FROM scp_request WHERE org_id = $1`
	listQuery := `
		SELECT
			id, org_id, member_id, ssn_hash, first_name, last_name,
			service_type, tier, years_requested,
			cost_factor, total_cost, payment_method, amount_paid, amount_remaining,
			quote_date, quote_expires,
			excludes_from_rule_of_75_85, excludes_from_ipr, excludes_from_vesting,
			request_status, notes, created_at, updated_at
		FROM scp_request
		WHERE org_id = $1`

	args := []interface{}{orgID}
	countArgs := []interface{}{orgID}
	paramIdx := 2

	if status != "" {
		countQuery += fmt.Sprintf(` AND request_status = $%d`, paramIdx)
		listQuery += fmt.Sprintf(` AND request_status = $%d`, paramIdx)
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

	var requests []SCPRequest
	for rows.Next() {
		var r SCPRequest
		var memberID, costFactor, totalCost, paymentMethod sql.NullString
		var quoteDate, quoteExpires, notes sql.NullString
		if err := rows.Scan(
			&r.ID, &r.OrgID, &memberID, &r.SSNHash, &r.FirstName, &r.LastName,
			&r.ServiceType, &r.Tier, &r.YearsRequested,
			&costFactor, &totalCost, &paymentMethod, &r.AmountPaid, &r.AmountRemaining,
			&quoteDate, &quoteExpires,
			&r.ExcludesFromRuleOf7585, &r.ExcludesFromIPR, &r.ExcludesFromVesting,
			&r.RequestStatus, &notes, &r.CreatedAt, &r.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		r.MemberID = nullStr(memberID)
		r.CostFactor = nullStr(costFactor)
		r.TotalCost = nullStr(totalCost)
		r.PaymentMethod = nullStr(paymentMethod)
		r.QuoteDate = nullStr(quoteDate)
		r.QuoteExpires = nullStr(quoteExpires)
		r.Notes = nullStr(notes)
		requests = append(requests, r)
	}

	return requests, total, rows.Err()
}

// UpdateQuote sets the cost quote details on a request.
func (s *Store) UpdateQuote(ctx context.Context, id, costFactorID, costFactor, annualSalary, totalCost, quoteDate, quoteExpires string) error {
	query := `
		UPDATE scp_request
		SET cost_factor_id = $1, cost_factor = $2,
			annual_salary_at_purchase = $3, total_cost = $4,
			amount_remaining = $4,
			quote_date = $5, quote_expires = $6,
			request_status = 'QUOTED', updated_at = NOW()
		WHERE id = $7 AND request_status = 'DRAFT'`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query,
		costFactorID, costFactor, annualSalary, totalCost, quoteDate, quoteExpires, id,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// SubmitDocumentation marks documentation as received.
func (s *Store) SubmitDocumentation(ctx context.Context, id string) error {
	query := `
		UPDATE scp_request
		SET documentation_received = true, request_status = 'UNDER_REVIEW', updated_at = NOW()
		WHERE id = $1 AND request_status IN ('QUOTED', 'PENDING_DOCS')`
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

// ApproveRequest approves a purchase request.
func (s *Store) ApproveRequest(ctx context.Context, id, approvedBy string) error {
	query := `
		UPDATE scp_request
		SET request_status = 'APPROVED', approved_by = $1, approved_at = NOW(), updated_at = NOW()
		WHERE id = $2 AND request_status = 'UNDER_REVIEW'`
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

// DenyRequest denies a purchase request.
func (s *Store) DenyRequest(ctx context.Context, id, deniedBy, reason string) error {
	query := `
		UPDATE scp_request
		SET request_status = 'DENIED', denied_by = $1, denied_at = NOW(),
			denial_reason = $2, updated_at = NOW()
		WHERE id = $3 AND request_status IN ('UNDER_REVIEW', 'PENDING_DOCS')`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, deniedBy, reason, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// RecordPayment records a payment against a request.
func (s *Store) RecordPayment(ctx context.Context, id, amount, paymentMethod string) error {
	query := `
		UPDATE scp_request
		SET amount_paid = amount_paid + $1::NUMERIC,
			amount_remaining = amount_remaining - $1::NUMERIC,
			payment_method = COALESCE(payment_method, $2),
			request_status = CASE
				WHEN amount_remaining - $1::NUMERIC <= 0 THEN 'COMPLETED'
				ELSE 'PAYING'
			END,
			updated_at = NOW()
		WHERE id = $3 AND request_status IN ('APPROVED', 'PAYING')`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, amount, paymentMethod, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// CancelRequest cancels a purchase request.
func (s *Store) CancelRequest(ctx context.Context, id string) error {
	query := `
		UPDATE scp_request
		SET request_status = 'CANCELLED', updated_at = NOW()
		WHERE id = $1 AND request_status IN ('DRAFT', 'QUOTED', 'PENDING_DOCS')`
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

// nullStr converts sql.NullString to *string.
func nullStr(ns sql.NullString) *string {
	if ns.Valid {
		return &ns.String
	}
	return nil
}
