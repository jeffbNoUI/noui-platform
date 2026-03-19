package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/noui/platform/casemanagement/models"
	"github.com/noui/platform/dbcontext"
)

// ListCasesByEmployer returns cases linked to an employer org via
// the CRM bridge (crm_org_contact → crm_contact → member_master).
func (s *Store) ListCasesByEmployer(ctx context.Context, tenantID, orgID string, limit, offset int) ([]models.RetirementCase, int, error) {
	// Count total
	var total int
	countQuery := `
		SELECT COUNT(*)
		FROM retirement_case rc
		JOIN member_master m ON rc.member_id = m.member_id
		JOIN crm_contact cc ON cc.legacy_mbr_id = CAST(m.member_id AS TEXT)
			AND cc.contact_type = 'member'
		JOIN crm_org_contact coc ON coc.contact_id = cc.contact_id
		WHERE rc.tenant_id = $1 AND coc.org_id = $2`

	if err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, countQuery, tenantID, orgID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting employer cases: %w", err)
	}

	// Fetch page
	query := fmt.Sprintf(`
		SELECT %s
		FROM retirement_case rc
		LEFT JOIN member_master m ON rc.member_id = m.member_id
		LEFT JOIN department_ref d ON m.dept_cd = d.dept_cd
		JOIN crm_contact cc ON cc.legacy_mbr_id = CAST(m.member_id AS TEXT)
			AND cc.contact_type = 'member'
		JOIN crm_org_contact coc ON coc.contact_id = cc.contact_id
		WHERE rc.tenant_id = $1 AND coc.org_id = $2
		ORDER BY rc.updated_at DESC
		LIMIT $3 OFFSET $4`, caseColumns)

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, tenantID, orgID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("listing employer cases: %w", err)
	}
	defer rows.Close()

	var cases []models.RetirementCase
	for rows.Next() {
		c, err := scanCase(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning employer case: %w", err)
		}
		cases = append(cases, *c)
	}

	// Load flags for each case
	for i := range cases {
		flags, err := s.GetCaseFlags(ctx, cases[i].CaseID)
		if err != nil {
			return nil, 0, err
		}
		cases[i].Flags = flags
	}

	return cases, total, rows.Err()
}

// GetEmployerCaseSummary returns aggregate case counts for an employer org.
func (s *Store) GetEmployerCaseSummary(ctx context.Context, tenantID, orgID string) (*models.EmployerCaseSummary, error) {
	query := `
		SELECT
			COUNT(*) AS total_cases,
			COUNT(*) FILTER (WHERE rc.status = 'active') AS active_cases,
			COUNT(*) FILTER (WHERE rc.status = 'completed') AS completed_cases,
			COUNT(*) FILTER (WHERE rc.sla_status = 'at-risk' OR rc.sla_status = 'overdue') AS at_risk_cases
		FROM retirement_case rc
		JOIN member_master m ON rc.member_id = m.member_id
		JOIN crm_contact cc ON cc.legacy_mbr_id = CAST(m.member_id AS TEXT)
			AND cc.contact_type = 'member'
		JOIN crm_org_contact coc ON coc.contact_id = cc.contact_id
		WHERE rc.tenant_id = $1 AND coc.org_id = $2`

	var summary models.EmployerCaseSummary
	summary.OrgID = orgID

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, tenantID, orgID).Scan(
		&summary.TotalCases, &summary.ActiveCases, &summary.CompletedCases, &summary.AtRiskCases,
	)
	if err != nil {
		return nil, fmt.Errorf("getting employer case summary: %w", err)
	}

	return &summary, nil
}

// GetCaseByTriggerRef checks if a case already exists for a given trigger reference.
// Used for idempotency — prevents duplicate case creation from the same employer event.
func (s *Store) GetCaseByTriggerRef(ctx context.Context, tenantID, triggerRef string) (*models.RetirementCase, error) {
	query := fmt.Sprintf("SELECT %s %s WHERE rc.case_id = $1 AND rc.tenant_id = $2", caseColumns, caseFrom)
	c, err := scanCase(dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, triggerRef, tenantID))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // not found — safe to create
		}
		return nil, fmt.Errorf("checking trigger ref: %w", err)
	}

	flags, err := s.GetCaseFlags(ctx, c.CaseID)
	if err != nil {
		return nil, err
	}
	c.Flags = flags

	return c, nil
}
