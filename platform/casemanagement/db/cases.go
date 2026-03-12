package db

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/noui/platform/casemanagement/models"
)

// caseColumns is the shared SELECT list for case queries.
// JOINs member_master and department_ref to return name, tier, and dept
// matching the frontend WorkQueueItem shape.
const caseColumns = `
	rc.case_id, rc.tenant_id, rc.member_id, rc.case_type,
	rc.retirement_date, rc.priority, rc.sla_status,
	rc.current_stage, rc.current_stage_idx, rc.assigned_to,
	rc.days_open, rc.status, rc.dro_id, rc.created_at, rc.updated_at,
	COALESCE(m.first_name || ' ' || m.last_name, '') AS name,
	COALESCE(m.tier_cd, 0) AS tier,
	COALESCE(d.dept_name, '') AS dept
`

const caseFrom = `
	FROM retirement_case rc
	LEFT JOIN member_master m ON rc.member_id = m.member_id
	LEFT JOIN department_ref d ON m.dept_cd = d.dept_cd
`

// scanCase scans a single case row into a RetirementCase.
func scanCase(scanner interface{ Scan(dest ...any) error }) (*models.RetirementCase, error) {
	var c models.RetirementCase
	var retDate time.Time
	var assignedTo sql.NullString
	var droID sql.NullInt64

	err := scanner.Scan(
		&c.CaseID, &c.TenantID, &c.MemberID, &c.CaseType,
		&retDate, &c.Priority, &c.SLAStatus,
		&c.CurrentStage, &c.CurrentStageIdx, &assignedTo,
		&c.DaysOpen, &c.Status, &droID, &c.CreatedAt, &c.UpdatedAt,
		&c.Name, &c.Tier, &c.Dept,
	)
	if err != nil {
		return nil, err
	}

	c.RetirementDate = retDate.Format("2006-01-02")
	if assignedTo.Valid {
		c.AssignedTo = assignedTo.String
	}
	if droID.Valid {
		id := int(droID.Int64)
		c.DROID = &id
	}

	return &c, nil
}

