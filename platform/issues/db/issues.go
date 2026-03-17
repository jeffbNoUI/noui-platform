package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/issues/models"
)

// issueColumns is the shared SELECT list for issue queries.
const issueColumns = `
	i.id, i.issue_id, i.tenant_id, i.title, i.description,
	i.severity, i.category, i.status, i.affected_service,
	i.reported_by, i.assigned_to, i.reported_at, i.resolved_at,
	i.resolution_note, i.created_at, i.updated_at
`

// scanIssue scans a single issue row into an Issue.
func scanIssue(scanner interface{ Scan(dest ...any) error }) (*models.Issue, error) {
	var iss models.Issue
	var assignedTo sql.NullString
	var resolvedAt sql.NullTime
	var resolutionNote sql.NullString

	err := scanner.Scan(
		&iss.ID, &iss.IssueID, &iss.TenantID, &iss.Title, &iss.Description,
		&iss.Severity, &iss.Category, &iss.Status, &iss.AffectedService,
		&iss.ReportedBy, &assignedTo, &iss.ReportedAt, &resolvedAt,
		&resolutionNote, &iss.CreatedAt, &iss.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if assignedTo.Valid {
		iss.AssignedTo = &assignedTo.String
	}
	if resolvedAt.Valid {
		iss.ResolvedAt = &resolvedAt.Time
	}
	if resolutionNote.Valid {
		iss.ResolutionNote = &resolutionNote.String
	}

	return &iss, nil
}

// ListIssues returns issues matching the filter, scoped to a tenant.
func (s *Store) ListIssues(ctx context.Context, tenantID string, f models.IssueFilter) ([]models.Issue, int, error) {
	where := []string{"i.tenant_id = $1"}
	args := []any{tenantID}
	idx := 2

	if f.Status != "" {
		where = append(where, fmt.Sprintf("i.status = $%d", idx))
		args = append(args, f.Status)
		idx++
	}
	if f.Severity != "" {
		where = append(where, fmt.Sprintf("i.severity = $%d", idx))
		args = append(args, f.Severity)
		idx++
	}
	if f.Category != "" {
		where = append(where, fmt.Sprintf("i.category = $%d", idx))
		args = append(args, f.Category)
		idx++
	}
	if f.AssignedTo != "" {
		where = append(where, fmt.Sprintf("i.assigned_to = $%d", idx))
		args = append(args, f.AssignedTo)
		idx++
	}

	whereClause := "WHERE " + strings.Join(where, " AND ")

	// Count total
	var total int
	countQ := "SELECT COUNT(*) FROM issues i " + whereClause
	if err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, countQ, args...).Scan(&total); err != nil {
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
		"SELECT %s FROM issues i %s ORDER BY i.updated_at DESC LIMIT $%d OFFSET $%d",
		issueColumns, whereClause, idx, idx+1,
	)
	args = append(args, limit, offset)

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var issues []models.Issue
	for rows.Next() {
		iss, err := scanIssue(rows)
		if err != nil {
			return nil, 0, err
		}
		issues = append(issues, *iss)
	}

	return issues, total, rows.Err()
}

// GetIssueByID returns a single issue by integer ID, scoped to the given tenant.
func (s *Store) GetIssueByID(ctx context.Context, tenantID string, id int) (*models.Issue, error) {
	query := fmt.Sprintf("SELECT %s FROM issues i WHERE i.id = $1 AND i.tenant_id = $2", issueColumns)
	return scanIssue(dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, id, tenantID))
}

// CreateIssue inserts a new issue and returns the created issue with generated ID and issue_id.
func (s *Store) CreateIssue(ctx context.Context, tenantID string, req models.CreateIssueRequest) (*models.Issue, error) {
	severity := req.Severity
	if severity == "" {
		severity = "medium"
	}
	category := req.Category
	if category == "" {
		category = "defect"
	}

	now := time.Now().UTC()

	tx, err := s.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Insert issue with placeholder issue_id
	var id int
	err = tx.QueryRow(`
		INSERT INTO issues (
			issue_id, tenant_id, title, description, severity, category,
			status, affected_service, reported_by, assigned_to,
			reported_at, created_at, updated_at
		) VALUES ('placeholder', $1, $2, $3, $4, $5, 'open', $6, $7, $8, $9, $9, $9)
		RETURNING id
	`,
		tenantID, req.Title, req.Description, severity, category,
		req.AffectedService, req.ReportedBy, sql.NullString{String: req.AssignedTo, Valid: req.AssignedTo != ""},
		now,
	).Scan(&id)
	if err != nil {
		return nil, err
	}

	// Update issue_id to formatted value
	issueID := fmt.Sprintf("ISS-%03d", id)
	_, err = tx.Exec(`UPDATE issues SET issue_id = $1 WHERE id = $2`, issueID, id)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Re-fetch the complete issue
	return s.GetIssueByID(ctx, tenantID, id)
}

// UpdateIssue updates mutable fields on an existing issue, scoped to tenant.
func (s *Store) UpdateIssue(ctx context.Context, tenantID string, id int, req models.UpdateIssueRequest) error {
	sets := []string{"updated_at = NOW()"}
	args := []any{}
	idx := 1

	if req.Title != nil {
		sets = append(sets, fmt.Sprintf("title = $%d", idx))
		args = append(args, *req.Title)
		idx++
	}
	if req.Description != nil {
		sets = append(sets, fmt.Sprintf("description = $%d", idx))
		args = append(args, *req.Description)
		idx++
	}
	if req.Severity != nil {
		sets = append(sets, fmt.Sprintf("severity = $%d", idx))
		args = append(args, *req.Severity)
		idx++
	}
	if req.Category != nil {
		sets = append(sets, fmt.Sprintf("category = $%d", idx))
		args = append(args, *req.Category)
		idx++
	}
	if req.Status != nil {
		sets = append(sets, fmt.Sprintf("status = $%d", idx))
		args = append(args, *req.Status)
		idx++
		// If transitioning to resolved/closed, set resolved_at
		if *req.Status == "resolved" || *req.Status == "closed" {
			sets = append(sets, fmt.Sprintf("resolved_at = COALESCE(resolved_at, NOW())"))
		}
	}
	if req.AffectedService != nil {
		sets = append(sets, fmt.Sprintf("affected_service = $%d", idx))
		args = append(args, *req.AffectedService)
		idx++
	}
	if req.AssignedTo != nil {
		sets = append(sets, fmt.Sprintf("assigned_to = $%d", idx))
		args = append(args, *req.AssignedTo)
		idx++
	}
	if req.ResolutionNote != nil {
		sets = append(sets, fmt.Sprintf("resolution_note = $%d", idx))
		args = append(args, *req.ResolutionNote)
		idx++
	}

	if len(args) == 0 {
		return nil // nothing to update
	}

	query := fmt.Sprintf(
		"UPDATE issues SET %s WHERE id = $%d AND tenant_id = $%d",
		strings.Join(sets, ", "), idx, idx+1,
	)
	args = append(args, id, tenantID)

	_, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, query, args...)
	return err
}
