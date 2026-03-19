package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/noui/platform/dbcontext"
)

// Store wraps a database connection and exposes employer-enrollment data-access methods.
type Store struct {
	DB *sql.DB
}

// NewStore creates a Store from an existing database connection.
func NewStore(database *sql.DB) *Store {
	return &Store{DB: database}
}

// --- Enrollment Submissions ---

// CreateSubmission inserts a new enrollment submission.
func (s *Store) CreateSubmission(ctx context.Context, sub *EnrollmentSubmission) error {
	query := `
		INSERT INTO enrollment_submission
			(org_id, submitted_by, enrollment_type, submission_status,
			 ssn_hash, first_name, last_name, date_of_birth, hire_date,
			 plan_code, division_code, tier,
			 middle_name, suffix, gender,
			 address_line1, address_line2, city, state, zip_code,
			 email, phone, is_safety_officer, job_title, annual_salary,
			 is_rehire, prior_member_id, prior_refund_taken)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
				$13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
				$26, $27, $28)
		RETURNING id, created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		sub.OrgID, sub.SubmittedBy, sub.EnrollmentType, sub.SubmissionStatus,
		sub.SSNHash, sub.FirstName, sub.LastName, sub.DateOfBirth, sub.HireDate,
		sub.PlanCode, sub.DivisionCode, sub.Tier,
		sub.MiddleName, sub.Suffix, sub.Gender,
		sub.AddressLine1, sub.AddressLine2, sub.City, sub.State, sub.ZipCode,
		sub.Email, sub.Phone, sub.IsSafetyOfficer, sub.JobTitle, sub.AnnualSalary,
		sub.IsRehire, sub.PriorMemberID, sub.PriorRefundTaken,
	).Scan(&sub.ID, &sub.CreatedAt, &sub.UpdatedAt)
}

// GetSubmission retrieves an enrollment submission by ID.
func (s *Store) GetSubmission(ctx context.Context, id string) (*EnrollmentSubmission, error) {
	query := `
		SELECT
			id, org_id, submitted_by, enrollment_type, submission_status,
			ssn_hash, first_name, last_name, date_of_birth, hire_date,
			plan_code, division_code, tier,
			middle_name, suffix, gender,
			address_line1, address_line2, city, state, zip_code,
			email, phone, is_safety_officer, job_title, annual_salary,
			is_rehire, prior_member_id, prior_refund_taken,
			conflict_status, conflict_fields, conflict_resolved_by, conflict_resolved_at,
			validation_errors, validated_at, approved_by, approved_at,
			rejected_by, rejected_at, rejection_reason,
			created_at, updated_at
		FROM enrollment_submission
		WHERE id = $1`

	sub := &EnrollmentSubmission{}
	var tier, middleName, suffix, gender sql.NullString
	var addr1, addr2, city, state, zip, email, phone, jobTitle sql.NullString
	var annualSalary sql.NullString
	var priorMemberID sql.NullString
	var priorRefundTaken sql.NullBool
	var conflictStatus, conflictFields, conflictResolvedBy sql.NullString
	var conflictResolvedAt sql.NullTime
	var validationErrors, approvedBy, rejectedBy, rejectionReason sql.NullString
	var validatedAt, approvedAt, rejectedAt sql.NullTime

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, id).Scan(
		&sub.ID, &sub.OrgID, &sub.SubmittedBy, &sub.EnrollmentType, &sub.SubmissionStatus,
		&sub.SSNHash, &sub.FirstName, &sub.LastName, &sub.DateOfBirth, &sub.HireDate,
		&sub.PlanCode, &sub.DivisionCode, &tier,
		&middleName, &suffix, &gender,
		&addr1, &addr2, &city, &state, &zip,
		&email, &phone, &sub.IsSafetyOfficer, &jobTitle, &annualSalary,
		&sub.IsRehire, &priorMemberID, &priorRefundTaken,
		&conflictStatus, &conflictFields, &conflictResolvedBy, &conflictResolvedAt,
		&validationErrors, &validatedAt, &approvedBy, &approvedAt,
		&rejectedBy, &rejectedAt, &rejectionReason,
		&sub.CreatedAt, &sub.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	sub.Tier = nullStr(tier)
	sub.MiddleName = nullStr(middleName)
	sub.Suffix = nullStr(suffix)
	sub.Gender = nullStr(gender)
	sub.AddressLine1 = nullStr(addr1)
	sub.AddressLine2 = nullStr(addr2)
	sub.City = nullStr(city)
	sub.State = nullStr(state)
	sub.ZipCode = nullStr(zip)
	sub.Email = nullStr(email)
	sub.Phone = nullStr(phone)
	sub.JobTitle = nullStr(jobTitle)
	sub.AnnualSalary = nullStr(annualSalary)
	sub.PriorMemberID = nullStr(priorMemberID)
	if priorRefundTaken.Valid {
		sub.PriorRefundTaken = &priorRefundTaken.Bool
	}
	sub.ConflictStatus = nullStr(conflictStatus)
	sub.ConflictFields = nullStr(conflictFields)
	sub.ConflictResolvedBy = nullStr(conflictResolvedBy)
	if conflictResolvedAt.Valid {
		sub.ConflictResolvedAt = &conflictResolvedAt.Time
	}
	sub.ValidationErrors = nullStr(validationErrors)
	if validatedAt.Valid {
		sub.ValidatedAt = &validatedAt.Time
	}
	sub.ApprovedBy = nullStr(approvedBy)
	if approvedAt.Valid {
		sub.ApprovedAt = &approvedAt.Time
	}
	sub.RejectedBy = nullStr(rejectedBy)
	if rejectedAt.Valid {
		sub.RejectedAt = &rejectedAt.Time
	}
	sub.RejectionReason = nullStr(rejectionReason)

	return sub, nil
}

// ListSubmissions retrieves enrollment submissions for an org with pagination.
func (s *Store) ListSubmissions(ctx context.Context, orgID string, status string, limit, offset int) ([]EnrollmentSubmission, int, error) {
	countQuery := `SELECT COUNT(*) FROM enrollment_submission WHERE org_id = $1`
	listQuery := `
		SELECT
			id, org_id, submitted_by, enrollment_type, submission_status,
			ssn_hash, first_name, last_name, date_of_birth, hire_date,
			plan_code, division_code, tier,
			is_safety_officer, is_rehire, submission_status,
			created_at, updated_at
		FROM enrollment_submission
		WHERE org_id = $1`

	args := []interface{}{orgID}
	countArgs := []interface{}{orgID}

	if status != "" {
		countQuery += ` AND submission_status = $2`
		listQuery += ` AND submission_status = $2`
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

	var subs []EnrollmentSubmission
	for rows.Next() {
		var sub EnrollmentSubmission
		var tier sql.NullString
		if err := rows.Scan(
			&sub.ID, &sub.OrgID, &sub.SubmittedBy, &sub.EnrollmentType, &sub.SubmissionStatus,
			&sub.SSNHash, &sub.FirstName, &sub.LastName, &sub.DateOfBirth, &sub.HireDate,
			&sub.PlanCode, &sub.DivisionCode, &tier,
			&sub.IsSafetyOfficer, &sub.IsRehire, &sub.SubmissionStatus,
			&sub.CreatedAt, &sub.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		sub.Tier = nullStr(tier)
		subs = append(subs, sub)
	}

	return subs, total, rows.Err()
}

// UpdateSubmissionStatus updates the status of a submission.
func (s *Store) UpdateSubmissionStatus(ctx context.Context, id, status string) error {
	query := `UPDATE enrollment_submission SET submission_status = $1, updated_at = NOW() WHERE id = $2`
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

// ApproveSubmission marks a submission as approved.
func (s *Store) ApproveSubmission(ctx context.Context, id, approvedBy string) error {
	query := `
		UPDATE enrollment_submission
		SET submission_status = 'APPROVED', approved_by = $1, approved_at = NOW(), updated_at = NOW()
		WHERE id = $2 AND submission_status IN ('VALIDATED', 'DUPLICATE_REVIEW')`
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

// RejectSubmission marks a submission as rejected.
func (s *Store) RejectSubmission(ctx context.Context, id, rejectedBy, reason string) error {
	query := `
		UPDATE enrollment_submission
		SET submission_status = 'REJECTED', rejected_by = $1, rejected_at = NOW(),
			rejection_reason = $2, updated_at = NOW()
		WHERE id = $3 AND submission_status NOT IN ('APPROVED', 'REJECTED')`
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

// --- Duplicate Flags ---

// CreateDuplicateFlag inserts a new duplicate detection flag.
func (s *Store) CreateDuplicateFlag(ctx context.Context, flag *DuplicateFlag) error {
	query := `
		INSERT INTO enrollment_duplicate_flag
			(submission_id, match_type, matched_member_id, matched_submission_id,
			 confidence_score, match_details, resolution_status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at`
	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		flag.SubmissionID, flag.MatchType, flag.MatchedMemberID, flag.MatchedSubmissionID,
		flag.ConfidenceScore, flag.MatchDetails, flag.ResolutionStatus,
	).Scan(&flag.ID, &flag.CreatedAt)
}

// ListDuplicateFlags retrieves duplicate flags for a submission.
func (s *Store) ListDuplicateFlags(ctx context.Context, submissionID string) ([]DuplicateFlag, error) {
	query := `
		SELECT
			id, submission_id, match_type, matched_member_id, matched_submission_id,
			confidence_score, match_details, resolution_status,
			resolved_by, resolved_at, resolution_note, created_at
		FROM enrollment_duplicate_flag
		WHERE submission_id = $1
		ORDER BY confidence_score DESC`

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, submissionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var flags []DuplicateFlag
	for rows.Next() {
		var f DuplicateFlag
		var matchedMember, matchedSub, matchDetails sql.NullString
		var resolvedBy, resolutionNote sql.NullString
		var resolvedAt sql.NullTime
		if err := rows.Scan(
			&f.ID, &f.SubmissionID, &f.MatchType, &matchedMember, &matchedSub,
			&f.ConfidenceScore, &matchDetails, &f.ResolutionStatus,
			&resolvedBy, &resolvedAt, &resolutionNote, &f.CreatedAt,
		); err != nil {
			return nil, err
		}
		f.MatchedMemberID = nullStr(matchedMember)
		f.MatchedSubmissionID = nullStr(matchedSub)
		f.MatchDetails = nullStr(matchDetails)
		f.ResolvedBy = nullStr(resolvedBy)
		if resolvedAt.Valid {
			f.ResolvedAt = &resolvedAt.Time
		}
		f.ResolutionNote = nullStr(resolutionNote)
		flags = append(flags, f)
	}
	return flags, rows.Err()
}

// ListPendingDuplicates retrieves all pending duplicate flags across all submissions for an org.
func (s *Store) ListPendingDuplicates(ctx context.Context, orgID string, limit, offset int) ([]DuplicateFlag, int, error) {
	countQuery := `
		SELECT COUNT(*) FROM enrollment_duplicate_flag df
		JOIN enrollment_submission es ON df.submission_id = es.id
		WHERE es.org_id = $1 AND df.resolution_status = 'PENDING'`
	listQuery := `
		SELECT
			df.id, df.submission_id, df.match_type, df.matched_member_id, df.matched_submission_id,
			df.confidence_score, df.match_details, df.resolution_status,
			df.resolved_by, df.resolved_at, df.resolution_note, df.created_at
		FROM enrollment_duplicate_flag df
		JOIN enrollment_submission es ON df.submission_id = es.id
		WHERE es.org_id = $1 AND df.resolution_status = 'PENDING'
		ORDER BY df.confidence_score DESC
		LIMIT $2 OFFSET $3`

	var total int
	if err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, countQuery, orgID).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, listQuery, orgID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var flags []DuplicateFlag
	for rows.Next() {
		var f DuplicateFlag
		var matchedMember, matchedSub, matchDetails sql.NullString
		var resolvedBy, resolutionNote sql.NullString
		var resolvedAt sql.NullTime
		if err := rows.Scan(
			&f.ID, &f.SubmissionID, &f.MatchType, &matchedMember, &matchedSub,
			&f.ConfidenceScore, &matchDetails, &f.ResolutionStatus,
			&resolvedBy, &resolvedAt, &resolutionNote, &f.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		f.MatchedMemberID = nullStr(matchedMember)
		f.MatchedSubmissionID = nullStr(matchedSub)
		f.MatchDetails = nullStr(matchDetails)
		f.ResolvedBy = nullStr(resolvedBy)
		if resolvedAt.Valid {
			f.ResolvedAt = &resolvedAt.Time
		}
		f.ResolutionNote = nullStr(resolutionNote)
		flags = append(flags, f)
	}
	return flags, total, rows.Err()
}

// ResolveDuplicateFlag updates a duplicate flag's resolution.
func (s *Store) ResolveDuplicateFlag(ctx context.Context, flagID, resolution, resolvedBy, note string) error {
	query := `
		UPDATE enrollment_duplicate_flag
		SET resolution_status = $1, resolved_by = $2, resolved_at = NOW(), resolution_note = $3
		WHERE id = $4 AND resolution_status = 'PENDING'`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, resolution, resolvedBy, note, flagID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// --- PERAChoice Elections ---

// CreatePERAChoiceElection inserts a new PERAChoice election record.
func (s *Store) CreatePERAChoiceElection(ctx context.Context, e *PERAChoiceElection) error {
	query := `
		INSERT INTO perachoice_election
			(submission_id, member_id, hire_date, window_opens, window_closes, election_status)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`
	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query,
		e.SubmissionID, e.MemberID, e.HireDate, e.WindowOpens, e.WindowCloses, e.ElectionStatus,
	).Scan(&e.ID, &e.CreatedAt, &e.UpdatedAt)
}

// ListPERAChoicePending retrieves PERAChoice elections that are still pending.
func (s *Store) ListPERAChoicePending(ctx context.Context, orgID string, limit, offset int) ([]PERAChoiceElection, int, error) {
	countQuery := `
		SELECT COUNT(*) FROM perachoice_election pe
		JOIN enrollment_submission es ON pe.submission_id = es.id
		WHERE es.org_id = $1 AND pe.election_status = 'PENDING'`
	listQuery := `
		SELECT
			pe.id, pe.submission_id, pe.member_id, pe.hire_date,
			pe.window_opens, pe.window_closes, pe.election_status,
			pe.elected_at, pe.elected_plan, pe.notification_sent_at,
			pe.dc_team_notified, pe.reminder_sent_at, pe.member_acknowledged,
			pe.created_at, pe.updated_at
		FROM perachoice_election pe
		JOIN enrollment_submission es ON pe.submission_id = es.id
		WHERE es.org_id = $1 AND pe.election_status = 'PENDING'
		ORDER BY pe.window_closes ASC
		LIMIT $2 OFFSET $3`

	var total int
	if err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, countQuery, orgID).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, listQuery, orgID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var elections []PERAChoiceElection
	for rows.Next() {
		e := PERAChoiceElection{}
		var memberID, electedPlan sql.NullString
		var electedAt, notifSent, reminderSent sql.NullTime
		if err := rows.Scan(
			&e.ID, &e.SubmissionID, &memberID, &e.HireDate,
			&e.WindowOpens, &e.WindowCloses, &e.ElectionStatus,
			&electedAt, &electedPlan, &notifSent,
			&e.DCTeamNotified, &reminderSent, &e.MemberAcknowledged,
			&e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		e.MemberID = nullStr(memberID)
		e.ElectedPlan = nullStr(electedPlan)
		if electedAt.Valid {
			e.ElectedAt = &electedAt.Time
		}
		if notifSent.Valid {
			e.NotificationSentAt = &notifSent.Time
		}
		if reminderSent.Valid {
			e.ReminderSentAt = &reminderSent.Time
		}
		elections = append(elections, e)
	}
	return elections, total, rows.Err()
}

// GetPERAChoiceElection retrieves a PERAChoice election by ID.
func (s *Store) GetPERAChoiceElection(ctx context.Context, id string) (*PERAChoiceElection, error) {
	query := `
		SELECT
			id, submission_id, member_id, hire_date,
			window_opens, window_closes, election_status,
			elected_at, elected_plan, notification_sent_at,
			dc_team_notified, reminder_sent_at, member_acknowledged,
			created_at, updated_at
		FROM perachoice_election
		WHERE id = $1`

	e := &PERAChoiceElection{}
	var memberID, electedPlan sql.NullString
	var electedAt, notifSent, reminderSent sql.NullTime

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, id).Scan(
		&e.ID, &e.SubmissionID, &memberID, &e.HireDate,
		&e.WindowOpens, &e.WindowCloses, &e.ElectionStatus,
		&electedAt, &electedPlan, &notifSent,
		&e.DCTeamNotified, &reminderSent, &e.MemberAcknowledged,
		&e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	e.MemberID = nullStr(memberID)
	e.ElectedPlan = nullStr(electedPlan)
	if electedAt.Valid {
		e.ElectedAt = &electedAt.Time
	}
	if notifSent.Valid {
		e.NotificationSentAt = &notifSent.Time
	}
	if reminderSent.Valid {
		e.ReminderSentAt = &reminderSent.Time
	}
	return e, nil
}

// ElectPERAChoice records a member's PERAChoice election.
func (s *Store) ElectPERAChoice(ctx context.Context, id, plan string) error {
	status := "ELECTED_DC"
	if plan == "DB" {
		status = "WAIVED"
	}
	query := `
		UPDATE perachoice_election
		SET election_status = $1, elected_plan = $2, elected_at = NOW(), updated_at = NOW()
		WHERE id = $3 AND election_status = 'PENDING'`
	res, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, status, plan, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// FindDuplicatesBySSN checks for existing submissions with the same SSN hash.
func (s *Store) FindDuplicatesBySSN(ctx context.Context, ssnHash, excludeID string) ([]EnrollmentSubmission, error) {
	query := `
		SELECT id, org_id, submitted_by, enrollment_type, submission_status,
			ssn_hash, first_name, last_name, date_of_birth, hire_date,
			plan_code, division_code, tier,
			is_safety_officer, is_rehire, created_at, updated_at
		FROM enrollment_submission
		WHERE ssn_hash = $1 AND id != $2 AND submission_status NOT IN ('REJECTED')
		ORDER BY created_at DESC`

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, ssnHash, excludeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []EnrollmentSubmission
	for rows.Next() {
		var sub EnrollmentSubmission
		var tier sql.NullString
		if err := rows.Scan(
			&sub.ID, &sub.OrgID, &sub.SubmittedBy, &sub.EnrollmentType, &sub.SubmissionStatus,
			&sub.SSNHash, &sub.FirstName, &sub.LastName, &sub.DateOfBirth, &sub.HireDate,
			&sub.PlanCode, &sub.DivisionCode, &tier,
			&sub.IsSafetyOfficer, &sub.IsRehire, &sub.CreatedAt, &sub.UpdatedAt,
		); err != nil {
			return nil, err
		}
		sub.Tier = nullStr(tier)
		subs = append(subs, sub)
	}
	return subs, rows.Err()
}

// nullStr converts sql.NullString to *string.
func nullStr(ns sql.NullString) *string {
	if ns.Valid {
		return &ns.String
	}
	return nil
}