// ListCases returns cases matching the filter, enriched with member data.
func (s *Store) ListCases(tenantID string, f models.CaseFilter) ([]models.RetirementCase, int, error) {
	where := []string{"rc.tenant_id = $1"}
	args := []any{tenantID}
	idx := 2

	if f.Status != "" {
		where = append(where, fmt.Sprintf("rc.status = $%d", idx))
		args = append(args, f.Status)
		idx++
	}
	if f.Priority != "" {
		where = append(where, fmt.Sprintf("rc.priority = $%d", idx))
		args = append(args, f.Priority)
		idx++
	}
	if f.AssignedTo != "" {
		where = append(where, fmt.Sprintf("rc.assigned_to = $%d", idx))
		args = append(args, f.AssignedTo)
		idx++
	}
	if f.MemberID > 0 {
		where = append(where, fmt.Sprintf("rc.member_id = $%d", idx))
		args = append(args, f.MemberID)
		idx++
	}

	whereClause := "WHERE " + strings.Join(where, " AND ")

	// Count total
	var total int
	countQ := "SELECT COUNT(*) FROM retirement_case rc " + whereClause
	if err := s.DB.QueryRow(countQ, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Fetch page
	limit := f.Limit
	if limit <= 0 {
		limit = 25
	}
	offset := f.Offset
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(
		"SELECT %s %s %s ORDER BY rc.updated_at DESC LIMIT $%d OFFSET $%d",
		caseColumns, caseFrom, whereClause, idx, idx+1,
	)
	args = append(args, limit, offset)

	rows, err := s.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var cases []models.RetirementCase
	for rows.Next() {
		c, err := scanCase(rows)
		if err != nil {
			return nil, 0, err
		}
		cases = append(cases, *c)
	}

	// Load flags for each case
	for i := range cases {
		flags, err := s.GetCaseFlags(cases[i].CaseID)
		if err != nil {
			return nil, 0, err
		}
		cases[i].Flags = flags
	}

	return cases, total, rows.Err()
}

// GetCase returns a single case by ID, scoped to the given tenant.
func (s *Store) GetCase(tenantID, caseID string) (*models.RetirementCase, error) {
	query := fmt.Sprintf("SELECT %s %s WHERE rc.case_id = $1 AND rc.tenant_id = $2", caseColumns, caseFrom)
	c, err := scanCase(s.DB.QueryRow(query, caseID, tenantID))
	if err != nil {
		return nil, err
	}

	flags, err := s.GetCaseFlags(caseID)
	if err != nil {
		return nil, err
	}
	c.Flags = flags

	return c, nil
}

// GetCaseByID returns a case without tenant scoping (internal use only, e.g. after CreateCase).
func (s *Store) GetCaseByID(caseID string) (*models.RetirementCase, error) {
	query := fmt.Sprintf("SELECT %s %s WHERE rc.case_id = $1", caseColumns, caseFrom)
	c, err := scanCase(s.DB.QueryRow(query, caseID))
	if err != nil {
		return nil, err
	}

	flags, err := s.GetCaseFlags(caseID)
	if err != nil {
		return nil, err
	}
	c.Flags = flags

	return c, nil
}

// CreateCase inserts a new case and its flags.
func (s *Store) CreateCase(c *models.RetirementCase, flags []string) error {
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO retirement_case (
			case_id, tenant_id, member_id, case_type, retirement_date,
			priority, sla_status, current_stage, current_stage_idx,
			assigned_to, days_open, status, dro_id, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`,
		c.CaseID, c.TenantID, c.MemberID, c.CaseType, c.RetirementDate,
		c.Priority, c.SLAStatus, c.CurrentStage, c.CurrentStageIdx,
		c.AssignedTo, c.DaysOpen, c.Status, c.DROID, c.CreatedAt, c.UpdatedAt,
	)
	if err != nil {
		return err
	}

	for _, flag := range flags {
		_, err = tx.Exec(
			`INSERT INTO case_flag (case_id, flag_code) VALUES ($1, $2)`,
			c.CaseID, flag,
		)
		if err != nil {
			return err
		}
	}

	// Record initial stage transition
	_, err = tx.Exec(`
		INSERT INTO case_stage_history (case_id, to_stage_idx, to_stage, transitioned_by, note)
		VALUES ($1, $2, $3, $4, 'Case created')
	`, c.CaseID, c.CurrentStageIdx, c.CurrentStage, c.AssignedTo)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// UpdateCase updates mutable fields on an existing case, scoped to tenant.
func (s *Store) UpdateCase(tenantID, caseID string, req models.UpdateCaseRequest) error {
	sets := []string{"updated_at = NOW()"}
	args := []any{}
	idx := 1

	if req.Priority != nil {
		sets = append(sets, fmt.Sprintf("priority = $%d", idx))
		args = append(args, *req.Priority)
		idx++
	}
	if req.SLAStatus != nil {
		sets = append(sets, fmt.Sprintf("sla_status = $%d", idx))
		args = append(args, *req.SLAStatus)
		idx++
	}
	if req.AssignedTo != nil {
		sets = append(sets, fmt.Sprintf("assigned_to = $%d", idx))
		args = append(args, *req.AssignedTo)
		idx++
	}
	if req.Status != nil {
		sets = append(sets, fmt.Sprintf("status = $%d", idx))
		args = append(args, *req.Status)
		idx++
	}

	if len(args) == 0 {
		return nil // nothing to update
	}

	query := fmt.Sprintf(
		"UPDATE retirement_case SET %s WHERE case_id = $%d AND tenant_id = $%d",
		strings.Join(sets, ", "), idx, idx+1,
	)
	args = append(args, caseID, tenantID)

	_, err := s.DB.Exec(query, args...)
	return err
}

// AdvanceStage moves a case to the next stage and records the transition, scoped to tenant.
func (s *Store) AdvanceStage(tenantID, caseID string, transitionedBy, note string) (*models.RetirementCase, error) {
	tx, err := s.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Get current stage (tenant-scoped lock)
	var currentIdx int
	err = tx.QueryRow(
		`SELECT current_stage_idx FROM retirement_case WHERE case_id = $1 AND tenant_id = $2 FOR UPDATE`,
		caseID, tenantID,
	).Scan(&currentIdx)
	if err != nil {
		return nil, err
	}

	nextIdx := currentIdx + 1

	// Look up the next stage name
	var nextStage string
	err = tx.QueryRow(
		`SELECT stage_name FROM case_stage_definition WHERE stage_idx = $1`,
		nextIdx,
	).Scan(&nextStage)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("case is already at the final stage")
		}
		return nil, err
	}

	// Get current stage name for history
	var currentStage string
	_ = tx.QueryRow(
		`SELECT stage_name FROM case_stage_definition WHERE stage_idx = $1`,
		currentIdx,
	).Scan(&currentStage)

	// Update the case
	_, err = tx.Exec(`
		UPDATE retirement_case
		SET current_stage_idx = $1, current_stage = $2, updated_at = NOW()
		WHERE case_id = $3
	`, nextIdx, nextStage, caseID)
	if err != nil {
		return nil, err
	}

	// Record history
	_, err = tx.Exec(`
		INSERT INTO case_stage_history (case_id, from_stage_idx, to_stage_idx, from_stage, to_stage, transitioned_by, note)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, caseID, currentIdx, nextIdx, currentStage, nextStage, transitionedBy, note)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Return refreshed case
	return s.GetCase(tenantID, caseID)
}

// GetCaseFlags returns flag codes for a case.
func (s *Store) GetCaseFlags(caseID string) ([]string, error) {
	rows, err := s.DB.Query(
		`SELECT flag_code FROM case_flag WHERE case_id = $1 ORDER BY flag_code`,
		caseID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var flags []string
	for rows.Next() {
		var flag string
		if err := rows.Scan(&flag); err != nil {
			return nil, err
		}
		flags = append(flags, flag)
	}
	return flags, rows.Err()
}

// GetStageHistory returns the transition history for a case, scoped to tenant.
func (s *Store) GetStageHistory(tenantID, caseID string) ([]models.StageTransition, error) {
	rows, err := s.DB.Query(`
		SELECT csh.id, csh.case_id, csh.from_stage_idx, csh.to_stage_idx, csh.from_stage, csh.to_stage,
			   COALESCE(csh.transitioned_by, ''), COALESCE(csh.note, ''), csh.transitioned_at
		FROM case_stage_history csh
		WHERE csh.case_id = $1
		  AND EXISTS (SELECT 1 FROM retirement_case rc WHERE rc.case_id = $1 AND rc.tenant_id = $2)
		ORDER BY csh.transitioned_at DESC
	`, caseID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []models.StageTransition
	for rows.Next() {
		var t models.StageTransition
		if err := rows.Scan(
			&t.ID, &t.CaseID, &t.FromStageIdx, &t.ToStageIdx,
			&t.FromStage, &t.ToStage, &t.TransitionedBy, &t.Note, &t.TransitionedAt,
		); err != nil {
			return nil, err
		}
		history = append(history, t)
	}
	return history, rows.Err()
}
